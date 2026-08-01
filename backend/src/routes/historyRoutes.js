import { Router } from 'express';
import {
  getOrderList,
  getOrderDetail,
  getOrderByNumber,
  getTimeline,
  getAuditTrail,
  searchOrders,
  getSyncStatus,
  getStats,
  getCacheStats,
  invalidateOrder,
} from '../controllers/historyController.js';

const router = Router();

// ─── Stats ────────────────────────────────────────────────────────────────────
router.get('/stats',                            getStats);
router.get('/cache/stats',                      getCacheStats);

// ─── Search ───────────────────────────────────────────────────────────────────
router.get('/search',                           searchOrders);

// ─── Order List ───────────────────────────────────────────────────────────────
// Supports all filter dimensions via query params:
//   ?date_preset=TODAY|YESTERDAY|LAST_7_DAYS|THIS_MONTH|CURRENT_SHIFT
//   ?date_from=2026-07-01&date_to=2026-07-31
//   ?lifecycle_state=COMPLETED,CANCELLED  (comma-separated for multi-select)
//   ?payment_state=PAID&order_type=DINE_IN
//   ?cashier_user_id=xxx&branch_id=xxx
//   ?min_amount=100&max_amount=5000
//   ?payment_method=CASH&product_name=burger
//   ?sort_by=NEWEST|OLDEST|HIGHEST|LOWEST|ORDER_NUMBER
//   ?page=1&limit=50
router.get('/orders',                           getOrderList);

// ─── Order Detail ─────────────────────────────────────────────────────────────
router.get('/orders/by-number/:orderNumber',    getOrderByNumber);
router.get('/orders/:orderId',                  getOrderDetail);
router.get('/orders/:orderId/timeline',         getTimeline);
router.get('/orders/:orderId/audit',            getAuditTrail);
router.get('/orders/:orderId/sync-status',      getSyncStatus);

// ─── Cache Management ─────────────────────────────────────────────────────────
router.post('/orders/:orderId/invalidate-cache', invalidateOrder);

export default router;
