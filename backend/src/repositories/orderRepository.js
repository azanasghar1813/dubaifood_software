import { dbEngine } from '../database/sqlite.js';
import crypto from 'crypto';

class OrderRepository {
  /**
   * Creates a new draft order
   */
  create(orderData) {
    const id = crypto.randomUUID();
    const order_number = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    
    dbEngine.prepare(`
      INSERT INTO orders (
        id, order_number, cashier_session_id, user_id, status, order_type, customer_id, table_id, hold_name, held_at
      ) VALUES (
        @id, @order_number, @cashier_session_id, @user_id, @status, @order_type, @customer_id, @table_id, @hold_name, @held_at
      )
    `).run({
      id,
      order_number,
      cashier_session_id: orderData.cashier_session_id,
      user_id: orderData.user_id,
      status: orderData.status || 'DRAFT',
      order_type: orderData.order_type || 'DINE_IN',
      customer_id: orderData.customer_id || null,
      table_id: orderData.table_id || null,
      hold_name: orderData.hold_name || null,
      held_at: orderData.held_at || null
    });

    return this.findById(id);
  }

  findById(id) {
    const order = dbEngine.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) return null;

    order.items = this.getOrderItems(id);
    order.payments = this.getOrderPayments(id);
    return order;
  }

  getOrderItems(orderId) {
    const items = dbEngine.prepare(`
      SELECT oi.*, 
             COALESCE(p.name, d.name) as product_name, 
             NULL as product_image
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN deals d ON oi.product_id = d.id
      WHERE oi.order_id = ?
    `).all(orderId);
    for (let item of items) {
      item.modifiers = dbEngine.prepare(`
        SELECT oim.*, m.name as modifier_name 
        FROM order_item_modifiers oim
        JOIN modifiers m ON oim.modifier_id = m.id
        WHERE oim.order_item_id = ?
      `).all(item.id);
    }
    return items;
  }

  getOrderPayments(orderId) {
    return dbEngine.prepare('SELECT * FROM payments WHERE order_id = ?').all(orderId);
  }

  /**
   * Updates an order's totals and status
   */
  update(id, updates) {
    const setClause = Object.keys(updates)
      .map((key) => `${key} = @${key}`)
      .join(', ');

    if (setClause) {
      dbEngine.prepare(`
        UPDATE orders 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({ ...updates, id });
    }

    return this.findById(id);
  }

  /**
   * Adds an item to an order
   */
  addItem(orderId, itemData) {
    const id = crypto.randomUUID();
    
    dbEngine.prepare(`
      INSERT INTO order_items (
        id, order_id, product_id, quantity, unit_price, subtotal, notes, status
      ) VALUES (
        @id, @order_id, @product_id, @quantity, @unit_price, @subtotal, @notes, @status
      )
    `).run({
      id,
      order_id: orderId,
      product_id: itemData.product_id,
      quantity: itemData.quantity || 1,
      unit_price: itemData.unit_price || 0,
      subtotal: itemData.subtotal || 0,
      notes: itemData.notes || null,
      status: itemData.status || 'PENDING'
    });

    if (itemData.modifiers && itemData.modifiers.length > 0) {
      const stmt = dbEngine.prepare(`
        INSERT INTO order_item_modifiers (id, order_item_id, modifier_id, price_adjustment)
        VALUES (@id, @order_item_id, @modifier_id, @price_adjustment)
      `);
      
      const tx = dbEngine.transaction((modifiers) => {
        for (const mod of modifiers) {
          stmt.run({
            id: crypto.randomUUID(),
            order_item_id: id,
            modifier_id: mod.modifier_id,
            price_adjustment: mod.price_adjustment || 0
          });
        }
      });
      tx(itemData.modifiers);
    }

    return id;
  }

  updateItem(itemId, updates) {
    const setClause = Object.keys(updates)
      .map((key) => `${key} = @${key}`)
      .join(', ');

    if (setClause) {
      dbEngine.prepare(`
        UPDATE order_items 
        SET ${setClause}
        WHERE id = @id
      `).run({ ...updates, id: itemId });
    }
  }

  removeItem(itemId) {
    dbEngine.prepare('DELETE FROM order_items WHERE id = ?').run(itemId);
  }

  addPayment(orderId, paymentData) {
    const id = crypto.randomUUID();
    dbEngine.prepare(`
      INSERT INTO payments (
        id, order_id, cashier_session_id, payment_method, amount, status, transaction_reference
      ) VALUES (
        @id, @order_id, @cashier_session_id, @payment_method, @amount, @status, @transaction_reference
      )
    `).run({
      id,
      order_id: orderId,
      cashier_session_id: paymentData.cashier_session_id,
      payment_method: paymentData.payment_method,
      amount: paymentData.amount,
      status: paymentData.status || 'COMPLETED',
      transaction_reference: paymentData.transaction_reference || null
    });
    return id;
  }

  findHeldOrders(cashierSessionId = null) {
    let sql = `SELECT * FROM orders WHERE status = 'HELD'`;
    const params = [];
    if (cashierSessionId) {
      sql += ` AND cashier_session_id = ?`;
      params.push(cashierSessionId);
    }
    sql += ` ORDER BY held_at DESC`;

    const orders = dbEngine.prepare(sql).all(...params);
    return orders.map(o => {
      o.items = this.getOrderItems(o.id);
      return o;
    });
  }

  findDraftBySession(cashierSessionId) {
    const order = dbEngine.prepare(`
      SELECT * FROM orders 
      WHERE cashier_session_id = ? AND status = 'DRAFT'
      ORDER BY created_at DESC LIMIT 1
    `).get(cashierSessionId);

    if (!order) return null;
    return this.findById(order.id);
  }
}

export const orderRepository = new OrderRepository();
