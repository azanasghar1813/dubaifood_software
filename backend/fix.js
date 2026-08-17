import sqlite3 from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'storage', 'database', 'pos.db');
const db = new sqlite3(dbPath);
const info = db.prepare("UPDATE products SET lifecycle_state = 'ACTIVE', status = 'AVAILABLE' WHERE lifecycle_state = 'DRAFT'").run();
console.log('Fixed', info.changes, 'products.');
