import { dbEngine } from '../database/sqlite.js';

class OrderRepository {
  create(orderData) {
    dbEngine.prepare(`
      INSERT INTO orders (
        id, order_number, business_date, branch_id, cashier_user_id, shift_id,
        customer_id, table_id, order_type, lifecycle_state, kitchen_state, payment_state,
        subtotal, tax_total, discount_total, tip_total, delivery_fee, grand_total,
        paid_total, due_total, hold_name, held_at, notes, sync_status, sync_version,
        created_at, updated_at
      ) VALUES (
        @id, @order_number, @business_date, @branch_id, @cashier_user_id, @shift_id,
        @customer_id, @table_id, @order_type, @lifecycle_state, @kitchen_state, @payment_state,
        @subtotal, @tax_total, @discount_total, @tip_total, @delivery_fee, @grand_total,
        @paid_total, @due_total, @hold_name, @held_at, @notes, @sync_status, @sync_version,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run({
      id: orderData.id,
      order_number: orderData.order_number,
      business_date: orderData.business_date,
      branch_id: orderData.branch_id || 'DEFAULT_BRANCH',
      cashier_user_id: orderData.cashier_user_id,
      shift_id: orderData.shift_id,
      customer_id: orderData.customer_id || null,
      table_id: orderData.table_id || null,
      order_type: orderData.order_type || 'DINE_IN',
      lifecycle_state: orderData.lifecycle_state || 'DRAFT',
      kitchen_state: orderData.kitchen_state || 'PENDING',
      payment_state: orderData.payment_state || 'UNPAID',
      subtotal: orderData.subtotal || 0,
      tax_total: orderData.tax_total || 0,
      discount_total: orderData.discount_total || 0,
      tip_total: orderData.tip_total || 0,
      delivery_fee: orderData.delivery_fee || 0,
      grand_total: orderData.grand_total || 0,
      paid_total: orderData.paid_total || 0,
      due_total: orderData.due_total || 0,
      hold_name: orderData.hold_name || null,
      held_at: orderData.held_at || null,
      notes: orderData.notes || null,
      sync_status: orderData.sync_status || 'PENDING',
      sync_version: orderData.sync_version || 1
    });

    return this.findById(orderData.id);
  }

  findById(id) {
    const order = dbEngine.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    return order || null;
  }

  findByNumber(orderNumber) {
    const order = dbEngine.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);
    return order || null;
  }

  findDraftBySession(shiftId) {
    const order = dbEngine.prepare(`
      SELECT * FROM orders 
      WHERE shift_id = ? AND lifecycle_state = 'DRAFT'
      ORDER BY created_at DESC LIMIT 1
    `).get(shiftId);
    return order || null;
  }

  update(id, updates) {
    const fields = [];
    const params = { id };

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id') {
        fields.push(`${key} = @${key}`);
        params[key] = value;
      }
    }

    if (fields.length > 0) {
      if (!params.updated_at) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
      }
      dbEngine.prepare(`
        UPDATE orders 
        SET ${fields.join(', ')} 
        WHERE id = @id
      `).run(params);
    }

    return this.findById(id);
  }

  queryActive(branchId = 'DEFAULT_BRANCH') {
    return dbEngine.prepare(`
      SELECT * FROM orders 
      WHERE branch_id = ? 
        AND lifecycle_state IN ('DRAFT', 'HELD', 'PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY')
      ORDER BY updated_at DESC
    `).all(branchId);
  }

  queryHeld(shiftId = null) {
    let sql = "SELECT * FROM orders WHERE lifecycle_state = 'HELD'";
    const params = [];
    if (shiftId) {
      sql += ' AND shift_id = ?';
      params.push(shiftId);
    }
    sql += ' ORDER BY held_at DESC';
    return dbEngine.prepare(sql).all(...params);
  }

  queryByState(lifecycleState, limit = 100) {
    return dbEngine.prepare(`
      SELECT * FROM orders 
      WHERE lifecycle_state = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(lifecycleState, limit);
  }

  queryByDateRange(startDate, endDate, branchId = 'DEFAULT_BRANCH') {
    return dbEngine.prepare(`
      SELECT * FROM orders 
      WHERE branch_id = ? 
        AND business_date >= ? 
        AND business_date <= ?
      ORDER BY created_at DESC
    `).all(branchId, startDate, endDate);
  }
}

export const orderRepository = new OrderRepository();
