export default {
  version: '040',
  name: 'users_sync_version',

  up: (db) => {
    const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
    const add = (sql) => {
      try { db.exec(sql); } catch (e) {
        if (!String(e.message).includes('duplicate column name')) throw e;
      }
    };
    if (!cols.includes('sync_version')) {
      add('ALTER TABLE users ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1');
    }
    if (!cols.includes('sync_status')) {
      add("ALTER TABLE users ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'PENDING'");
    }
  },

  down: () => {
    console.warn('Manual rollback required for 040_users_sync_version.');
  }
};
