import { permissionRepository } from '../repositories/permissionRepository.js';

export const permissionService = {
  getAllPermissions: () => {
    return permissionRepository.findAll();
  },

  getPermissionsByModule: (module) => {
    return permissionRepository.findByModule(module);
  }
};
