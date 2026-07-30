import { dbEngine } from '../database/sqlite.js';

export const permissionRepository = {
  findAll: () => {
    const stmt = dbEngine.db.prepare('SELECT * FROM permissions ORDER BY module ASC, code ASC');
    return stmt.all();
  },

  findByModule: (module) => {
    const stmt = dbEngine.db.prepare('SELECT * FROM permissions WHERE module = ? ORDER BY code ASC');
    return stmt.all(module);
  }
};
