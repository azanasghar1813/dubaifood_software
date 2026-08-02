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
  },

  /**
   * Retrieves activity logs with pagination and optional filtering
   */
  getLogs: (options = {}) => {
    const { limit = 100, offset = 0, userId, entityType, action } = options;
    let query = 'SELECT * FROM activity_logs WHERE 1=1';
    let params = [];
    
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    if (entityType) {
      query += ' AND entity_type = ?';
      params.push(entityType);
    }
    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const stmt = dbEngine.db.prepare(query);
    return stmt.all(...params);
  }
};
