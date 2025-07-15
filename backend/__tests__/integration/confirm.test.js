const request = require('supertest');
const app = require('../../src/app');
const {
  GolfCourseInstance,
  StaffUser,
  sequelize,
} = require('../../src/models');

// Mock the SQS client for email queue testing
jest.mock('@aws-sdk/client-sqs');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

describe('GET /api/v1/confirm', () => {
  let testCourse;
  let testUser;
  let mockSend;
  let mockSQSClient;

  beforeAll(async () => {
    try {
      // Set up database for this test suite only
      await sequelize.authenticate();
      console.log('Database connection established for confirm tests');

      // Create tables without foreign key constraints using raw SQL
      await sequelize.getQueryInterface().dropAllTables();

      // Create GolfCourseInstances table
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "GolfCourseInstances" (
          "id" UUID PRIMARY KEY,
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

      // Create StaffUsers table
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "StaffUsers" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "course_id" UUID NOT NULL,
          "email" VARCHAR(255) UNIQUE NOT NULL,
          "password" VARCHAR(255) NOT NULL,
          "role" VARCHAR(255) NOT NULL DEFAULT 'Staff',
          "is_active" BOOLEAN NOT NULL DEFAULT false,
          "invitation_token" VARCHAR(255),
          "invited_at" TIMESTAMP WITH TIME ZONE,
          "token_expires_at" TIMESTAMP WITH TIME ZONE,
          "first_name" VARCHAR(255),
          "last_name" VARCHAR(255),
          "phone" VARCHAR(255),
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('Tables created for confirm tests');
    } catch (error) {
      console.error('Error setting up confirm tests database:', error);
      throw error;
    }
  });

  beforeEach(async () => {
    // Clean up data before each test
    await sequelize.query('DELETE FROM "StaffUsers"');
    await sequelize.query('DELETE FROM "GolfCourseInstances"');

    // Set up SQS mocks
    jest.clearAllMocks();
    mockSend = jest.fn().mockResolvedValue({
      MessageId: 'mock-message-id-456',
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

    // Create test course
    testCourse = await GolfCourseInstance.create({
      name: 'Test Golf Course',
      subdomain: 'test-golf-course',
      status: 'Pending',
    });

    // Create test user with an invitation token
    testUser = await StaffUser.create({
      course_id: testCourse.id,
      email: 'test@example.com',
      password: 'hashedpassword',
      first_name: 'John',
      last_name: 'Doe',
      invitation_token: 'valid-token-123',
      invited_at: new Date(),
      token_expires_at: new Date(Date.now() + 3600000), // 1 hour from now
      is_active: false,
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

  describe('Email integration', () => {
    test('should activate user and course with valid token and send welcome email', async () => {
      const response = await request(app)
        .get('/api/v1/confirm?token=valid-token-123')
        .set('Accept', 'application/json')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Account activated successfully',
      });

      // Verify user is activated
      const updatedUser = await StaffUser.findByPk(testUser.id);
      expect(updatedUser.is_active).toBe(true);
      expect(updatedUser.invitation_token).toBeNull();

      // Verify course is activated
      const updatedCourse = await GolfCourseInstance.findByPk(testCourse.id);
      expect(updatedCourse.status).toBe('Active');
      expect(updatedCourse.primary_admin_id).toBe(testUser.id);

      // Verify that SQS send was called exactly once for welcome email
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Verify the command was created with correct parameters
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(SendMessageCommand);

      // Check that the command was constructed with the right parameters
      expect(SendMessageCommand).toHaveBeenCalledWith({
        QueueUrl:
          'https://sqs.us-east-1.amazonaws.com/123456789/CatalogEmailQueue',
        MessageBody: expect.stringContaining('"templateName":"WelcomeEmail"'),
      });

      // Parse the message body to verify the content
      const messageBodyCall = SendMessageCommand.mock.calls[0][0];
      const messageBody = JSON.parse(messageBodyCall.MessageBody);

      expect(messageBody).toEqual({
        templateName: 'WelcomeEmail',
        toAddress: 'test@example.com',
        templateData: {
          user_name: 'John Doe',
          course_name: 'Test Golf Course',
          subdomain: 'test-golf-course',
        },
      });
    });

    test('should handle SQS failures gracefully during confirmation', async () => {
      // Mock SQS to throw an error
      mockSend.mockRejectedValueOnce(new Error('SQS service unavailable'));

      const response = await request(app)
        .get('/api/v1/confirm?token=valid-token-123')
        .set('Accept', 'application/json')
        .expect(200);

      // Verify successful response (confirmation succeeds even if email fails)
      expect(response.body).toEqual({
        message: 'Account activated successfully',
      });

      // Verify that SQS send was attempted
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Verify that the database transaction was completed successfully
      // (user and course should be activated even if email fails)
      const user = await StaffUser.findByPk(testUser.id);
      const course = await GolfCourseInstance.findByPk(testCourse.id);

      // The transaction completes before the email, so activation should succeed
      // even if the welcome email fails to send
      expect(user.is_active).toBe(true); // User should be activated
      expect(course.status).toBe('Active'); // Course should be activated
      expect(course.primary_admin_id).toBe(testUser.id); // Admin should be set
    });
  });

  describe('should return 400 for expired token', () => {
    test('should return 400 for expired token', async () => {
      // Update user with expired token
      await testUser.update({
        token_expires_at: new Date(Date.now() - 3600000), // 1 hour ago
      });

      const response = await request(app)
        .get('/api/v1/confirm?token=valid-token-123')
        .set('Accept', 'application/json')
        .expect(400);

      expect(response.body).toEqual({
        error: 'This confirmation link has expired. Please request a new confirmation email.',
      });
    });
  });

  describe('should return 400 for invalid token', () => {
    test('should return 400 for invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/confirm?token=invalid-token')
        .set('Accept', 'application/json')
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid or expired token',
      });
    });
  });

  describe('should return 400 when token is missing', () => {
    test('should return 400 when token is missing', async () => {
      const response = await request(app)
        .get('/api/v1/confirm')
        .set('Accept', 'application/json')
        .expect(400);

      expect(response.body).toEqual({
        error: 'Token is required',
      });
    });
  });
});
