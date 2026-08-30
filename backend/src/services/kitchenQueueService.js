import { dbEngine } from '../database/sqlite.js';
import { kitchenStatusService } from './kitchenStatusService.js';
import { kitchenTimerService } from './kitchenTimerService.js';
import { configService } from './configService.js';

class KitchenQueueService {
  constructor() {
    this.cache = new Map();
  }

  _cacheKey(filters = {}) {
    return JSON.stringify({
      branchId: filters.branchId || null,
      stationId: filters.stationId || null,
      includeCompleted: !!filters.includeCompleted,
      changedSince: filters.changedSince || null,
      limit: Number(filters.limit) || 100,
      monitorMode: !!filters.monitorMode
    });
  }

  invalidate(orderId) {
    this.cache.clear();
  }

  _businessDate() {
    const startHour = Number(String((configService.getBusinessDay().start_time || '06:00').split(':')[0]));
    const cutoff = Number.isFinite(startHour) ? startHour : 6;
    const d = new Date();
    if (d.getHours() < cutoff) d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  _loadItemChildren(itemIds = []) {
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return {
        variantsByItem: new Map(),
        modifiersByItem: new Map(),
        addonsByItem: new Map(),
        combosByItem: new Map()
      };
    }

    const placeholders = itemIds.map(() => '?').join(',');

    const variants = dbEngine.prepare(`
      SELECT * FROM order_item_variants WHERE order_item_id IN (${placeholders})
    `).all(...itemIds);

    const modifiers = dbEngine.prepare(`
      SELECT * FROM order_item_modifiers WHERE order_item_id IN (${placeholders})
    `).all(...itemIds);

    const addons = dbEngine.prepare(`
      SELECT * FROM order_item_addons WHERE order_item_id IN (${placeholders})
    `).all(...itemIds);

    const combos = dbEngine.prepare(`
      SELECT * FROM order_combo_components WHERE order_item_id IN (${placeholders})
    `).all(...itemIds);

    const variantsByItem = new Map();
    const modifiersByItem = new Map();
    const addonsByItem = new Map();
    const combosByItem = new Map();

    for (const row of variants) {
      if (!variantsByItem.has(row.order_item_id)) variantsByItem.set(row.order_item_id, []);
      variantsByItem.get(row.order_item_id).push(row);
    }

    for (const row of modifiers) {
      if (!modifiersByItem.has(row.order_item_id)) modifiersByItem.set(row.order_item_id, []);
      modifiersByItem.get(row.order_item_id).push(row);
    }

    for (const row of addons) {
      if (!addonsByItem.has(row.order_item_id)) addonsByItem.set(row.order_item_id, []);
      addonsByItem.get(row.order_item_id).push(row);
    }

    for (const row of combos) {
      if (!combosByItem.has(row.order_item_id)) combosByItem.set(row.order_item_id, []);
      combosByItem.get(row.order_item_id).push(row);
    }

    return { variantsByItem, modifiersByItem, addonsByItem, combosByItem };
  }

  getQueue(filters = {}) {
    const key = this._cacheKey(filters);
    const cached = this.cache.get(key);
    if (cached) return cached.payload;

    const activeOrderStates = ['ACTIVE'];
    const activeItemStates = ['PENDING', 'SENT', 'PREPARING', 'READY', 'SERVED'];
    const params = [];

    let sql = `
      SELECT
        o.id AS order_id,
        o.order_number,
        o.business_date,
        o.branch_id,
        o.cashier_user_id,
        o.shift_id,
        o.order_type,
        o.table_id,
        o.customer_id,
        o.notes AS customer_notes,
        o.kitchen_state AS order_kitchen_state,
        o.lifecycle_state,
        o.payment_state,
        o.created_at AS order_created_at,
        o.updated_at AS order_updated_at,
        COALESCE((SELECT meta_value FROM order_metadata om WHERE om.order_id = o.id AND om.meta_key = 'priority' LIMIT 1), 'NORMAL') AS priority,
        (SELECT meta_value FROM order_metadata om WHERE om.order_id = o.id AND om.meta_key = 'kitchen_notes' LIMIT 1) AS kitchen_notes,
        (SELECT meta_value FROM order_metadata om WHERE om.order_id = o.id AND om.meta_key = 'kitchen_received_at' LIMIT 1) AS kitchen_received_at,
        (SELECT meta_value FROM order_metadata om WHERE om.order_id = o.id AND om.meta_key = 'is_vip' LIMIT 1) AS is_vip,
        o.rider_name_snapshot,
        o.waiter_name_snapshot,
        u.username,
        u.first_name,
        u.last_name,
        i.id AS item_id,
        i.product_id,
        i.product_name_snapshot,
        i.product_code_snapshot,
        i.quantity,
        i.subtotal,
        i.final_unit_price,
        i.base_unit_price,
        i.tax_amount,
        i.notes AS item_notes,
        i.kitchen_state AS item_kitchen_state,
        i.kitchen_station_id,
        i.kitchen_station_name_snapshot,
        CASE WHEN d.id IS NOT NULL THEN 'DEALS' ELSE UPPER(c.name) END AS category_name,
        i.estimated_prep_minutes,
        i.created_at AS item_created_at,
        i.updated_at AS item_updated_at,
        i.kitchen_started_at,
        i.kitchen_ready_at,
        i.kitchen_served_at,
        i.kitchen_completed_at,
        i.kitchen_cancelled_at
      FROM orders o
      INNER JOIN order_items i ON i.order_id = o.id
      LEFT JOIN users u ON u.id = o.cashier_user_id
      LEFT JOIN products p ON p.id = i.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN deals d ON d.id = i.product_id
      WHERE 1=1
    `;

    if (filters.monitorMode) {
      sql += ` AND o.business_date = ?`;
      params.push(this._businessDate());
    } else {
      sql += ` AND o.lifecycle_state IN (${activeOrderStates.map(() => '?').join(',')})`;
      sql += ` AND i.kitchen_state IN (${activeItemStates.map(() => '?').join(',')})`;
      params.push(...activeOrderStates, ...activeItemStates);
    }

    if (filters.branchId) {
      sql += ' AND o.branch_id = ?';
      params.push(filters.branchId);
    }

    if (filters.stationId) {
      sql += ' AND i.kitchen_station_id = ?';
      params.push(filters.stationId);
    }

    if (filters.changedSince) {
      sql += ' AND (o.updated_at > ? OR i.updated_at > ?)';
      params.push(filters.changedSince, filters.changedSince);
    }

    sql += ' ORDER BY o.created_at ASC, i.created_at ASC';

    const rows = dbEngine.prepare(sql).all(...params);
    const itemIds = rows.map(row => row.item_id);
    const { variantsByItem, modifiersByItem, addonsByItem, combosByItem } = this._loadItemChildren(itemIds);

    const ticketMap = new Map();

    for (const row of rows) {
      if (!ticketMap.has(row.order_id)) {
        ticketMap.set(row.order_id, {
          id: row.order_id,
          order_number: row.order_number,
          business_date: row.business_date,
          branch_id: row.branch_id,
          cashier_user_id: row.cashier_user_id,
          cashier_name: row.first_name ? `${row.first_name} ${row.last_name}` : row.username || null,
          shift_id: row.shift_id,
          order_type: row.order_type,
          table_id: row.table_id,
          customer_id: row.customer_id,
          customer_notes: row.customer_notes,
          kitchen_notes: row.kitchen_notes,
          kitchen_received_at: row.kitchen_received_at,
          kitchen_state: row.order_kitchen_state,
          lifecycle_state: row.lifecycle_state,
          payment_state: row.payment_state,
          priority: row.priority || 'NORMAL',
          is_vip: row.is_vip === 'true' || row.is_vip === '1',
          rider_name: row.rider_name_snapshot,
          waiter_name: row.waiter_name_snapshot,
          created_at: row.order_created_at,
          updated_at: row.order_updated_at,
          items: []
        });
      }

      const item = {
        id: row.item_id,
        product_id: row.product_id,
        product_name_snapshot: row.product_name_snapshot,
        product_code_snapshot: row.product_code_snapshot,
        quantity: row.quantity,
        subtotal: row.subtotal,
        final_unit_price: row.final_unit_price,
        base_unit_price: row.base_unit_price,
        tax_amount: row.tax_amount,
        notes: row.item_notes,
        kitchen_state: row.item_kitchen_state,
        kitchen_station_id: row.kitchen_station_id,
        kitchen_station_name_snapshot: row.kitchen_station_name_snapshot,
        category_name: row.category_name,
        estimated_prep_minutes: row.estimated_prep_minutes,
        created_at: row.item_created_at,
        updated_at: row.item_updated_at,
        kitchen_started_at: row.kitchen_started_at,
        kitchen_ready_at: row.kitchen_ready_at,
        kitchen_served_at: row.kitchen_served_at,
        kitchen_completed_at: row.kitchen_completed_at,
        kitchen_cancelled_at: row.kitchen_cancelled_at,
        variants: variantsByItem.get(row.item_id) || [],
        modifiers: modifiersByItem.get(row.item_id) || [],
        addons: addonsByItem.get(row.item_id) || [],
        combo_components: combosByItem.get(row.item_id) || []
      };

      item.timers = kitchenTimerService.buildItemTimers(item);
      ticketMap.get(row.order_id).items.push(item);
    }

    let tickets = Array.from(ticketMap.values()).map(ticket => ({
      ...ticket,
      timers: kitchenTimerService.buildOrderTimers(ticket, ticket.items)
    }));

    tickets.sort((a, b) => {
      const priorityDiff = kitchenStatusService.getPriorityWeight(a.priority) - kitchenStatusService.getPriorityWeight(b.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const limitedTickets = tickets.slice(0, Number(filters.limit) || 100);
    const allPreparationTimes = limitedTickets.flatMap(ticket =>
      ticket.items.map(item => item.timers.preparation_minutes || 0)
    );

    const averagePreparationTime = allPreparationTimes.length > 0
      ? Math.round(allPreparationTimes.reduce((sum, value) => sum + value, 0) / allPreparationTimes.length)
      : 0;

    const payload = {
      tickets: limitedTickets,
      total: tickets.length,
      summary: {
        pending: limitedTickets.filter(ticket => ticket.kitchen_state === 'PENDING').length,
        preparing: limitedTickets.filter(ticket => ticket.kitchen_state === 'PREPARING').length,
        ready: limitedTickets.filter(ticket => ticket.kitchen_state === 'READY').length,
        served: limitedTickets.filter(ticket => ticket.kitchen_state === 'SERVED').length,
        overdue: limitedTickets.reduce((sum, ticket) => sum + ticket.timers.overdue_items, 0),
        averagePreparationTime
      }
    };

    this.cache.set(key, {
      orderIds: tickets.map(ticket => ticket.id),
      payload
    });

    return payload;
  }

  getTicket(orderId, filters = {}) {
    const queue = this.getQueue({ ...filters, limit: 1000 });
    return queue.tickets.find(ticket => ticket.id === orderId) || null;
  }
}

export const kitchenQueueService = new KitchenQueueService();
