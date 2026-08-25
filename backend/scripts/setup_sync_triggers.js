import config from '../src/config/index.js'; // Ensure env and config are loaded
import { dbEngine } from '../src/database/sqlite.js';

async function setupTriggers() {
  await dbEngine.connect(config.paths.database.file);

  const tables = [
    'categories', 'products', 'deals', 'customers', 'users', 'settings', 'orders',
    'order_items', 'order_payments', 'dining_tables'
  ];

  console.log('Adding payload_version to tables...');
  for (const table of tables) {
    try {
      // Try to add payload_version if it doesn't exist. Ignore errors if it does.
      dbEngine.db.prepare(`ALTER TABLE ${table} ADD COLUMN payload_version INTEGER NOT NULL DEFAULT 1`).run();
      console.log(`Added payload_version to ${table}`);
    } catch (e) {
      if (!e.message.includes('duplicate column name')) {
        console.error(`Error adding payload_version to ${table}:`, e.message);
      }
    }
  }

  // Ensure sync_queue has payload_version and metadata
  try {
    dbEngine.db.prepare(`ALTER TABLE sync_queue ADD COLUMN payload_version INTEGER NOT NULL DEFAULT 1`).run();
  } catch(e) {}
  
  try {
    dbEngine.db.prepare(`ALTER TABLE sync_queue ADD COLUMN metadata TEXT`).run();
  } catch(e) {}

  console.log('Setting up triggers...');
  for (const table of tables) {
    const entityType = table.toUpperCase().replace(/S$/, ''); // naive singular
    
    // INSERT TRIGGER
    try {
      dbEngine.db.prepare(`
        CREATE TRIGGER IF NOT EXISTS sync_${table}_insert
        AFTER INSERT ON ${table}
        BEGIN
          INSERT INTO sync_queue (id, entity_type, entity_id, action, status, payload_version)
          VALUES (lower(hex(randomblob(16))), '${entityType}', NEW.id, 'INSERT', 'PENDING', NEW.payload_version);
        END;
      `).run();
    } catch(e) { console.error(e); }

    // UPDATE TRIGGER
    try {
      dbEngine.db.prepare(`
        CREATE TRIGGER IF NOT EXISTS sync_${table}_update
        AFTER UPDATE ON ${table}
        BEGIN
          INSERT INTO sync_queue (id, entity_type, entity_id, action, status, payload_version)
          VALUES (lower(hex(randomblob(16))), '${entityType}', NEW.id, 'UPDATE', 'PENDING', NEW.payload_version);
        END;
      `).run();
    } catch(e) { console.error(e); }

    // DELETE TRIGGER
    try {
      dbEngine.db.prepare(`
        CREATE TRIGGER IF NOT EXISTS sync_${table}_delete
        AFTER DELETE ON ${table}
        BEGIN
          INSERT INTO sync_queue (id, entity_type, entity_id, action, status, payload_version)
          VALUES (lower(hex(randomblob(16))), '${entityType}', OLD.id, 'DELETE', 'PENDING', OLD.payload_version);
        END;
      `).run();
    } catch(e) { console.error(e); }
  }

  console.log('Triggers setup complete!');
}

setupTriggers().catch(console.error);
