const request = require('supertest');
const app = require('../../src/index');
const {
  sequelize,
  GolfCourseInstance,
  StaffUser,
} = require('../../src/models');

describe('POST /api/v1/signup', () => {
  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key';

    // Sync database
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // Clean database before each test
    await StaffUser.destroy({ where: {} });
    await GolfCourseInstance.destroy({ where: {} });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  const validSignupData = {
    email: 'admin@example.com',
    password: 'SecurePass123',
    course: {
      name: 'Sunset Golf Club',
      street: '123 Golf Course Drive',
      city: 'Phoenix',
      state: 'Arizona',
      postal_code: '85001',
      country: 'United States',
    },
  };

  describe('Successful signup', () => {
    test('should create course and admin user successfully', async () => {
      const response = await request(app)
        .post('/api/v1/signup')
        .send(validSignupData)
        .expect(201);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('subdomain');
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data.subdomain).toBe('sunset-golf-club');
      expect(response.body.data.message).toContain(
        'Account created successfully'
      );

      // Verify course was created
      const course = await GolfCourseInstance.findOne({
        where: { subdomain: 'sunset-golf-club' },
      });
      expect(course).toBeTruthy();
      expect(course.name).toBe('Sunset Golf Club');
      expect(course.status).toBe('Pending');

      // Verify admin user was created
      const user = await StaffUser.findOne({
        where: { email: 'admin@example.com' },
      });
      expect(user).toBeTruthy();
      expect(user.role).toBe('Admin');
      expect(user.is_active).toBe(false);
      expect(user.invitation_token).toBeTruthy();
      expect(user.token_expires_at).toBeTruthy();
    });

    test('should generate unique subdomain with special characters', async () => {
      const signupData = {
        ...validSignupData,
        course: {
          ...validSignupData.course,
          name: "St. Mary's Golf & Country Club!",
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(signupData)
        .expect(201);

      expect(response.body.data.subdomain).toBe(
        'st-marys-golf-and-country-club'
      );
    });
  });

  describe('Subdomain collision handling', () => {
    test('should handle subdomain collisions by appending numbers', async () => {
      // Create first course
      await request(app)
        .post('/api/v1/signup')
        .send(validSignupData)
        .expect(201);

      // Create second course with same name but different email
      const secondSignupData = {
        ...validSignupData,
        email: 'admin2@example.com',
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(secondSignupData)
        .expect(201);

      expect(response.body.data.subdomain).toBe('sunset-golf-club-2');

      // Create third course
      const thirdSignupData = {
        ...validSignupData,
        email: 'admin3@example.com',
      };

      const response3 = await request(app)
        .post('/api/v1/signup')
        .send(thirdSignupData)
        .expect(201);

      expect(response3.body.data.subdomain).toBe('sunset-golf-club-3');

      // Verify all courses exist
      const courses = await GolfCourseInstance.findAll();
      expect(courses).toHaveLength(3);
      expect(courses.map(c => c.subdomain).sort()).toEqual([
        'sunset-golf-club',
        'sunset-golf-club-2',
        'sunset-golf-club-3',
      ]);
    });
  });

  describe('Validation errors', () => {
    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/signup')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body).toHaveProperty('details');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    test('should return 400 for invalid email format', async () => {
      const invalidData = {
        ...validSignupData,
        email: 'invalid-email',
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContainEqual({
        field: 'email',
        message: 'Please provide a valid email address',
      });
    });

    test('should return 400 for weak password', async () => {
      const invalidData = {
        ...validSignupData,
        password: 'weak',
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.some(d => d.field === 'password')).toBe(
        true
      );
    });

    test('should return 400 for invalid course data', async () => {
      const invalidData = {
        ...validSignupData,
        course: {
          name: 'A', // Too short
          street: '123', // Too short
          city: '', // Empty
          state: '', // Empty
          postal_code: 'invalid!@#', // Invalid format
          country: '', // Empty
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    test('should return 409 for duplicate email', async () => {
      // Create first user
      await request(app)
        .post('/api/v1/signup')
        .send(validSignupData)
        .expect(201);

      // Try to create second user with same email
      const duplicateData = {
        ...validSignupData,
        course: {
          ...validSignupData.course,
          name: 'Different Golf Club',
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(duplicateData)
        .expect(409);

      expect(response.body).toHaveProperty('error', 'Email already registered');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Edge cases', () => {
    test('should handle very long course names', async () => {
      const longNameData = {
        ...validSignupData,
        course: {
          ...validSignupData.course,
          name: 'The Very Long Golf Course Name That Should Be Truncated Properly',
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(longNameData)
        .expect(201);

      expect(response.body.data.subdomain).toBeTruthy();
      expect(response.body.data.subdomain.length).toBeLessThan(100);
    });

    test('should handle course names with only special characters', async () => {
      const specialCharData = {
        ...validSignupData,
        course: {
          ...validSignupData.course,
          name: '!@#$%^&*()',
        },
      };

      const response = await request(app)
        .post('/api/v1/signup')
        .send(specialCharData)
        .expect(201);

      expect(response.body.data.subdomain).toBeTruthy();
      expect(response.body.data.subdomain).toMatch(/^[a-z0-9-]+$/);
    });
  });
});
