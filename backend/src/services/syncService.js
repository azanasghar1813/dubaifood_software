import { dbEngine } from '../database/sqlite.js';
import crypto from 'crypto';

class SyncService {
  /**
   * Queues an event for MongoDB synchronization.
   * 
   * @param {string} entityType The type of entity (e.g., 'PRODUCT', 'CATEGORY', 'DEAL')
   * @param {string} entityId The UUID of the entity
   * @param {string} action The action taken ('CREATED', 'UPDATED', 'ARCHIVED', 'DELETED', 'IMAGE_CHANGED', etc.)
   * @param {Object} metadata Any additional contextual metadata
   * @param {number} payloadVersion The version number of the entity
   */
  queueSyncEvent(entityType, entityId, action, metadata = {}, payloadVersion = 1, options = {}) {
    try {
      const id = crypto.randomUUID();
      const metadataStr = JSON.stringify(metadata);

      const stmt = dbEngine.prepare(`
        INSERT INTO sync_queue (
          id, entity_type, entity_id, action, metadata, payload_version
        ) VALUES (
          ?, ?, ?, ?, ?, ?
        )
      `);

      stmt.run(id, entityType, entityId, action, metadataStr, payloadVersion);
      // In a real production system, this could also emit an event via an event bus to immediately notify the sync worker.
    } catch (error) {
      console.error(`[SyncService] Failed to queue sync event for ${entityType} ${entityId}:`, error.message);
      // We log but do not throw to prevent breaking the main transaction flow for minor sync errors
      if (options.strict) {
        throw error;
      }
    }
  }

  /**
   * Retrieves pending sync events for the worker.
   */
  getPendingEvents(limit = 100) {
    return dbEngine.prepare(`
      SELECT * FROM sync_queue
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT ?
    `).all(limit);
  }

  markEventSynced(eventId) {
    dbEngine.prepare(`
      UPDATE sync_queue SET status = 'SYNCED', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(eventId);
  }

  markEventFailed(eventId, errorMsg) {
    dbEngine.prepare(`
      UPDATE sync_queue 
      SET status = 'FAILED', error_details = ?, retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(errorMsg, eventId);
  }

  markEventPermanentFailure(eventId, errorMsg) {
    dbEngine.prepare(`
      UPDATE sync_queue 
      SET status = 'FAILED', error_details = ?, retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP, permanent_failure = 1
      WHERE id = ?
    `).run(errorMsg, eventId);
  }

  getQueue(status, limit = 50) {
    const rows = dbEngine.prepare(`
      SELECT * FROM sync_queue 
      WHERE status = ? 
      ORDER BY updated_at DESC 
      LIMIT ?
    `).all(status, limit);
    if (status !== 'CONFLICT') return rows;
    return rows.map((row) => this._decorateConflict(row));
  }

  _decorateConflict(row) {
    let cloud = {};
    try { cloud = row.error_details ? JSON.parse(row.error_details) : {}; } catch { cloud = { raw: row.error_details }; }

    const tableMap = {
      PRODUCT: 'products',
      CATEGORY: 'categories',
      DEAL: 'deals',
      CUSTOMER: 'customers',
      USER: 'users',
      EMPLOYEE: 'users',
      ORDER: 'orders',
      ORDER_ITEM: 'order_items',
      ORDER_PAYMENT: 'order_payments',
      PAYMENT: 'order_payments',
      DINING_TABLE: 'dining_tables',
      SETTING: 'application_settings'
    };
    const table = tableMap[row.entity_type];
    let local = null;
    if (table) {
      try {
        const record = table === 'application_settings'
          ? dbEngine.prepare('SELECT * FROM application_settings WHERE key = ?').get(row.entity_id)
          : dbEngine.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(row.entity_id);
        if (record) {
          if (table === 'orders') {
            const items = dbEngine.prepare(
              'SELECT product_name_snapshot as name, quantity FROM order_items WHERE order_id = ? LIMIT 8'
            ).all(row.entity_id);
            local = {
              order_number: record.order_number,
              status: record.lifecycle_state || record.status,
              payment: record.payment_state,
              total: record.grand_total ?? record.total_amount ?? record.total,
              updated_at: record.updated_at,
              items: items.map((i) => `${i.quantity}x ${i.name || 'Item'}`)
            };
          } else if (table === 'products' || table === 'categories' || table === 'deals') {
            local = { name: record.name, price: record.price ?? record.selling_price, updated_at: record.updated_at };
          } else if (table === 'users') {
            local = { username: record.username, name: `${record.first_name || ''} ${record.last_name || ''}`.trim(), updated_at: record.updated_at };
          } else if (table === 'customers') {
            local = { name: `${record.first_name || ''} ${record.last_name || ''}`.trim(), phone: record.phone, updated_at: record.updated_at };
          } else {
            local = { id: record.id, updated_at: record.updated_at };
          }
        } else {
          local = { missing: true };
        }
      } catch {
        local = { missing: true };
      }
    }

    const label = local?.order_number || local?.name || local?.username || row.entity_id;
    return {
      ...row,
      item: `${row.entity_type} · ${label}`,
      description: cloud.error
        ? cloud.error
        : `This ${String(row.entity_type || 'record').toLowerCase()} exists on the cloud with different data.`,
      local,
      cloud: {
        serverVersion: cloud.serverVersion,
        clientVersion: cloud.clientVersion,
        error: cloud.error || null,
        entityId: cloud.entityId || row.entity_id,
        needsPull: !!cloud.needsPull
      }
    };
  }

  retryEvent(eventId) {
    const info = dbEngine.prepare(`
      UPDATE sync_queue 
      SET status = 'PENDING', permanent_failure = 0, error_details = NULL 
      WHERE id = ? AND status = 'FAILED'
    `).run(eventId);
    return info.changes > 0;
  }

  retryAllEvents() {
    const info = dbEngine.prepare(`
      UPDATE sync_queue 
      SET status = 'PENDING', permanent_failure = 0, error_details = NULL 
      WHERE status = 'FAILED'
    `).run();
    return info.changes > 0;
  }

  markEventConflicted(eventId, conflictData) {
    dbEngine.prepare(`
      UPDATE sync_queue 
      SET status = 'CONFLICT', error_details = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(JSON.stringify(conflictData), eventId);
  }

  clearQueue(force = false) {
    if (force) {
      return dbEngine.prepare(`DELETE FROM sync_queue`).run().changes;
    }
    return dbEngine.prepare(`DELETE FROM sync_queue WHERE status = 'SYNCED' OR permanent_failure = 1`).run().changes;
  }
}

export const syncService = new SyncService();
