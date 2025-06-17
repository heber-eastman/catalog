const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const app = require('../../src/app');
const {
  GolfCourseInstance,
  SuperAdminUser,
  sequelize,
} = require('../../src/models');

describe('Super Admin Management API', () => {
  let superAdminAuthToken;
  let superAdminUserId;
  let testCourseId;

  beforeAll(async () => {
    try {
      // Set up database for this test suite only
      await sequelize.authenticate();
      console.log('Database connection established for super admin tests');

      // Create tables using raw SQL
      await sequelize.getQueryInterface().dropAllTables();

      // Create GolfCourseInstances table
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "GolfCourseInstances" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "name" VARCHAR(255) NOT NULL,
          "subdomain" VARCHAR(255) UNIQUE NOT NULL,
          "primary_admin_id" UUID,
          "status" VARCHAR(255) NOT NULL DEFAULT 'Pending',
          "street" VARCHAR(255),
          "city" VARCHAR(255),
          "state" VARCHAR(255),
          "postal_code" VARCHAR(255),
          "country" VARCHAR(255),
          "date_created" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create SuperAdminUsers table
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "SuperAdminUsers" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "email" VARCHAR(255) UNIQUE NOT NULL,
          "password_hash" VARCHAR(255) NOT NULL,
          "first_name" VARCHAR(255),
          "last_name" VARCHAR(255),
          "phone" VARCHAR(255),
          "is_active" BOOLEAN NOT NULL DEFAULT false,
          "invitation_token" VARCHAR(255),
          "invited_at" TIMESTAMP WITH TIME ZONE,
          "token_expires_at" TIMESTAMP WITH TIME ZONE,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('Tables created for super admin tests');

      // Create test super admin user
      const hashedPassword = await bcrypt.hash('password123', 12);
      const superAdmin = await SuperAdminUser.create({
        email: 'superadmin@example.com',
        password_hash: hashedPassword,
        first_name: 'Super',
        last_name: 'Admin',
        is_active: true,
      });
      superAdminUserId = superAdmin.id;

      // Create test golf course
      const course = await GolfCourseInstance.create({
        name: 'Test Golf Club',
        subdomain: 'test-golf-club',
        status: 'Active',
        street: '123 Golf Lane',
        city: 'Golfville',
        state: 'CA',
        postal_code: '12345',
        country: 'USA',
      });
      testCourseId = course.id;

      // Generate super admin auth token
      superAdminAuthToken = jwt.sign(
        {
          user_id: superAdminUserId,
          email: 'superadmin@example.com',
          role: 'SuperAdmin',
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
    } catch (error) {
      console.error('Error setting up super admin tests database:', error);
      throw error;
    }
  });

  beforeEach(async () => {
    // Clean up any test data created during tests
    await SuperAdminUser.destroy({ 
      where: { email: { [sequelize.Sequelize.Op.ne]: 'superadmin@example.com' } }
    });
    await GolfCourseInstance.destroy({ 
      where: { id: { [sequelize.Sequelize.Op.ne]: testCourseId } }
    });
  });

  afterAll(async () => {
    try {
      await sequelize.close();
    } catch (error) {
      // Ignore connection already closed errors
    }
  });

  // ===============================
  // COURSE MANAGEMENT TESTS
  // ===============================

  describe('GET /api/v1/super-admin/courses', () => {
    test('should list all courses for super admin', async () => {
      // Create additional test courses
      await GolfCourseInstance.bulkCreate([
        {
          name: 'Pine Valley Golf Club',
          subdomain: 'pine-valley',
          status: 'Active',
          city: 'Pine Valley',
        },
        {
          name: 'Ocean View Golf Course',
          subdomain: 'ocean-view',
          status: 'Pending',
          city: 'Ocean View',
        },
      ]);

      const response = await request(app)
        .get('/api/v1/super-admin/courses')
        .set('Cookie', `jwt=${superAdminAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.courses).toHaveLength(3);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 3,
        pages: 1,
      });
    });

    test('should filter courses by status', async () => {
      const response = await request(app)
        .get('/api/v1/super-admin/courses?status=Active')
        .set('Cookie', `jwt=${superAdminAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.courses).toHaveLength(1);
      expect(response.body.courses[0].status).toBe('Active');
    });

    test('should search courses by name', async () => {
      const response = await request(app)
        .get('/api/v1/super-admin/courses?search=Test')
        .set('Cookie', `jwt=${superAdminAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.courses).toHaveLength(1);
      expect(response.body.courses[0].name).toContain('Test');
    });

    test('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/super-admin/courses');

      expect(response.status).toBe(401);
    });

    test('should return 403 for non-super-admin roles', async () => {
      const staffToken = jwt.sign(
        { user_id: '123', email: 'staff@example.com', role: 'Admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/v1/super-admin/courses')
        .set('Cookie', `jwt=${staffToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/v1/super-admin/courses', () => {
    test('should create a new course as super admin', async () => {
      const courseData = {
        name: 'Riverside Golf Club',
        street: '456 River Road',
        city: 'Riverside',
        state: 'NY',
        postal_code: '12345',
        country: 'USA',
      };

      const response = await request(app)
        .post('/api/v1/super-admin/courses')
        .set('Cookie', `jwt=${superAdminAuthToken}`)
        .send(courseData);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(courseData.name);
      expect(response.body.subdomain).toBe('riverside-golf-club');
      expect(response.body.status).toBe('Active');
    });

    test('should handle subdomain collisions', async () => {
      const courseData = {
        name: 'Test Golf Club',
        city: 'Test City',
      };

      const response = await request(app)
        .post('/api/v1/super-admin/courses')
        .set('Cookie', `jwt=${superAdminAuthToken}`)
        .send(courseData);

      expect(response.status).toBe(201);
      expect(response.body.subdomain).toBe('test-golf-club-2');
    });

    test('should return 400 for invalid course data', async () => {
      const invalidData = {
        name: '', // Invalid - required field
      };

      const response = await request(app)
        .post('/api/v1/super-admin/courses')
        .set('Cookie', `jwt=${superAdminAuthToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/v1/super-admin/courses/:id', () => {
    test('should update course as super admin', async () => {
      const updateData = {
        name: 'Updated Golf Club',
        city: 'Updated City',
      };

      const response = await request(app)
        .put(`/api/v1/super-admin/courses/${testCourseId}`)
        .set('Cookie', `jwt=${superAdminAuthToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(updateData.name);
      expect(response.body.city).toBe(updateData.city);
    });

    test('should return 404 for non-existent course', async () => {
      const response = await request(app)
        .put('/api/v1/super-admin/courses/00000000-0000-0000-0000-000000000000')
        .set('Cookie', `jwt=${superAdminAuthToken}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/super-admin/courses/:id/status', () => {
    test('should update course status', async () => {
      const response = await request(app)
        .patch(`/api/v1/super-admin/courses/${testCourseId}/status`)
        .set('Cookie', `jwt=${superAdminAuthToken}`)
        .send({ status: 'Suspended' });

      expect(response.status).toBe(200);
      expect(response.body.course.status).toBe('Suspended');
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app)
        .patch(`/api/v1/super-admin/courses/${testCourseId}/status`)
        .set('Cookie', `jwt=${superAdminAuthToken}`)
        .send({ status: 'InvalidStatus' });

      expect(response.status).toBe(400);
    });
  });

  // ===============================
  // SUPER ADMIN MANAGEMENT TESTS
  // ===============================

  describe('GET /api/v1/super-admin/super-admins', () => {
    test('should list all super admins', async () => {
      const response = await request(app)
        .get('/api/v1/super-admin/super-admins')
        .set('Cookie', `jwt=${superAdminAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.super_admins).toHaveLength(1);
      expect(response.body.super_admins[0].email).toBe('superadmin@example.com');
    });

    test('should search super admins by email', async () => {
      const response = await request(app)
        .get('/api/v1/super-admin/super-admins?search=superadmin')
        .set('Cookie', `jwt=${superAdminAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.super_admins).toHaveLength(1);
    });
  });

  describe('POST /api/v1/super-admin/super-admins/invite', () => {
    test('should invite new super admin', async () => {
      const inviteData = {
        email: 'newadmin@example.com',
        first_name: 'New',
        last_name: 'Admin',
        phone: '+1234567890',
      };

      const response = await request(app)
        .post('/api/v1/super-admin/super-admins/invite')
        .set('Cookie', `jwt=${superAdminAuthToken}`)
        .send(inviteData);

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('invitation sent successfully');
      expect(response.body.super_admin.email).toBe(inviteData.email);
    });

    test('should return 400 for invalid email', async () => {
      const invalidData = {
        email: 'invalid-email',
        first_name: 'Test',
        last_name: 'User',
      };

      const response = await request(app)
        .post('/api/v1/super-admin/super-admins/invite')
        .set('Cookie', `jwt=${superAdminAuthToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
    });

    test('should return 409 for duplicate email', async () => {
      const duplicateData = {
        email: 'superadmin@example.com',
        first_name: 'Duplicate',
        last_name: 'Admin',
      };

      const response = await request(app)
        .post('/api/v1/super-admin/super-admins/invite')
        .set('Cookie', `jwt=${superAdminAuthToken}`)
        .send(duplicateData);

      expect(response.status).toBe(409);
    });
  });

  describe('POST /api/v1/super-admin/super-admins/register', () => {
    let invitationToken;

    beforeEach(async () => {
      // Create a pending super admin for registration tests
      const pendingSuperAdmin = await SuperAdminUser.create({
        email: 'pending@example.com',
        password_hash: 'temporary',
        first_name: 'Pending',
        last_name: 'Admin',
        is_active: false,
        invitation_token: 'valid-token-123',
        invited_at: new Date(),
        token_expires_at: new Date(Date.now() + 3600000), // 1 hour from now
      });
      invitationToken = pendingSuperAdmin.invitation_token;
    });

    test('should complete super admin registration', async () => {
      const registrationData = {
        token: invitationToken,
        password: 'newpassword123',
        first_name: 'Registered',
        last_name: 'Admin',
      };

      const response = await request(app)
        .post('/api/v1/super-admin/super-admins/register')
        .send(registrationData);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('registration completed');
    });

    test('should return 400 for invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/super-admin/super-admins/register')
        .send({
          token: 'invalid-token',
          password: 'password123',
        });

      expect(response.status).toBe(400);
    });

    test('should return 400 for expired token', async () => {
      // Update token to be expired
      await SuperAdminUser.update(
        { token_expires_at: new Date(Date.now() - 3600000) },
        { where: { invitation_token: invitationToken } }
      );

      const response = await request(app)
        .post('/api/v1/super-admin/super-admins/register')
        .send({
          token: invitationToken,
          password: 'password123',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/super-admin/super-admins/resend-invite', () => {
    beforeEach(async () => {
      await SuperAdminUser.create({
        email: 'pending@example.com',
        password_hash: 'temporary',
        first_name: 'Pending',
        last_name: 'Admin',
        is_active: false,
        invitation_token: 'old-token',
        invited_at: new Date(),
        token_expires_at: new Date(Date.now() + 3600000),
      });
    });

    test('should resend invitation', async () => {
      const response = await request(app)
        .post('/api/v1/super-admin/super-admins/resend-invite')
        .set('Cookie', `jwt=${superAdminAuthToken}`)
        .send({ email: 'pending@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('resent successfully');
    });

    test('should return 400 for non-existent or active user', async () => {
      const response = await request(app)
        .post('/api/v1/super-admin/super-admins/resend-invite')
        .set('Cookie', `jwt=${superAdminAuthToken}`)
        .send({ email: 'superadmin@example.com' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/super-admin/super-admins/revoke-invite', () => {
    beforeEach(async () => {
      await SuperAdminUser.create({
        email: 'pending@example.com',
        password_hash: 'temporary',
        first_name: 'Pending',
        last_name: 'Admin',
        is_active: false,
        invitation_token: 'token-to-revoke',
        invited_at: new Date(),
        token_expires_at: new Date(Date.now() + 3600000),
      });
    });

    test('should revoke invitation', async () => {
      const response = await request(app)
        .post('/api/v1/super-admin/super-admins/revoke-invite')
        .set('Cookie', `jwt=${superAdminAuthToken}`)
        .send({ email: 'pending@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('revoked successfully');
    });

    test('should return 400 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/super-admin/super-admins/revoke-invite')
        .set('Cookie', `jwt=${superAdminAuthToken}`)
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/v1/super-admin/super-admins/:id', () => {
    let anotherSuperAdminId;

    beforeEach(async () => {
      const anotherSuperAdmin = await SuperAdminUser.create({
        email: 'another@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Another',
        last_name: 'Admin',
        is_active: true,
      });
      anotherSuperAdminId = anotherSuperAdmin.id;
    });

    test('should update super admin', async () => {
      const updateData = {
        first_name: 'Updated',
        last_name: 'Name',
        phone: '+1987654321',
      };

      const response = await request(app)
        .put(`/api/v1/super-admin/super-admins/${anotherSuperAdminId}`)
        .set('Cookie', `jwt=${superAdminAuthToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.first_name).toBe(updateData.first_name);
      expect(response.body.last_name).toBe(updateData.last_name);
      expect(response.body.phone).toBe(updateData.phone);
    });

    test('should return 404 for non-existent super admin', async () => {
      const response = await request(app)
        .put('/api/v1/super-admin/super-admins/00000000-0000-0000-0000-000000000000')
        .set('Cookie', `jwt=${superAdminAuthToken}`)
        .send({ first_name: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/super-admin/super-admins/:id', () => {
    let anotherSuperAdminId;

    beforeEach(async () => {
      const anotherSuperAdmin = await SuperAdminUser.create({
        email: 'todelete@example.com',
        password_hash: 'hashedpassword',
        first_name: 'To',
        last_name: 'Delete',
        is_active: true,
      });
      anotherSuperAdminId = anotherSuperAdmin.id;
    });

    test('should deactivate super admin', async () => {
      const response = await request(app)
        .delete(`/api/v1/super-admin/super-admins/${anotherSuperAdminId}`)
        .set('Cookie', `jwt=${superAdminAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deactivated successfully');
    });

    test('should return 404 for non-existent super admin', async () => {
      const response = await request(app)
        .delete('/api/v1/super-admin/super-admins/00000000-0000-0000-0000-000000000000')
        .set('Cookie', `jwt=${superAdminAuthToken}`);

      expect(response.status).toBe(404);
    });
  });
}); 