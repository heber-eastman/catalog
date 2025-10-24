const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const {
  GolfCourseInstance,
  StaffUser,
  Customer,
  sequelize,
} = require('../../src/models');

describe('Customer Import/Export API', () => {
  let authToken;
  let courseId;
  let staffUserId;

  beforeAll(async () => {
    try {
      // Set up database for this test suite only
      await sequelize.authenticate();
      console.log('Database connection established for import/export tests');

      // Create tables using raw SQL
      await sequelize.getQueryInterface().dropAllTables();

      // Ensure required extension and enum used by the model exist
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await sequelize.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_GolfCourseInstances_status') THEN
          CREATE TYPE "enum_GolfCourseInstances_status" AS ENUM ('Pending','Active','Deactivated');
        END IF;
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

      // Create StaffUsers table
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "StaffUsers" (
          "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

      // Create customers table
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "Customers" (
          "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

      console.log('Tables created for import/export tests');

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
      console.error('Error setting up import/export tests database:', error);
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

  describe('POST /api/v1/customers/import', () => {
    test('should import valid CSV file successfully', async () => {
      const csvContent = `first_name,last_name,email,phone,membership_type
John,Doe,john@example.com,+1234567890,Full
Jane,Smith,jane@example.com,+1234567891,Trial
Bob,Johnson,bob@example.com,,Junior`;

      const response = await request(app)
        .post('/api/v1/customers/import')
        .set('Cookie', `jwt=${authToken}`)
        .attach('file', Buffer.from(csvContent), 'customers.csv');

      expect(response.status).toBe(200);
      expect(response.body.imported_count).toBe(3);
      expect(response.body.failed_count).toBe(0);
      expect(response.body.failed_rows).toHaveLength(0);

      // Verify customers were created
      const customers = await Customer.findAll({
        where: { course_id: courseId },
      });
      expect(customers).toHaveLength(3);
      expect(customers.find(c => c.email === 'john@example.com')).toBeTruthy();
      expect(customers.find(c => c.email === 'jane@example.com')).toBeTruthy();
      expect(customers.find(c => c.email === 'bob@example.com')).toBeTruthy();
    });

    test('should handle CSV with validation errors', async () => {
      const csvContent = `first_name,last_name,email,phone,membership_type
John,Doe,john@example.com,+1234567890,Full
,Smith,jane@example.com,+1234567891,Trial
Bob,Johnson,invalid-email,,Junior
Alice,Brown,alice@example.com,+1234567892,Invalid`;

      const response = await request(app)
        .post('/api/v1/customers/import')
        .set('Cookie', `jwt=${authToken}`)
        .attach('file', Buffer.from(csvContent), 'customers.csv');

      expect(response.status).toBe(200);
      expect(response.body.imported_count).toBe(2); // John and Alice (with corrected membership type)
      expect(response.body.failed_count).toBe(2);
      expect(response.body.failed_rows).toHaveLength(2);

      // Check specific failures
      const failures = response.body.failed_rows;
      expect(failures.find(f => f.row === 3)).toBeTruthy(); // Missing first_name
      expect(failures.find(f => f.row === 4)).toBeTruthy(); // Invalid email

      // Verify successful imports
      const customers = await Customer.findAll({
        where: { course_id: courseId },
      });
      expect(customers).toHaveLength(2);
      expect(customers.find(c => c.email === 'john@example.com')).toBeTruthy();
      expect(customers.find(c => c.email === 'alice@example.com')).toBeTruthy();
    });

    test('should update existing customers on import', async () => {
      // Create an existing customer
      await Customer.create({
        first_name: 'Old',
        last_name: 'Name',
        email: 'john@example.com',
        phone: '+0000000000',
        membership_type: 'Trial',
        course_id: courseId,
      });

      const csvContent = `first_name,last_name,email,phone,membership_type
John,Doe,john@example.com,+1234567890,Full`;

      const response = await request(app)
        .post('/api/v1/customers/import')
        .set('Cookie', `jwt=${authToken}`)
        .attach('file', Buffer.from(csvContent), 'customers.csv');

      expect(response.status).toBe(200);
      expect(response.body.imported_count).toBe(1);
      expect(response.body.failed_count).toBe(0);

      // Verify customer was updated
      const customers = await Customer.findAll({
        where: { course_id: courseId },
      });
      expect(customers).toHaveLength(1);
      const customer = customers[0];
      expect(customer.first_name).toBe('John');
      expect(customer.last_name).toBe('Doe');
      expect(customer.phone).toBe('+1234567890');
      expect(customer.membership_type).toBe('Full');
    });

    test('should return 400 when no file is uploaded', async () => {
      const response = await request(app)
        .post('/api/v1/customers/import')
        .set('Cookie', `jwt=${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file uploaded');
    });

    test('should return 401 without authentication', async () => {
      const csvContent = `first_name,last_name,email
John,Doe,john@example.com`;

      const response = await request(app)
        .post('/api/v1/customers/import')
        .attach('file', Buffer.from(csvContent), 'customers.csv');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/customers/export', () => {
    beforeEach(async () => {
      // Create test customers
      await Customer.bulkCreate([
        {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          membership_type: 'Full',
          course_id: courseId,
        },
        {
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          phone: '+1234567891',
          membership_type: 'Trial',
          course_id: courseId,
        },
        {
          first_name: 'Bob',
          last_name: 'Johnson',
          email: 'bob@example.com',
          phone: null,
          membership_type: 'Junior',
          course_id: courseId,
        },
      ]);
    });

    test('should export all customers in CSV format', async () => {
      const response = await request(app)
        .get('/api/v1/customers/export')
        .set('Cookie', `jwt=${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="customers.csv"'
      );

      const csvContent = response.text;
      expect(csvContent).toContain('name,email,phone');
      expect(csvContent).toContain(
        '"John Doe","john@example.com","+1234567890"'
      );
      expect(csvContent).toContain(
        '"Jane Smith","jane@example.com","+1234567891"'
      );
      expect(csvContent).toContain('"Bob Johnson","bob@example.com",""');
    });

    test('should export filtered customers', async () => {
      const response = await request(app)
        .get('/api/v1/customers/export?membership_type=Full')
        .set('Cookie', `jwt=${authToken}`);

      expect(response.status).toBe(200);
      const csvContent = response.text;
      expect(csvContent).toContain(
        '"John Doe","john@example.com","+1234567890"'
      );
      expect(csvContent).not.toContain('Jane Smith');
      expect(csvContent).not.toContain('Bob Johnson');
    });

    test('should export searched customers', async () => {
      const response = await request(app)
        .get('/api/v1/customers/export?search=John')
        .set('Cookie', `jwt=${authToken}`);

      expect(response.status).toBe(200);
      const csvContent = response.text;
      expect(csvContent).toContain(
        '"John Doe","john@example.com","+1234567890"'
      );
      expect(csvContent).toContain('"Bob Johnson","bob@example.com",""');
      expect(csvContent).not.toContain('Jane Smith');
    });

    test('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/v1/customers/export');

      expect(response.status).toBe(401);
    });
  });
});
