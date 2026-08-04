import { dbEngine } from '../database/sqlite.js';
import { configService } from './configService.js';
import { userRepository } from '../repositories/userRepository.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { orderItemRepository } from '../repositories/orderItemRepository.js';
import { orderMetadataRepository } from '../repositories/orderMetadataRepository.js';
import { orderTimelineService } from './orderTimelineService.js';
import { activityLogService } from './activityLogService.js';
import { syncService } from './syncService.js';
import { orderCacheService } from './orderCacheService.js';
import { kitchenQueueService } from './kitchenQueueService.js';
import { kitchenStatusService } from './kitchenStatusService.js';
import { kitchenNotesService } from './kitchenNotesService.js';
import { KitchenState, OrderLifecycleState, AllowedLifecycleTransitions } from '../constants/orderStates.js';

class KitchenService {
  _getUser(userId) {
    if (!userId) return null;
    return userRepository.findById(userId);
  }

  _isKitchenOperator(userId) {
    const user = this._getUser(userId);
    if (!user) return false;
    const role = String(user.role_name || '').toUpperCase();
    return ['KITCHEN', 'MANAGER', 'ADMIN', 'SUPER ADMIN'].includes(role);
  }

  _isManagerOrAbove(userId) {
    const user = this._getUser(userId);
    if (!user) return false;
    const role = String(user.role_name || '').toUpperCase();
    return ['MANAGER', 'ADMIN', 'SUPER ADMIN'].includes(role);
  }

  _shouldAutoRelease(order) {
    const config = configService.getKitchenConfig() || configService.getOrderConfig() || {};
    const releaseMode = String(config.kitchen_release_mode || 'PAYMENT').toUpperCase();

    if (releaseMode === 'CONFIRMATION') {
      return [OrderLifecycleState.ACTIVE].includes(order.lifecycle_state);
    }

    return order.payment_state === 'PAID';
  }

  _loadOrder(orderId) {
    const order = orderRepository.findById(orderId);
    if (!order) throw new Error('Order not found.');
    order.items = orderItemRepository.findItemsByOrderId(orderId);
    order.metadata = orderMetadataRepository.getAllMeta(orderId);
    return order;
  }

  _loadItem(itemId) {
    const item = orderItemRepository.findItemById(itemId);
    if (!item) throw new Error('Kitchen item not found.');
    const order = this._loadOrder(item.order_id);
    return { order, item };
  }

  onOrderLifecycleChange(order, { fromLifecycle, toLifecycle, userId, context } = {}) {
    if (!order) return null;

    const shouldRelease = this._shouldAutoRelease(order);
    const receivedAt = orderMetadataRepository.getMeta(order.id, 'kitchen_received_at');

    if (shouldRelease && !receivedAt) {
      orderMetadataRepository.setMeta(order.id, 'kitchen_received_at', new Date().toISOString());
      orderMetadataRepository.setMeta(order.id, 'kitchen_release_mode', String((configService.getKitchenConfig() || configService.getOrderConfig() || {}).kitchen_release_mode || 'PAYMENT').toUpperCase());

      orderTimelineService.recordEvent(order.id, userId || order.cashier_user_id || 'SYSTEM', 'KITCHEN_RECEIVED', {
        from_state: fromLifecycle || order.lifecycle_state,
        to_state: toLifecycle || order.lifecycle_state,
        description: `Order ${order.order_number} received by kitchen`,
        metadata: {
          order_id: order.id,
          branch_id: order.branch_id,
          lifecycle_state: order.lifecycle_state,
          payment_state: order.payment_state,
          reason: context?.reason || null
        }
      });

      activityLogService.logActivity(userId || order.cashier_user_id || 'SYSTEM', 'KITCHEN_RECEIVED', 'KITCHEN', order.id, {
        order_number: order.order_number,
        branch_id: order.branch_id,
        lifecycle_state: order.lifecycle_state,
        payment_state: order.payment_state
      });

      syncService.queueSyncEvent('ORDER', order.id, 'KITCHEN_RECEIVED', {
        order_number: order.order_number,
        branch_id: order.branch_id
      });
    }

    kitchenQueueService.invalidate(order.id);
    orderCacheService.upsertOrder(order);
    return order;
  }

  getQueue(filters = {}) {
    return kitchenQueueService.getQueue(filters);
  }

  getTicket(orderId, filters = {}) {
    return kitchenQueueService.getTicket(orderId, filters);
  }

  getDashboardMetrics(branchId = null) {
    const queue = this.getQueue({ branchId, limit: 1000 });
    return {
      kitchenQueue: queue.summary.pending + queue.summary.preparing + queue.summary.ready + queue.summary.served,
      preparing: queue.summary.preparing,
      ready: queue.summary.ready,
      served: queue.summary.served,
      overdue: queue.summary.overdue,
      averagePreparationTime: queue.summary.averagePreparationTime,
      tickets: queue.total
    };
  }

  _reconcileOrder(orderId, userId, reason = 'Kitchen workflow update') {
    const order = this._loadOrder(orderId);
    const aggregateState = kitchenStatusService.getAggregateKitchenState(order.items);
    const lifecycleTarget = kitchenStatusService.getAggregateLifecycleState(order, order.items);

    const updates = {
      kitchen_state: aggregateState,
      updated_at: new Date().toISOString()
    };

    if (lifecycleTarget && lifecycleTarget !== order.lifecycle_state) {
      const allowed = AllowedLifecycleTransitions[order.lifecycle_state] || [];
      if (allowed.includes(lifecycleTarget)) {
        updates.lifecycle_state = lifecycleTarget;
        if (lifecycleTarget === OrderLifecycleState.COMPLETED) {
          updates.completed_at = new Date().toISOString();
        }
      }
    }

    const updatedOrder = orderRepository.update(orderId, updates);
    orderCacheService.upsertOrder(updatedOrder);
    kitchenQueueService.invalidate(orderId);

    const eventTypeMap = {
      [KitchenState.PENDING]: 'KITCHEN_PENDING',
      [KitchenState.PREPARING]: 'KITCHEN_PREPARING',
      [KitchenState.READY]: 'KITCHEN_ORDER_READY',
      [KitchenState.SERVED]: 'KITCHEN_ORDER_SERVED',
      [KitchenState.COMPLETED]: 'KITCHEN_ORDER_COMPLETED',
      [KitchenState.CANCELLED]: 'KITCHEN_ORDER_CANCELLED'
    };

    const activityMap = {
      [KitchenState.PENDING]: 'KITCHEN_PENDING',
      [KitchenState.PREPARING]: 'PREPARATION_STARTED',
      [KitchenState.READY]: 'ORDER_READY',
      [KitchenState.SERVED]: 'ORDER_SERVED',
      [KitchenState.COMPLETED]: 'ORDER_COMPLETED',
      [KitchenState.CANCELLED]: 'ORDER_CANCELLED'
    };

    orderTimelineService.recordEvent(orderId, userId, eventTypeMap[aggregateState] || 'KITCHEN_STATUS_UPDATED', {
      from_state: order.kitchen_state,
      to_state: aggregateState,
      description: `Kitchen workflow updated for order ${order.order_number}`,
      metadata: {
        reason,
        aggregate_state: aggregateState,
        order_state: updatedOrder.lifecycle_state
      }
    });

    activityLogService.logActivity(userId, activityMap[aggregateState] || 'KITCHEN_STATUS_UPDATED', 'KITCHEN', orderId, {
      order_number: order.order_number,
      from: order.kitchen_state,
      to: aggregateState,
      lifecycle_state: updatedOrder.lifecycle_state
    });

    syncService.queueSyncEvent('ORDER', orderId, 'KITCHEN_STATUS_UPDATED', {
      order_number: order.order_number,
      kitchen_state: aggregateState,
      lifecycle_state: updatedOrder.lifecycle_state
    });

    return updatedOrder;
  }

  _updateItemState(itemId, userId, targetState, options = {}) {
    return dbEngine.transaction(() => {
      const { order, item } = this._loadItem(itemId);

      if (!this._isKitchenOperator(userId) && !options.force) {
        throw new Error('Permission denied for kitchen status update.');
      }

      if (targetState === KitchenState.CANCELLED && !this._isManagerOrAbove(userId) && !options.force) {
        throw new Error('Permission denied to cancel kitchen item.');
      }

      if (!kitchenStatusService.canTransition(item.kitchen_state, targetState)) {
        throw new Error(`Invalid kitchen transition from ${item.kitchen_state} to ${targetState}.`);
      }

      if (options.force) {
        activityLogService.logActivity(userId, 'PERMISSION_OVERRIDE', 'KITCHEN', order.id, {
          order_number: order.order_number,
          item_id: itemId,
          from_state: item.kitchen_state,
          requested_state: targetState
        });
      }

      const updates = {
        kitchen_state: targetState,
        updated_at: new Date().toISOString()
      };

      if (targetState === KitchenState.PREPARING) {
        updates.kitchen_started_at = item.kitchen_started_at || new Date().toISOString();
      }
      if (targetState === KitchenState.READY) {
        updates.kitchen_ready_at = new Date().toISOString();
      }
      if (targetState === KitchenState.SERVED) {
        updates.kitchen_served_at = new Date().toISOString();
      }
      if (targetState === KitchenState.COMPLETED) {
        updates.kitchen_completed_at = new Date().toISOString();
      }
      if (targetState === KitchenState.CANCELLED) {
        updates.kitchen_cancelled_at = new Date().toISOString();
      }

      orderItemRepository.updateItem(itemId, updates);

      orderTimelineService.recordEvent(order.id, userId, `KITCHEN_ITEM_${targetState}`, {
        from_state: item.kitchen_state,
        to_state: targetState,
        description: `${item.product_name_snapshot} moved to ${targetState}`,
        metadata: {
          item_id: itemId,
          product_id: item.product_id,
          order_id: order.id
        }
      });

      activityLogService.logActivity(userId, `KITCHEN_ITEM_${targetState}`, 'KITCHEN', order.id, {
        item_id: itemId,
        order_number: order.order_number,
        product_name: item.product_name_snapshot,
        station_id: item.kitchen_station_id
      });

      syncService.queueSyncEvent('ORDER', order.id, `KITCHEN_ITEM_${targetState}`, {
        item_id: itemId,
        order_number: order.order_number,
        kitchen_state: targetState
      });

      return this._reconcileOrder(order.id, userId, `item_${targetState.toLowerCase()}`);
    });
  }

  startPreparingItem(itemId, userId, options = {}) {
    return this._updateItemState(itemId, userId, KitchenState.PREPARING, options);
  }

  markItemReady(itemId, userId, options = {}) {
    return this._updateItemState(itemId, userId, KitchenState.READY, options);
  }

  markItemServed(itemId, userId, options = {}) {
    return this._updateItemState(itemId, userId, KitchenState.SERVED, options);
  }

  completeItem(itemId, userId, options = {}) {
    return this._updateItemState(itemId, userId, KitchenState.COMPLETED, options);
  }

  cancelItem(itemId, userId, options = {}) {
    return this._updateItemState(itemId, userId, KitchenState.CANCELLED, options);
  }

  returnItemToPreparing(itemId, userId, options = {}) {
    if (!this._isManagerOrAbove(userId) && !options.force) {
      throw new Error('Permission denied to return item to preparing.');
    }
    return this._updateItemState(itemId, userId, KitchenState.PREPARING, { ...options, force: true });
  }

  addOrderKitchenNote(orderId, userId, note) {
    return dbEngine.transaction(() => {
      if (!this._isKitchenOperator(userId)) {
        throw new Error('Permission denied for kitchen note updates.');
      }

      kitchenNotesService.updateOrderKitchenNotes(orderId, note);
      const order = this._loadOrder(orderId);

      orderTimelineService.recordEvent(orderId, userId, 'KITCHEN_NOTE_UPDATED', {
        description: `Kitchen note updated for order ${order.order_number}`,
        metadata: { note }
      });

      activityLogService.logActivity(userId, 'KITCHEN_NOTE_UPDATED', 'KITCHEN', orderId, {
        order_number: order.order_number,
        note
      });

      syncService.queueSyncEvent('ORDER', orderId, 'KITCHEN_NOTE_UPDATED', { note });
      kitchenQueueService.invalidate(orderId);
      return this.getTicket(orderId) || this._loadOrder(orderId);
    });
  }

  addItemKitchenNote(itemId, userId, note) {
    return dbEngine.transaction(() => {
      if (!this._isKitchenOperator(userId)) {
        throw new Error('Permission denied for kitchen note updates.');
      }

      const { order, item } = this._loadItem(itemId);
      kitchenNotesService.updateItemNotes(itemId, note);

      orderTimelineService.recordEvent(order.id, userId, 'KITCHEN_NOTE_UPDATED', {
        description: `Kitchen note updated for item ${item.product_name_snapshot}`,
        metadata: { item_id: itemId, note }
      });

      activityLogService.logActivity(userId, 'KITCHEN_NOTE_UPDATED', 'KITCHEN', order.id, {
        order_number: order.order_number,
        item_id: itemId,
        note
      });

      syncService.queueSyncEvent('ORDER', order.id, 'KITCHEN_NOTE_UPDATED', {
        item_id: itemId,
        note
      });

      kitchenQueueService.invalidate(order.id);
      return this.getTicket(order.id) || this._loadOrder(order.id);
    });
  }

  setPriority(orderId, userId, priority) {
    return dbEngine.transaction(() => {
      if (!this._isManagerOrAbove(userId)) {
        throw new Error('Permission denied to change kitchen priority.');
      }

      const normalizedPriority = String(priority || 'NORMAL').toUpperCase();
      kitchenNotesService.updateOrderPriority(orderId, normalizedPriority);
      const order = this._loadOrder(orderId);

      orderTimelineService.recordEvent(orderId, userId, 'KITCHEN_PRIORITY_UPDATED', {
        description: `Priority updated to ${normalizedPriority} for order ${order.order_number}`,
        metadata: { priority: normalizedPriority }
      });

      activityLogService.logActivity(userId, 'KITCHEN_PRIORITY_UPDATED', 'KITCHEN', orderId, {
        order_number: order.order_number,
        priority: normalizedPriority
      });

      syncService.queueSyncEvent('ORDER', orderId, 'KITCHEN_PRIORITY_UPDATED', { priority: normalizedPriority });
      kitchenQueueService.invalidate(orderId);
      return this.getTicket(orderId) || this._loadOrder(orderId);
    });
  }
}

export const kitchenService = new KitchenService();
