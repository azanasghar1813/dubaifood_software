const db = require('better-sqlite3')('storage/database/pos.db');
const deals = db.prepare("SELECT name, code FROM deals WHERE code LIKE '%DL-%'").all();
const products = db.prepare("SELECT name, product_code FROM products WHERE product_code LIKE '%DL-%'").all();
console.log('Deals with DL-:', deals);
console.log('Products with DL-:', products);
