const db = require('better-sqlite3')('storage/database/pos.db');
db.prepare("UPDATE products SET lifecycle_state = 'HIDDEN' WHERE price = 0").run();
console.log("Hidden products with price 0");
