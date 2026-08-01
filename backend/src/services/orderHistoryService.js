import { historyRepository } from '../repositories/historyRepository.js';
import { historyFilterService } from './historyFilterService.js';
import { historySearchService } from './historySearchService.js';
import { historyCacheService } from './historyCacheService.js';
import { auditService } from './auditService.js';
import { syncStatusService } from './syncStatusService.js';

/**
 * OrderHistoryService — The Central History Orchestrator
 *
 * This is the ONLY service that other modules (reports, analytics, loyalty)
 * should use to access historical order data. Never query orders directly.
 *
 * Principles:
 *   - All data returned is snapshot-based (never re-reads current catalog)
 *   - Results are paginated for large datasets
 *   - Cache is used intelligently
 *   - Viewing history does NOT generate activity logs
 *   - Administrative actions (cancel, reprint) DO generate audit entries
 */
class OrderHistoryService {
  // ──────────────────────────────────────────────────────────────────────────
  // Primary Query: Order List
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Paginated order list with full filter support.
   *
   * @param {Object} filters   - All filter dimensions (see historyFilterService)
   * @param {Object} pagination - { page, limit, sortBy }
   * @returns {Object} - { orders, total, page, limit, totalPages }
   */
  getOrderList(filters = {}, pagination = {}) {
    const page   = Math.max(1, parseInt(pagination.page)  || 1);
    const limit  = Math.min(200, parseInt(pagination.limit) || 50);
    const sortBy = pagination.sortBy || 'NEWEST';

    // Check list cache
    const cacheKey = historyCacheService.buildListKey({ ...filters, sortBy }, page, limit);
    const cached   = historyCacheService.getList(cacheKey);
    if (cached) return cached;

    // Build filter SQL
    const { sql: whereSql, params: whereParams } = historyFilterService.buildQuery(filters);
    const orderBySql = historyFilterService.buildOrderBy(sortBy);

    const result = historyRepository.findPaginated(whereSql, whereParams, orderBySql, page, limit);

    // Cache the result
    historyCacheService.setList(cacheKey, result);

    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Order Detail
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Full order detail — all sub-entities from snapshots.
   * Uses cache for repeat requests.
   *
   * @param {string} orderId
   * @returns {Object|null}
   */
  getOrderDetail(orderId) {
    // Check cache
    const cached = historyCacheService.getDetail(orderId);
    if (cached) return cached;

    const order = historyRepository.findFullDetail(orderId);
    if (!order) return null;

    // Cache with appropriate TTL based on business date
    historyCacheService.setDetail(orderId, order, order.business_date);

    return order;
  }

  /**
   * Find order by order number (exact match).
   */
  getByOrderNumber(orderNumber) {
    const order = historyRepository.findByOrderNumber(orderNumber);
    if (!order) return null;
    return this.getOrderDetail(order.id);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Timeline
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Chronological timeline of all events for an order.
   * Displayed as a visual timeline in the Order Detail panel.
   */
  getTimeline(orderId) {
    const detail = this.getOrderDetail(orderId);
    if (!detail) return null;

    return {
      order_id:     orderId,
      order_number: detail.order_number,
      events:       detail.timeline || [],
      total:        (detail.timeline || []).length,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Audit Trail
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Audit trail for an order.
   * Viewing the audit trail by an admin generates its own audit entry.
   *
   * @param {string} orderId
   * @param {string} viewingUserId  - User requesting the audit trail
   * @param {Object} options        - { recordViewAudit }
   */
  getAuditTrail(orderId, viewingUserId = null, options = {}) {
    const order = historyRepository.findLightweight(orderId);
    if (!order) return null;

    const entries = auditService.getByOrderId(orderId);

    // Record that this audit was viewed (only for admin/manager use)
    if (options.recordViewAudit && viewingUserId) {
      auditService.recordAuditView(orderId, viewingUserId, order.branch_id || 'DEFAULT_BRANCH');
    }

    return {
      order_id:     orderId,
      order_number: order.order_number,
      entries,
      total:        entries.length,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Search
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Enterprise full-text search across orders.
   *
   * @param {string} query
   * @param {Object} filters  - Additional filter dimensions
   * @param {Object} pagination
   */
  search(query, filters = {}, pagination = {}) {
    const page  = Math.max(1, parseInt(pagination.page)  || 1);
    const limit = Math.min(100, parseInt(pagination.limit) || 50);

    return historySearchService.search(query, filters, page, limit);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sync Status
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get sync status display data for an order.
   * Read-only — never triggers sync operations.
   */
  getSyncStatus(orderId) {
    return syncStatusService.getOrderSyncStatus(orderId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Stats & Aggregates
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Aggregate statistics for the history dashboard header.
   */
  getStats(filters = {}) {
    return historyRepository.getStats(filters);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Cache Management (for admin use)
  // ──────────────────────────────────────────────────────────────────────────

  getCacheStats() {
    return historyCacheService.getStats();
  }

  invalidateOrder(orderId) {
    historyCacheService.invalidateOrder(orderId);
    historySearchService.rebuildIndex(orderId);
  }
}

export const orderHistoryService = new OrderHistoryService();
