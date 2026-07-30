/**
 * Express middleware factory for Role-Based Access Control.
 * @param {string|string[]} requiredPermissions - The permission code(s) required
 */
export const authorize = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return res.status(403).json({ error: 'Forbidden: No permissions found for user' });
    }

    const permsArray = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    
    // User must have AT LEAST ONE of the required permissions
    const hasPermission = permsArray.some(p => req.user.permissions.includes(p));

    if (!hasPermission) {
      // Super Admin bypass (optional, if we want Super Admin to just have all rights implicitly)
      // Normally, seeding Super Admin with all permissions is cleaner.
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }

    next();
  };
};
