const db = require('better-sqlite3')('storage/database/pos.db');

db.transaction(() => {
  // 1. Activate ALL categories
  db.prepare("UPDATE categories SET lifecycle_state = 'ACTIVE'").run();

  // 2. Activate ALL products
  db.prepare("UPDATE products SET lifecycle_state = 'ACTIVE'").run();

  // 3. Hide ONLY the specific modifier products with 0 price that have no variants
  // First let's find out which ones those are.
  const allProducts = db.prepare('SELECT id, name, price FROM products').all();
  for (const p of allProducts) {
    const variantCount = db.prepare('SELECT count(*) as count FROM product_variants WHERE product_id = ?').get(p.id).count;
    if (p.price === 0 && variantCount === 0) {
      db.prepare("UPDATE products SET lifecycle_state = 'HIDDEN' WHERE id = ?").run(p.id);
      console.log(`Hid modifier product: ${p.name}`);
    }
  }
})();

console.log("Categories and products activated correctly!");
