const db = require('better-sqlite3')('storage/database/pos.db'); 
const active = db.prepare("SELECT name, display_order, lifecycle_state FROM products WHERE lifecycle_state='ACTIVE' LIMIT 20").all();
console.log(JSON.stringify(active, null, 2));
