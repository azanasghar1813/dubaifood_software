const { dbEngine } = require('../sqlite.js');

module.exports = {
  up: () => {
    // Check if idempotency_key column exists in orders table
    const columns = dbEngine.prepare("PRAGMA table_info(orders)").all();
    const hasIdempotencyKey = columns.some(col => col.name === 'idempotency_key');

    if (!hasIdempotencyKey) {
      console.log('Adding idempotency_key to orders table...');
      dbEngine.prepare("ALTER TABLE orders ADD COLUMN idempotency_key TEXT UNIQUE").run();
    }
  },
  down: () => {
    // SQLite doesn't easily support dropping columns without recreating the table
    console.log('Skipping down migration for idempotency_key in orders table.');
  }
};
