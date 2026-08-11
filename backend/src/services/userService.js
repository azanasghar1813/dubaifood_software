import { userRepository } from '../repositories/userRepository.js';
import { roleRepository } from '../repositories/roleRepository.js';
import { activityLogService } from './activityLogService.js';
import { securityUtils } from '../utils/security.js';

const enforceRoleHierarchy = (actorId, targetRoleId = null, targetUserId = null) => {
  const actor = userRepository.findById(actorId);
  if (!actor) throw new Error('Actor not found');
  
  const actorRoleName = actor.role_name;
  
  if (actorRoleName === 'Super Admin' || actorRoleName === 'Owner') {
    return; // Super Admin and Owner can do anything
  }
  
  if (actorRoleName === 'Admin') {
    if (targetRoleId) {
      const targetRole = roleRepository.findById(targetRoleId);
      if (targetRole && (targetRole.name === 'Super Admin' || targetRole.name === 'Owner' || targetRole.name === 'Admin')) {
        throw new Error('Admins cannot assign Super Admin, Owner, or Admin roles');
      }
    }
    if (targetUserId) {
      const targetUser = userRepository.findById(targetUserId);
      if (targetUser && (targetUser.role_name === 'Super Admin' || targetUser.role_name === 'Owner' || targetUser.role_name === 'Admin')) {
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
    return newUserId;
  },

  updateUserProfile: (actorId, targetUserId, updateData) => {
    const user = userRepository.findById(targetUserId);
    if (!user) throw new Error('User not found');

    const role = roleRepository.findById(updateData.roleId);
    if (!role) throw new Error('Invalid role ID');

    enforceRoleHierarchy(actorId, updateData.roleId, targetUserId);

    userRepository.updateProfile(targetUserId, updateData);
    
    activityLogService.logActivity(actorId, 'USER_UPDATED', 'USER', targetUserId, { roleChanged: user.role_id !== updateData.roleId });
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
    
    const action = isActive ? 'USER_ACTIVATED' : 'USER_DISABLED';
    activityLogService.logActivity(actorId, action, 'USER', targetUserId, {});
  },

  resetUserPin: (actorId, targetUserId, newPin) => {
    const user = userRepository.findById(targetUserId);
    if (!user) throw new Error('User not found');

    enforceRoleHierarchy(actorId, null, targetUserId);

    const hashedPin = securityUtils.hashPin(newPin);
    userRepository.updatePin(targetUserId, hashedPin);
    userRepository.resetFailedAttempts(targetUserId); // Unlock account if it was locked

    activityLogService.logActivity(actorId, 'PIN_RESET', 'USER', targetUserId, {});
  },
  
  changeMyPin: (userId, oldPin, newPin) => {
    const user = userRepository.findById(userId);
    if (!user) throw new Error('User not found');

    if (!securityUtils.verifyPin(oldPin, user.pin_code)) {
      throw new Error('Incorrect current PIN');
    }

    const hashedPin = securityUtils.hashPin(newPin);
    userRepository.updatePin(userId, hashedPin);
    
    activityLogService.logActivity(userId, 'PIN_CHANGED', 'USER', userId, {});
  },

  updateProfilePhoto: (actorId, targetUserId, photoPath) => {
    const user = userRepository.findById(targetUserId);
    if (!user) throw new Error('User not found');

    userRepository.updatePhoto(targetUserId, photoPath);
    activityLogService.logActivity(actorId, 'USER_PHOTO_UPDATED', 'USER', targetUserId, { photoPath });
  }
};
