import crypto from 'crypto';
import { dbEngine } from '../database/sqlite.js';

export const activityLogService = {
  /**
   * Logs an action to the audit trail securely.
   * @param {string|null} userId - ID of the user performing the action (null for system events)
   * @param {string} action - The specific action (e.g., 'LOGIN_SUCCESS', 'VOID_ORDER')
   * @param {string} entityType - The category of the entity (e.g., 'AUTH', 'ORDER')
   * @param {string|null} entityId - Specific ID of the affected entity
   * @param {Object} details - Any structured JSON data providing context
   */
  logActivity: (userId, action, entityType, entityId = null, details = {}, options = {}) => {
    try {
      const stmt = dbEngine.db.prepare(`
        INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        crypto.randomUUID(),
        userId,
        action,
        entityType,
        entityId,
        JSON.stringify(details)
      );
    } catch (error) {
      // We log to the console but do not throw, as we don't want a failed log 
      // to crash the main business transaction in production.
      console.error(`[ActivityLog] Failed to record activity: ${action}`, error);
      if (options.strict) {
        throw error;
      }
    }
  }
};
