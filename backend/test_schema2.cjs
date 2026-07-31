const db = require('better-sqlite3')('storage/database/pos.db');
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").get();
console.log(schema.sql);
