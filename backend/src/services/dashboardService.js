import { dbEngine } from '../database/sqlite.js';
import { configService } from './configService.js';
import { activityLogService } from './activityLogService.js';
import { kitchenService } from './kitchenService.js';

export const dashboardService = {
  /**
   * Calculates the exact Date objects for the current Business Day
   */
  getBusinessDayBounds: () => {
    // We haven't built a full Business Configuration UI yet, so default is 06:00
    // Actually, configService.getBusinessDay() is implemented!
    const { start_time } = configService.getBusinessDay();
    const [startHour, startMinute] = start_time.split(':').map(Number);
    
    const now = new Date();
    
    // If we are currently before the start time (e.g. 2 AM), 
    // the "business day" started yesterday at 6 AM.
    const startOfBusinessDay = new Date(now);
    startOfBusinessDay.setHours(startHour, startMinute, 0, 0);
    
    if (now < startOfBusinessDay) {
      startOfBusinessDay.setDate(startOfBusinessDay.getDate() - 1);
    }
    
    const endOfBusinessDay = new Date(startOfBusinessDay);
    endOfBusinessDay.setDate(endOfBusinessDay.getDate() + 1);

    return {
      start: startOfBusinessDay.toISOString().replace('T', ' ').substring(0, 19),
      end: endOfBusinessDay.toISOString().replace('T', ' ').substring(0, 19),
    };
  },

  getSummary: () => {
    const { start, end } = dashboardService.getBusinessDayBounds();
    
    // Total Sales (completed, confirmed, or active)
    const stmt = dbEngine.db.prepare(`
      SELECT 
        SUM(grand_total) as todaySales,
        COUNT(id) as ordersCount
      FROM orders
      WHERE (lifecycle_state = 'COMPLETED' OR lifecycle_state = 'CONFIRMED' OR lifecycle_state = 'ACTIVE')
      AND created_at >= ? AND created_at < ?
    `);
    
    const result = stmt.get(start, end);
    const todaySales = result.todaySales || 0;
    const ordersCount = result.ordersCount || 0;
    const aov = ordersCount > 0 ? Math.round(todaySales / ordersCount) : 0;

    const paidStmt = dbEngine.db.prepare(`
      SELECT COUNT(id) as paid
      FROM orders
      WHERE payment_state = 'PAID'
      AND created_at >= ? AND created_at < ?
    `);
    const paid = paidStmt.get(start, end)?.paid || 0;

    const unpaidStmt = dbEngine.db.prepare(`
      SELECT COUNT(id) as unpaid
      FROM orders
      WHERE payment_state != 'PAID'
      AND created_at >= ? AND created_at < ?
    `);
    const unpaid = unpaidStmt.get(start, end)?.unpaid || 0;

    const cashStmt = dbEngine.db.prepare(`
      SELECT SUM(amount) as cashInDrawer
      FROM order_payments
      WHERE (payment_method = 'CASH' OR payment_method = 'Cash')
      AND created_at >= ? AND created_at < ?
    `);
    const cashInDrawer = cashStmt.get(start, end)?.cashInDrawer || 0;

    const custStmt = dbEngine.db.prepare(`
      SELECT COUNT(DISTINCT customer_id) as customers
      FROM orders
      WHERE customer_id IS NOT NULL
      AND created_at >= ? AND created_at < ?
    `);
    const customers = custStmt.get(start, end)?.customers || 0;

    const typeStmt = dbEngine.db.prepare(`
      SELECT order_type, COUNT(id) as count
      FROM orders
      WHERE created_at >= ? AND created_at < ?
      GROUP BY order_type
    `);
    const types = typeStmt.all(start, end);
    let restaurant = 0, fastFood = 0, deals = 0;
    for (const t of types) {
      if (t.order_type === 'DINE_IN') restaurant += t.count;
      else if (t.order_type === 'TAKEAWAY' || t.order_type === 'DELIVERY') fastFood += t.count;
    }

    return {
      todaySales,
      ordersCount,
      preparing: 0, // Migrated to operations
      ready: 0,
      served: 0,
      paid,
      unpaid,
      aov,
      customers,
      fastFood,
      restaurant,
      deals,
      cashInDrawer
    };
  },

  getOperations: () => {
    const { start, end } = dashboardService.getBusinessDayBounds();
    
    // Active cashiers
    const sessionStmt = dbEngine.db.prepare(`
      SELECT COUNT(id) as activeCashiers
      FROM cashier_sessions
      WHERE status = 'OPEN'
    `);
    const activeCashiers = sessionStmt.get().activeCashiers || 0;

    const kitchenMetrics = kitchenService.getDashboardMetrics();

    // Unpaid Orders from enterprise order states
    const unpaidStmt = dbEngine.db.prepare(`
      SELECT COUNT(id) as unpaid
      FROM orders
      WHERE payment_state != 'PAID'
        AND created_at >= ? AND created_at < ?
    `);
    const unpaid = unpaidStmt.get(start, end)?.unpaid || 0;

    return {
      activeCashiers,
      kitchenQueue: kitchenMetrics.kitchenQueue,
      preparing: kitchenMetrics.preparing,
      ready: kitchenMetrics.ready,
      served: kitchenMetrics.served,
      averagePreparationTime: kitchenMetrics.averagePreparationTime,
      overdueKitchenItems: kitchenMetrics.overdue,
      unpaidOrders: unpaid
    };
  },

  getRevenueAnalytics: () => {
    const { start, end } = dashboardService.getBusinessDayBounds();
    const stmt = dbEngine.db.prepare(`
      SELECT created_at, grand_total
      FROM orders
      WHERE created_at >= ? AND created_at < ?
    `);
    const results = stmt.all(start, end);
    
    const buckets = [
      { hourStr: "06:00 AM", h: 6 },
      { hourStr: "08:00 AM", h: 8 },
      { hourStr: "10:00 AM", h: 10 },
      { hourStr: "12:00 PM", h: 12 },
      { hourStr: "02:00 PM", h: 14 },
      { hourStr: "04:00 PM", h: 16 },
      { hourStr: "06:00 PM", h: 18 },
      { hourStr: "08:00 PM", h: 20 },
      { hourStr: "10:00 PM", h: 22 },
      { hourStr: "12:00 AM", h: 0 },
      { hourStr: "02:00 AM", h: 2 },
      { hourStr: "04:00 AM", h: 4 },
    ];
    const mapped = buckets.map(b => ({ hour: b.hourStr, sales: 0 }));
    
    for (const r of results) {
      if (!r.created_at) continue;
      const dt = r.created_at.includes('Z') ? new Date(r.created_at) : new Date(r.created_at.replace(' ', 'T') + 'Z');
      const h = dt.getHours(); 
      
      let bucketIndex = 0;
      if (h >= 6 && h < 8) bucketIndex = 0;
      else if (h >= 8 && h < 10) bucketIndex = 1;
      else if (h >= 10 && h < 12) bucketIndex = 2;
      else if (h >= 12 && h < 14) bucketIndex = 3;
      else if (h >= 14 && h < 16) bucketIndex = 4;
      else if (h >= 16 && h < 18) bucketIndex = 5;
      else if (h >= 18 && h < 20) bucketIndex = 6;
      else if (h >= 20 && h < 22) bucketIndex = 7;
      else if (h >= 22 && h < 24) bucketIndex = 8;
      else if (h >= 0 && h < 2) bucketIndex = 9;
      else if (h >= 2 && h < 4) bucketIndex = 10;
      else if (h >= 4 && h < 6) bucketIndex = 11;
      
      mapped[bucketIndex].sales += (r.grand_total || 0);
    }
    
    return mapped;
  },

  getPopularProducts: () => {
    const { start, end } = dashboardService.getBusinessDayBounds();
    const stmt = dbEngine.db.prepare(`
      SELECT oi.product_name_snapshot as name, SUM(oi.quantity) as sales, oi.product_id as id
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= ? AND o.created_at < ?
      GROUP BY oi.product_id, oi.product_name_snapshot
      ORDER BY sales DESC
      LIMIT 5
    `);
    return stmt.all(start, end).map(row => ({
      id: row.id || Math.random().toString(36).substr(2, 9),
      name: row.name || 'Unknown',
      sales: row.sales || 0
    }));
  },

  getActivityFeed: (limit = 10) => {
    // Query the activity_logs table!
    const stmt = dbEngine.db.prepare(`
      SELECT a.id, a.action, a.entity_type as module, a.details, a.created_at as time, 
             u.username, u.first_name, u.last_name
      FROM activity_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit).map(row => ({
      id: row.id,
      title: `${row.action.replace(/_/g, ' ')}`,
      type: row.module.toLowerCase(),
      user: row.first_name ? `${row.first_name} ${row.last_name}` : 'System',
      time: row.time
    }));
  }
};
