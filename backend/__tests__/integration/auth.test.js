const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../../src/app');
const { sequelize } = require('../../src/models');
const {
  StaffUser,
  GolfCourseInstance,
  SuperAdminUser,
} = require('../../src/models');

describe('Authentication API', () => {
  let courseId;

  beforeAll(async () => {
    console.log('Database connection established for auth tests');
    await sequelize.authenticate();

    // Sync only the models we need for auth tests (force recreates tables)
    await GolfCourseInstance.sync({ force: true });
    await StaffUser.sync({ force: true });
    await SuperAdminUser.sync({ force: true });
    console.log('Tables created for auth tests');

    // Create test course
    const course = await GolfCourseInstance.create({
      name: 'Test Golf Club',
      subdomain: 'test-golf-auth',
      status: 'Active',
    });
    courseId = course.id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up users before each test
    await StaffUser.destroy({ where: {}, truncate: true });
    await SuperAdminUser.destroy({ where: {}, truncate: true });
  });

  describe('POST /api/v1/auth/login (Staff Login)', () => {
    test('should login successfully with active user', async () => {
      const hashedPassword = await bcrypt.hash('testpassword123', 10);

      const user = await StaffUser.create({
        course_id: courseId,
        email: 'active@testgolf.com',
        password: hashedPassword,
        role: 'Admin',
        is_active: true,
        first_name: 'Active',
        last_name: 'User',
      });

      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'active@testgolf.com',
        password: 'testpassword123',
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('id', user.id);
      expect(response.body).toHaveProperty('email', 'active@testgolf.com');
      expect(response.body).toHaveProperty('role', 'Admin');
      expect(response.body).toHaveProperty('first_name', 'Active');
      expect(response.body).toHaveProperty('last_name', 'User');
      expect(response.body).toHaveProperty('course_id', courseId);
    });

    test('should reject login for inactive user (unconfirmed email)', async () => {
      const hashedPassword = await bcrypt.hash('testpassword123', 10);

      await StaffUser.create({
        course_id: courseId,
        email: 'inactive@testgolf.com',
        password: hashedPassword,
        role: 'Admin',
        is_active: false, // User hasn't confirmed their email yet
        first_name: 'Inactive',
        last_name: 'User',
        invitation_token: 'some-token',
        token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'inactive@testgolf.com',
        password: 'testpassword123',
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Authentication failed');
      expect(response.body).toHaveProperty(
        'message',
        'Invalid email or password'
      );
      expect(response.body).not.toHaveProperty('token');
    });

    test('should reject login for non-existent user', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'nonexistent@testgolf.com',
        password: 'testpassword123',
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Authentication failed');
      expect(response.body).toHaveProperty(
        'message',
        'Invalid email or password'
      );
    });

    test('should reject login with wrong password', async () => {
      const hashedPassword = await bcrypt.hash('testpassword123', 10);

      await StaffUser.create({
        course_id: courseId,
        email: 'active@testgolf.com',
        password: hashedPassword,
        role: 'Admin',
        is_active: true,
        first_name: 'Active',
        last_name: 'User',
      });

      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'active@testgolf.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Authentication failed');
      expect(response.body).toHaveProperty(
        'message',
        'Invalid email or password'
      );
    });

    test('should reject login with missing fields', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'test@testgolf.com',
        // Missing password
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Missing required fields');
      expect(response.body).toHaveProperty(
        'message',
        'Email and password are required'
      );
    });
  });

  describe('POST /api/v1/auth/super-admin/login (Super Admin Login)', () => {
    test('should login successfully with active super admin', async () => {
      const hashedPassword = await bcrypt.hash('superpassword123', 10);

      const superAdmin = await SuperAdminUser.create({
        email: 'super@testgolf.com',
        password_hash: hashedPassword,
        is_active: true,
        first_name: 'Super',
        last_name: 'Admin',
      });

      const response = await request(app)
        .post('/api/v1/auth/super-admin/login')
        .send({
          email: 'super@testgolf.com',
          password: 'superpassword123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('id', superAdmin.id);
      expect(response.body).toHaveProperty('email', 'super@testgolf.com');
      expect(response.body).toHaveProperty('role', 'SuperAdmin');
      expect(response.body).toHaveProperty('first_name', 'Super');
      expect(response.body).toHaveProperty('last_name', 'Admin');
    });

    test('should reject login for inactive super admin', async () => {
      const hashedPassword = await bcrypt.hash('superpassword123', 10);

      await SuperAdminUser.create({
        email: 'inactive-super@testgolf.com',
        password_hash: hashedPassword,
        is_active: false, // Inactive super admin
        first_name: 'Inactive',
        last_name: 'Super',
      });

      const response = await request(app)
        .post('/api/v1/auth/super-admin/login')
        .send({
          email: 'inactive-super@testgolf.com',
          password: 'superpassword123',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Authentication failed');
      expect(response.body).toHaveProperty(
        'message',
        'Invalid email or password'
      );
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    test('should logout successfully', async () => {
      const response = await request(app).post('/api/v1/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        'message',
        'Logged out successfully'
      );
    });
  });
});
