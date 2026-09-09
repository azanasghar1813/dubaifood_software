import { initDatabase } from './src/database/initDatabase.js';
import { dbEngine } from './src/database/sqlite.js';
initDatabase().then(() => {
  dbEngine.prepare("UPDATE application_settings SET value = 'false' WHERE key = 'cloud_sync_enabled'").run();
  dbEngine.prepare("UPDATE application_settings SET value = 'false' WHERE key = 'lan_sync_enabled'").run();
  console.log('Reset OK');
  process.exit(0);
});
