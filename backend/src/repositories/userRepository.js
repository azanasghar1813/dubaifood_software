import crypto from 'crypto';
import { dbEngine } from '../database/sqlite.js';

const usersHasSyncVersion = () => {
  try {
    return dbEngine.db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'sync_version');
  } catch {
    return false;
  }
};

const bumpSync = () => (usersHasSyncVersion() ? ', sync_version = sync_version + 1' : '');

export const userRepository = {
  findAll: () => {
    const stmt = dbEngine.db.prepare(`
      SELECT u.id, u.username, u.first_name, u.last_name, u.is_active, u.show_on_login, u.last_login, u.profile_photo, u.phone, u.email, u.joining_date, r.name as role_name, r.id as role_id 
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.username != 'system_user'
        AND u.id != '00000000-0000-4000-a000-000000000001'
      ORDER BY u.created_at DESC
    `);
    return stmt.all();
  },

  getAllActive: () => {
    const stmt = dbEngine.db.prepare(`
      SELECT u.id, u.username, u.first_name, u.last_name, r.name as role_name 
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1 AND u.show_on_login = 1
        AND u.username != 'system_user'
        AND u.id != '00000000-0000-4000-a000-000000000001'
      ORDER BY u.first_name ASC
    `);
    return stmt.all();
  },

  findById: (id) => {
    const stmt = dbEngine.db.prepare(`
      SELECT u.*, r.name as role_name 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `);
    return stmt.get(id);
  },

  findByUsername: (username) => {
    const stmt = dbEngine.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  },

  create: (userData) => {
    const id = crypto.randomUUID();
    const stmt = dbEngine.db.prepare(`
      INSERT INTO users (id, role_id, username, password_hash, pin_code, first_name, last_name, phone, email, joining_date, profile_photo, show_on_login)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      userData.roleId,
      userData.username,
      userData.passwordHash,
      userData.pinCode, // Hashed pin
      userData.firstName,
      userData.lastName,
      userData.phone || null,
      userData.email || null,
      userData.joiningDate || null,
      userData.profilePhoto || null,
      userData.showOnLogin === false ? 0 : 1
    );
    return id;
  },

  updateProfile: (id, data) => {
    const stmt = dbEngine.db.prepare(`
      UPDATE users 
      SET username = ?, first_name = ?, last_name = ?, phone = ?, email = ?, profile_photo = ?, role_id = ?, show_on_login = ?, updated_at = CURRENT_TIMESTAMP${bumpSync()}
      WHERE id = ?
    `);
    stmt.run(data.username, data.firstName, data.lastName, data.phone, data.email, data.profilePhoto, data.roleId, data.showOnLogin === false ? 0 : 1, id);
  },

  updateStatus: (id, isActive) => {
    const stmt = dbEngine.db.prepare(`UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP${bumpSync()} WHERE id = ?`);
    stmt.run(isActive ? 1 : 0, id);
  },

  updatePin: (id, newHashedPin) => {
    const stmt = dbEngine.db.prepare(`UPDATE users SET pin_code = ?, updated_at = CURRENT_TIMESTAMP${bumpSync()} WHERE id = ?`);
    stmt.run(newHashedPin, id);
  },

  updatePhoto: (id, photoPath) => {
    const stmt = dbEngine.db.prepare(`UPDATE users SET profile_photo = ?, updated_at = CURRENT_TIMESTAMP${bumpSync()} WHERE id = ?`);
    stmt.run(photoPath, id);
  },

  incrementFailedAttempts: (userId, currentAttempts) => {
    const newAttempts = currentAttempts + 1;
    let lockedUntil = null;
    if (newAttempts >= 5) {
      lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }
    const stmt = dbEngine.db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?');
    stmt.run(newAttempts, lockedUntil, userId);
    return { lockedUntil };
  },

  resetFailedAttempts: (userId) => {
    const stmt = dbEngine.db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?');
    stmt.run(userId);
  },

  updateLastLogin: (userId) => {
    const stmt = dbEngine.db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(userId);
  },

  getUserPermissions: (roleId) => {
    const stmt = dbEngine.db.prepare(`
      SELECT p.code 
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
    `);
    const rows = stmt.all(roleId);
    return rows.map(r => r.code);
  }
};
