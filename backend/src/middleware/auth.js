const { verifyToken } = require('../auth/jwt');

const STAFF_ROLES = ['Admin', 'Manager', 'Staff'];
const SUPER_ADMIN_ROLES = ['SuperAdmin'];
const ALL_ROLES = [...STAFF_ROLES, ...SUPER_ADMIN_ROLES];

const requireAuth = (allowedRoles = STAFF_ROLES) => {
  return async (req, res, next) => {
    try {
      // Get token from cookie or Authorization header
      let token = req.cookies.jwt;

      // If no cookie, check Authorization header
      if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

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
      req.userId = decoded.user_id;
      req.courseId = decoded.course_id;
      req.userRole = decoded.role;

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(401).json({ error: 'Authentication failed' });
    }
  };
};

const requireSuperAdmin = () => {
  return async (req, res, next) => {
    try {
      // Get token from cookie or Authorization header
      let token = req.cookies.jwt;

      // If no cookie, check Authorization header
      if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Verify token
      const decoded = await verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Check if user is super admin
      if (decoded.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Super admin access required' });
      }

      // Add user info to request
      req.user = decoded;
      req.userId = decoded.user_id;
      req.userRole = decoded.role;

      next();
    } catch (error) {
      console.error('Super admin auth middleware error:', error);
      res.status(401).json({ error: 'Authentication failed' });
    }
  };
};

// Optional auth: if a valid token is present, populate req fields; otherwise continue anonymously
const optionalAuth = () => {
  return async (req, res, next) => {
    try {
      let token = req.cookies.jwt;
      if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }
      if (!token) {
        return next();
      }
      const decoded = await verifyToken(token);
      if (!decoded) {
        return next();
      }
      req.user = decoded;
      req.userId = decoded.user_id;
      req.courseId = decoded.course_id;
      req.userRole = decoded.role;
    } catch (_) {
      // ignore and proceed as anonymous
    }
    next();
  };
};

module.exports = {
  requireAuth,
  requireSuperAdmin,
  optionalAuth,
  STAFF_ROLES,
  SUPER_ADMIN_ROLES,
  ALL_ROLES,
};
