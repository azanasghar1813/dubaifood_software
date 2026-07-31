const db = require('better-sqlite3')('storage/database/pos.db');

try {
  const products = db.prepare('SELECT id, name, product_code FROM products WHERE display_order > 0 ORDER BY display_order ASC').all();
  
  const updateStmt = db.prepare('UPDATE products SET product_code = ? WHERE id = ?');
  
  db.transaction(() => {
    products.forEach((p, index) => {
      const newCode = (100 + index).toString();
      updateStmt.run(newCode, p.id);
      console.log(`Updated ${p.name} -> ${newCode}`);
    });
  })();
  
  console.log('Successfully assigned numbers starting from 100 to all fast food products.');
} catch (e) {
  console.error(e);
}
