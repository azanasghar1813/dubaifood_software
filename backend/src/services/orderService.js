import { orderRepository } from '../repositories/orderRepository.js';
import { dbEngine } from '../database/sqlite.js';
import { pricingService } from './pricingService.js';
import { activityLogService } from './activityLogService.js';
import { productRepository } from '../repositories/productRepository.js';
import { dealRepository } from '../repositories/dealRepository.js';

class OrderService {
  /**
   * Recalculates the subtotals and grand totals of an order
   */
  async recalculateOrder(orderId) {
    return dbEngine.transaction(() => {
      const order = orderRepository.findById(orderId);
      if (!order) throw new Error('Order not found');

      let subtotal = 0;
      
      for (const item of order.items) {
        const modifierIds = item.modifiers.map(m => m.modifier_id);
        
        let unitPrice = 0;
        try {
          unitPrice = pricingService.calculateItemPrice(item.product_id, null, modifierIds, []);
        } catch (e) {
          unitPrice = item.unit_price;
        }

        const itemSubtotal = unitPrice * item.quantity;
        
        orderRepository.updateItem(item.id, {
          unit_price: unitPrice,
          subtotal: itemSubtotal
        });

        subtotal += itemSubtotal;
      }

      const tax_total = subtotal * 0.05;
      const discount_total = 0;
      const grand_total = subtotal + tax_total - discount_total;

      const updatedOrder = orderRepository.update(orderId, {
        subtotal,
        tax_total,
        discount_total,
        grand_total
      });

      return updatedOrder;
    });
  }

  getOrCreateDraft(cashierSessionId, userId) {
    return dbEngine.transaction(() => {
      let order = orderRepository.findDraftBySession(cashierSessionId);
      
      if (!order) {
        order = orderRepository.create({
          cashier_session_id: cashierSessionId,
          user_id: userId,
          status: 'DRAFT',
          order_type: 'DINE_IN'
        });
        activityLogService.logActivity(userId, 'ORDER_STARTED', `Order started with ID: ${order.order_number}`, null, order.id);
      }
      return order;
    });
  }

  async addItemToDraft(cashierSessionId, userId, itemData) {
    const orderId = dbEngine.transaction(() => {
      const order = this.getOrCreateDraft(cashierSessionId, userId);
      
      let product = productRepository.findById(itemData.product_id);
      let isDeal = false;
      if (!product) {
        product = dealRepository.findById(itemData.product_id);
        if (product) isDeal = true;
      }
      if (!product) throw new Error('Product not found');

      orderRepository.addItem(order.id, {
        product_id: itemData.product_id,
        quantity: itemData.quantity || 1,
        unit_price: product.price,
        subtotal: product.price * (itemData.quantity || 1),
        modifiers: itemData.modifiers || []
      });

      activityLogService.logActivity(userId, 'ITEM_ADDED', `Added ${product.name} to order ${order.order_number}`, null, order.id);
      return order.id;
    });
    
    return await this.recalculateOrder(orderId);
  }

  async removeItemFromDraft(cashierSessionId, userId, itemId) {
    const orderId = dbEngine.transaction(() => {
      const order = orderRepository.findDraftBySession(cashierSessionId);
      if (!order) throw new Error('No draft order found');
      
      orderRepository.removeItem(itemId);
      activityLogService.logActivity(userId, 'ITEM_REMOVED', `Removed item from order ${order.order_number}`, null, order.id);
      return order.id;
    });

    return await this.recalculateOrder(orderId);
  }

  async updateItemQuantity(cashierSessionId, userId, itemId, quantity) {
    const orderId = dbEngine.transaction(() => {
      const order = orderRepository.findDraftBySession(cashierSessionId);
      if (!order) throw new Error('No draft order found');

      if (quantity <= 0) {
        orderRepository.removeItem(itemId);
        activityLogService.logActivity(userId, 'ITEM_REMOVED', `Removed item from order ${order.order_number}`, null, order.id);
        return order.id;
      }
      
      orderRepository.updateItem(itemId, { quantity });
      activityLogService.logActivity(userId, 'QUANTITY_CHANGED', `Changed quantity for item in order ${order.order_number}`, null, order.id);
      return order.id;
    });

    return await this.recalculateOrder(orderId);
  }

  holdOrder(cashierSessionId, userId, holdName) {
    return dbEngine.transaction(() => {
      const order = orderRepository.findDraftBySession(cashierSessionId);
      if (!order) throw new Error('No draft order found to hold');
      
      const updated = orderRepository.update(order.id, {
        status: 'HELD',
        hold_name: holdName,
        held_at: new Date().toISOString()
      });

      activityLogService.logActivity(userId, 'ORDER_HELD', `Order ${order.order_number} held as ${holdName}`, null, order.id);
      return updated;
    });
  }

  resumeOrder(cashierSessionId, userId, orderId) {
    return dbEngine.transaction(() => {
      const updated = orderRepository.update(orderId, {
        status: 'DRAFT',
        cashier_session_id: cashierSessionId,
        hold_name: null,
        held_at: null
      });
      
      activityLogService.logActivity(userId, 'ORDER_RESUMED', `Order ${updated.order_number} resumed`, null, orderId);
      return updated;
    });
  }

  getHeldOrders(cashierSessionId) {
    return orderRepository.findHeldOrders(cashierSessionId);
  }

  addPayment(orderId, cashierSessionId, userId, paymentData) {
    return dbEngine.transaction(() => {
      const order = orderRepository.findById(orderId);
      if (!order) throw new Error('Order not found');

      orderRepository.addPayment(orderId, {
        cashier_session_id: cashierSessionId,
        payment_method: paymentData.paymentMethod,
        amount: paymentData.amount
      });

      activityLogService.logActivity(userId, 'PAYMENT_COMPLETED', `Payment of ${paymentData.amount} received via ${paymentData.paymentMethod}`, null, order.id);

      const totalPayments = orderRepository.getOrderPayments(orderId).reduce((sum, p) => sum + p.amount, 0);
      
      if (totalPayments >= order.grand_total) {
        return this.completeOrder(orderId, userId);
      }
      
      return orderRepository.update(orderId, { status: 'PENDING_PAYMENT' });
    });
  }

  completeOrder(orderId, userId) {
    // Expected to be called within a transaction (e.g. from addPayment)
    const updated = orderRepository.update(orderId, {
      status: 'COMPLETED'
    });
    activityLogService.log(userId, 'ORDER_COMPLETED', `Order ${updated.order_number} completed`, null, orderId);
    return updated;
  }
}

export const orderService = new OrderService();
