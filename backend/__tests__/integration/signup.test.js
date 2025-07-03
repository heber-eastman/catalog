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

describe('POST /api/v1/signup', () => {
  let mockSend;
  let mockSQSClient;

  beforeAll(async () => {
    try {
      // Set up database for this test suite only
      await sequelize.authenticate();
      console.log('Database connection established for signup tests');

      // Create tables without foreign key constraints for now
      await sequelize.getQueryInterface().dropAllTables();
      await GolfCourseInstance.sync({ force: true });
      await StaffUser.sync({ force: true });

      console.log('Tables created for signup tests');
    } catch (error) {
      console.error('Error setting up signup tests database:', error);
      throw error;
    }
  });

  beforeEach(async () => {
    // Clean up data before each test
    await StaffUser.destroy({ where: {}, truncate: true });
    await GolfCourseInstance.destroy({ where: {}, truncate: true });

    // Set up SQS mocks
    jest.clearAllMocks();
    mockSend = jest.fn().mockResolvedValue({
      MessageId: 'mock-message-id-123',
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

  describe('Successful signup', () => {
    test('should create course and admin user successfully', async () => {
      const signupData = {
        course: {
          name: 'Sunset Golf Club',
          street: '123 Golf Lane',
          city: 'Golfville',
          state: 'CA',
          postal_code: '12345',
          country: 'USA',
        },
        admin: {
          email: 'admin@example.com',
          password: 'StrongP@ss123',
          first_name: 'John',
          last_name: 'Doe',
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(signupData)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Account created successfully');

      // Verify course was created
      const course = await GolfCourseInstance.findOne({
        where: { name: 'Sunset Golf Club' },
      });
      expect(course).toBeTruthy();
      expect(course.subdomain).toMatch(/^sunset-golf-club/);

      // Verify admin user was created
      const admin = await StaffUser.findOne({
        where: { email: 'admin@example.com' },
      });
      expect(admin).toBeTruthy();
      expect(admin.first_name).toBe('John');
      expect(admin.last_name).toBe('Doe');
      expect(admin.role).toBe('Admin');
      expect(admin.is_active).toBe(false);
      expect(admin.invitation_token).toBeTruthy();
    });

    test('should generate unique subdomain with special characters', async () => {
      const signupData = {
        course: {
          name: 'The Royal & Country Club!',
          street: '456 Royal Rd',
          city: 'Royalton',
          state: 'TX',
          postal_code: '67890',
          country: 'USA',
        },
        admin: {
          email: 'royal@example.com',
          password: 'RoyalP@ss123',
          first_name: 'Royal',
          last_name: 'Admin',
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(signupData);

      expect(response.status).toBe(201);

      const course = await GolfCourseInstance.findOne({
        where: { name: 'The Royal & Country Club!' },
      });
      expect(course.subdomain).toMatch(/^the-royal.*country-club/);
    });
  });

  describe('Email integration', () => {
    test('should enqueue confirmation email with correct template and data', async () => {
      const signupData = {
        course: {
          name: 'Pine Valley Golf Club',
          street: '123 Pine Valley Dr',
          city: 'Pine Valley',
          state: 'NJ',
          postal_code: '08021',
          country: 'USA',
        },
        admin: {
          email: 'admin@pinevalley.com',
          password: 'StrongP@ss123',
          first_name: 'Pine',
          last_name: 'Admin',
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(signupData)
        .expect(201);

      // Verify successful response
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Account created successfully');

      // Verify that SQS send was called exactly once
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Verify the command was created with correct parameters
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(SendMessageCommand);

      // Check that the command was constructed with the right parameters
      expect(SendMessageCommand).toHaveBeenCalledWith({
        QueueUrl:
          'https://sqs.us-east-1.amazonaws.com/123456789/CatalogEmailQueue',
        MessageBody: expect.stringContaining(
          '"templateName":"SignupConfirmation"'
        ),
      });

      // Parse the message body to verify the content
      const messageBodyCall = SendMessageCommand.mock.calls[0][0];
      const messageBody = JSON.parse(messageBodyCall.MessageBody);

      expect(messageBody).toEqual({
        templateName: 'SignupConfirmation',
        toAddress: 'admin@pinevalley.com',
        templateData: {
          confirmation_link: expect.stringMatching(
            /^https:\/\/pine-valley-golf-club.*\.catalog\.golf\/confirm\?token=.+$/
          ),
          course_name: 'Pine Valley Golf Club',
        },
      });

      // Verify the confirmation link contains a valid token
      expect(messageBody.templateData.confirmation_link).toMatch(
        /token=[a-zA-Z0-9]+/
      );
    });

    test('should handle SQS failures gracefully', async () => {
      const sqsError = new Error('SQS service unavailable');
      mockSend.mockRejectedValueOnce(sqsError);

      const signupData = {
        course: {
          name: 'Error Test Club',
          street: '123 Error St',
          city: 'Errorville',
          state: 'CA',
          postal_code: '12345',
          country: 'USA',
        },
        admin: {
          email: 'error@example.com',
          password: 'TestP@ss123',
          first_name: 'Error',
          last_name: 'Test',
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(signupData)
        .expect(201);

      // Verify success response even with email failure
      expect(response.body).toHaveProperty('subdomain');
      expect(response.body.subdomain).toBe('error-test-club');

      // Verify that SQS send was attempted
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Verify that the course and user were created successfully
      // even though email failed (non-blocking operation)
      const course = await GolfCourseInstance.findOne({
        where: { name: 'Error Test Club' },
      });
      const user = await StaffUser.findOne({
        where: { email: 'error@example.com' },
      });

      expect(course).toBeTruthy(); // Course was created successfully
      expect(user).toBeTruthy(); // User was created successfully
    });
  });

  describe('Subdomain collision handling', () => {
    test('should handle subdomain collisions by appending numbers', async () => {
      // Create initial course
      await GolfCourseInstance.create({
        name: 'Test Club',
        subdomain: 'test-club',
        status: 'Active',
      });

      const signupData = {
        course: {
          name: 'Test Club',
          street: '123 Test St',
          city: 'Testville',
          state: 'CA',
          postal_code: '12345',
          country: 'USA',
        },
        admin: {
          email: 'admin2@example.com',
          password: 'TestP@ss123',
          first_name: 'Test',
          last_name: 'Admin',
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(signupData);

      expect(response.status).toBe(201);

      const course = await GolfCourseInstance.findOne({
        where: { name: 'Test Club' },
        order: [['created_at', 'DESC']],
      });
      expect(course.subdomain).toBe('test-club-2');
    });
  });

  describe('Validation errors', () => {
    test('should return 400 for missing required fields', async () => {
      const incompleteData = {
        course: {
          name: 'Incomplete Club',
        },
        admin: {
          email: 'incomplete@example.com',
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should return 400 for invalid email format', async () => {
      const invalidEmailData = {
        course: {
          name: 'Test Club',
          street: '123 Test St',
          city: 'Testville',
          state: 'CA',
          postal_code: '12345',
          country: 'USA',
        },
        admin: {
          email: 'invalid-email',
          password: 'ValidP@ss123',
          first_name: 'Test',
          last_name: 'Admin',
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(invalidEmailData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should return 400 for weak password', async () => {
      const weakPasswordData = {
        course: {
          name: 'Test Club',
          street: '123 Test St',
          city: 'Testville',
          state: 'CA',
          postal_code: '12345',
          country: 'USA',
        },
        admin: {
          email: 'admin@example.com',
          password: 'weak',
          first_name: 'Test',
          last_name: 'Admin',
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(weakPasswordData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should return 400 for invalid course data', async () => {
      const invalidCourseData = {
        course: {
          name: '',
        },
        admin: {
          email: 'admin@example.com',
          password: 'ValidP@ss123',
          first_name: 'Test',
          last_name: 'Admin',
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(invalidCourseData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should return 409 for duplicate email', async () => {
      // Create initial user
      const course = await GolfCourseInstance.create({
        name: 'Existing Club',
        subdomain: 'existing-club',
        status: 'Active',
      });

      await StaffUser.create({
        course_id: course.id,
        email: 'duplicate@example.com',
        password: 'hashedpassword',
        first_name: 'Existing',
        last_name: 'User',
        role: 'Admin',
      });

      const duplicateEmailData = {
        course: {
          name: 'New Club',
          street: '123 New St',
          city: 'Newville',
          state: 'CA',
          postal_code: '12345',
          country: 'USA',
        },
        admin: {
          email: 'duplicate@example.com',
          password: 'ValidP@ss123',
          first_name: 'New',
          last_name: 'Admin',
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(duplicateEmailData);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Edge cases', () => {
    test('should handle very long course names', async () => {
      const longName = 'A'.repeat(100); // Max allowed length
      const longNameData = {
        course: {
          name: longName,
          street: '123 Long St',
          city: 'Longville',
          state: 'CA',
          postal_code: '12345',
          country: 'USA',
        },
        admin: {
          email: 'long@example.com',
          password: 'LongP@ss123',
          first_name: 'Long',
          last_name: 'Admin',
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(longNameData);

      expect(response.status).toBe(201);
    });

    test('should handle course names with only special characters', async () => {
      const specialCharData = {
        course: {
          name: '!@#$%^&*()',
          street: '123 Special St',
          city: 'Specialville',
          state: 'CA',
          postal_code: '12345',
          country: 'USA',
        },
        admin: {
          email: 'special@example.com',
          password: 'SpecialP@ss123',
          first_name: 'Special',
          last_name: 'Admin',
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(specialCharData);

      expect(response.status).toBe(201);

      const course = await GolfCourseInstance.findOne({
        where: { name: '!@#$%^&*()' },
      });
      expect(course.subdomain).toMatch(/^[a-z0-9-]+$/);
    });
  });
});
