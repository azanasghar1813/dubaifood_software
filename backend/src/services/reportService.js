import { dbEngine } from '../database/sqlite.js';

const buildDateFilter = (filters) => {
  let { startDate, endDate, dateFilter } = filters;
  
  if (dateFilter) {
    const today = new Date();
    // Helper to format YYYY-MM-DD
    const fmt = d => d.toISOString().split('T')[0];
    
    if (dateFilter === 'Today') {
      startDate = fmt(today);
      endDate = fmt(today);
    } else if (dateFilter === 'Yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = fmt(yesterday);
      endDate = fmt(yesterday);
    } else if (dateFilter === 'This Week') {
      const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
      startDate = fmt(firstDay);
      endDate = fmt(new Date());
    } else if (dateFilter === 'This Month') {
      startDate = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
      endDate = fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    }
  }

  // If no dates provided, default to today
  if (!startDate) startDate = new Date().toISOString().split('T')[0];
  if (!endDate) endDate = startDate;

  return { startDate, endDate };
};

const buildWhereClause = (filters, prefix = 'o') => {
  const { startDate, endDate } = buildDateFilter(filters);
  const params = [startDate, endDate];
  let where = `${prefix}.business_date BETWEEN ? AND ?`;
  
  // Exclude Draft and Held orders from sales calculations
  where += ` AND ${prefix}.lifecycle_state NOT IN ('DRAFT', 'HELD')`;

  if (filters.cashier && filters.cashier !== 'All') {
    where += ` AND ${prefix}.cashier_user_id = ?`;
    params.push(filters.cashier);
  }
  if (filters.orderType && filters.orderType !== 'All') {
    where += ` AND ${prefix}.order_type = ?`;
    params.push(filters.orderType);
  }
  if (filters.paymentMethod && filters.paymentMethod !== 'All') {
    // Requires join with payments or we assume single payment method stored in order if possible
    // We will assume it's filtered at the payment level if needed, or we use a subquery
    where += ` AND EXISTS (SELECT 1 FROM order_payments op WHERE op.order_id = ${prefix}.id AND op.payment_method = ?)`;
    params.push(filters.paymentMethod);
  }

  return { where, params };
};

export const reportService = {
  getSummary: async (filters) => {
    const { where, params } = buildWhereClause(filters, 'o');
    
    // Summary Query for Sales
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT o.id) as ordersCount,
        SUM(o.grand_total) as netSales,
        SUM(o.subtotal) as grossSales,
        SUM(o.discount_total) as discounts,
        SUM(o.tax_total) as tax,
        SUM(o.delivery_fee) as deliveryCharges,
        SUM(CASE WHEN o.lifecycle_state IN ('CANCELLED', 'REFUNDED') THEN o.grand_total ELSE 0 END) as refunds
      FROM orders o
      WHERE ${where}
    `;
    
    const itemQuery = `
      SELECT SUM(oi.quantity) as itemsSold
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE ${where} AND o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED')
    `;

    const summary = dbEngine.get(summaryQuery, ...params);
    const items = dbEngine.get(itemQuery, ...params);
    
    const netSales = summary.netSales || 0;
    const refunds = summary.refunds || 0;
    // Calculate actual net (completed sales)
    const actualNet = netSales - refunds;
    const ordersCount = summary.ordersCount || 0;

    return {
      grossSales: summary.grossSales || 0,
      netSales: actualNet,
      ordersCount: ordersCount,
      itemsSold: items.itemsSold || 0,
      discounts: summary.discounts || 0,
      tax: summary.tax || 0,
      serviceCharges: 0, // Currently no explicit service charge col in orders, relying on items or tax
      deliveryCharges: summary.deliveryCharges || 0,
      refunds: refunds,
      averageOrderValue: ordersCount > 0 ? (actualNet / ordersCount) : 0
    };
  },

  getDetailedSales: async (filters) => {
    const { where, params } = buildWhereClause(filters, 'o');
    
    // Fetch hierarchical sales
    // We group by main category, sub category, product
    const query = `
      SELECT 
        COALESCE(c2.name, c1.name, 'Uncategorized') as main_category,
        COALESCE(c1.name, 'Uncategorized') as sub_category,
        p.name as product_name,
        p.id as product_id,
        SUM(CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN oi.quantity ELSE 0 END) as qty,
        COUNT(DISTINCT CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN o.id END) as orders,
        SUM(CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN oi.quantity * oi.base_unit_price ELSE 0 END) as gross,
        SUM(CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN oi.discount_amount ELSE 0 END) as discount,
        SUM(CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN oi.tax_amount ELSE 0 END) as tax,
        SUM(CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN oi.total_amount ELSE 0 END) as net,
        SUM(CASE WHEN o.lifecycle_state IN ('CANCELLED', 'REFUNDED') THEN oi.total_amount ELSE 0 END) as refunds
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c1 ON p.category_id = c1.id
      LEFT JOIN categories c2 ON c1.parent_id = c2.id
      WHERE ${where}
      GROUP BY main_category, sub_category, product_name, product_id
      HAVING qty > 0 OR refunds > 0
      ORDER BY main_category, sub_category, net DESC
    `;
    
    const rows = dbEngine.all(query, ...params);
    return rows;
  },
  
  getTrends: async (filters) => {
    const { where, params } = buildWhereClause(filters, 'o');
    // removed getDb
    
    const query = `
      SELECT 
        o.business_date as date,
        SUM(CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN o.grand_total ELSE 0 END) as sales
      FROM orders o
      WHERE ${where}
      GROUP BY o.business_date
      ORDER BY o.business_date ASC
    `;
    
    return dbEngine.all(query, ...params);
  },
  
  getProductDetails: async (productId, filters) => {
    const { where, params } = buildWhereClause(filters, 'o');
    // removed getDb
    
    const query = `
      SELECT 
        o.order_type,
        SUM(CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN oi.quantity ELSE 0 END) as qty,
        SUM(CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN oi.total_amount ELSE 0 END) as net
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE ${where} AND oi.product_id = ?
      GROUP BY o.order_type
    `;
    
    const details = dbEngine.all(query, ...params, productId);
    return details;
  }
};
