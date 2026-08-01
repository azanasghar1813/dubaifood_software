import crypto from 'crypto';
import { dbEngine } from '../database/sqlite.js';

export const cashierSessionRepository = {
  findOpenSessionForUser: (userId) => {
    return dbEngine.prepare(`
      SELECT * FROM cashier_sessions
      WHERE user_id = ? AND status = 'OPEN'
      ORDER BY opened_at DESC
      LIMIT 1
    `).get(userId);
  },

  createSession: (userId, terminalId = 'DEFAULT_TERMINAL', openingFloat = 0) => {
    const id = crypto.randomUUID();
    dbEngine.prepare(`
      INSERT INTO cashier_sessions (id, user_id, terminal_id, opening_float, status)
      VALUES (?, ?, ?, ?, 'OPEN')
    `).run(id, userId, terminalId, openingFloat);
    return id;
  },

  getOrCreateOpenSession: (userId, terminalId = 'DEFAULT_TERMINAL', openingFloat = 0) => {
    const existing = cashierSessionRepository.findOpenSessionForUser(userId);
    if (existing) return existing.id;
    return cashierSessionRepository.createSession(userId, terminalId, openingFloat);
  },

  findById: (sessionId) => {
    return dbEngine.prepare('SELECT * FROM cashier_sessions WHERE id = ?').get(sessionId);
  },
};
