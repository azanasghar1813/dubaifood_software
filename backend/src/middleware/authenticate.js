import { securityUtils } from '../utils/security.js';
import { sessionRepository } from '../repositories/sessionRepository.js';

/**
 * Express middleware to verify JWT and active sessions.
 */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = securityUtils.verifyToken(token);
    
    // Check Database Session Status (prevents hijacked/revoked tokens)
    const session = sessionRepository.findSessionByTokenId(decoded.jti);
    
    if (!session || session.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Unauthorized: Session expired or revoked' });
    }

    // Optionally update last activity (can be debounced in highly loaded systems)
    sessionRepository.updateLastActivity(decoded.jti);

    req.user = decoded; // Contains userId, roleId, permissions
    req.sessionId = decoded.jti;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: ' + error.message });
  }
};
