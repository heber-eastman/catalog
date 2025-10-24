const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const app = require('../../src/app');
const {
  GolfCourseInstance,
  SuperAdminUser,
  sequelize,
} = require('../../src/models');

// Mock the SQS client for email queue testing
jest.mock('@aws-sdk/client-sqs');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

describe('Super Admin Management API', () => {
  let superAdminAuthToken;
  let superAdminUserId;
  let testCourseId;
  let mockSend;
  let mockSQSClient;

  beforeAll(async () => {
    try {
      // Set up database for this test suite only
      await sequelize.authenticate();
      console.log('Database connection established for super admin tests');

      // Create tables using raw SQL
      await sequelize.getQueryInterface().dropAllTables();

      // Ensure required extension and enum used by the model exist
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await sequelize.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_GolfCourseInstances_status') THEN
          CREATE TYPE "enum_GolfCourseInstances_status" AS ENUM ('Pending','Active','Suspended','Deactivated');
        END IF;
        BEGIN
          ALTER TYPE "enum_GolfCourseInstances_status" ADD VALUE IF NOT EXISTS 'Suspended';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
      END $$;`);

      // Create GolfCourseInstances table
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "GolfCourseInstances" (
          "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "name" VARCHAR(255) NOT NULL,
          "subdomain" VARCHAR(255) UNIQUE NOT NULL,
          "primary_admin_id" UUID,
          "status" "enum_GolfCourseInstances_status" NOT NULL DEFAULT 'Pending',
          "street" VARCHAR(255),
          "city" VARCHAR(255),
          "state" VARCHAR(255),
          "postal_code" VARCHAR(255),
          "country" VARCHAR(255),
          "timezone" VARCHAR(255),
          "latitude" DECIMAL(9,6),
          "longitude" DECIMAL(9,6),
          "date_created" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create SuperAdminUsers table
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "SuperAdminUsers" (
          "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    // Set up SQS mocks
    jest.clearAllMocks();
    mockSend = jest.fn().mockResolvedValue({
      MessageId: 'mock-message-id-999',
      MD5OfBody: 'mock-md5-hash',
    });

    mockSQSClient = {
      send: mockSend,
    };
    SQSClient.mockImplementation(() => mockSQSClient);

    // Set up environment variables for email queue
    process.env.EMAIL_QUEUE_URL =
      'https://sqs.us-east-1.amazonaws.com/123456789/CatalogEmailQueue';
    process.env.AWS_REGION = 'us-east-1';

    // Clean up any test data created during tests
    await SuperAdminUser.destroy({
      where: {
        email: { [sequelize.Sequelize.Op.ne]: 'superadmin@example.com' },
      },
    });
    await GolfCourseInstance.destroy({
      where: { id: { [sequelize.Sequelize.Op.ne]: testCourseId } },
    });
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.EMAIL_QUEUE_URL;
    delete process.env.AWS_REGION;
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
      const response = await request(app).get('/api/v1/super-admin/courses');

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
      expect(Array.isArray(response.body.super_admins)).toBe(true);
    });
  });
});