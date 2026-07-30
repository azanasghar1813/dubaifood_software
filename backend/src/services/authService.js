import crypto from 'crypto';
import { userRepository } from '../repositories/userRepository.js';
import { sessionRepository } from '../repositories/sessionRepository.js';
import { activityLogService } from './activityLogService.js';
import { securityUtils } from '../utils/security.js';
import { dbEngine } from '../database/sqlite.js';

export const authService = {
  /**
   * Orchestrates the login process securely.
   * Handles brute-force checks, PIN validation, session creation, and activity logging.
   */
  login: (username, pin, deviceInfo = 'Unknown Device') => {
    const user = userRepository.findByUsername(username);

    if (!user) {
      // Log generic failure (do not leak whether user exists)
      activityLogService.logActivity(null, 'LOGIN_FAILED', 'AUTH', null, { username, reason: 'Invalid credentials' });
      throw new Error('Invalid username or PIN');
    }

    // 1. Check if Account is Locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      activityLogService.logActivity(user.id, 'LOGIN_LOCKED_ATTEMPT', 'AUTH');
      throw new Error('Account is temporarily locked due to multiple failed attempts. Please try again later.');
    }

    // 2. Verify PIN
    const isValid = securityUtils.verifyPin(pin, user.pin_code);

    if (!isValid) {
      const { lockedUntil } = userRepository.incrementFailedAttempts(user.id, user.failed_login_attempts);
      
      if (lockedUntil) {
        activityLogService.logActivity(user.id, 'ACCOUNT_LOCKED', 'AUTH', user.id, { lockedUntil });
        throw new Error('Account locked due to multiple failed attempts.');
      } else {
        activityLogService.logActivity(user.id, 'LOGIN_FAILED', 'AUTH', user.id, { reason: 'Invalid PIN' });
        throw new Error('Invalid username or PIN');
      }
    }

    // 3. Login Successful - Transaction to reset attempts and create session
    let token = null;
    let userDetails = null;

    dbEngine.transaction(() => {
      userRepository.resetFailedAttempts(user.id);
      userRepository.updateLastLogin(user.id);

      const tokenId = crypto.randomUUID();
      sessionRepository.createSession(user.id, tokenId, deviceInfo);

      const permissions = userRepository.getUserPermissions(user.role_id);
      
      // Token payload
      const payload = {
        userId: user.id,
        roleId: user.role_id,
        permissions: permissions
      };

      token = securityUtils.generateToken(payload, tokenId);

      userDetails = {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        roleId: user.role_id,
        forcePinChange: user.force_pin_change === 1,
        permissions
      };
    });

    activityLogService.logActivity(user.id, 'LOGIN_SUCCESS', 'AUTH', user.id, { device: deviceInfo });
    
    return { token, user: userDetails };
  },

  /**
   * Securely revokes a session.
   */
  logout: (tokenId, userId) => {
    sessionRepository.revokeSession(tokenId);
    activityLogService.logActivity(userId, 'LOGOUT_SUCCESS', 'AUTH');
  }
};
