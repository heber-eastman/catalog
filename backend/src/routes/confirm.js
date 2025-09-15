const express = require('express');
const { GolfCourseInstance, StaffUser } = require('../models');
const { signToken } = require('../auth/jwt');
const { enqueueEmailNonBlocking } = require('../emailQueue');

const router = express.Router();

router.get('/confirm', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    // Find staff user by invitation token
    const staffUser = await StaffUser.findOne({
      where: { invitation_token: token },
    });

    if (!staffUser) {
      // Check if there's a user with this token that's already active (token was used)
      const alreadyActiveUser = await StaffUser.findOne({
        where: {
          invitation_token: null,
          is_active: true,
        },
        // We can't search by the token since it's null, but we can check recent confirmations
        order: [['updated_at', 'DESC']],
        limit: 10,
      });

      // If we find recently activated users, it's likely the token was already used
      if (alreadyActiveUser) {
        return res.status(400).json({
          error:
            'This confirmation link has already been used. If you have an account, please try logging in.',
        });
      }

      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Check if user is already active
    if (staffUser.is_active) {
      return res.status(400).json({
        error:
          'This account has already been confirmed. Please try logging in.',
      });
    }

    // Check if token has expired
    if (staffUser.token_expires_at < new Date()) {
      return res.status(400).json({
        error:
          'This confirmation link has expired. Please request a new confirmation email.',
      });
    }

    // Get the associated golf course
    const golfCourse = await GolfCourseInstance.findByPk(staffUser.course_id);
    if (!golfCourse) {
      return res.status(400).json({ error: 'Golf course not found' });
    }

    // Start a transaction to update both user and course
    const transaction = await StaffUser.sequelize.transaction();

    try {
      // Update staff user
      await staffUser.update(
        {
          is_active: true,
          invitation_token: null,
          token_expires_at: null,
        },
        { transaction }
      );

      // Update golf course instance
      await GolfCourseInstance.update(
        {
          status: 'Active',
          primary_admin_id: staffUser.id,
        },
        {
          where: { id: staffUser.course_id },
          transaction,
        }
      );

      // Commit transaction
      await transaction.commit();

      // Send welcome email via SQS queue (non-blocking)
      // This won't block the response if email service is slow or unavailable
      enqueueEmailNonBlocking('WelcomeEmail', staffUser.email, {
        user_name: `${staffUser.first_name} ${staffUser.last_name}`,
        course_name: golfCourse.name,
        subdomain: golfCourse.subdomain,
      });

      // For API testing, return JSON response
      if (
        req.headers.accept &&
        req.headers.accept.includes('application/json')
      ) {
        return res
          .status(200)
          .json({ message: 'Account activated successfully' });
      }

      // Generate JWT
      const jwt = signToken({
        sub: staffUser.id,
        email: staffUser.email,
        role: staffUser.role,
        course_id: staffUser.course_id,
      });

      // Set JWT as HTTP-only cookie with cross-subdomain support and redirect
      res.cookie('jwt', jwt, {
        httpOnly: true,
        secure: true, // Use HTTPS in production
        sameSite: 'lax', // Allow cross-site requests for subdomain navigation
        domain: '.catalog.golf', // Share cookie across all subdomains
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      // Redirect to dashboard
      return res.redirect(
        `https://${golfCourse.subdomain}.catalog.golf/dashboard`
      );
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Confirmation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
