export default {
  version: '043',
  name: 'lan_sync_hardening',

  up: (db) => {
    // 1. Create temp_ticket_sequences
    db.exec(`
      CREATE TABLE IF NOT EXISTS temp_ticket_sequences (
        device_id TEXT PRIMARY KEY,
        seq INTEGER NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create pending_kitchen_prints
    db.exec(`
      CREATE TABLE IF NOT EXISTS pending_kitchen_prints (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        cashier_user_id TEXT,
        options TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Add synced_to_hub column to orders
    try {
      db.exec(`ALTER TABLE orders ADD COLUMN synced_to_hub INTEGER DEFAULT 1;`);
    } catch (e) {
      if (!e.message.includes('duplicate column name')) throw e;
    }
  },

  down: (db) => {
    db.exec(`
      DROP TABLE IF EXISTS temp_ticket_sequences;
      DROP TABLE IF EXISTS pending_kitchen_prints;
    `);
    // SQLite does not support easily dropping columns natively
  }
};
