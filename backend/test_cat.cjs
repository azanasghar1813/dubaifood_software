const db = require('better-sqlite3')('storage/database/pos.db'); 
const active = db.prepare("SELECT * FROM categories WHERE lifecycle_state='ACTIVE'").all();
console.log(JSON.stringify(active, null, 2));
