const db = require('better-sqlite3')('storage/database/pos.db');

try {
  db.exec('PRAGMA foreign_keys = OFF;');
  
  db.transaction(() => {
    // 1. Rename existing table
    db.exec('ALTER TABLE order_items RENAME TO _order_items_old;');
    
    // 2. Create new table without the product_id foreign key
    db.exec(`
      CREATE TABLE order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL,
        subtotal REAL NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
    `);
    
    // 3. Copy data
    db.exec('INSERT INTO order_items SELECT * FROM _order_items_old;');
    
    // 4. Drop old table
    db.exec('DROP TABLE _order_items_old;');
  })();
  
  db.exec('PRAGMA foreign_keys = ON;');
  console.log('Successfully removed foreign key constraint from order_items.product_id');
} catch (e) {
  console.error('Migration failed:', e);
}
