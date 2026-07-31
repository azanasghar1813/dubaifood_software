const db = require('better-sqlite3')('storage/database/pos.db');

const cats = db.prepare('SELECT id, name, parent_id FROM categories ORDER BY created_at ASC').all();
const nameMap = new Map();

db.transaction(() => {
  for (const c of cats) {
    if (nameMap.has(c.name)) {
      const targetId = nameMap.get(c.name);
      // Move all products from duplicate category to original category
      const res = db.prepare('UPDATE products SET category_id = ? WHERE category_id = ?').run(targetId, c.id);
      
      // Update parent_id of any subcategories that point to the duplicate
      db.prepare('UPDATE categories SET parent_id = ? WHERE parent_id = ?').run(targetId, c.id);
      
      // Delete the duplicate category
      db.prepare('DELETE FROM categories WHERE id = ?').run(c.id);
      console.log(`Merged duplicate ${c.name} (moved ${res.changes} products)`);
    } else {
      nameMap.set(c.name, c.id);
    }
  }
})();

console.log('Duplicate categories merged successfully.');
