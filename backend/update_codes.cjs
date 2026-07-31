const db = require('better-sqlite3')('storage/database/pos.db');

const cats = [
  'Regular Pizza',
  'Premium Pizza',
  'Square Pizza',
  'Burgers',
  'Shawarma',
  'Pratha Rolls',
  'Special Rolls',
  'Pasta',
  'Appetizers',
  'Sandwich',
  'Extra Toppings'
];

const catIds = db.prepare(`SELECT id FROM categories WHERE name IN (${cats.map(c => `'${c}'`).join(',')})`).all().map(c => c.id);
const allProducts = db.prepare(`SELECT id, category_id, name FROM products`).all();

db.transaction(() => {
  // Clear all codes to avoid conflicts
  for (const p of allProducts) {
    db.prepare('UPDATE products SET product_code = ? WHERE id = ?').run(`TEMP_${p.id}`, p.id);
  }

  // Fastfood starts at 100
  let fastFoodCounter = 100;
  // Others start at 500
  let otherCounter = 500;

  for (const p of allProducts) {
    if (catIds.includes(p.category_id)) {
      db.prepare('UPDATE products SET product_code = ? WHERE id = ?').run(fastFoodCounter.toString(), p.id);
      fastFoodCounter++;
    } else {
      db.prepare('UPDATE products SET product_code = ? WHERE id = ?').run(otherCounter.toString(), p.id);
      otherCounter++;
    }
  }
})();

console.log(`Updated all ${allProducts.length} products`);
