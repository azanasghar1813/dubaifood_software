export default {
  version: '047',
  name: 'covering_order_metadata_index',
  
  up: (db) => {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_order_metadata_covering 
      ON order_metadata(order_id, meta_key, meta_value);

      DROP INDEX IF EXISTS idx_order_metadata_priority;

      CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at 
      ON activity_logs(created_at DESC);
    `);
  },

  down: (db) => {
    db.exec(`
      DROP INDEX IF EXISTS idx_order_metadata_covering;
      DROP INDEX IF EXISTS idx_activity_logs_created_at;
    `);
  }
};
