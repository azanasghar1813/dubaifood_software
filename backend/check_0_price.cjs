const db = require('better-sqlite3')('storage/database/pos.db');
const products = db.prepare(`
  SELECT p.name, p.price, p.id,
         (SELECT count(*) FROM product_variants v WHERE v.product_id = p.id) as variant_count
  FROM products p
  JOIN categories c ON p.category_id = c.id
  WHERE c.parent_id = '66f1293c-4e70-4c2f-980e-29332fea9b1a' AND p.price = 0
`).all();
console.log(products);
