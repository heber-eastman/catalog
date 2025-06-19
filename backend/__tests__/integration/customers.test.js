const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const {
  GolfCourseInstance,
  StaffUser,
  Customer,
  sequelize,
} = require('../../src/models');

describe('Customer Management API', () => {
  let authToken;
  let courseId;
  let staffUserId;

  beforeAll(async () => {
    try {
      // Set up database for this test suite only
      await sequelize.authenticate();
      console.log('Database connection established for customer tests');

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

      // Create customers table without foreign key constraints
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "Customers" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "course_id" UUID NOT NULL,
          "first_name" VARCHAR(255) NOT NULL,
          "last_name" VARCHAR(255) NOT NULL,
          "email" VARCHAR(255) NOT NULL,
          "phone" VARCHAR(20),
          "handicap" DECIMAL(4,1),
          "membership_type" VARCHAR(255) NOT NULL DEFAULT 'Trial',
          "membership_start_date" TIMESTAMP WITH TIME ZONE,
          "membership_end_date" TIMESTAMP WITH TIME ZONE,
          "is_archived" BOOLEAN NOT NULL DEFAULT false,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE("email")
        );
      `);

      console.log('Tables created for customer tests');

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
      courseId = course.id;

      // Create test staff user
      const staffUser = await StaffUser.create({
        course_id: courseId,
        email: 'admin@testgolf.com',
        password: 'hashedpassword123',
        first_name: 'Test',
        last_name: 'Admin',
        role: 'Admin',
        is_active: true,
      });
      staffUserId = staffUser.id;

      // Generate auth token
      authToken = jwt.sign(
        {
          user_id: staffUserId,
          course_id: courseId,
          email: 'admin@testgolf.com',
          role: 'Admin',
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
    } catch (error) {
      console.error('Error setting up customer tests database:', error);
      throw error;
    }
  });

  beforeEach(async () => {
    // Clean up customer data before each test
    await Customer.destroy({ where: {}, truncate: true });
  });

  afterAll(async () => {
    try {
      await sequelize.close();
    } catch (error) {
      // Ignore connection already closed errors
    }
  });

  describe('POST /api/v1/customers', () => {
    const validCustomerData = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      membership_type: 'Full',
    };

    test('should create a new customer with valid data', async () => {
      const response = await request(app)
        .post('/api/v1/customers')
        .set('Cookie', `jwt=${authToken}`)
        .send(validCustomerData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.first_name).toBe(validCustomerData.first_name);
      expect(response.body.last_name).toBe(validCustomerData.last_name);
      expect(response.body.email).toBe(validCustomerData.email);
      expect(response.body.course_id).toBe(courseId);

      // Verify customer was saved to database
      const savedCustomer = await Customer.findByPk(response.body.id);
      expect(savedCustomer).toBeTruthy();
      expect(savedCustomer.email).toBe(validCustomerData.email);
    });

    test('should return 400 for invalid email format', async () => {
      const invalidData = {
        ...validCustomerData,
        email: 'invalid-email',
      };

      const response = await request(app)
        .post('/api/v1/customers')
        .set('Cookie', `jwt=${authToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should return 400 for missing required fields', async () => {
      const incompleteData = {
        first_name: 'John',
        // missing last_name and email
      };

      const response = await request(app)
        .post('/api/v1/customers')
        .set('Cookie', `jwt=${authToken}`)
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should return 409 for duplicate email', async () => {
      // Create first customer
      await Customer.create({
        ...validCustomerData,
        course_id: courseId,
      });

      // Try to create another with same email
      const response = await request(app)
        .post('/api/v1/customers')
        .set('Cookie', `jwt=${authToken}`)
        .send(validCustomerData);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('email');
    });

    test('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/customers')
        .send(validCustomerData);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/customers', () => {
    beforeEach(async () => {
      // Create test customers
      await Customer.bulkCreate([
        {
          first_name: 'Alice',
          last_name: 'Smith',
          email: 'alice@example.com',
          phone: '+1111111111',
          course_id: courseId,
          membership_type: 'Full',
        },
        {
          first_name: 'Bob',
          last_name: 'Johnson',
          email: 'bob@example.com',
          phone: '+2222222222',
          course_id: courseId,
          membership_type: 'Junior',
        },
      ]);
    });

    test('should retrieve all customers for the course', async () => {
      const response = await request(app)
        .get('/api/v1/customers')
        .set('Cookie', `jwt=${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('first_name');
      expect(response.body[0]).toHaveProperty('email');
    });

    test('should return empty array when no customers exist', async () => {
      await Customer.destroy({ where: {}, truncate: true });

      const response = await request(app)
        .get('/api/v1/customers')
        .set('Cookie', `jwt=${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    test('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/v1/customers');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/customers/:id', () => {
    let customerId;

    beforeEach(async () => {
      const customer = await Customer.create({
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        phone: '+3333333333',
        course_id: courseId,
        membership_type: 'Full',
      });
      customerId = customer.id;
    });

    test('should retrieve a specific customer', async () => {
      const response = await request(app)
        .get(`/api/v1/customers/${customerId}`)
        .set('Cookie', `jwt=${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', customerId);
      expect(response.body).toHaveProperty('first_name', 'Jane');
      expect(response.body).toHaveProperty('email', 'jane@example.com');
    });

    test('should return 404 for non-existent customer', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/v1/customers/${nonExistentId}`)
        .set('Cookie', `jwt=${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    test('should return 401 without authentication', async () => {
      const response = await request(app).get(
        `/api/v1/customers/${customerId}`
      );

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/customers/:id', () => {
    let customerId;

    beforeEach(async () => {
      const customer = await Customer.create({
        first_name: 'Original',
        last_name: 'Name',
        email: 'original@example.com',
        phone: '+4444444444',
        course_id: courseId,
        membership_type: 'Trial',
      });
      customerId = customer.id;
    });

    test('should update customer with valid data', async () => {
      const updateData = {
        first_name: 'Updated',
        last_name: 'Name',
        email: 'updated@example.com',
        phone: '+5555555555',
        membership_type: 'Full',
      };

      const response = await request(app)
        .put(`/api/v1/customers/${customerId}`)
        .set('Cookie', `jwt=${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('first_name', 'Updated');
      expect(response.body).toHaveProperty('email', 'updated@example.com');

      // Verify changes in database
      const updatedCustomer = await Customer.findByPk(customerId);
      expect(updatedCustomer.first_name).toBe('Updated');
      expect(updatedCustomer.email).toBe('updated@example.com');
    });

    test('should return 400 for invalid update data', async () => {
      const invalidData = {
        email: 'invalid-email-format',
      };

      const response = await request(app)
        .put(`/api/v1/customers/${customerId}`)
        .set('Cookie', `jwt=${authToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should return 404 for non-existent customer', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const updateData = {
        first_name: 'Updated',
        last_name: 'Name',
      };

      const response = await request(app)
        .put(`/api/v1/customers/${nonExistentId}`)
        .set('Cookie', `jwt=${authToken}`)
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    test('should return 401 without authentication', async () => {
      const response = await request(app)
        .put(`/api/v1/customers/${customerId}`)
        .send({ first_name: 'Updated' });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/customers/:id', () => {
    let customerId;

    beforeEach(async () => {
      const customer = await Customer.create({
        first_name: 'To Be',
        last_name: 'Deleted',
        email: 'deleted@example.com',
        phone: '+6666666666',
        course_id: courseId,
        membership_type: 'Trial',
      });
      customerId = customer.id;
    });

    test('should delete customer successfully', async () => {
      const response = await request(app)
        .delete(`/api/v1/customers/${customerId}`)
        .set('Cookie', `jwt=${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');

      // Verify deletion in database
      const deletedCustomer = await Customer.findByPk(customerId);
      expect(deletedCustomer).toBeNull();
    });

    test('should return 404 for non-existent customer', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/v1/customers/${nonExistentId}`)
        .set('Cookie', `jwt=${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    test('should return 401 without authentication', async () => {
      const response = await request(app).delete(
        `/api/v1/customers/${customerId}`
      );

      expect(response.status).toBe(401);
    });
  });
});
