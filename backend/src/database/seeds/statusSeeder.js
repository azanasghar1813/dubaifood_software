/**
 * Seeds Order, Kitchen, and Shift Statuses.
 * Uses INSERT OR IGNORE to guarantee idempotency.
 * 
 * @param {Object} db 
 * @returns {Object} 
 */
export const runStatusSeeder = (db) => {
  let inserted = 0;

  // 1. Order Statuses
  const insertOrderStat = db.prepare('INSERT OR IGNORE INTO order_statuses (code, name, color, display_order, is_system) VALUES (?, ?, ?, ?, ?)');
  
  const orderStatuses = [
    { code: 'DRAFT', name: 'Draft', color: '#6B7280', order: 10, sys: 1 },
    { code: 'PENDING_PAYMENT', name: 'Pending Payment', color: '#F59E0B', order: 20, sys: 1 },
    { code: 'PAID', name: 'Paid', color: '#10B981', order: 30, sys: 1 },
    { code: 'PREPARING', name: 'Preparing', color: '#3B82F6', order: 40, sys: 1 },
    { code: 'READY', name: 'Ready', color: '#8B5CF6', order: 50, sys: 1 },
    { code: 'SERVED', name: 'Served', color: '#6366F1', order: 60, sys: 1 },
    { code: 'COMPLETED', name: 'Completed', color: '#059669', order: 70, sys: 1 },
    { code: 'CANCELLED', name: 'Cancelled', color: '#EF4444', order: 80, sys: 1 },
    { code: 'REFUNDED', name: 'Refunded', color: '#B91C1C', order: 90, sys: 1 }
  ];

  for (const stat of orderStatuses) {
    const res = insertOrderStat.run(stat.code, stat.name, stat.color, stat.order, stat.sys);
    if (res.changes > 0) inserted++;
  }

  // 2. Kitchen Statuses
  const insertKitchenStat = db.prepare('INSERT OR IGNORE INTO kitchen_statuses (code, name, color, display_order, is_system) VALUES (?, ?, ?, ?, ?)');
  
  const kitchenStatuses = [
    { code: 'WAITING', name: 'Waiting', color: '#6B7280', order: 10, sys: 1 },
    { code: 'ACCEPTED', name: 'Accepted', color: '#3B82F6', order: 20, sys: 1 },
    { code: 'PREPARING', name: 'Preparing', color: '#F59E0B', order: 30, sys: 1 },
    { code: 'READY', name: 'Ready', color: '#10B981', order: 40, sys: 1 },
    { code: 'DELIVERED', name: 'Delivered', color: '#059669', order: 50, sys: 1 }
  ];

  for (const stat of kitchenStatuses) {
    const res = insertKitchenStat.run(stat.code, stat.name, stat.color, stat.order, stat.sys);
    if (res.changes > 0) inserted++;
  }

  // 3. Shift Statuses
  const insertShiftStat = db.prepare('INSERT OR IGNORE INTO shift_statuses (code, name, is_system) VALUES (?, ?, ?)');
  
  const shiftStatuses = [
    { code: 'OPEN', name: 'Open', sys: 1 },
    { code: 'CLOSED', name: 'Closed', sys: 1 },
    { code: 'SUSPENDED', name: 'Suspended', sys: 1 }
  ];

  for (const stat of shiftStatuses) {
    const res = insertShiftStat.run(stat.code, stat.name, stat.sys);
    if (res.changes > 0) inserted++;
  }

  return { name: 'Statuses', inserted };
};
