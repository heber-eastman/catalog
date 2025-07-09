const express = require('express');
const bcrypt = require('bcrypt');
const { StaffUser, SuperAdminUser } = require('../models');
const { signToken } = require('../auth/jwt');

const router = express.Router();

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

    // Find user by email
    const user = await StaffUser.findOne({
      where: { email },
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

    // Generate JWT token
    const token = await signToken({
      user_id: user.id,
      email: user.email,
      role: user.role,
      course_id: user.course_id,
      first_name: user.first_name,
      last_name: user.last_name,
    });

    // Set cookie
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: false, // Set to false since we're not using HTTPS
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Return success response
    res.json({
      token: token,
      id: user.id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      course_id: user.course_id,
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

    // Set cookie
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: false, // Set to false since we're not using HTTPS
      sameSite: 'strict',
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
    // Clear the JWT cookie
    res.clearCookie('jwt', {
      httpOnly: true,
      secure: false, // Set to false since we're not using HTTPS
      sameSite: 'strict',
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during logout.',
    });
  }
});

module.exports = router;
