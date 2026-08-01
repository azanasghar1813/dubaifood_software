import { dbEngine } from '../database/sqlite.js';

/**
 * SyncStatusService
 *
 * Read-only view of synchronization state for orders.
 * This service never modifies sync_queue — it only reads.
 * The synchronization layer is the single writer.
 *
 * Displayed in: Order History detail panel → Sync Status tab
 */
class SyncStatusService {
  /**
   * Get the sync metadata for an order.
   *
   * @param {string} orderId
   * @returns {Object} - { status, synced_at, pending_count, failed_count, events }
   */
  getOrderSyncStatus(orderId) {
    // Check the orders.sync_status column first (lightweight)
    const order = dbEngine.prepare(
      'SELECT sync_status, synced_at, sync_version FROM orders WHERE id = ?'
    ).get(orderId);

    if (!order) return null;

    // Get detailed sync events from the queue
    const events = dbEngine.prepare(`
      SELECT entity_type, action, status, created_at, updated_at, error_details, retry_count
      FROM sync_queue
      WHERE entity_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).all(orderId);

    // Also look up payment sync events for this order
    const paymentEvents = dbEngine.prepare(`
      SELECT sq.entity_type, sq.action, sq.status, sq.created_at, sq.updated_at,
             sq.error_details, sq.retry_count
      FROM sync_queue sq
      JOIN order_payments op ON sq.entity_id = op.id
      WHERE op.order_id = ?
      ORDER BY sq.created_at DESC
      LIMIT 10
    `).all(orderId);

    const allEvents = [...events, ...paymentEvents].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    const pendingCount = allEvents.filter(e => e.status === 'PENDING').length;
    const failedCount  = allEvents.filter(e => e.status === 'FAILED').length;
    const syncedCount  = allEvents.filter(e => e.status === 'SYNCED').length;

    // Determine overall sync status
    let overallStatus = order.sync_status;
    if (failedCount > 0 && pendingCount === 0) overallStatus = 'FAILED';
    else if (pendingCount > 0) overallStatus = 'PENDING';
    else if (syncedCount > 0 && pendingCount === 0 && failedCount === 0) overallStatus = 'SYNCED';

    return {
      sync_status:    overallStatus,
      synced_at:      order.synced_at   || null,
      sync_version:   order.sync_version || 1,
      pending_count:  pendingCount,
      failed_count:   failedCount,
      synced_count:   syncedCount,
      events:         allEvents,
      display: {
        label:     this._getLabel(overallStatus),
        color:     this._getColor(overallStatus),
        icon:      this._getIcon(overallStatus),
        retry_required: failedCount > 0,
        last_sync_at:   order.synced_at,
      },
    };
  }

  _getLabel(status) {
    return {
      PENDING:    'Sync Pending',
      SYNCED:     'Synced',
      FAILED:     'Sync Failed',
      RETRY:      'Retry Required',
    }[status] || status;
  }

  _getColor(status) {
    return {
      PENDING:    'amber',
      SYNCED:     'green',
      FAILED:     'red',
      RETRY:      'orange',
    }[status] || 'gray';
  }

  _getIcon(status) {
    return {
      PENDING:    'clock',
      SYNCED:     'check-circle',
      FAILED:     'x-circle',
      RETRY:      'refresh-cw',
    }[status] || 'help-circle';
  }
}

export const syncStatusService = new SyncStatusService();
