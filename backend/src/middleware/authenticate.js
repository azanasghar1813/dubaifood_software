import { securityUtils } from '../utils/security.js';
import { sessionRepository } from '../repositories/sessionRepository.js';


/**
 * Express middleware to verify JWT and active sessions.
 */
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = securityUtils.verifyToken(token);

    // Verify session is active in DB
    const session = sessionRepository.findSessionByTokenId(decoded.jti);
    if (!session || session.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Session expired or revoked. Please login again.' });
    }

    // Update last activity heartbeat asynchronously
    sessionRepository.updateLastActivity(decoded.jti);

    req.user = { 
      userId: decoded.userId, 
      roleId: decoded.roleId,
      permissions: decoded.permissions || []
    };
    req.sessionId = session.id;
    
    next();
  } catch (error) {
    console.error('Authentication Error:', error.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};
