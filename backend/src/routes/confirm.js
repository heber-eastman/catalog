const express = require('express');
const { GolfCourseInstance, StaffUser } = require('../models');
const { signToken } = require('../auth/jwt');

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
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Check if token has expired
    if (staffUser.token_expires_at < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired token' });
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

      // Set JWT as HTTP-only cookie and redirect
      res.cookie('jwt', jwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      // Redirect to dashboard
      return res.redirect(
        `https://${golfCourse.subdomain}.devstreet.co/dashboard`
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
