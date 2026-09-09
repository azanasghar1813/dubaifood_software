import { dbEngine } from '../database/sqlite.js';

const SYNC_TABLES = [
  { table: 'categories', type: 'CATEGORY' },
  { table: 'products', type: 'PRODUCT' },
  { table: 'deals', type: 'DEAL' },
  { table: 'customers', type: 'CUSTOMER' },
  { table: 'users', type: 'USER' },
  { table: 'orders', type: 'ORDER' },
  { table: 'order_items', type: 'ORDER_ITEM' },
  { table: 'order_payments', type: 'ORDER_PAYMENT' },
  { table: 'dining_tables', type: 'DINING_TABLE' },
  { table: 'tables', type: 'DINING_TABLE' },
  { table: 'product_variants', type: 'VARIANT' },
  { table: 'deal_components', type: 'DEAL_COMPONENT' },
  { table: 'product_images', type: 'PRODUCT_IMAGE' },
  { table: 'modifiers', type: 'MODIFIER' },
  { table: 'modifier_groups', type: 'MODIFIER_GROUP' },
  { table: 'order_timeline', type: 'ORDER_TIMELINE' },
  { table: 'order_audit_trail', type: 'ORDER_AUDIT_TRAIL' }
];

function tableExists(name) {
  return !!dbEngine.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

export function ensureSyncMuteTable() {
  dbEngine.prepare(`
    CREATE TABLE IF NOT EXISTS sync_mute (
      id INTEGER PRIMARY KEY CHECK (id = 1)
    )
  `).run();
}

export function muteSyncTriggers() {
  ensureSyncMuteTable();
  dbEngine.prepare('INSERT OR IGNORE INTO sync_mute (id) VALUES (1)').run();
}

export function unmuteSyncTriggers() {
  try {
    dbEngine.prepare('DELETE FROM sync_mute').run();
  } catch { /* table may not exist */ }
}

export function installGuardedSyncTriggers() {
  ensureSyncMuteTable();
  unmuteSyncTriggers();
  try {
    dbEngine.prepare('ALTER TABLE sync_queue ADD COLUMN payload_version INTEGER NOT NULL DEFAULT 1').run();
  } catch { /* exists */ }
  try {
    dbEngine.prepare("ALTER TABLE sync_queue ADD COLUMN lan_status TEXT DEFAULT 'PENDING'").run();
  } catch { /* exists */ }

  for (const { table, type } of SYNC_TABLES) {
    if (!tableExists(table)) continue;

    try { dbEngine.db.exec(`DROP TRIGGER IF EXISTS sync_${table}_insert`); } catch { /* ignore */ }
    try { dbEngine.db.exec(`DROP TRIGGER IF EXISTS sync_${table}_update`); } catch { /* ignore */ }
    try { dbEngine.db.exec(`DROP TRIGGER IF EXISTS sync_${table}_delete`); } catch { /* ignore */ }

    const hasPv = dbEngine.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === 'payload_version');
    const newVer = hasPv ? 'COALESCE(NEW.payload_version, 1)' : '1';
    const oldVer = hasPv ? 'COALESCE(OLD.payload_version, 1)' : '1';

    try {
      dbEngine.db.exec(`
        CREATE TRIGGER sync_${table}_insert
        AFTER INSERT ON ${table}
        WHEN (SELECT COUNT(*) FROM sync_mute) = 0
        BEGIN
          INSERT INTO sync_queue (id, entity_type, entity_id, action, status, payload_version)
          VALUES (lower(hex(randomblob(16))), '${type}', NEW.id, 'INSERT', 'PENDING', ${newVer});
        END;
      `);
      dbEngine.db.exec(`
        CREATE TRIGGER sync_${table}_update
        AFTER UPDATE ON ${table}
        WHEN (SELECT COUNT(*) FROM sync_mute) = 0
        BEGIN
          INSERT INTO sync_queue (id, entity_type, entity_id, action, status, payload_version)
          VALUES (lower(hex(randomblob(16))), '${type}', NEW.id, 'UPDATE', 'PENDING', ${newVer});
        END;
      `);
      dbEngine.db.exec(`
        CREATE TRIGGER sync_${table}_delete
        AFTER DELETE ON ${table}
        WHEN (SELECT COUNT(*) FROM sync_mute) = 0
        BEGIN
          INSERT INTO sync_queue (id, entity_type, entity_id, action, status, payload_version)
          VALUES (lower(hex(randomblob(16))), '${type}', OLD.id, 'DELETE', 'PENDING', ${oldVer});
        END;
      `);
    } catch (e) {
      console.warn(`[syncTriggers] Could not install triggers for ${table}:`, e.message);
    }
  }
}

export function withSyncMuted(fn) {
  muteSyncTriggers();
  try {
    return fn();
  } finally {
    unmuteSyncTriggers();
  }
}
