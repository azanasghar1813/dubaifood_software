import { roleRepository } from '../repositories/roleRepository.js';
import { activityLogService } from './activityLogService.js';
import { dbEngine } from '../database/sqlite.js';

export const roleService = {
  getAllRoles: () => {
    const roles = roleRepository.findAll();
    return roles.map(role => ({
      ...role,
      permissions: roleRepository.getRolePermissions(role.id)
    }));
  },

  getRoleById: (id) => {
    const role = roleRepository.findById(id);
    if (!role) throw new Error('Role not found');
    role.permissions = roleRepository.getRolePermissions(id);
    return role;
  },

  createRole: (actorId, name, description, permissionIds = []) => {
    const existing = roleRepository.findByName(name);
    if (existing) throw new Error('Role name already exists');

    let roleId;
    dbEngine.transaction(() => {
      roleId = roleRepository.create(name, description, 0); // User roles are not system roles
      if (permissionIds.length > 0) {
        roleRepository.assignPermissions(roleId, permissionIds);
      }
    });

    activityLogService.logActivity(actorId, 'ROLE_CREATED', 'ROLE', roleId, { name, permissionsAssigned: permissionIds.length });
    return roleId;
  },

  updateRole: (actorId, roleId, name, description, permissionIds = []) => {
    const role = roleRepository.findById(roleId);
    if (!role) throw new Error('Role not found');

    if (role.is_system === 1 && name !== role.name) {
      throw new Error('Cannot rename a core system role');
    }

    const existing = roleRepository.findByName(name);
    if (existing && existing.id !== roleId) {
      throw new Error('Role name already exists');
    }

    dbEngine.transaction(() => {
      roleRepository.update(roleId, name, description);
      roleRepository.clearPermissions(roleId);
      if (permissionIds.length > 0) {
        roleRepository.assignPermissions(roleId, permissionIds);
      }
    });

    activityLogService.logActivity(actorId, 'ROLE_UPDATED', 'ROLE', roleId, { name, permissionsAssigned: permissionIds.length });
  },

  deleteRole: (actorId, roleId) => {
    const role = roleRepository.findById(roleId);
    if (!role) throw new Error('Role not found');

    const protectedRoles = ['Super Admin', 'Admin', 'Owner'];
    if (protectedRoles.includes(role.name)) {
      throw new Error(`Cannot delete the core system role: ${role.name}`);
    }

    // In a real scenario, we should check if any users have this role before deleting
    // The SQLite schema handles this via ON DELETE RESTRICT on the users table.
    try {
      roleRepository.delete(roleId);
      activityLogService.logActivity(actorId, 'ROLE_DELETED', 'ROLE', roleId, { name: role.name });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        throw new Error('Cannot delete role: There are users assigned to this role.');
      }
      throw error;
    }
  }
};
