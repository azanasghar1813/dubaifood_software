import { dbEngine } from '../database/sqlite.js';
import { dateUtils } from '../utils/dateUtils.js';

const buildDateFilter = (filters) => {
  let { startDate, endDate, dateFilter } = filters;
  
  if (dateFilter) {
    const todayStr = dateUtils.getBusinessDate();
    
    if (dateFilter === 'Today') {
      startDate = todayStr;
      endDate = todayStr;
    } else if (dateFilter === 'Yesterday') {
      const yesterdayStr = dateUtils.getYesterdayBusinessDate();
      startDate = yesterdayStr;
      endDate = yesterdayStr;
    } else if (dateFilter === 'This Week') {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay());
      startDate = dateUtils.getBusinessDate(d);
      endDate = todayStr;
    } else if (dateFilter === 'This Month' || dateFilter === 'Monthly') {
      startDate = dateUtils.getBusinessMonthStart();
      
      const d = new Date();
      if (d.getHours() < 6) d.setDate(d.getDate() - 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const lastDayOfMonth = new Date(year, month + 1, 0);
      endDate = dateUtils.getBusinessDate(lastDayOfMonth);
    } else if (dateFilter === 'Custom Date' && filters.startDate && filters.endDate) {
      startDate = filters.startDate;
      endDate = filters.endDate;
    } else if (dateFilter === 'All Time') {
      startDate = '1970-01-01';
      endDate = '2099-12-31';
    }
  }

  // If no dates provided, default to today
  if (!startDate) startDate = dateUtils.getBusinessDate();
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
        SUM(o.subtotal + o.tax_total - o.discount_total) as netSales,
        SUM(o.grand_total) as grossSales,
        SUM(o.discount_total) as discounts,
        SUM(o.tax_total) as tax,
        SUM(o.delivery_fee) as deliveryCharges,
        SUM(COALESCE(o.service_charge, 0)) as serviceCharges,
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
      grossSales: (summary.grossSales || 0) - refunds,
      netSales: actualNet,
      ordersCount: ordersCount,
      itemsSold: items.itemsSold || 0,
      discounts: summary.discounts || 0,
      tax: summary.tax || 0,
      serviceCharges: summary.serviceCharges || 0,
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
      WITH AllSales AS (
        SELECT order_id, product_id, quantity as qty, base_unit_price, discount_amount, tax_amount, total_amount, product_name_snapshot as component_name, 0 as is_component, NULL as parent_deal_name FROM order_items
        UNION ALL
        SELECT oi.order_id, occ.product_id, occ.quantity as qty, occ.price_adjustment as base_unit_price, 0 as discount_amount, 0 as tax_amount, (occ.quantity * occ.price_adjustment) as total_amount, occ.product_name_snapshot as component_name, 1 as is_component, oi.product_name_snapshot as parent_deal_name
        FROM order_combo_components occ
        JOIN order_items oi ON occ.order_item_id = oi.id
      )
      SELECT 
        COALESCE(
          CASE WHEN d.id IS NOT NULL THEN 'Deals' END,
          CASE WHEN a.is_component = 1 AND (a.component_name LIKE '%Drink%' OR a.component_name LIKE '%Limka%' OR a.component_name LIKE '%Beverage%' OR a.component_name LIKE '%Coke%' OR a.component_name LIKE '%Sprite%' OR a.component_name LIKE '%Water%' OR a.component_name LIKE '%Tea%' OR a.component_name LIKE '%Coffee%') THEN 'Drinks' END,
          CASE WHEN c1.name LIKE '%Drink%' OR c2.name LIKE '%Drink%' OR c1.name LIKE '%Beverage%' OR c1.name LIKE '%Juice%' OR c1.name LIKE '%Shake%' OR c1.name LIKE '%Cold%' OR c1.name LIKE '%Limka%' THEN 'Drinks' END,
          CASE WHEN a.is_component = 1 AND (a.component_name LIKE '%Chip%' OR a.component_name LIKE '%Fries%') THEN 'Potato Chips' END,
          CASE WHEN c1.name LIKE '%Chips%' OR p.name LIKE '%Chips%' THEN 'Potato Chips' END,
          CASE WHEN a.is_component = 1 THEN 'Deals' END,
          CASE WHEN a.is_component = 0 AND (a.component_name LIKE '%Deal%' OR a.component_name LIKE '%Combo%') THEN 'Deals' END,
          CASE WHEN a.is_component = 0 AND (a.component_name LIKE '%Drink%' OR a.component_name LIKE '%Limka%' OR a.component_name LIKE '%Beverage%') THEN 'Drinks' END,
          c2.name, c1.name, 'Uncategorized'
        ) as main_category,
        COALESCE(
          CASE WHEN d.id IS NOT NULL THEN d.name END,
          CASE WHEN a.is_component = 1 AND (a.component_name LIKE '%Drink%' OR a.component_name LIKE '%Limka%' OR a.component_name LIKE '%Beverage%' OR a.component_name LIKE '%Water%') THEN 'Deal Drinks' END,
          CASE WHEN a.is_component = 1 AND (a.component_name LIKE '%Chip%' OR a.component_name LIKE '%Fries%') THEN 'Deal Chips' END,
          CASE WHEN a.is_component = 1 THEN 'Deal Components' END,
          c1.name, 'Uncategorized'
        ) as sub_category,
        COALESCE(a.component_name, p.name, d.name) as product_name,
        a.product_id,
        SUM(CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN a.qty ELSE 0 END) as qty,
        COUNT(DISTINCT CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN o.id END) as orders,
        SUM(CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN a.qty * a.base_unit_price ELSE 0 END) as gross,
        SUM(CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN a.discount_amount ELSE 0 END) as discount,
        SUM(CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN a.tax_amount ELSE 0 END) as tax,
        SUM(CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN a.total_amount ELSE 0 END) as net,
        SUM(CASE WHEN o.lifecycle_state IN ('CANCELLED', 'REFUNDED') THEN a.total_amount ELSE 0 END) as refunds,
        SUM(CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN COALESCE(p.price, 0) * a.qty ELSE 0 END) as original_value,
        MAX(a.is_component) as is_component,
        MAX(a.parent_deal_name) as parent_deal_name
      FROM AllSales a
      JOIN orders o ON a.order_id = o.id
      LEFT JOIN products p ON a.product_id = p.id
      LEFT JOIN deals d ON a.product_id = d.id
      LEFT JOIN categories c1 ON p.category_id = c1.id
      LEFT JOIN categories c2 ON c1.parent_id = c2.id
      WHERE ${where}
      GROUP BY main_category, sub_category, product_name, a.product_id
      HAVING qty > 0 OR refunds > 0
      ORDER BY main_category, sub_category, net DESC
    `;
    
    const rows = dbEngine.all(query, ...params);
    return rows;
  },
  
  getRecentItems: async (filters) => {
    const { where, params } = buildWhereClause(filters, 'o');
    
    const query = `
      SELECT 
        COALESCE(oi.product_name_snapshot, p.name, d.name, 'Unknown') as name,
        COALESCE(c.name, 'Other') as cat,
        oi.quantity as qty,
        oi.total_amount as price,
        o.created_at as time
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN deals d ON oi.product_id = d.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${where} AND o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED')
      ORDER BY o.created_at DESC
      LIMIT 10
    `;
    
    return dbEngine.all(query, ...params);
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
      WITH AllSales AS (
        SELECT order_id, product_id, quantity as qty, total_amount as net FROM order_items
        UNION ALL
        SELECT oi.order_id, occ.product_id, occ.quantity as qty, (occ.quantity * occ.price_adjustment) as net
        FROM order_combo_components occ
        JOIN order_items oi ON occ.order_item_id = oi.id
      )
      SELECT 
        o.order_type,
        SUM(CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN a.qty ELSE 0 END) as qty,
        SUM(CASE WHEN o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED') THEN a.net ELSE 0 END) as net
      FROM AllSales a
      JOIN orders o ON a.order_id = o.id
      WHERE ${where} AND a.product_id = ?
      GROUP BY o.order_type
    `;
    
    const details = dbEngine.all(query, ...params, productId);
    return details;
  }
};
