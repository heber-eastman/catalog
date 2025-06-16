const request = require('supertest');
const app = require('../../src/app');
const {
  GolfCourseInstance,
  StaffUser,
  sequelize,
} = require('../../src/models');

describe('POST /api/v1/signup', () => {
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
        order: [['date_created', 'DESC']],
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
