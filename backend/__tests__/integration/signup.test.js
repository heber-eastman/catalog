const request = require('supertest');
const app = require('../../src/app');
const { GolfCourseInstance, StaffUser, sequelize } = require('../../src/models');

describe('POST /api/v1/signup', () => {
  beforeAll(async () => {
    // Sync database
    await sequelize.sync({ force: true });
  });

  afterEach(async () => {
    // Clean up test data
    await StaffUser.destroy({ where: {} });
    await GolfCourseInstance.destroy({ where: {} });
  });

  afterAll(async () => {
    // Close database connection
    await sequelize.close();
  });

  describe('Successful signup', () => {
    it('should create course and admin user successfully', async () => {
      const response = await request(app)
        .post('/api/v1/signup')
        .send({
          course: {
            name: 'Sunset Golf Club',
            street: '123 Sunset Blvd',
            city: 'Los Angeles',
            state: 'CA',
            postal_code: '90001',
            country: 'USA'
          },
          admin: {
            email: 'admin@example.com',
            password: 'Password123!',
            first_name: 'John',
            last_name: 'Doe'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('subdomain', 'sunset-golf-club');
      expect(response.body).toHaveProperty('message');

      // Verify database entries
      const course = await GolfCourseInstance.findOne({
        where: { subdomain: 'sunset-golf-club' }
      });
      expect(course).toBeTruthy();
      expect(course.status).toBe('Pending');

      const user = await StaffUser.findOne({
        where: { email: 'admin@example.com' }
      });
      expect(user).toBeTruthy();
      expect(user.is_active).toBe(false);
      expect(user.role).toBe('Admin');
    });

    it('should generate unique subdomain with special characters', async () => {
      const response = await request(app)
        .post('/api/v1/signup')
        .send({
          course: {
            name: "St. Mary's Golf & Country Club",
            street: '123 Saint St',
            city: 'Los Angeles',
            state: 'CA',
            postal_code: '90001',
            country: 'USA'
          },
          admin: {
            email: 'admin@example.com',
            password: 'Password123!',
            first_name: 'John',
            last_name: 'Doe'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('subdomain', 'st-marys-golf-and-country-club');
    });
  });

  describe('Subdomain collision handling', () => {
    it('should handle subdomain collisions by appending numbers', async () => {
      // Create first course
      await request(app)
        .post('/api/v1/signup')
        .send({
          course: {
            name: 'Sunset Golf Club',
            street: '123 Sunset Blvd',
            city: 'Los Angeles',
            state: 'CA',
            postal_code: '90001',
            country: 'USA'
          },
          admin: {
            email: 'admin@example.com',
            password: 'Password123!',
            first_name: 'John',
            last_name: 'Doe'
          }
        });

      // Create second course with same name
      const response = await request(app)
        .post('/api/v1/signup')
        .send({
          course: {
            name: 'Sunset Golf Club',
            street: '456 Sunset Blvd',
            city: 'Los Angeles',
            state: 'CA',
            postal_code: '90001',
            country: 'USA'
          },
          admin: {
            email: 'admin2@example.com',
            password: 'Password123!',
            first_name: 'Jane',
            last_name: 'Doe'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('subdomain', 'sunset-golf-club-2');
    });
  });

  describe('Validation errors', () => {
    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/signup')
        .send({
          course: {
            name: 'Sunset Golf Club'
          },
          admin: {
            email: 'admin@example.com'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/signup')
        .send({
          course: {
            name: 'Sunset Golf Club',
            street: '123 Sunset Blvd',
            city: 'Los Angeles',
            state: 'CA',
            postal_code: '90001',
            country: 'USA'
          },
          admin: {
            email: 'invalid-email',
            password: 'Password123!',
            first_name: 'John',
            last_name: 'Doe'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/email/i);
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/v1/signup')
        .send({
          course: {
            name: 'Sunset Golf Club',
            street: '123 Sunset Blvd',
            city: 'Los Angeles',
            state: 'CA',
            postal_code: '90001',
            country: 'USA'
          },
          admin: {
            email: 'admin@example.com',
            password: 'weak',
            first_name: 'John',
            last_name: 'Doe'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/password/i);
    });

    it('should return 400 for invalid course data', async () => {
      const response = await request(app)
        .post('/api/v1/signup')
        .send({
          course: {
            name: '',
            street: '123 Sunset Blvd',
            city: 'Los Angeles',
            state: 'CA',
            postal_code: '90001',
            country: 'USA'
          },
          admin: {
            email: 'admin@example.com',
            password: 'Password123!',
            first_name: 'John',
            last_name: 'Doe'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/name/i);
    });

    it('should return 409 for duplicate email', async () => {
      // Create first user
      await request(app)
        .post('/api/v1/signup')
        .send({
          course: {
            name: 'First Golf Club',
            street: '123 First St',
            city: 'Los Angeles',
            state: 'CA',
            postal_code: '90001',
            country: 'USA'
          },
          admin: {
            email: 'admin@example.com',
            password: 'Password123!',
            first_name: 'John',
            last_name: 'Doe'
          }
        });

      // Try to create second user with same email
      const response = await request(app)
        .post('/api/v1/signup')
        .send({
          course: {
            name: 'Second Golf Club',
            street: '456 Second St',
            city: 'Los Angeles',
            state: 'CA',
            postal_code: '90001',
            country: 'USA'
          },
          admin: {
            email: 'admin@example.com',
            password: 'Password123!',
            first_name: 'Jane',
            last_name: 'Doe'
          }
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/email/i);
    });
  });

  describe('Edge cases', () => {
    it('should handle very long course names', async () => {
      const response = await request(app)
        .post('/api/v1/signup')
        .send({
          course: {
            name: 'The Very Long Golf Course Name That Should Be Truncated Properly And Still Work',
            street: '123 Long St',
            city: 'Los Angeles',
            state: 'CA',
            postal_code: '90001',
            country: 'USA'
          },
          admin: {
            email: 'admin@example.com',
            password: 'Password123!',
            first_name: 'John',
            last_name: 'Doe'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.subdomain.length).toBeLessThan(64);
    });

    it('should handle course names with only special characters', async () => {
      const response = await request(app)
        .post('/api/v1/signup')
        .send({
          course: {
            name: '$%&',
            street: '123 Special St',
            city: 'Los Angeles',
            state: 'CA',
            postal_code: '90001',
            country: 'USA'
          },
          admin: {
            email: 'admin@example.com',
            password: 'Password123!',
            first_name: 'John',
            last_name: 'Doe'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.subdomain).toBe('dollarpercentand');
    });
  });
});
