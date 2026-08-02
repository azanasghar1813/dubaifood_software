const Database = require('better-sqlite3');
const db = new Database('c:/Users/Azan/Desktop/Dubai Food Software/backend/storage/database/pos.db');

const products = db.prepare('SELECT id, name FROM products LIMIT 5').all();
console.log("Products:", products);

const variants = db.prepare('SELECT id, product_id, name FROM variants LIMIT 5').all();
console.log("Variants:", variants);
