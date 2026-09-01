import { userRepository } from '../repositories/userRepository.js';
import { roleRepository } from '../repositories/roleRepository.js';
import { settingsRepository } from '../repositories/settingsRepository.js';
import { activityLogService } from './activityLogService.js';
import { securityUtils } from '../utils/security.js';
import { syncService } from './syncService.js';

const FULL_ACCESS_ROLES = new Set(['super admin', 'super administrator', 'owner']);
const PROTECTED_ROLES = new Set(['super admin', 'super administrator', 'owner', 'admin']);

const normalizeRole = (name) => String(name || '').trim().toLowerCase();

const isFullAccessRole = (name) => FULL_ACCESS_ROLES.has(normalizeRole(name));

const isProtectedRole = (name) => PROTECTED_ROLES.has(normalizeRole(name));

const actorHasFullAccess = (actor) => {
  if (!actor) return false;
  if (isFullAccessRole(actor.role_name)) return true;
  try {
    const perms = userRepository.getUserPermissions(actor.role_id) || [];
    return perms.includes('*');
  } catch {
    return false;
  }
};

const queueShowOnLogin = (userId, showOnLogin) => {
  if (!userId) return;
  const value = (showOnLogin === false || showOnLogin === 0) ? '0' : '1';
  settingsRepository.updateApplicationSettings('SYNC', {
    [`user_show_on_login_${userId}`]: value
  });
};

const enforceRoleHierarchy = (actorId, targetRoleId = null, targetUserId = null) => {
  const actor = userRepository.findById(actorId);
  if (!actor) throw new Error('Actor not found');

  if (actorHasFullAccess(actor)) {
    return;
  }

  if (normalizeRole(actor.role_name) === 'admin') {
    if (targetRoleId) {
      const targetRole = roleRepository.findById(targetRoleId);
      if (targetRole && isProtectedRole(targetRole.name)) {
        throw new Error('Admins cannot assign Super Admin, Owner, or Admin roles');
      }
    }
    if (targetUserId) {
      const targetUser = userRepository.findById(targetUserId);
      if (targetUser && isProtectedRole(targetUser.role_name)) {
        throw new Error('Admins cannot modify Super Admin, Owner, or other Admin accounts');
      }
    }
    return;
  }

  throw new Error('Unauthorized role management');
};

export const userService = {
  getAllUsers: () => {
    return userRepository.findAll();
  },

  getUserById: (id) => {
    const user = userRepository.findById(id);
    if (!user) throw new Error('User not found');
    delete user.password_hash;
    delete user.pin_code;
    return user;
  },

  createUser: (actorId, userData) => {
    // Validate role
    const role = roleRepository.findById(userData.roleId);
    if (!role) throw new Error('Invalid role ID');

    // Enforce Hierarchy
    enforceRoleHierarchy(actorId, userData.roleId);

    // Check unique username
    if (userRepository.findByUsername(userData.username)) {
      throw new Error('Username already exists');
    }

    const hashedPin = securityUtils.hashPin(userData.pinCode);
    const hashedPassword = securityUtils.hashPin(userData.password || userData.pinCode); // Fallback password to pin if not provided for now

    const newUserData = {
      ...userData,
      passwordHash: hashedPassword,
      pinCode: hashedPin
    };

    const newUserId = userRepository.create(newUserData);
    
    activityLogService.logActivity(actorId, 'USER_CREATED', 'USER', newUserId, { username: userData.username, role: role.name });
    syncService.queueSyncEvent('USER', newUserId, 'CREATED', { username: userData.username }, 1);
    try { queueShowOnLogin(newUserId, userData.showOnLogin); } catch { /* sync is best-effort */ }
    return newUserId;
  },

  updateUserProfile: (actorId, targetUserId, updateData) => {
    const user = userRepository.findById(targetUserId);
    if (!user) throw new Error('User not found');

    const role = roleRepository.findById(updateData.roleId);
    if (!role) throw new Error('Invalid role ID');

    enforceRoleHierarchy(actorId, updateData.roleId, targetUserId);

    if (updateData.username && updateData.username !== user.username) {
      if (userRepository.findByUsername(updateData.username)) {
        throw new Error('Username already exists');
      }
    }

    userRepository.updateProfile(targetUserId, updateData);
    
    // Retrieve the updated user to get the new sync_version
    const updatedUser = userRepository.findById(targetUserId);
    activityLogService.logActivity(actorId, 'USER_UPDATED', 'USER', targetUserId, { roleChanged: user.role_id !== updateData.roleId });
    syncService.queueSyncEvent('USER', targetUserId, 'UPDATED', {}, updatedUser.sync_version || 1);
    try { queueShowOnLogin(targetUserId, updateData.showOnLogin); } catch { /* sync is best-effort */ }
  },

  updateUserStatus: (actorId, targetUserId, isActive) => {
    const user = userRepository.findById(targetUserId);
    if (!user) throw new Error('User not found');
    
    // Prevent disabling Super Admin
    if ((user.role_name === 'Super Admin' || user.role_name === 'Owner') && !isActive) {
      throw new Error('Cannot disable a Super Administrator or Owner account');
    }

    enforceRoleHierarchy(actorId, null, targetUserId);

    userRepository.updateStatus(targetUserId, isActive);
    
    const updatedUser = userRepository.findById(targetUserId);
    const action = isActive ? 'USER_ACTIVATED' : 'USER_DISABLED';
    activityLogService.logActivity(actorId, action, 'USER', targetUserId, {});
    syncService.queueSyncEvent('USER', targetUserId, 'UPDATED', { isActive }, updatedUser.sync_version || 1);
  },

  resetUserPin: (actorId, targetUserId, newPin) => {
    const user = userRepository.findById(targetUserId);
    if (!user) throw new Error('User not found');

    enforceRoleHierarchy(actorId, null, targetUserId);

    const hashedPin = securityUtils.hashPin(newPin);
    userRepository.updatePin(targetUserId, hashedPin);
    userRepository.resetFailedAttempts(targetUserId); // Unlock account if it was locked

    const updatedUser = userRepository.findById(targetUserId);
    activityLogService.logActivity(actorId, 'PIN_RESET', 'USER', targetUserId, {});
    syncService.queueSyncEvent('USER', targetUserId, 'UPDATED', { pin_reset: true, pin_code: hashedPin }, updatedUser.sync_version || 1);
  },
  
  changeMyPin: (userId, oldPin, newPin) => {
    const user = userRepository.findById(userId);
    if (!user) throw new Error('User not found');

    if (!securityUtils.verifyPin(oldPin, user.pin_code)) {
      throw new Error('Incorrect current PIN');
    }

    const hashedPin = securityUtils.hashPin(newPin);
    userRepository.updatePin(userId, hashedPin);
    
    const updatedUser = userRepository.findById(userId);
    activityLogService.logActivity(userId, 'PIN_CHANGED', 'USER', userId, {});
    syncService.queueSyncEvent('USER', userId, 'UPDATED', { pin_changed: true }, updatedUser.sync_version || 1);
  },

  updateProfilePhoto: (actorId, targetUserId, photoPath) => {
    const user = userRepository.findById(targetUserId);
    if (!user) throw new Error('User not found');

    userRepository.updatePhoto(targetUserId, photoPath);
    const updatedUser = userRepository.findById(targetUserId);
    activityLogService.logActivity(actorId, 'USER_PHOTO_UPDATED', 'USER', targetUserId, { photoPath });
    syncService.queueSyncEvent('USER', targetUserId, 'UPDATED', { photoPath }, updatedUser.sync_version || 1);
  }
};
