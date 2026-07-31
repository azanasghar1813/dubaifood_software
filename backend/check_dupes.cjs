const db = require('better-sqlite3')('storage/database/pos.db');

try {
  const products = db.prepare('SELECT id, name, product_code, display_order, price FROM products WHERE display_order > 0 ORDER BY display_order ASC').all();
  console.log(products);
} catch (e) {
  console.error(e);
}
