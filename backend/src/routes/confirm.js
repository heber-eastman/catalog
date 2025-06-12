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
      include: [{
        model: GolfCourseInstance,
        as: 'course'
      }]
    });

    if (!staffUser) {
      return res.status(400).json({ error: 'Invalid invitation token' });
    }

    // Check if token has expired
    if (staffUser.token_expires_at < new Date()) {
      return res.status(400).json({ error: 'Invitation token has expired' });
    }

    // Start a transaction to update both user and course
    const transaction = await StaffUser.sequelize.transaction();

    try {
      // Update staff user
      await staffUser.update({
        is_active: true,
        invitation_token: null,
        token_expires_at: null
      }, { transaction });

      // Update golf course instance
      await GolfCourseInstance.update({
        status: 'Active'
      }, {
        where: { id: staffUser.course_id },
        transaction
      });

      // Generate JWT
      const jwt = signToken({
        sub: staffUser.id,
        email: staffUser.email,
        role: staffUser.role,
        course_id: staffUser.course_id
      });

      // Commit transaction
      await transaction.commit();

      // Set JWT as HTTP-only cookie and redirect
      res.cookie('jwt', jwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Redirect to dashboard
      return res.redirect(`https://${staffUser.course.subdomain}.devstreet.co/dashboard`);
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