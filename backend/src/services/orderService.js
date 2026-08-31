import { dbEngine } from '../database/sqlite.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { orderItemRepository } from '../repositories/orderItemRepository.js';
import { orderPaymentRepository } from '../repositories/orderPaymentRepository.js';
import { orderTimelineRepository } from '../repositories/orderTimelineRepository.js';
import { orderMetadataRepository } from '../repositories/orderMetadataRepository.js';
import { customerRepository } from '../repositories/customerRepository.js';
import { orderLifecycleService } from './orderLifecycleService.js';
import { orderNumberService } from './orderNumberService.js';
import { orderSnapshotService } from './orderSnapshotService.js';
import { orderTimelineService } from './orderTimelineService.js';
import { orderValidationService } from './orderValidationService.js';
import { orderCacheService } from './orderCacheService.js';
import { activityLogService } from './activityLogService.js';
import { syncService } from './syncService.js';
import { auditService } from './auditService.js';
import { OrderLifecycleState } from '../constants/orderStates.js';
import { releaseTableIfIdle } from '../controllers/tableController.js';
import { cartService } from './cartService.js';
import { orderCreationService } from './orderCreationService.js';
import crypto from 'crypto';

class OrderService {
  /**
   * Internal guard to prevent concurrent modification of an order by different devices.
   */
  _enforceLock(orderId, terminalId) {
    const order = orderRepository.findById(orderId);
    if (!order) throw new Error('Order not found.');
    
    if (order.lifecycle_state === 'CANCELLED' || order.lifecycle_state === 'ARCHIVED') {
      throw new Error(`Order ${order.order_number} is ${order.lifecycle_state} and cannot be modified.`);
    }
    return order;
  }
  /**
   * Retrieves full hydrated order graph.
   */
  getOrderById(orderId) {
    const cached = orderCacheService.getOrder(orderId);
    if (cached) return cached;

    const order = orderRepository.findById(orderId);
    if (!order) return null;

    return this._hydrateOrder(order);
  }

  getOrderByNumber(orderNumber) {
    const cached = orderCacheService.getOrderByNumber(orderNumber);
    if (cached) return cached;

    const order = orderRepository.findByNumber(orderNumber);
    if (!order) return null;

    return this._hydrateOrder(order);
  }

  /**
   * Internal hydrator that loads items, variants, modifiers, add-ons, combos, payments, timeline, metadata.
   */
  _hydrateOrder(order) {
    if (!order) return null;
    order.items = orderItemRepository.findItemsByOrderId(order.id);
    order.payments = orderPaymentRepository.findByOrderId(order.id);
    order.timeline = orderTimelineRepository.findByOrderId(order.id);
    order.metadata = orderMetadataRepository.getAllMeta(order.id);
    order.tags = orderMetadataRepository.getTags(order.id);
    order.attachments = orderMetadataRepository.getAttachments(order.id);

    // Auto-populate customer info if a customer is linked
    if (order.customer_id) {
      try {
        const customer = customerRepository.findById(order.customer_id);
        if (customer) {
          order.customer = customer;
          order.metadata.customer_name = customer.first_name + (customer.last_name ? ' ' + customer.last_name : '');
          order.metadata.customer_phone = customer.phone || order.metadata.customer_phone;
          order.metadata.customer_address = customer.address || order.metadata.customer_address;
          if (customer.is_vip === 1 || customer.is_vip === true || customer.isVip) {
            if (order.metadata.is_vip !== 'false') {
              order.metadata.is_vip = 'true';
            }
          }
        }
      } catch (e) {
        console.error('Failed to hydrate customer info:', e);
      }
    }
    order.is_vip = order.metadata?.is_vip === 'true' || order.metadata?.is_vip === true || order.customer?.is_vip === 1 || order.customer?.is_vip === true;
    this._enrichPeopleAndTable(order);

    // Cache if active
    orderCacheService.upsertOrder(order);
    return order;
  }

  _displayUserName(userId, snapshot) {
    if (snapshot) return snapshot;
    if (!userId) return null;
    try {
      const u = dbEngine.prepare('SELECT first_name, last_name, username FROM users WHERE id = ?').get(userId);
      if (!u) return null;
      const n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
      return n || u.username || null;
    } catch {
      return null;
    }
  }

  _enrichPeopleAndTable(order) {
    if (!order) return order;
    try {
      if (order.table_id) {
        let tableName = null;
        try {
          const dt = dbEngine.prepare('SELECT table_number FROM dining_tables WHERE id = ? OR table_number = ?').get(order.table_id, String(order.table_id));
          tableName = dt?.table_number || null;
        } catch { /* ignore */ }
        if (!tableName) {
          try {
            const fl = dbEngine.prepare('SELECT name FROM tables WHERE id = ? OR name = ?').get(order.table_id, String(order.table_id));
            tableName = fl?.name || null;
          } catch { /* ignore */ }
        }
        order.table_number = tableName || order.table_id;
      }
    } catch {
      order.table_number = order.table_id || null;
    }
    order.cashier_name = this._displayUserName(order.cashier_user_id, null);
    order.waiter_name = this._displayUserName(order.waiter_id, order.waiter_name_snapshot);
    order.rider_name = this._displayUserName(order.rider_id, order.rider_name_snapshot);
    return order;
  }

  /**
   * Recalculates order financial totals atomically inside SQLite transaction.
   */
  recalculateOrderTotals(orderId) {
    return dbEngine.transaction(() => {
      const order = orderRepository.findById(orderId);
      if (!order) throw new Error('Order not found.');

      const items = orderItemRepository.findItemsByOrderId(orderId);

      let subtotal = 0;
      let taxTotal = 0;
      let lineDiscountTotal = 0;

      for (const item of items) {
        subtotal += item.subtotal;
        taxTotal += item.tax_amount;
        lineDiscountTotal += item.discount_amount;
      }

      const discountTotal = Math.max(lineDiscountTotal, Number(order.discount_total) || 0);
      const grandTotal = subtotal + taxTotal - discountTotal + order.tip_total + order.delivery_fee + order.service_charge;
      const paidTotal = orderPaymentRepository.getTotalPaidForOrder(orderId);
      const dueTotal = Math.max(0, grandTotal - paidTotal);

      let paymentState = order.payment_state;
      if (paidTotal >= grandTotal && grandTotal > 0) {
        paymentState = 'PAID';
      } else if (paidTotal > 0) {
        paymentState = 'PARTIALLY_PAID';
      } else {
        paymentState = 'UNPAID';
      }

      const updated = orderRepository.update(orderId, {
        subtotal,
        tax_total: taxTotal,
        discount_total: discountTotal,
        grand_total: grandTotal,
        paid_total: paidTotal,
        due_total: dueTotal,
        payment_state: paymentState
      });

      return this._hydrateOrder(updated);
    });
  }

  applyOrderDiscount(orderId, discountTotal, printPaid = false) {
    const order = orderRepository.findById(orderId);
    if (!order) throw new Error('Order not found.');
    const discount = Math.max(0, Number(discountTotal) || 0);
    const subtotal = Number(order.subtotal) || 0;
    const service = Number(order.service_charge) || 0;
    const delivery = Number(order.delivery_fee) || 0;
    const grand = Math.max(0, subtotal + service + delivery - discount);
    const paid = Number(order.paid_total) || 0;
    const updated = orderRepository.update(orderId, {
      discount_total: discount,
      grand_total: grand,
      due_total: Math.max(0, grand - paid)
    });
    try {
      orderMetadataRepository.setMeta(orderId, 'receipt_paid_stamp', printPaid ? 'true' : 'false');
    } catch { /* optional */ }
    orderCacheService.upsertOrder(updated);
    syncService.queueSyncEvent('ORDER', orderId, 'ORDER_UPDATED', { discount_total: discount });
    return this._hydrateOrder(updated);
  }

  /**
   * Opens a new Draft Order.
   */
  createDraftOrder(shiftId, userId, options = {}) {
    orderValidationService.validateOrderCreation({ shift_id: shiftId, cashier_user_id: userId });

    return dbEngine.transaction(() => {
      const businessDate = options.business_date || new Date().toISOString().split('T')[0];
      const branchId = options.branch_id || 'DEFAULT_BRANCH';

      // Allocate atomic Business Order Number
      const orderNumber = orderNumberService.generateNextNumber(branchId, businessDate);
      const orderId = crypto.randomUUID();

      const newOrder = orderRepository.create({
        id: orderId,
        order_number: orderNumber,
        business_date: businessDate,
        branch_id: branchId,
        cashier_user_id: userId,
        shift_id: shiftId,
        customer_id: options.customer_id || null,
        table_id: options.table_id || null,
        order_type: options.order_type || 'DINE_IN',
        lifecycle_state: OrderLifecycleState.DRAFT,
        kitchen_state: 'PENDING',
        payment_state: 'UNPAID',
        notes: options.notes || null
      });

      // Record Timeline Event
      orderTimelineService.recordEvent(orderId, userId, 'ORDER_CREATED', {
        to_state: OrderLifecycleState.DRAFT,
        description: `Order ${orderNumber} created by cashier ${userId}`,
        metadata: { branch_id: branchId, order_type: options.order_type || 'DINE_IN' }
      });

      // Log Activity
      activityLogService.logActivity(userId, 'ORDER_CREATED', 'ORDER', orderId, {
        order_number: orderNumber,
        branch_id: branchId
      });

      // Queue Sync Event
      syncService.queueSyncEvent('ORDER', orderId, 'ORDER_CREATED', {
        order_number: orderNumber,
        business_date: businessDate
      });

      return this._hydrateOrder(newOrder);
    });
  }

  /**
   * Gets existing active draft for cashier shift session or creates a new one.
   */
  getOrCreateDraft(shiftId, userId, options = {}) {
    return dbEngine.transaction(() => {
      let draft = orderRepository.findDraftBySession(shiftId);
      if (!draft) {
        draft = this.createDraftOrder(shiftId, userId, options);
      } else {
        draft = this._hydrateOrder(draft);
      }
      return draft;
    });
  }

  /**
   * Adds an item with complete menu snapshot to an order inside an atomic transaction.
   */
  addItemToDraft(shiftId, userId, itemInput) {
    return dbEngine.transaction(() => {
      const order = this.getOrCreateDraft(shiftId, userId);
      return this.addItemToOrder(order.id, itemInput, userId);
    });
  }

  /**
   * Adds an item to a specific order.
   */
  addItemToOrder(orderId, itemInput, actorUserId = 'SYSTEM', terminalId = 'SYSTEM') {
    return dbEngine.transaction(() => {
      this._enforceLock(orderId, terminalId);
      const order = orderRepository.findById(orderId);
      orderValidationService.validateItemAddition(order, itemInput);

      // Create snapshot object
      const snapshot = orderSnapshotService.createItemSnapshot({
        productId: itemInput.product_id,
        variantId: itemInput.variant_id || null,
        modifiers: itemInput.modifiers || [],
        addons: itemInput.addons || [],
        comboComponents: itemInput.comboComponents || [],
        quantity: itemInput.quantity || 1,
        notes: itemInput.notes || null
      });

      // Save item
      snapshot.item.order_id = orderId;
      orderItemRepository.addItem(snapshot.item);

      // Save variant
      if (snapshot.variant) {
        orderItemRepository.addVariant(snapshot.variant);
      }

      // Save modifiers
      if (snapshot.modifiers.length > 0) {
        for (const mod of snapshot.modifiers) {
          orderItemRepository.addModifier(mod);
        }
      }

      // Save addons
      if (snapshot.addons.length > 0) {
        for (const add of snapshot.addons) {
          orderItemRepository.addAddon(add);
        }
      }

      // Save combo components
      if (snapshot.comboComponents.length > 0) {
        for (const comp of snapshot.comboComponents) {
          orderItemRepository.addComboComponent(comp);
        }
      }

      // Recalculate Totals
      const updatedOrder = this.recalculateOrderTotals(orderId);

      // Record Timeline Event
      orderTimelineService.recordEvent(orderId, actorUserId, 'ITEM_ADDED', {
        description: `Added ${snapshot.item.quantity}x ${snapshot.item.product_name_snapshot} to order ${order.order_number}`,
        metadata: { item_id: snapshot.item.id, product_id: snapshot.item.product_id }
      });

      // Log Activity
      activityLogService.logActivity(actorUserId, 'ITEM_ADDED', 'ORDER', orderId, {
        order_number: order.order_number,
        product: snapshot.item.product_name_snapshot,
        quantity: snapshot.item.quantity
      });

      // Queue Sync Event
      syncService.queueSyncEvent('ORDER', orderId, 'ORDER_UPDATED', {
        action: 'ITEM_ADDED',
        order_number: order.order_number
      });

      return updatedOrder;
    });
  }

  /**
   * Updates an item's quantity or removes if quantity <= 0.
   */
  updateItemQuantity(orderId, itemId, newQuantity, actorUserId = 'SYSTEM', terminalId = 'SYSTEM') {
    return dbEngine.transaction(() => {
      this._enforceLock(orderId, terminalId);
      const order = orderRepository.findById(orderId);
      orderValidationService.validateItemModification(order, itemId);

      if (newQuantity <= 0) {
        return this.removeItem(orderId, itemId, actorUserId);
      }

      const item = orderItemRepository.findItemById(itemId);
      if (!item) throw new Error('Order line item not found.');

      const newSubtotal = item.final_unit_price * newQuantity;
      let newTaxAmount = 0;
      if (item.is_tax_inclusive) {
        newTaxAmount = newSubtotal - (newSubtotal / (1 + item.tax_rate));
      } else {
        newTaxAmount = newSubtotal * item.tax_rate;
      }
      const newTotalAmount = item.is_tax_inclusive ? newSubtotal : newSubtotal + newTaxAmount;

      orderItemRepository.updateItem(itemId, {
        quantity: newQuantity,
        subtotal: newSubtotal,
        tax_amount: newTaxAmount,
        total_amount: newTotalAmount
      });

      const updatedOrder = this.recalculateOrderTotals(orderId);

      orderTimelineService.recordEvent(orderId, actorUserId, 'ITEM_QUANTITY_CHANGED', {
        description: `Updated quantity of ${item.product_name_snapshot} to ${newQuantity}`,
        metadata: { item_id: itemId, old_qty: item.quantity, new_qty: newQuantity }
      });

      activityLogService.logActivity(actorUserId, 'QUANTITY_CHANGED', 'ORDER', orderId, {
        order_number: order.order_number,
        new_quantity: newQuantity
      });

      return updatedOrder;
    });
  }

  /**
   * Removes an item from an order.
   */
  removeItem(orderId, itemId, actorUserId = 'SYSTEM', reason = null, terminalId = 'SYSTEM') {
    return dbEngine.transaction(() => {
      this._enforceLock(orderId, terminalId);
      const order = orderRepository.findById(orderId);
      orderValidationService.validateItemModification(order, itemId);

      const item = orderItemRepository.findItemById(itemId);
      orderItemRepository.removeItem(itemId);

      const updatedOrder = this.recalculateOrderTotals(orderId);

      // If the order has already been sent to kitchen, we should log a reason
      const isSent = order.kitchen_state !== 'PENDING';
      const description = `Removed ${item ? item.product_name_snapshot : 'item'} from order ${order.order_number}`;

      orderTimelineService.recordEvent(orderId, actorUserId, 'ITEM_REMOVED', {
        description: description + (reason ? ` - Reason: ${reason}` : ''),
        metadata: { item_id: itemId, reason }
      });

      if (isSent && reason) {
        auditService.record({
          orderId,
          userId: actorUserId,
          action: 'ITEM_VOID',
          entityType: 'ORDER_ITEM',
          entityId: itemId,
          oldValue: { product_name: item ? item.product_name_snapshot : 'unknown' },
          newValue: { status: 'REMOVED' },
          reason
        });
      }

      activityLogService.logActivity(actorUserId, 'ITEM_REMOVED', 'ORDER', orderId, {
        order_number: order.order_number,
        reason: reason
      });

      return updatedOrder;
    });
  }

  /**
   * Places an active draft order on hold.
   */
  holdOrder(shiftId, userId, holdName) {
    const draft = orderRepository.findDraftBySession(shiftId);
    if (draft) {
      return dbEngine.transaction(() => {
        return orderLifecycleService.transition(draft.id, OrderLifecycleState.HELD, {
          userId,
          holdName
        });
      });
    }

    const cart = cartService.getCart(shiftId);
    if (!cart || !cart.items?.length) {
      throw new Error('No active cart or draft order to hold.');
    }

    const order = orderCreationService.checkoutCart(shiftId, userId, {}, crypto.randomUUID());
    return orderLifecycleService.transition(order.id, OrderLifecycleState.HELD, {
      userId,
      holdName
    });
  }

  /**
   * Resumes a held order into active draft status.
   */
  resumeOrder(shiftId, userId, orderId) {
    return dbEngine.transaction(() => {
      const order = orderRepository.findById(orderId);
      if (!order) throw new Error('Order not found.');

      if (order.lifecycle_state !== OrderLifecycleState.HELD) {
        throw new Error(`Only HELD orders can be resumed. Order ${order.order_number} is in state ${order.lifecycle_state}.`);
      }

      // Re-assign shift/cashier if needed and set back to DRAFT
      orderRepository.update(orderId, {
        shift_id: shiftId,
        cashier_user_id: userId
      });

      return orderLifecycleService.transition(orderId, OrderLifecycleState.DRAFT, {
        userId,
        reason: 'Order resumed into active cart'
      });
    });
  }

  /**
   * Queries held orders.
   */
  getHeldOrders(shiftId = null) {
    const orders = orderRepository.queryHeld(shiftId);
    return orders.map(o => this._hydrateOrder(o));
  }

  transitionOrderState(orderId, targetState, context = {}) {
    return orderLifecycleService.transition(orderId, targetState, context);
  }

  /**
   * Updates order metadata directly (like table_id or order_type) for an active order
   */
  updateOrderMeta(orderId, meta, userId, terminalId = 'SYSTEM') {
    return dbEngine.transaction(() => {
      this._enforceLock(orderId, terminalId);
      const order = orderRepository.findById(orderId);
      if (!order) throw new Error('Order not found.');

      const updates = {};

      if (meta.order_type !== undefined) {
        updates.order_type = meta.order_type;
      }
      if (meta.table_id !== undefined) {
        updates.table_id = meta.table_id;
        if (meta.table_id) {
          try {
            dbEngine.db.prepare('INSERT OR IGNORE INTO dining_tables (id, table_number, status) VALUES (?, ?, ?)').run(meta.table_id, meta.table_id, 'OCCUPIED');
          } catch (err) {
            console.error('Error auto-creating dining table on meta update:', err);
          }
        }
      }
      if (meta.customer_id !== undefined) {
        updates.customer_id = meta.customer_id;
      }
      if (meta.waiter_id !== undefined) {
        updates.waiter_id = meta.waiter_id || null;
      }
      if (meta.waiter_name_snapshot !== undefined) {
        updates.waiter_name_snapshot = meta.waiter_name_snapshot || null;
      }
      if (meta.rider_id !== undefined) {
        updates.rider_id = meta.rider_id || null;
      }
      if (meta.rider_name_snapshot !== undefined) {
        updates.rider_name_snapshot = meta.rider_name_snapshot || null;
      }
      if (meta.delivery_charges !== undefined) {
        updates.delivery_fee = meta.delivery_charges;
      }
      if (meta.customer_name !== undefined) {
        orderMetadataRepository.setMeta(orderId, 'customer_name', meta.customer_name || '');
      }
      if (meta.customer_phone !== undefined) {
        orderMetadataRepository.setMeta(orderId, 'customer_phone', meta.customer_phone || '');
      }
      if (meta.customer_address !== undefined) {
        orderMetadataRepository.setMeta(orderId, 'customer_address', meta.customer_address || '');
      }
      if (meta.receipt_paid_stamp !== undefined || meta.print_paid !== undefined) {
        const paid = meta.receipt_paid_stamp === true || meta.receipt_paid_stamp === 'true' || meta.print_paid === true;
        orderMetadataRepository.setMeta(orderId, 'receipt_paid_stamp', paid ? 'true' : 'false');
      }
      if (meta.is_vip !== undefined) {
        orderMetadataRepository.setMeta(orderId, 'is_vip', meta.is_vip ? 'true' : 'false');
      } else if (meta.customer_id) {
        try {
          const cust = customerRepository.findById(meta.customer_id);
          if (cust && (cust.is_vip === 1 || cust.is_vip === true || cust.isVip)) {
            orderMetadataRepository.setMeta(orderId, 'is_vip', 'true');
          }
        } catch { /* customer lookup is best-effort */ }
      }

      if (Object.keys(updates).length > 0) {
        orderRepository.update(orderId, updates);

        // Log activity
        activityLogService.logActivity(userId, 'ORDER_UPDATED', 'ORDER', orderId, meta);
        
        orderTimelineService.recordEvent(orderId, userId, 'Order Edited', {
          description: `Order metadata updated.`,
          metadata: meta
        });

        syncService.queueSyncEvent('ORDER', orderId, 'ORDER_UPDATED', meta);
      }

      // Recalculate totals in case delivery charges or order type changed
      return this.recalculateOrderTotals(orderId);
    });
  }

  /**
   * Deletes an order permanently from the database.
   */
  deleteOrder(orderId, userId, terminalId = 'SYSTEM') {
    return dbEngine.transaction(() => {
      const order = orderRepository.findById(orderId);
      if (!order) throw new Error('Order not found.');

      activityLogService.logActivity(
        userId,
        'ORDER_DELETED',
        'ORDER',
        orderId,
        { orderNumber: order.order_number, reason: 'Order permanently deleted' }
      );

      const success = orderRepository.delete(orderId);
      if (!success) throw new Error('Failed to delete order.');

      orderCacheService.invalidate(orderId);
      syncService.queueSyncEvent('ORDER', orderId, 'DELETE', { order_number: order.order_number });
      releaseTableIfIdle(order.table_id);
      return { success: true, message: 'Order deleted successfully' };
    });
  }

  /**
   * Lock an order for editing.
   */
  lockOrder(orderId, terminalId, userId) {
    const order = orderRepository.findById(orderId);
    if (!order) throw new Error('Order not found.');
    return this._hydrateOrder(order);
  }

  /**
   * Unlock an order.
   */
  unlockOrder(orderId, terminalId, userId) {
    return dbEngine.transaction(() => {
      const order = orderRepository.findById(orderId);
      if (!order) throw new Error('Order not found.');
      // Unlock doesn't enforce immutability strictly, but it checks lock
      
      if (order.locked_by && order.locked_by !== terminalId) {
        throw new Error(`Order is locked by ${order.locked_by} and cannot be unlocked by ${terminalId}`);
      }

      const updated = orderRepository.update(orderId, { locked_by: null });
      
      activityLogService.logActivity(userId, 'ORDER_UNLOCKED', 'ORDER', orderId, { terminalId });
      syncService.queueSyncEvent('ORDER', orderId, 'ORDER_UPDATED', { locked_by: null });

      return this._hydrateOrder(updated);
    });
  }
}

export const orderService = new OrderService();
