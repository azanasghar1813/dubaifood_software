import { dbEngine } from '../database/sqlite.js';
import { dateUtils } from '../utils/dateUtils.js';
import { SALE_PREDICATE } from '../utils/saleScope.js';

class DailySalesCloudSync {
  constructor() {
    this._interval = null;
    this._isSyncing = false;
  }

  start() {
    const syncUrl = process.env.CLOUD_SALES_SYNC_URL || 'https://dubai-pwa.vercel.app/api/sync';
    console.log('[DailySalesCloudSync] Service started with target:', syncUrl);

    // Initial sync 10s after startup
    setTimeout(() => this.triggerSync(), 10000);

    // Periodic sync every 2 minutes
    this._interval = setInterval(() => {
      this.triggerSync();
    }, 2 * 60 * 1000);
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  /**
   * Safe, non-blocking background sync of the 6 AM - 6 AM business day totals
   */
  async triggerSync() {
    if (this._isSyncing) return;
    const syncUrl = process.env.CLOUD_SALES_SYNC_URL || 'https://dubai-pwa.vercel.app/api/sync';

    this._isSyncing = true;
    try {
      // 6:00 AM to 5:59:59 AM next day business date
      const businessDate = dateUtils.getBusinessDate();

      const row = dbEngine.get(`
        SELECT
          COALESCE(SUM(grand_total), 0) as totalSales,
          COUNT(id) as totalOrders
        FROM orders o
        WHERE o.business_date = ? AND ${SALE_PREDICATE}
      `, businessDate);

      const totalSales = Number(row?.totalSales || 0);
      const totalOrders = Number(row?.totalOrders || 0);
      const secret = process.env.CLOUD_SYNC_SECRET || 'Azan@181314Sync2026';

      await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-secret': secret
        },
        body: JSON.stringify({
          business_date: businessDate,
          total_sales: totalSales,
          total_orders: totalOrders
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
