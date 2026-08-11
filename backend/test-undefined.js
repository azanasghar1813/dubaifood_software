import { dbEngine } from './src/database/sqlite.js';
dbEngine.connect('C:\\Users\\Azan\\Desktop\\Dubai Food Software\\backend\\storage\\database\\pos.db');

try {
  dbEngine.prepare(`CREATE TABLE IF NOT EXISTS test (id TEXT, name TEXT)`).run();
  dbEngine.prepare(`INSERT INTO test (id, name) VALUES (@id, @name)`).run({ id: '1', name: undefined });
  console.log("Success with undefined name");
} catch (e) {
  console.log("Error when name is undefined:", e.message);
}

try {
  dbEngine.prepare(`INSERT INTO test (id, name) VALUES (@id, @name)`).run({ id: '2' });
  console.log("Success with missing name");
} catch (e) {
  console.log("Error when object is missing name:", e.message);
}
