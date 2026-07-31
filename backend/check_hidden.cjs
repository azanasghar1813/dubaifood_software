const db = require('better-sqlite3')('storage/database/pos.db');
console.log(db.prepare("SELECT name, price, lifecycle_state FROM products WHERE lifecycle_state = 'HIDDEN' LIMIT 20").all());
