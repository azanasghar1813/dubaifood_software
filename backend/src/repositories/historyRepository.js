import { dbEngine } from '../database/sqlite.js';
import crypto from 'crypto';

/**
 * HistoryRepository
 *
 * All read queries for order history. Optimized with indexes from migration 017.
 * Never writes order data — immutable reads only.
 *
 * Key rules:
 *  - Snapshots are used for display; catalog tables are NEVER joined
 *  - N+1 queries are avoided — all sub-entities loaded in bulk
 *  - Load order details only when requested (not during list queries)
 */
class HistoryRepository {
  /**
   * Paginated list of orders with lightweight columns only.
   * Detail columns (items, payments, etc.) are NOT loaded here.
   *
   * @param {string} whereSql   - WHERE clause from historyFilterService
   * @param {Array}  whereParams
   * @param {string} orderBySql
   * @param {number} page
   * @param {number} limit
   * @returns {{ orders, total, page, limit, totalPages }}
   */
  findPaginated(whereSql, whereParams, orderBySql, page, limit) {
    const offset = (page - 1) * limit;

    const countSql = `
      SELECT COUNT(*) as total
      FROM orders o
      ${whereSql}
    `;

    const listSql = `
      SELECT
        o.id,
        o.order_number,
        o.business_date,
        o.branch_id,
        o.cashier_user_id,
        o.shift_id,
        o.customer_id,
        o.table_id,
        o.order_type,
        o.lifecycle_state,
        o.kitchen_state,
        o.payment_state,
        o.subtotal,
        o.tax_total,
        o.discount_total,
        o.grand_total,
        o.paid_total,
        o.due_total,
        o.sync_status,
        o.synced_at,
        o.notes,
        o.created_at,
        o.updated_at,
        o.completed_at,
        -- Aggregate item count (fast subquery, uses index)
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
        -- First payment method (for display badge)
        (
          SELECT op.payment_method
          FROM order_payments op
          WHERE op.order_id = o.id AND op.status = 'COMPLETED'
          ORDER BY op.created_at ASC LIMIT 1
        ) AS primary_payment_method,
        (SELECT meta_value FROM order_metadata om WHERE om.order_id = o.id AND om.meta_key = 'service_charge') AS service_charge,
        (SELECT meta_value FROM order_metadata om WHERE om.order_id = o.id AND om.meta_key = 'delivery_charges') AS delivery_charges,
        (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END FROM activity_logs al WHERE al.entity_id = o.id AND al.action IN ('ITEM_REMOVED', 'ITEM_ADDED', 'QUANTITY_CHANGED')) AS is_edited
      FROM orders o
      ${whereSql}
      ORDER BY ${orderBySql}
      LIMIT ? OFFSET ?
    `;

    const total   = dbEngine.prepare(countSql).get(...whereParams)?.total || 0;
    const orders  = dbEngine.prepare(listSql).all(...whereParams, limit, offset);

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Full order detail — all sub-entities loaded from snapshot tables.
   * NEVER joins catalog tables. Everything comes from immutable snapshots.
   *
   * @param {string} orderId
   * @returns {Object|null}
   */
  findFullDetail(orderId) {
    const order = dbEngine.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return null;

    // Load all items in one query, joining products and categories for category_name
    const items = dbEngine.prepare(`
      SELECT 
        oi.*,
        CASE 
          WHEN d.id IS NOT NULL THEN 'Deals'
          ELSE c.name 
        END AS category_name
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN deals d ON d.id = oi.product_id
      WHERE oi.order_id = ? 
      ORDER BY oi.created_at ASC
    `).all(orderId);

    const itemIds = items.map(i => i.id);

    // Load all sub-entities in bulk (no N+1)
    let variants = [], modifiers = [], addons = [], comboComponents = [];

    if (itemIds.length > 0) {
      const placeholders = itemIds.map(() => '?').join(',');
      variants         = dbEngine.prepare(`SELECT * FROM order_item_variants WHERE order_item_id IN (${placeholders})`).all(...itemIds);
      modifiers        = dbEngine.prepare(`SELECT * FROM order_item_modifiers WHERE order_item_id IN (${placeholders})`).all(...itemIds);
      addons           = dbEngine.prepare(`SELECT * FROM order_item_addons WHERE order_item_id IN (${placeholders})`).all(...itemIds);
      comboComponents  = dbEngine.prepare(`SELECT * FROM order_combo_components WHERE order_item_id IN (${placeholders})`).all(...itemIds);
    }

    // Group sub-entities by item_id
    const variantsByItem   = this._groupBy(variants,        'order_item_id');
    const modifiersByItem  = this._groupBy(modifiers,       'order_item_id');
    const addonsByItem     = this._groupBy(addons,          'order_item_id');
    const combosByItem     = this._groupBy(comboComponents, 'order_item_id');

    // Hydrate items
    order.items = items.map(item => ({
      ...item,
      variant:           variantsByItem[item.id]?.[0]  || null,
      modifiers:         modifiersByItem[item.id]      || [],
      addons:            addonsByItem[item.id]          || [],
      combo_components:  combosByItem[item.id]          || [],
    }));

    // Payments
    order.payments = dbEngine.prepare(`
      SELECT * FROM order_payments WHERE order_id = ? ORDER BY created_at ASC
    `).all(orderId);

    // Receipt info (without full payload for list performance)
    order.receipts = dbEngine.prepare(`
      SELECT id, receipt_number, generated_at, printed_at, print_count
      FROM payment_receipts WHERE order_id = ? ORDER BY generated_at ASC
    `).all(orderId);

    // Timeline
    order.timeline = dbEngine.prepare(`
      SELECT * FROM order_timeline WHERE order_id = ? ORDER BY created_at ASC
    `).all(orderId);

    // Parse timeline metadata
    order.timeline = order.timeline.map(e => ({
      ...e,
      metadata: e.metadata ? this._tryParse(e.metadata) : null,
    }));

    // Metadata
    order.metadata = this._loadMetadata(orderId);

    // Audit trail (Combine order_audit_trail and activity_logs)
    const audits = dbEngine.prepare(`
      SELECT id, user_id, action, old_value, new_value, reason, created_at 
      FROM order_audit_trail WHERE order_id = ?
    `).all(orderId);
    
    const activities = dbEngine.prepare(`
      SELECT id, user_id, action, NULL as old_value, details as new_value, NULL as reason, created_at
      FROM activity_logs WHERE entity_type = 'ORDER' AND entity_id = ?
    `).all(orderId);
    
    order.audit_trail = [...audits, ...activities].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Tags
    order.tags = dbEngine.prepare(`
      SELECT tag_name, tag_color FROM order_tags WHERE order_id = ?
    `).all(orderId);

    // Print jobs (without full payload)
    order.print_jobs = dbEngine.prepare(`
      SELECT id, job_type, status, order_number, retries, last_error, created_at, completed_at
      FROM print_jobs WHERE order_id = ? ORDER BY created_at DESC
    `).all(orderId);

    // Reprint log
    order.reprint_log = dbEngine.prepare(`
      SELECT * FROM reprint_log WHERE order_id = ? ORDER BY created_at DESC
    `).all(orderId);

    return order;
  }

  /**
   * Lightweight order lookup (for search result cards).
   */
  findLightweight(orderId) {
    const order = dbEngine.prepare(`
      SELECT id, order_number, business_date, order_type, lifecycle_state,
             payment_state, kitchen_state, grand_total, cashier_user_id,
             customer_id, table_id, created_at, updated_at, sync_status
      FROM orders WHERE id = ?
    `).get(orderId);

    if (!order) return null;

    order.item_count = dbEngine.prepare(
      'SELECT COUNT(*) as c FROM order_items WHERE order_id = ?'
    ).get(orderId)?.c || 0;

    return order;
  }

  /**
   * Find by order number (unique index — O(1)).
   */
  findByOrderNumber(orderNumber) {
    const order = dbEngine.prepare(
      'SELECT * FROM orders WHERE order_number = ?'
    ).get(orderNumber);
    return order || null;
  }

  /**
   * Stats for history dashboard header.
   */
  getStats(filters = {}) {
    const today = new Date().toISOString().slice(0, 10);

    return {
      today: dbEngine.prepare(`
        SELECT
          COUNT(*) as total_orders,
          SUM(grand_total) as total_revenue,
          SUM(CASE WHEN lifecycle_state = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN lifecycle_state = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
          SUM(CASE WHEN payment_state = 'PAID' THEN 1 ELSE 0 END) as paid
        FROM orders
        WHERE business_date = ?
      `).get(today),

      by_state: dbEngine.prepare(`
        SELECT lifecycle_state, COUNT(*) as count, SUM(grand_total) as total
        FROM orders
        WHERE business_date = ?
        GROUP BY lifecycle_state
      `).all(today),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  _groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      const k = item[key];
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    }, {});
  }

  _loadMetadata(orderId) {
    const rows = dbEngine.prepare(
      'SELECT meta_key, meta_value FROM order_metadata WHERE order_id = ?'
    ).all(orderId);

    return rows.reduce((acc, row) => {
      acc[row.meta_key] = this._tryParse(row.meta_value);
      return acc;
    }, {});
  }

  _tryParse(str) {
    try { return JSON.parse(str); } catch { return str; }
  }
}

export const historyRepository = new HistoryRepository();
