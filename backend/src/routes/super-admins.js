const express = require('express');
const bcrypt = require('bcrypt');
const { GolfCourseInstance, SuperAdminUser, sequelize } = require('../models');
const { requireSuperAdmin } = require('../middleware/auth');
const { enqueueEmail } = require('../emailQueue');
const { generateTokenString } = require('../auth/tokenUtil');
const {
  inviteSuperAdminSchema: superAdminInviteSchema,
  registerSuperAdminSchema: superAdminRegisterSchema,
  updateSuperAdminSchema: superAdminUpdateSchema,
  createCourseSchema: courseCreateSchema,
  updateCourseSchema: courseUpdateSchema,
  updateCourseStatusSchema: courseStatusSchema,
} = require('../validation/superAdminSchema');

const router = express.Router();

// Note: Authentication middleware applied per route rather than globally

// ===============================
// COURSE MANAGEMENT ENDPOINTS
// ===============================

/**
 * GET /courses
 * List all golf course instances
 */
router.get('/courses', requireSuperAdmin(), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sort = 'created_at',
    } = req.query;
    const offset = (page - 1) * limit;

    // Build where clause
    const where = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where[sequelize.Sequelize.Op.or] = [
        { name: { [sequelize.Sequelize.Op.iLike]: `%${search}%` } },
        { subdomain: { [sequelize.Sequelize.Op.iLike]: `%${search}%` } },
        { city: { [sequelize.Sequelize.Op.iLike]: `%${search}%` } },
      ];
    }

    // Build order clause
    const orderMap = {
      name: ['name', 'ASC'],
      status: ['status', 'ASC'],
      created_at: ['created_at', 'DESC'],
      updated_at: ['updated_at', 'DESC'],
    };
    const order = [orderMap[sort] || orderMap.created_at];

    const { count, rows: courses } = await GolfCourseInstance.findAndCountAll({
      where,
      order,
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: [
        'id',
        'name',
        'subdomain',
        'status',
        'street',
        'city',
        'state',
        'postal_code',
        'country',
        'created_at',
        'updated_at',
      ],
    });

    res.json({
      courses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

/**
 * POST /courses
 * Create a new golf course instance
 */
router.post('/courses', requireSuperAdmin(), async (req, res) => {
  try {
    const { error, value } = courseCreateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Generate subdomain from course name
    const baseSubdomain = value.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Check for subdomain collisions
    let subdomain = baseSubdomain;
    let counter = 1;
    while (await GolfCourseInstance.findOne({ where: { subdomain } })) {
      counter++;
      subdomain = `${baseSubdomain}-${counter}`;
    }

    const course = await GolfCourseInstance.create({
      ...value,
      subdomain,
      status: 'Active', // Super admin created courses are active by default
    });

    res.status(201).json(course);
  } catch (error) {
    console.error('Error creating course:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(409).json({ error: 'Course with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create course' });
    }
  }
});

/**
 * PUT /courses/:id
 * Update a golf course instance
 */
router.put('/courses/:id', requireSuperAdmin(), async (req, res) => {
  try {
    const { error, value } = courseUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const course = await GolfCourseInstance.findByPk(req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    await course.update(value);
    res.json(course);
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

/**
 * PATCH /courses/:id/status
 * Update course status
 */
router.patch('/courses/:id/status', requireSuperAdmin(), async (req, res) => {
  try {
    const { error, value } = courseStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const course = await GolfCourseInstance.findByPk(req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    await course.update({ status: value.status });
    res.json({ message: 'Course status updated successfully', course });
  } catch (error) {
    console.error('Error updating course status:', error);
    res.status(500).json({ error: 'Failed to update course status' });
  }
});

// ===============================
// SUPER ADMIN MANAGEMENT ENDPOINTS
// ===============================

/**
 * GET /super-admins
 * List all super admin users
 */
router.get('/super-admins', requireSuperAdmin(), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sort = 'created_at' } = req.query;
    const offset = (page - 1) * limit;

    // Build where clause
    const where = {};
    if (search) {
      where[sequelize.Sequelize.Op.or] = [
        { email: { [sequelize.Sequelize.Op.iLike]: `%${search}%` } },
        { first_name: { [sequelize.Sequelize.Op.iLike]: `%${search}%` } },
        { last_name: { [sequelize.Sequelize.Op.iLike]: `%${search}%` } },
      ];
    }

    // Build order clause
    const orderMap = {
      email: ['email', 'ASC'],
      name: ['first_name', 'ASC'],
      created_at: ['created_at', 'DESC'],
      updated_at: ['updated_at', 'DESC'],
    };
    const order = [orderMap[sort] || orderMap.created_at];

    const { count, rows: superAdmins } = await SuperAdminUser.findAndCountAll({
      where,
      order,
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: [
        'id',
        'email',
        'first_name',
        'last_name',
        'phone',
        'is_active',
        'invitation_token',
        'invited_at',
        'token_expires_at',
        'created_at',
        'updated_at',
      ],
    });

    res.json({
      super_admins: superAdmins,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching super admins:', error);
    res.status(500).json({ error: 'Failed to fetch super admins' });
  }
});

/**
 * POST /super-admins/invite
 * Invite a new super admin
 */
router.post('/super-admins/invite', requireSuperAdmin(), async (req, res) => {
  try {
    const { error, value } = superAdminInviteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check if super admin with this email already exists
    const existingSuperAdmin = await SuperAdminUser.findOne({
      where: { email: value.email },
    });
    if (existingSuperAdmin) {
      return res
        .status(409)
        .json({ error: 'Super admin with this email already exists' });
    }

    // Generate invitation token
    const invitationToken = generateTokenString();
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create pending super admin
    const superAdmin = await SuperAdminUser.create({
      email: value.email,
      first_name: value.first_name,
      last_name: value.last_name,
      phone: value.phone,
      password_hash: 'temporary', // Will be set during registration
      is_active: false,
      invitation_token: invitationToken,
      invited_at: new Date(),
      token_expires_at: tokenExpiresAt,
    });

    // Send invitation email via SQS queue
    try {
      const invitationLink = `${process.env.FRONTEND_URL || 'https://admin.catalog.golf'}/super-admin/register?token=${invitationToken}`;
      await enqueueEmail('SuperAdminInvitation', value.email, {
        invitation_link: invitationLink,
      });
    } catch (emailError) {
      console.error(
        'Failed to enqueue super admin invitation email:',
        emailError
      );
      // Continue with response even if email fails
    }

    res.status(201).json({
      message: 'Super admin invitation sent successfully',
      super_admin: {
        id: superAdmin.id,
        email: superAdmin.email,
        first_name: superAdmin.first_name,
        last_name: superAdmin.last_name,
        invited_at: superAdmin.invited_at,
        token_expires_at: superAdmin.token_expires_at,
      },
    });
  } catch (error) {
    console.error('Error inviting super admin:', error);
    res.status(500).json({ error: 'Failed to send super admin invitation' });
  }
});

/**
 * POST /super-admins/register
 * Complete super admin registration - NO AUTHENTICATION REQUIRED
 */
router.post('/super-admins/register', async (req, res) => {
  try {
    const { error, value } = superAdminRegisterSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Find super admin by invitation token
    const superAdmin = await SuperAdminUser.findOne({
      where: {
        invitation_token: value.token,
        is_active: false,
      },
    });

    if (!superAdmin) {
      return res.status(400).json({ error: 'Invalid invitation token' });
    }

    // Check if token is expired
    if (new Date() > superAdmin.token_expires_at) {
      return res.status(400).json({ error: 'Invitation token has expired' });
    }

    // Hash password and activate super admin
    const hashedPassword = await bcrypt.hash(value.password, 12);

    await superAdmin.update({
      password_hash: hashedPassword,
      first_name: value.first_name || superAdmin.first_name,
      last_name: value.last_name || superAdmin.last_name,
      phone: value.phone || superAdmin.phone,
      is_active: true,
      invitation_token: null,
      invited_at: null,
      token_expires_at: null,
    });

    res.json({ message: 'Super admin registration completed successfully' });
  } catch (error) {
    console.error('Error completing super admin registration:', error);
    res.status(500).json({ error: 'Failed to complete registration' });
  }
});

/**
 * POST /super-admins/resend-invite
 * Resend invitation to a super admin
 */
router.post(
  '/super-admins/resend-invite',
  requireSuperAdmin(),
  async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const superAdmin = await SuperAdminUser.findOne({
        where: { email, is_active: false },
      });

      if (!superAdmin) {
        return res
          .status(400)
          .json({ error: 'Super admin not found or already active' });
      }

      // Generate new invitation token
      const invitationToken = generateTokenString();
      const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await superAdmin.update({
        invitation_token: invitationToken,
        invited_at: new Date(),
        token_expires_at: tokenExpiresAt,
      });

      // Send invitation email via SQS queue
      try {
        const invitationLink = `${process.env.FRONTEND_URL || 'https://admin.catalog.golf'}/super-admin/register?token=${invitationToken}`;
        await enqueueEmail('SuperAdminInvitation', email, {
          invitation_link: invitationLink,
        });
      } catch (emailError) {
        console.error(
          'Failed to enqueue super admin invitation email:',
          emailError
        );
        // Continue with response even if email fails
      }

      res.json({ message: 'Invitation resent successfully' });
    } catch (error) {
      console.error('Error resending super admin invitation:', error);
      res.status(500).json({ error: 'Failed to resend invitation' });
    }
  }
);

/**
 * POST /super-admins/revoke-invite
 * Revoke a super admin invitation
 */
router.post(
  '/super-admins/revoke-invite',
  requireSuperAdmin(),
  async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const superAdmin = await SuperAdminUser.findOne({
        where: { email, is_active: false },
      });

      if (!superAdmin) {
        return res
          .status(400)
          .json({ error: 'Super admin not found or already active' });
      }

      await superAdmin.destroy();
      res.json({ message: 'Invitation revoked successfully' });
    } catch (error) {
      console.error('Error revoking super admin invitation:', error);
      res.status(500).json({ error: 'Failed to revoke invitation' });
    }
  }
);

/**
 * PUT /super-admins/:id
 * Update a super admin
 */
router.put('/super-admins/:id', requireSuperAdmin(), async (req, res) => {
  try {
    const { error, value } = superAdminUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const superAdmin = await SuperAdminUser.findByPk(req.params.id);
    if (!superAdmin) {
      return res.status(404).json({ error: 'Super admin not found' });
    }

    await superAdmin.update(value);

    res.json({
      id: superAdmin.id,
      email: superAdmin.email,
      first_name: superAdmin.first_name,
      last_name: superAdmin.last_name,
      phone: superAdmin.phone,
      is_active: superAdmin.is_active,
      updated_at: superAdmin.updated_at,
    });
  } catch (error) {
    console.error('Error updating super admin:', error);
    res.status(500).json({ error: 'Failed to update super admin' });
  }
});

/**
 * DELETE /super-admins/:id
 * Deactivate a super admin
 */
router.delete('/super-admins/:id', requireSuperAdmin(), async (req, res) => {
  try {
    const superAdmin = await SuperAdminUser.findByPk(req.params.id);
    if (!superAdmin) {
      return res.status(404).json({ error: 'Super admin not found' });
    }

    await superAdmin.update({ is_active: false });
    res.json({ message: 'Super admin deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating super admin:', error);
    res.status(500).json({ error: 'Failed to deactivate super admin' });
  }
});

module.exports = router;
