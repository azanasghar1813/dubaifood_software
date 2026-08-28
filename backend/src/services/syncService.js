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
    return dbEngine.prepare(`
      SELECT * FROM sync_queue 
      WHERE status = ? 
      ORDER BY updated_at DESC 
      LIMIT ?
    `).all(status, limit);
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
