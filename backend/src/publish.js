import Database from 'better-sqlite3';
const db = new Database('C:/Users/Azan/Desktop/Dubai Food Software/backend/storage/database/pos.db');
db.prepare("UPDATE categories SET lifecycle_state = 'ACTIVE'").run();
db.prepare("UPDATE products SET lifecycle_state = 'ACTIVE'").run();
db.prepare("UPDATE product_variants SET lifecycle_state = 'ACTIVE'").run();
console.log("Published all items (categories, products, variants) as ACTIVE.");
