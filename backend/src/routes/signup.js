const express = require('express');
const { signupSchema } = require('../validation/signupValidation');
const { createCourseAndAdmin } = require('../services/signupService');
const { StaffUser } = require('../models');

const router = express.Router();

/**
 * POST /api/v1/signup
 * Create new golf course and admin user
 */
router.post('/signup', async (req, res) => {
  const requestStart = Date.now();
  console.log('Signup request started...');

  try {
    // Step 1: Validate request body
    const validationStart = Date.now();
    const { error, value } = signupSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      console.log(`Validation took ${Date.now() - validationStart}ms`);
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
    console.log(`Validation took ${Date.now() - validationStart}ms`);

    // Step 2: Check if email already exists
    const emailCheckStart = Date.now();
    const existingUser = await StaffUser.findOne({
      where: { email: value.admin.email },
      attributes: ['id'], // Only fetch the ID for performance
    });

    if (existingUser) {
      console.log(
        `Email check took ${Date.now() - emailCheckStart}ms - email exists`
      );
      return res.status(409).json({
        error: 'Email already registered',
        message: 'An account with this email address already exists',
      });
    }
    console.log(
      `Email check took ${Date.now() - emailCheckStart}ms - email available`
    );

    // Step 3: Create course and admin user
    const creationStart = Date.now();
    const result = await createCourseAndAdmin(value);
    console.log(`Course creation took ${Date.now() - creationStart}ms`);

    const totalRequestTime = Date.now() - requestStart;
    console.log(`Total signup request time: ${totalRequestTime}ms`);

    // Return success response
    res.status(201).json({
      subdomain: result.subdomain,
      message:
        'Account created successfully. Please check your email for confirmation instructions.',
    });
  } catch (error) {
    const totalRequestTime = Date.now() - requestStart;
    console.error(`Signup error after ${totalRequestTime}ms:`, error);

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
