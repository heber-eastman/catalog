const express = require('express');
const bcrypt = require('bcrypt');
const { StaffUser, SuperAdminUser, GolfCourseInstance } = require('../models');
const { signToken } = require('../auth/jwt');

const router = express.Router();
const { CustomerUser } = require('../models');

/**
 * GET /test - Simple test route to verify auth routes are loading
 */
router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes are working!' });
});

/**
 * POST /api/v1/auth/login
 * Login with email and password (for regular staff users)
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate request body
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and password are required',
      });
    }

    // Find user by email (only active users can login)
    const user = await StaffUser.findOne({
      where: { email, is_active: true },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
    }

    // Get the associated golf course for subdomain
    const golfCourse = await GolfCourseInstance.findByPk(user.course_id);

    if (!golfCourse) {
      return res.status(400).json({ error: 'Golf course not found' });
    }

    // Generate JWT token
    const token = await signToken({
      user_id: user.id,
      email: user.email,
      role: user.role,
      course_id: user.course_id,
      first_name: user.first_name,
      last_name: user.last_name,
    });

    // Set cookie with cross-subdomain support
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: true, // Use HTTPS in production
      sameSite: 'lax', // Allow cross-site requests for subdomain navigation
      domain: '.catalog.golf', // Share cookie across all subdomains
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Return success response with course subdomain
    res.json({
      token: token,
      id: user.id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      course_id: user.course_id,
      course_subdomain: golfCourse.subdomain,
      course_name: golfCourse.name,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
});

/**
 * POST /api/v1/auth/super-admin/login
 * Login for super admin users
 */
router.post('/super-admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate request body
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and password are required',
      });
    }

    // Find super admin user by email
    const user = await SuperAdminUser.findOne({
      where: { email, is_active: true },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token
    const token = await signToken({
      user_id: user.id,
      email: user.email,
      role: 'SuperAdmin',
      first_name: user.first_name,
      last_name: user.last_name,
    });

    // Set cookie with cross-subdomain support
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: true, // Use HTTPS in production
      sameSite: 'lax', // Allow cross-site requests for subdomain navigation
      domain: '.catalog.golf', // Share cookie across all subdomains
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Return success response
    res.json({
      token: token,
      id: user.id,
      email: user.email,
      role: 'SuperAdmin',
      first_name: user.first_name,
      last_name: user.last_name,
    });
  } catch (error) {
    console.error('Super admin login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout and clear authentication cookie
 */
router.post('/logout', (req, res) => {
  try {
    // Clear the JWT cookie with matching settings used when it was set
    const base = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' };
    // In production, the cookie includes a domain so clear with domain specified
    if (process.env.NODE_ENV === 'production') {
      res.clearCookie('jwt', { ...base, domain: '.catalog.golf' });
    }
    // Always also attempt a no-domain clear for local/dev where domain isn't set
    res.clearCookie('jwt', base);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during logout.',
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current authenticated user information
 */
router.get('/me', async (req, res) => {
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
    const { verifyToken } = require('../auth/jwt');
    const decoded = await verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // For staff users, include course subdomain and course name
    if (decoded.course_id) {
      const golfCourse = await GolfCourseInstance.findByPk(decoded.course_id);

      if (!golfCourse) {
        return res.status(400).json({ error: 'Golf course not found' });
      }

      return res.json({
        id: decoded.user_id,
        email: decoded.email,
        role: decoded.role,
        first_name: decoded.first_name,
        last_name: decoded.last_name,
        course_id: decoded.course_id,
        course_subdomain: golfCourse.subdomain,
        course_name: golfCourse.name,
      });
    }

    // For customer users
    if (decoded.role === 'Customer') {
      return res.json({
        id: decoded.user_id,
        email: decoded.email,
        role: 'Customer',
        first_name: decoded.first_name,
        last_name: decoded.last_name,
      });
    }

    // For super admin users
    return res.json({
      id: decoded.user_id,
      email: decoded.email,
      role: decoded.role,
      first_name: decoded.first_name,
      last_name: decoded.last_name,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

/**
 * POST /api/v1/auth/customer/signup
 * Public sign-up for golfers (customer accounts)
 */
router.post('/customer/signup', async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body || {};
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const existing = await CustomerUser.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Account already exists. Please login.' });
    const hash = await bcrypt.hash(password, 10);
    const cu = await CustomerUser.create({ first_name, last_name, email, password_hash: hash });
    const token = await signToken({ user_id: cu.id, email: cu.email, role: 'Customer', first_name: cu.first_name, last_name: cu.last_name }, { expiresIn: '7d' });
    // In development, avoid cross-domain cookie constraints; still return token in body
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.json({
      token,
      id: cu.id,
      email: cu.email,
      role: 'Customer',
      first_name: cu.first_name,
      last_name: cu.last_name,
    });
  } catch (e) {
    console.error('Customer signup error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/v1/auth/customer/login
 */
router.post('/customer/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
    const cu = await CustomerUser.findOne({ where: { email } });
    if (!cu) return res.status(401).json({ error: 'Invalid email or password' });
    const ok = await bcrypt.compare(password, cu.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    const token = await signToken({ user_id: cu.id, email: cu.email, role: 'Customer', first_name: cu.first_name, last_name: cu.last_name }, { expiresIn: '7d' });
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.json({ token, id: cu.id, email: cu.email, role: 'Customer', first_name: cu.first_name, last_name: cu.last_name });
  } catch (e) {
    console.error('Customer login error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
