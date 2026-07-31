const db = require('better-sqlite3')('storage/database/pos.db');

try {
  const result = db.prepare("UPDATE products SET lifecycle_state = 'HIDDEN' WHERE price = 0").run();
  console.log(`Hidden ${result.changes} zero-price products`);
} catch (e) {
  console.error(e);
}
