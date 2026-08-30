import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

/**
 * Seeds Roles, Permissions, and the Super Admin account.
 * Uses INSERT OR IGNORE to guarantee idempotency.
 * 
 * @param {Object} db - The better-sqlite3 database instance
 * @returns {Object} Seeding statistics
 */
export const runAuthSeeder = (db) => {
  let inserted = 0;

  // 1. Roles
  const insertRole = db.prepare('INSERT OR IGNORE INTO roles (id, name, description, is_system) VALUES (?, ?, ?, ?)');
  
  const roles = [
    { id: crypto.randomUUID(), name: 'Super Admin', desc: 'Full system access', sys: 1 },
    { id: crypto.randomUUID(), name: 'Admin', desc: 'Administrative access', sys: 1 },
    { id: crypto.randomUUID(), name: 'Manager', desc: 'Store management', sys: 1 },
    { id: crypto.randomUUID(), name: 'Cashier', desc: 'Point of sale operations', sys: 1 },
    { id: crypto.randomUUID(), name: 'Kitchen', desc: 'Kitchen display access', sys: 1 },
    { id: crypto.randomUUID(), name: 'Waiter', desc: 'Table service operations', sys: 1 }
  ];

  for (const role of roles) {
    const res = insertRole.run(role.id, role.name, role.desc, role.sys);
    if (res.changes > 0) inserted++;
  }

  // 1.5. Permissions
  const insertPermission = db.prepare('INSERT OR IGNORE INTO permissions (id, code, module, description) VALUES (?, ?, ?, ?)');
  const permissions = [
    { id: crypto.randomUUID(), code: 'MANAGE_USERS', module: 'IAM', desc: 'Manage users' },
    { id: crypto.randomUUID(), code: 'MANAGE_ROLES', module: 'IAM', desc: 'Manage roles and permissions' },
    { id: crypto.randomUUID(), code: 'MANAGE_SETTINGS', module: 'CONFIG', desc: 'Manage system settings' },
    { id: crypto.randomUUID(), code: 'MANAGE_PRODUCTS', module: 'CATALOG', desc: 'Manage products and categories' }
  ];

  for (const perm of permissions) {
    const res = insertPermission.run(perm.id, perm.code, perm.module, perm.desc);
    if (res.changes > 0) inserted++;
  }

  // Link Permissions to Super Admin
  const superAdminRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('Super Admin');
  const allPerms = db.prepare('SELECT id FROM permissions').all();
  
  if (superAdminRole && allPerms.length > 0) {
    const linkPerm = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    for (const perm of allPerms) {
      linkPerm.run(superAdminRole.id, perm.id);
    }
  }

  // 2. Super Admin User
  
  if (superAdminRole) {
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, role_id, username, password_hash, first_name, last_name, pin_code, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const hashedPassword = bcrypt.hashSync('admin123', 10);
    const hashedPin = bcrypt.hashSync('1234', 10);

    const res = insertUser.run(
      crypto.randomUUID(),
      superAdminRole.id,
      'admin',
      hashedPassword,
      'Super',
      'Administrator',
      hashedPin,
      1
    );
    if (res.changes > 0) inserted++;

    // Rotate the well-known default PIN on first boot after this change.
    const admin = db.prepare("SELECT id, pin_code FROM users WHERE username = 'admin'").get();
    if (admin && bcrypt.compareSync('1234', admin.pin_code)) {
      const newPin = process.env.DEFAULT_ADMIN_PIN && process.env.DEFAULT_ADMIN_PIN.length >= 4
        ? process.env.DEFAULT_ADMIN_PIN
        : String(crypto.randomInt(100000, 1000000));
      db.prepare('UPDATE users SET pin_code = ?, force_pin_change = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(bcrypt.hashSync(newPin, 10), admin.id);

      try {
        const dbPath = typeof db.name === 'string' ? db.name : null;
        if (dbPath) {
          const pinFile = path.join(path.dirname(dbPath), 'ADMIN_PIN.txt');
          fs.writeFileSync(pinFile, `${newPin}\n`, { encoding: 'utf8' });
          console.log(`[Auth] Default admin PIN 1234 was rotated. New PIN written to ${pinFile}`);
        } else {
          console.log(`[Auth] Default admin PIN 1234 was rotated. New PIN: ${newPin}`);
        }
      } catch (err) {
        console.log(`[Auth] Default admin PIN 1234 was rotated. New PIN: ${newPin}`);
        console.warn('[Auth] Could not write ADMIN_PIN.txt:', err.message);
      }
    }
  }

  return { name: 'Auth', inserted };
};
