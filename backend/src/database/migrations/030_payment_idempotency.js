export const migration = {
  version: 30,
  name: 'add_payment_idempotency',
  up: (db) => {
    // Check if column exists first to be idempotent
    const tableInfo = db.prepare('PRAGMA table_info(order_payments)').all();
    const hasIdempotencyKey = tableInfo.some(col => col.name === 'idempotency_key');

    if (!hasIdempotencyKey) {
      db.exec(`
        ALTER TABLE order_payments 
        ADD COLUMN idempotency_key TEXT UNIQUE;
      `);
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_order_payments_idempotency 
        ON order_payments(idempotency_key) 
        WHERE idempotency_key IS NOT NULL;
      `);
    }
  }
};
