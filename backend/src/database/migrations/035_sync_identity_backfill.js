import crypto from 'crypto';
import { SYSTEM_USER_ID, SYSTEM_SHIFT_ID } from '../../sync/syncIdentities.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const hasCol = (db, table, col) =>
  db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);

const tableExists = (db, table) =>
  !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table);

const retarget = (db, table, column, oldId, newId) => {
  if (!tableExists(db, table) || !hasCol(db, table, column)) return;
  db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`).run(newId, oldId);
};

const rewritePrimary = (db, table, oldId, newId) => {
  if (!tableExists(db, table) || oldId === newId) return;
  const oldRow = db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(oldId);
  if (!oldRow) return;
  const clash = db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(newId);
  if (!clash) {
    db.prepare(`UPDATE ${table} SET id = ? WHERE id = ?`).run(newId, oldId);
  }
};

const enqueueMissing = (db, entityType, entityId, action = 'CREATED', version = 1) => {
  if (!entityId) return;
  const existing = db.prepare(
    `SELECT id, status FROM sync_queue WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT 1`
  ).get(entityType, entityId);
  if (existing && (existing.status === 'PENDING' || existing.status === 'SYNCED')) return;
  if (existing && (existing.status === 'FAILED' || existing.status === 'CONFLICT')) {
    db.prepare(
      `UPDATE sync_queue SET status = 'PENDING', permanent_failure = 0, error_details = NULL, payload_version = COALESCE(payload_version, 1) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(existing.id);
    return;
  }
  db.prepare(
    `INSERT INTO sync_queue (id, entity_type, entity_id, action, metadata, payload_version, status)
     VALUES (?, ?, ?, ?, '{}', ?, 'PENDING')`
  ).run(crypto.randomUUID(), entityType, entityId, action, version || 1);
};

export default {
  version: '035',
  name: 'sync_identity_backfill',
  disableForeignKeys: true,
  up: (db) => {
    rewritePrimary(db, 'users', 'SYSTEM_USER', SYSTEM_USER_ID);
    retarget(db, 'cashier_sessions', 'user_id', 'SYSTEM_USER', SYSTEM_USER_ID);
    retarget(db, 'orders', 'cashier_user_id', 'SYSTEM_USER', SYSTEM_USER_ID);
    retarget(db, 'orders', 'waiter_id', 'SYSTEM_USER', SYSTEM_USER_ID);
    retarget(db, 'orders', 'rider_id', 'SYSTEM_USER', SYSTEM_USER_ID);
    retarget(db, 'order_payments', 'cashier_user_id', 'SYSTEM_USER', SYSTEM_USER_ID);
    retarget(db, 'order_payments', 'voided_by_user_id', 'SYSTEM_USER', SYSTEM_USER_ID);
    retarget(db, 'activity_logs', 'user_id', 'SYSTEM_USER', SYSTEM_USER_ID);
    if (tableExists(db, 'sync_queue')) {
      db.prepare(
        `UPDATE sync_queue SET entity_id = ? WHERE entity_type IN ('USER', 'EMPLOYEE') AND entity_id = 'SYSTEM_USER'`
      ).run(SYSTEM_USER_ID);
    }

    rewritePrimary(db, 'cashier_sessions', 'SYSTEM_SHIFT', SYSTEM_SHIFT_ID);
    retarget(db, 'orders', 'shift_id', 'SYSTEM_SHIFT', SYSTEM_SHIFT_ID);
    retarget(db, 'order_payments', 'shift_id', 'SYSTEM_SHIFT', SYSTEM_SHIFT_ID);

    const mockShift = 'mock-session-123';
    if (tableExists(db, 'cashier_sessions') && db.prepare('SELECT 1 FROM cashier_sessions WHERE id = ?').get(mockShift)) {
      const mockUuid = crypto.randomUUID();
      rewritePrimary(db, 'cashier_sessions', mockShift, mockUuid);
      retarget(db, 'orders', 'shift_id', mockShift, mockUuid);
      retarget(db, 'order_payments', 'shift_id', mockShift, mockUuid);
    }

    if (tableExists(db, 'dining_tables')) {
      const tables = db.prepare('SELECT id FROM dining_tables').all();
      for (const t of tables) {
        if (UUID_RE.test(t.id)) continue;
        const newId = crypto.randomUUID();
        retarget(db, 'orders', 'table_id', t.id, newId);
        rewritePrimary(db, 'dining_tables', t.id, newId);
      }
    }

    if (tableExists(db, 'application_settings')) {
      if (!hasCol(db, 'application_settings', 'category')) {
        db.exec(`ALTER TABLE application_settings ADD COLUMN category TEXT NOT NULL DEFAULT 'GENERAL'`);
      }
      db.prepare(`UPDATE application_settings SET category = 'GENERAL' WHERE category IS NULL OR category = ''`).run();
    }

    const typeTable = {
      PRODUCT: 'products',
      CATEGORY: 'categories',
      DEAL: 'deals',
      CUSTOMER: 'customers',
      USER: 'users',
      ORDER: 'orders',
      ORDER_ITEM: 'order_items',
      ORDER_PAYMENT: 'order_payments',
      DINING_TABLE: 'dining_tables'
    };

    if (tableExists(db, 'sync_queue')) {
      const conflicts = db.prepare(`SELECT entity_type, entity_id FROM sync_queue WHERE status = 'CONFLICT'`).all();
      for (const c of conflicts) {
        const table = typeTable[c.entity_type];
        if (table && tableExists(db, table) && hasCol(db, table, 'payload_version')) {
          db.prepare(`UPDATE ${table} SET payload_version = COALESCE(payload_version, 1) + 1 WHERE id = ?`).run(c.entity_id);
        }
      }
      db.prepare(
        `UPDATE sync_queue SET status = 'PENDING', permanent_failure = 0, error_details = NULL, payload_version = COALESCE(payload_version, 1) + 1, updated_at = CURRENT_TIMESTAMP WHERE status IN ('CONFLICT', 'FAILED')`
      ).run();
    }

    for (const [type, table] of Object.entries(typeTable)) {
      if (!tableExists(db, table)) continue;
      const rows = db.prepare(`SELECT id FROM ${table}`).all();
      for (const row of rows) {
        const version = hasCol(db, table, 'payload_version')
          ? (db.prepare(`SELECT payload_version FROM ${table} WHERE id = ?`).get(row.id)?.payload_version || 1)
          : 1;
        enqueueMissing(db, type, row.id, 'CREATED', version);
      }
    }

    if (tableExists(db, 'application_settings')) {
      const settings = db.prepare('SELECT key FROM application_settings').all();
      for (const s of settings) {
        enqueueMissing(db, 'SETTING', s.key, 'UPDATED', 1);
      }
    }
  },
  down: () => {}
};
