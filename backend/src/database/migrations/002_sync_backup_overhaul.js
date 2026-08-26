export default {
  version: '002',
  name: 'sync_backup_overhaul',

  up: (db) => {
    // 1. Add permanent_failure to sync_queue
    try {
      db.exec(`ALTER TABLE sync_queue ADD COLUMN permanent_failure BOOLEAN DEFAULT 0;`);
    } catch (e) {
      if (!e.message.includes('duplicate column name')) console.warn(e.message);
    }

    // 2. Add locked_by to orders
    try {
      db.exec(`ALTER TABLE orders ADD COLUMN locked_by TEXT;`);
    } catch (e) {
      if (!e.message.includes('duplicate column name')) console.warn(e.message);
    }

    // 3. Create sync_conflicts table
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_conflicts (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        local_version INTEGER,
        server_version INTEGER,
        resolution TEXT, -- 'PENDING', 'KEPT_LOCAL', 'KEPT_SERVER', 'MERGED'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME
      );
    `);

    // 4. Add deleted_at tombstones to all syncable tables
    const tables = [
      'products', 'categories', 'deals', 'customers', 
      'users', 'orders', 'order_items', 'order_payments', 'dining_tables'
    ];

    for (const table of tables) {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at DATETIME;`);
      } catch (e) {
        if (!e.message.includes('duplicate column name')) console.warn(`Failed adding deleted_at to ${table}:`, e.message);
      }
    }
  },

  down: (db) => {
    console.warn('Manual rollback required for 002_sync_backup_overhaul.');
  }
};
