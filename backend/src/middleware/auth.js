const { verifyToken } = require('../auth/jwt');

const STAFF_ROLES = ['Admin', 'Manager', 'Staff'];

const requireAuth = (allowedRoles = STAFF_ROLES) => {
  return async (req, res, next) => {
    try {
      // Get token from cookie
      const token = req.cookies.jwt;
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Verify token
      const decoded = await verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Check role
      if (!allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Add user info to request
      req.user = decoded;
      req.courseId = decoded.course_id;

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(401).json({ error: 'Authentication failed' });
    }
  };
};

module.exports = {
  requireAuth,
  STAFF_ROLES,
};
