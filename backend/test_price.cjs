const db = require('better-sqlite3')('storage/database/pos.db');
const products = db.prepare("SELECT name, price, display_order FROM products WHERE price = 0").all();
console.log('Zero price products:', products);
const all = db.prepare("SELECT name, price, display_order FROM products").all();
console.log('All products:', all.slice(0, 10));
