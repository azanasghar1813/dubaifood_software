export default {
  version: '046',
  name: 'activity_logs_index',
  
  up: (db) => {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_entity 
      ON activity_logs(entity_id);
    `);
  },

  down: (db) => {
    db.exec(`DROP INDEX IF EXISTS idx_activity_logs_entity;`);
  }
};
