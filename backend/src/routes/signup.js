const express = require('express');
const { signupSchema } = require('../validation/signupValidation');
const { createCourseAndAdmin } = require('../services/signupService');

const router = express.Router();

/**
 * POST /api/v1/signup
 * Create new golf course and admin user
 */
router.post('/signup', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = signupSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      // Get the first validation error
      const firstError = error.details[0];
      const errorField = firstError.path.join('.');
      
      return res.status(400).json({
        error: `Invalid ${errorField}`,
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
    }

    // Check if email already exists
    const { StaffUser } = require('../models');
    const existingUser = await StaffUser.findOne({
      where: { email: value.admin.email },
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Email already registered',
        message: 'An account with this email address already exists',
      });
    }

    // Create course and admin user
    const result = await createCourseAndAdmin(value);

    // Return success response
    res.status(201).json({
      subdomain: result.subdomain,
      message: 'Account created successfully. Please check your email for confirmation instructions.'
    });
  } catch (error) {
    console.error('Signup error:', error);

    // Handle specific database errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: 'Duplicate entry',
        message: 'An account with this information already exists',
      });
    }

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message,
        })),
      });
    }

    // Generic error response
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
});

module.exports = router;
