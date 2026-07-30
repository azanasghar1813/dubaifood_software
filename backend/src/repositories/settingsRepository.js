import { dbEngine } from '../database/sqlite.js';

export const settingsRepository = {
  getBusinessSettings: () => {
    const stmt = dbEngine.db.prepare('SELECT key, value, category FROM business_settings');
    const rows = stmt.all();
    const settings = {};
    rows.forEach(row => {
      if (!settings[row.category]) settings[row.category] = {};
      settings[row.category][row.key] = row.value;
    });
    return settings;
  },

  getApplicationSettings: () => {
    const stmt = dbEngine.db.prepare('SELECT key, value, category FROM application_settings');
    const rows = stmt.all();
    const settings = {};
    rows.forEach(row => {
      if (!settings[row.category]) settings[row.category] = {};
      settings[row.category][row.key] = row.value;
    });
    return settings;
  },

  updateBusinessSettings: (category, kvPairs) => {
    const stmt = dbEngine.db.prepare(`
      INSERT INTO business_settings (key, value, category) 
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET 
      value = excluded.value, 
      category = excluded.category, 
      updated_at = CURRENT_TIMESTAMP
    `);
    
    dbEngine.transaction(() => {
      for (const [key, value] of Object.entries(kvPairs)) {
        stmt.run(key, value, category);
      }
    });
  },

  updateApplicationSettings: (category, kvPairs) => {
    const stmt = dbEngine.db.prepare(`
      INSERT INTO application_settings (key, value, category) 
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET 
      value = excluded.value, 
      category = excluded.category, 
      updated_at = CURRENT_TIMESTAMP
    `);
    
    dbEngine.transaction(() => {
      for (const [key, value] of Object.entries(kvPairs)) {
        stmt.run(key, value, category);
      }
    });
  }
};
