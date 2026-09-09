export default {
  version: '042',
  name: 'ticket_leases',

  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_leases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        business_date TEXT NOT NULL,
        range_start INTEGER NOT NULL,
        range_end INTEGER NOT NULL,
        next_sequence INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(device_id, range_start)
      );
    `);
  },

  down: (db) => {
    db.exec(`DROP TABLE IF EXISTS ticket_leases;`);
  }
};
