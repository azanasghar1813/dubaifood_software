const db = require('better-sqlite3')('storage/database/pos.db');

try {
  // Find all products with display_order > 0
  const products = db.prepare('SELECT id, name, display_order FROM products WHERE display_order > 0 ORDER BY display_order ASC').all();
  
  const seen = new Set();
  const toDelete = [];
  
  for (const p of products) {
    const key = `${p.name}-${p.display_order}`;
    if (seen.has(key)) {
      toDelete.push(p.id);
    } else {
      seen.add(key);
    }
  }
  
  console.log(`Found ${toDelete.length} duplicates to delete.`);
  
  if (toDelete.length > 0) {
    db.transaction(() => {
      const delStmt = db.prepare('DELETE FROM products WHERE id = ?');
      for (const id of toDelete) {
        delStmt.run(id);
      }
    })();
    console.log('Deleted duplicates.');
  }
} catch (e) {
  console.error(e);
}
