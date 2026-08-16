/**
 * Express middleware factory for Role-Based Access Control.
 * @param {string|string[]} requiredPermissions - The permission code(s) required
 */
export const authorize = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return res.status(403).json({ success: false, message: 'Access denied. No permissions found.' });
    }

    const permissionsToCheck = Array.isArray(requiredPermissions) 
      ? requiredPermissions 
      : [requiredPermissions];

    // Super Admins automatically bypass permission checks
    if (req.user && req.user.permissions && req.user.permissions.includes('*')) {
      return next();
    }

    const hasPermission = permissionsToCheck.some(permission => 
      req.user.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({ success: false, message: 'Access denied. Insufficient permissions.' });
    }

    next();
  };
};
