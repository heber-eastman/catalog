const request = require('supertest');
const bcrypt = require('bcrypt');
const { signToken } = require('../../src/auth/jwt');
const { generateTokenString } = require('../../src/auth/tokenUtil');
const app = require('../../src/app');
const { sequelize } = require('../../src/models');
const { StaffUser, GolfCourseInstance } = require('../../src/models');

describe('Staff Management API', () => {
  let adminAuthToken, staffAuthToken, managerAuthToken;
  let courseId, adminUserId, staffUserId, managerUserId;
  let testStaffUser;

  beforeAll(async () => {
    console.log('Database connection established for staff tests');
    await sequelize.authenticate();

    // Sync only the models we need for staff tests (force recreates tables)
    await GolfCourseInstance.sync({ force: true });
    await StaffUser.sync({ force: true });
    console.log('Tables created for staff tests');

    // Create test course
    const course = await GolfCourseInstance.create({
      name: 'Test Golf Club',
      subdomain: 'test-golf-staff',
      status: 'Active',
    });
    courseId = course.id;

    // Create test users
    const hashedPassword = await bcrypt.hash('testpassword123', 10);

    const adminUser = await StaffUser.create({
      course_id: courseId,
      email: 'admin@testgolf.com',
      password: hashedPassword,
      role: 'Admin',
      is_active: true,
      first_name: 'Admin',
      last_name: 'User',
    });
    adminUserId = adminUser.id;

    const managerUser = await StaffUser.create({
      course_id: courseId,
      email: 'manager@testgolf.com',
      password: hashedPassword,
      role: 'Manager',
      is_active: true,
      first_name: 'Manager',
      last_name: 'User',
    });
    managerUserId = managerUser.id;

    const staffUser = await StaffUser.create({
      course_id: courseId,
      email: 'staff@testgolf.com',
      password: hashedPassword,
      role: 'Staff',
      is_active: true,
      first_name: 'Staff',
      last_name: 'User',
    });
    staffUserId = staffUser.id;

    // Generate auth tokens
    adminAuthToken = await signToken({
      user_id: adminUserId,
      email: 'admin@testgolf.com',
      role: 'Admin',
      course_id: courseId,
    });

    managerAuthToken = await signToken({
      user_id: managerUserId,
      email: 'manager@testgolf.com',
      role: 'Manager',
      course_id: courseId,
    });

    staffAuthToken = await signToken({
      user_id: staffUserId,
      email: 'staff@testgolf.com',
      role: 'Staff',
      course_id: courseId,
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Create a fresh test staff user for each test
    testStaffUser = await StaffUser.create({
      course_id: courseId,
      email: 'test.staff@example.com',
      password: await bcrypt.hash('password123', 10),
      role: 'Staff',
      is_active: true,
      first_name: 'Test',
      last_name: 'Staff',
    });
  });

  afterEach(async () => {
    // Clean up test staff users
    try {
      await StaffUser.destroy({
        where: {
          email: ['test.staff@example.com', 'invited@example.com', 'updated@example.com'],
        },
      });
    } catch (error) {
      // Ignore cleanup errors
      console.log('Cleanup error (ignored):', error.message);
    }
  });

  describe('GET /api/v1/staff', () => {
    test('should list all staff for admin', async () => {
      const response = await request(app)
        .get('/api/v1/staff')
        .set('Cookie', `jwt=${adminAuthToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('email');
      expect(response.body[0]).toHaveProperty('role');
      expect(response.body[0]).not.toHaveProperty('password');
    });

    test('should list all staff for manager', async () => {
      const response = await request(app)
        .get('/api/v1/staff')
        .set('Cookie', `jwt=${managerAuthToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return 403 for staff role', async () => {
      const response = await request(app)
        .get('/api/v1/staff')
        .set('Cookie', `jwt=${staffAuthToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Insufficient permissions');
    });

    test('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/v1/staff');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/staff/invite', () => {
    test('should invite new staff member as admin', async () => {
      const inviteData = {
        email: 'invited@example.com',
        role: 'Staff',
        first_name: 'Invited',
        last_name: 'User',
      };

      const response = await request(app)
        .post('/api/v1/staff/invite')
        .set('Cookie', `jwt=${adminAuthToken}`)
        .send(inviteData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(inviteData.email);
      expect(response.body.role).toBe(inviteData.role);
      expect(response.body.is_active).toBe(false);
      expect(response.body).toHaveProperty('invitation_token');

      // Verify user was created in database
      const invitedUser = await StaffUser.findOne({
        where: { email: 'invited@example.com' },
      });
      expect(invitedUser).toBeTruthy();
      expect(invitedUser.invitation_token).toBeTruthy();
    });

    test('should return 400 for invalid email', async () => {
      const inviteData = {
        email: 'invalid-email',
        role: 'Staff',
      };

      const response = await request(app)
        .post('/api/v1/staff/invite')
        .set('Cookie', `jwt=${adminAuthToken}`)
        .send(inviteData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should return 400 for invalid role', async () => {
      const inviteData = {
        email: 'invited@example.com',
        role: 'InvalidRole',
      };

      const response = await request(app)
        .post('/api/v1/staff/invite')
        .set('Cookie', `jwt=${adminAuthToken}`)
        .send(inviteData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should return 409 for duplicate email', async () => {
      const inviteData = {
        email: testStaffUser.email,
        role: 'Staff',
      };

      const response = await request(app)
        .post('/api/v1/staff/invite')
        .set('Cookie', `jwt=${adminAuthToken}`)
        .send(inviteData);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'Email already exists');
    });

    test('should return 403 for non-admin roles', async () => {
      const inviteData = {
        email: 'invited@example.com',
        role: 'Staff',
      };

      const response = await request(app)
        .post('/api/v1/staff/invite')
        .set('Cookie', `jwt=${staffAuthToken}`)
        .send(inviteData);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/v1/staff/register', () => {
    test('should register staff with valid token', async () => {
      // Create invited user
      const invitationToken = generateTokenString();
      const invitedUser = await StaffUser.create({
        course_id: courseId,
        email: 'register@example.com',
        password: 'temp', // Will be updated during registration
        role: 'Staff',
        is_active: false,
        invitation_token: invitationToken,
        token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      const registerData = {
        token: invitationToken,
        password: 'newpassword123',
        first_name: 'Registered',
        last_name: 'User',
        phone: '+1234567890',
      };

      const response = await request(app)
        .post('/api/v1/staff/register')
        .send(registerData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Registration successful');

      // Verify user was activated
      const registeredUser = await StaffUser.findByPk(invitedUser.id);
      expect(registeredUser.is_active).toBe(true);
      expect(registeredUser.first_name).toBe('Registered');
      expect(registeredUser.invitation_token).toBeNull();

      // Clean up
      await registeredUser.destroy();
    });

    test('should return 400 for invalid token', async () => {
      const registerData = {
        token: 'invalid-token',
        password: 'newpassword123',
        first_name: 'Test',
        last_name: 'User',
      };

      const response = await request(app)
        .post('/api/v1/staff/register')
        .send(registerData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid or expired token');
    });

    test('should return 400 for expired token', async () => {
      const expiredToken = generateTokenString();
      const invitedUser = await StaffUser.create({
        course_id: courseId,
        email: 'expired@example.com',
        password: 'temp',
        role: 'Staff',
        is_active: false,
        invitation_token: expiredToken,
        token_expires_at: new Date(Date.now() - 1000), // Expired
      });

      const registerData = {
        token: expiredToken,
        password: 'newpassword123',
        first_name: 'Test',
        last_name: 'User',
      };

      const response = await request(app)
        .post('/api/v1/staff/register')
        .send(registerData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid or expired token');

      // Clean up
      await invitedUser.destroy();
    });
  });

  describe('PUT /api/v1/staff/:id', () => {
    test('should update staff member as admin', async () => {
      const updateData = {
        role: 'Manager',
        first_name: 'Updated',
        phone: '+1987654321',
      };

      const response = await request(app)
        .put(`/api/v1/staff/${testStaffUser.id}`)
        .set('Cookie', `jwt=${adminAuthToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.role).toBe('Manager');
      expect(response.body.first_name).toBe('Updated');
      expect(response.body.phone).toBe('+1987654321');

      // Verify in database
      const updatedUser = await StaffUser.findByPk(testStaffUser.id);
      expect(updatedUser.role).toBe('Manager');
    });

    test('should return 404 for non-existent staff', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .put(`/api/v1/staff/${fakeId}`)
        .set('Cookie', `jwt=${adminAuthToken}`)
        .send({ first_name: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Staff member not found');
    });

    test('should return 403 for non-admin roles', async () => {
      const response = await request(app)
        .put(`/api/v1/staff/${testStaffUser.id}`)
        .set('Cookie', `jwt=${staffAuthToken}`)
        .send({ first_name: 'Test' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/staff/:id', () => {
    test('should deactivate staff member as admin', async () => {
      const response = await request(app)
        .delete(`/api/v1/staff/${testStaffUser.id}`)
        .set('Cookie', `jwt=${adminAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Staff member deactivated');

      // Verify user was deactivated
      const deactivatedUser = await StaffUser.findByPk(testStaffUser.id);
      expect(deactivatedUser.is_active).toBe(false);
    });

    test('should return 404 for non-existent staff', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/v1/staff/${fakeId}`)
        .set('Cookie', `jwt=${adminAuthToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Staff member not found');
    });

    test('should return 403 for non-admin roles', async () => {
      const response = await request(app)
        .delete(`/api/v1/staff/${testStaffUser.id}`)
        .set('Cookie', `jwt=${managerAuthToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/v1/staff/resend-invite', () => {
    test('should resend invitation as admin', async () => {
      // Create pending user
      const pendingUser = await StaffUser.create({
        course_id: courseId,
        email: 'pending@example.com',
        password: 'temp',
        role: 'Staff',
        is_active: false,
        invitation_token: generateTokenString(),
        token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const response = await request(app)
        .post('/api/v1/staff/resend-invite')
        .set('Cookie', `jwt=${adminAuthToken}`)
        .send({ staff_id: pendingUser.id });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Invitation resent');

      // Clean up
      await pendingUser.destroy();
    });

    test('should return 400 for active user', async () => {
      const response = await request(app)
        .post('/api/v1/staff/resend-invite')
        .set('Cookie', `jwt=${adminAuthToken}`)
        .send({ staff_id: testStaffUser.id });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'User is already active');
    });
  });

  describe('POST /api/v1/staff/revoke-invite', () => {
    test('should revoke invitation as admin', async () => {
      // Create pending user
      const pendingUser = await StaffUser.create({
        course_id: courseId,
        email: 'revoke@example.com',
        password: 'temp',
        role: 'Staff',
        is_active: false,
        invitation_token: generateTokenString(),
        token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const response = await request(app)
        .post('/api/v1/staff/revoke-invite')
        .set('Cookie', `jwt=${adminAuthToken}`)
        .send({ staff_id: pendingUser.id });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Invitation revoked');

      // Verify user was deleted
      const deletedUser = await StaffUser.findByPk(pendingUser.id);
      expect(deletedUser).toBeNull();
    });

    test('should return 400 for active user', async () => {
      const response = await request(app)
        .post('/api/v1/staff/revoke-invite')
        .set('Cookie', `jwt=${adminAuthToken}`)
        .send({ staff_id: testStaffUser.id });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Cannot revoke active user');
    });
  });
}); 