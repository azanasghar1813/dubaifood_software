import crypto from 'crypto';
import { dbEngine } from '../database/sqlite.js';

export const roleRepository = {
  findAll: () => {
    const stmt = dbEngine.db.prepare('SELECT * FROM roles ORDER BY name ASC');
    return stmt.all();
  },

  findById: (id) => {
    const stmt = dbEngine.db.prepare('SELECT * FROM roles WHERE id = ?');
    return stmt.get(id);
  },

  findByName: (name) => {
    const stmt = dbEngine.db.prepare('SELECT * FROM roles WHERE name = ? COLLATE NOCASE');
    return stmt.get(name);
  },

  create: (name, description, isSystem = 0) => {
    const id = crypto.randomUUID();
    const stmt = dbEngine.db.prepare(`
      INSERT INTO roles (id, name, description, is_system)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, name, description, isSystem);
    return id;
  },

  update: (id, name, description) => {
    const stmt = dbEngine.db.prepare(`
      UPDATE roles 
      SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(name, description, id);
  },

  delete: (id) => {
    const stmt = dbEngine.db.prepare('DELETE FROM roles WHERE id = ?');
    stmt.run(id);
  },

  getRolePermissions: (roleId) => {
    const stmt = dbEngine.db.prepare(`
      SELECT p.id, p.code, p.module, p.description 
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
    `);
    return stmt.all(roleId);
  },

  assignPermissions: (roleId, permissionIds) => {
    const insertStmt = dbEngine.db.prepare(`
      INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)
    `);
    permissionIds.forEach(permId => insertStmt.run(roleId, permId));
  },

  clearPermissions: (roleId) => {
    const stmt = dbEngine.db.prepare('DELETE FROM role_permissions WHERE role_id = ?');
    stmt.run(roleId);
  }
};
