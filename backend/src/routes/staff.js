const express = require('express');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const router = express.Router();

const { StaffUser } = require('../models');
const { requireAuth } = require('../middleware/auth');

const { generateTokenString } = require('../auth/tokenUtil');
const { sendEmail } = require('../services/emailService');
const {
  inviteStaffSchema,
  registerStaffSchema,
  updateStaffSchema,
  resendInviteSchema,
  revokeInviteSchema,
} = require('../validation/staffSchema');

// Note: /register route doesn't require auth, apply middleware selectively

// GET /staff - List all staff (Admin and Manager only)
router.get('/', requireAuth(['Admin', 'Manager']), async (req, res) => {
  try {
    const staff = await StaffUser.findAll({
      where: {
        course_id: req.courseId,
      },
      attributes: [
        'id',
        'email',
        'role',
        'is_active',
        'first_name',
        'last_name',
        'phone',
        'created_at',
        'updated_at',
      ],
      order: [['created_at', 'DESC']],
    });

    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// POST /staff/invite - Invite new staff member (Admin only)
router.post('/invite', requireAuth(['Admin']), async (req, res) => {
  try {
    // Validate request body
    const { error, value } = inviteStaffSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message),
      });
    }

    const { email, role, first_name, last_name } = value;

    // Check if email already exists
    const existingUser = await StaffUser.findOne({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Generate invitation token
    const invitationToken = generateTokenString();
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create staff user with pending status
    const staffUser = await StaffUser.create({
      course_id: req.courseId,
      email: email.toLowerCase(),
      password: 'pending', // Temporary password
      role,
      is_active: false,
      invitation_token: invitationToken,
      invited_at: new Date(),
      token_expires_at: tokenExpiresAt,
      first_name,
      last_name,
    });

    // Send invitation email
    try {
      await sendEmail({
        to: email,
        subject: 'Staff Invitation - Golf Course Management',
        text: `You have been invited to join as ${role}. Use this link to complete your registration: /staff/register?token=${invitationToken}`,
        html: `
          <h2>Staff Invitation</h2>
          <p>You have been invited to join as <strong>${role}</strong>.</p>
          <p>Click the link below to complete your registration:</p>
          <a href="/staff/register?token=${invitationToken}">Complete Registration</a>
          <p>This invitation expires in 7 days.</p>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Continue with response even if email fails
    }

    // Return staff user data (excluding sensitive info)
    const responseData = {
      id: staffUser.id,
      email: staffUser.email,
      role: staffUser.role,
      is_active: staffUser.is_active,
      first_name: staffUser.first_name,
      last_name: staffUser.last_name,
      invitation_token: staffUser.invitation_token,
      invited_at: staffUser.invited_at,
      token_expires_at: staffUser.token_expires_at,
    };

    res.status(201).json(responseData);
  } catch (error) {
    console.error('Error inviting staff:', error);
    res.status(500).json({ error: 'Failed to invite staff member' });
  }
});

// POST /staff/register - Complete staff registration (no auth required)
router.post('/register', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = registerStaffSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message),
      });
    }

    const { token, password, first_name, last_name, phone } = value;

    // Find user with this token
    const staffUser = await StaffUser.findOne({
      where: {
        invitation_token: token,
        is_active: false,
        token_expires_at: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!staffUser) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Hash password and update user
    const hashedPassword = await bcrypt.hash(password, 10);

    await staffUser.update({
      password: hashedPassword,
      first_name,
      last_name,
      phone,
      is_active: true,
      invitation_token: null,
      invited_at: null,
      token_expires_at: null,
    });

    res.json({ message: 'Registration successful' });
  } catch (error) {
    console.error('Error completing registration:', error);
    res.status(500).json({ error: 'Failed to complete registration' });
  }
});

// PUT /staff/:id - Update staff member (Admin only)
router.put('/:id', requireAuth(['Admin']), async (req, res) => {
  try {
    // Validate request body
    const { error, value } = updateStaffSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message),
      });
    }

    // Find staff member
    const staffUser = await StaffUser.findOne({
      where: {
        id: req.params.id,
        course_id: req.courseId,
      },
    });

    if (!staffUser) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Update staff member
    await staffUser.update(value);

    // Return updated data (excluding sensitive info)
    const responseData = {
      id: staffUser.id,
      email: staffUser.email,
      role: staffUser.role,
      is_active: staffUser.is_active,
      first_name: staffUser.first_name,
      last_name: staffUser.last_name,
      phone: staffUser.phone,
      updated_at: staffUser.updated_at,
    };

    res.json(responseData);
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
});

// DELETE /staff/:id - Deactivate staff member (Admin only)
router.delete('/:id', requireAuth(['Admin']), async (req, res) => {
  try {
    // Find staff member
    const staffUser = await StaffUser.findOne({
      where: {
        id: req.params.id,
        course_id: req.courseId,
      },
    });

    if (!staffUser) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Deactivate user (soft delete)
    await staffUser.update({ is_active: false });

    res.json({ message: 'Staff member deactivated' });
  } catch (error) {
    console.error('Error deactivating staff:', error);
    res.status(500).json({ error: 'Failed to deactivate staff member' });
  }
});

// POST /staff/resend-invite - Resend invitation (Admin only)
router.post('/resend-invite', requireAuth(['Admin']), async (req, res) => {
  try {
    // Validate request body
    const { error, value } = resendInviteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message),
      });
    }

    const { staff_id } = value;

    // Find staff member
    const staffUser = await StaffUser.findOne({
      where: {
        id: staff_id,
        course_id: req.courseId,
      },
    });

    if (!staffUser) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    if (staffUser.is_active) {
      return res.status(400).json({ error: 'User is already active' });
    }

    // Generate new token
    const invitationToken = generateTokenString();
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await staffUser.update({
      invitation_token: invitationToken,
      invited_at: new Date(),
      token_expires_at: tokenExpiresAt,
    });

    // Send invitation email
    try {
      await sendEmail({
        to: staffUser.email,
        subject: 'Staff Invitation - Golf Course Management (Resent)',
        text: `Your invitation to join as ${staffUser.role} has been resent. Use this link to complete your registration: /staff/register?token=${invitationToken}`,
        html: `
          <h2>Staff Invitation (Resent)</h2>
          <p>Your invitation to join as <strong>${staffUser.role}</strong> has been resent.</p>
          <p>Click the link below to complete your registration:</p>
          <a href="/staff/register?token=${invitationToken}">Complete Registration</a>
          <p>This invitation expires in 7 days.</p>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
    }

    res.json({ message: 'Invitation resent' });
  } catch (error) {
    console.error('Error resending invitation:', error);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

// POST /staff/revoke-invite - Revoke invitation (Admin only)
router.post('/revoke-invite', requireAuth(['Admin']), async (req, res) => {
  try {
    // Validate request body
    const { error, value } = revokeInviteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message),
      });
    }

    const { staff_id } = value;

    // Find staff member
    const staffUser = await StaffUser.findOne({
      where: {
        id: staff_id,
        course_id: req.courseId,
      },
    });

    if (!staffUser) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    if (staffUser.is_active) {
      return res.status(400).json({ error: 'Cannot revoke active user' });
    }

    // Delete the pending invitation
    await staffUser.destroy();

    res.json({ message: 'Invitation revoked' });
  } catch (error) {
    console.error('Error revoking invitation:', error);
    res.status(500).json({ error: 'Failed to revoke invitation' });
  }
});

module.exports = router; 