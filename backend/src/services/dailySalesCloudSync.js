import { dbEngine } from '../database/sqlite.js';
import { dateUtils } from '../utils/dateUtils.js';
import os from 'os';

const SALE_PREDICATE = "(lifecycle_state = 'COMPLETED' OR (lifecycle_state = 'ACTIVE' AND payment_state = 'PAID'))";

class DailySalesCloudSync {
  constructor() {
    this._intervalId = null;
    this._isSyncing = false;
    this._syncIntervalMs = 2 * 60 * 1000; // 2 minutes
    this._deviceId = this._resolveDeviceId();
    this._deviceName = this._resolveDeviceName();
  }

  _resolveDeviceId() {
    try {
      const hostname = os.hostname() || 'pos';
      return hostname.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    } catch {
      return 'primary';
    }
  }

  _resolveDeviceName() {
    try {
      return os.hostname() || 'Main POS';
    } catch {
      return 'Main POS';
    }
  }

  /**
   * Start recurring background sync every 2 minutes
   */
  start() {
    if (this._intervalId) return;

    // First sync after 5 seconds of startup
    setTimeout(() => {
      this.triggerSync().catch(() => {});
    }, 5000);

    this._intervalId = setInterval(() => {
      this.triggerSync().catch(() => {});
    }, this._syncIntervalMs);

    console.log(`[DailySalesCloudSync] Started background sales sync (${this._deviceName} / ${this._deviceId} every 2m).`);
  }

  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /**
   * Safe, non-blocking background sync of the 6 AM - 6 AM business day totals with breakdown
   */
  async triggerSync() {
    if (this._isSyncing) return;
    const syncUrl = process.env.CLOUD_SALES_SYNC_URL || 'https://dubai-pwa.vercel.app/api/sync';

    this._isSyncing = true;
    try {
      // 6:00 AM to 5:59:59 AM next day business date
      const businessDate = dateUtils.getBusinessDate();

      // Overall totals
      const overall = dbEngine.get(`
        SELECT
          COALESCE(SUM(grand_total), 0) as totalSales,
          COUNT(id) as totalOrders
        FROM orders o
        WHERE o.business_date = ? AND ${SALE_PREDICATE}
      `, businessDate);

      const totalSales = Number(overall?.totalSales || 0);
      const totalOrders = Number(overall?.totalOrders || 0);

      // Breakdown by Order Type
      const breakdownRows = dbEngine.all(`
        SELECT 
          CASE 
            WHEN UPPER(order_type) LIKE '%DELIV%' THEN 'DELIVERY'
            WHEN UPPER(order_type) LIKE '%TAKE%' OR UPPER(order_type) LIKE '%PICK%' THEN 'TAKEAWAY'
            ELSE 'DINE_IN'
          END as type_group,
          COALESCE(SUM(grand_total), 0) as type_sales,
          COUNT(id) as type_orders
        FROM orders
        WHERE business_date = ? AND ${SALE_PREDICATE}
        GROUP BY type_group
      `, businessDate);

      let deliverySales = 0, deliveryOrders = 0;
      let dineInSales = 0, dineInOrders = 0;
      let takeawaySales = 0, takeawayOrders = 0;

      for (const row of breakdownRows) {
        if (row.type_group === 'DELIVERY') {
          deliverySales = Number(row.type_sales || 0);
          deliveryOrders = Number(row.type_orders || 0);
        } else if (row.type_group === 'TAKEAWAY') {
          takeawaySales = Number(row.type_sales || 0);
          takeawayOrders = Number(row.type_orders || 0);
        } else {
          dineInSales = Number(row.type_sales || 0);
          dineInOrders = Number(row.type_orders || 0);
        }
      }

      const secret = process.env.CLOUD_SYNC_SECRET || 'Azan@181314Sync2026';

      await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-secret': secret
        },
        body: JSON.stringify({
          business_date: businessDate,
          device_id: this._deviceId,
          device_name: this._deviceName,
          total_sales: totalSales,
          total_orders: totalOrders,
          delivery_sales: deliverySales,
          delivery_orders: deliveryOrders,
          dine_in_sales: dineInSales,
          dine_in_orders: dineInOrders,
          takeaway_sales: takeawaySales,
          takeaway_orders: takeawayOrders
        }),
        signal: AbortSignal.timeout(6000)
      });
      // Silent success - no log spam
    } catch (_) {
      // Intentionally silent: If internet is down or DNS fails, POS continues 100% unaffected
    } finally {
      this._isSyncing = false;
    }
  }
}

export const dailySalesCloudSync = new DailySalesCloudSync();
