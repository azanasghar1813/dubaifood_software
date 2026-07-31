const db = require('better-sqlite3')('storage/database/pos.db');

const products = db.prepare(`
  SELECT p.id, p.name
  FROM products p
  WHERE p.price = 0
`).all();

let count = 0;
for (const p of products) {
  // Get variants
  const variants = db.prepare('SELECT price FROM product_variants WHERE product_id = ? ORDER BY price ASC').all(p.id);
  if (variants.length > 0) {
    const minPrice = variants[0].price;
    db.prepare('UPDATE products SET price = ? WHERE id = ?').run(minPrice, p.id);
    count++;
  }
}
console.log(`Updated ${count} products with base prices from variants.`);
