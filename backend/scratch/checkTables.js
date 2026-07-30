import { dbEngine } from '../src/database/sqlite.js';
dbEngine.connect('../storage/database/pos.db');
const tables = dbEngine.all("SELECT name FROM sqlite_master WHERE type='table'");
console.log('TABLES:', tables);
