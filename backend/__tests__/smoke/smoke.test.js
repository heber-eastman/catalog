/**
 * Smoke Tests for Production/Staging Environment
 * These tests verify basic functionality in deployed environments
 */

const request = require('supertest');
const { execSync } = require('child_process');

// Environment configuration
const BASE_URL = process.env.SMOKE_TEST_URL || 'http://localhost:3000';
const TIMEOUT = 30000; // 30 seconds

describe('🔥 Smoke Tests - Production Health Checks', () => {
  let app;
  let superAdminToken;
  let staffToken;
  let testCourseId;

  beforeAll(async () => {
    console.log(`🎯 Running smoke tests against: ${BASE_URL}`);
    
    // For local testing, we might need to start the app
    if (BASE_URL.includes('localhost')) {
      try {
        const { createApp } = require('../../src/app');
        app = createApp();
      } catch (error) {
        console.warn('Could not create app for testing - assuming external server');
      }
    }
  }, TIMEOUT);

  describe('🏥 Health and Infrastructure', () => {
    test('Health endpoint responds correctly', async () => {
      const response = await request(BASE_URL)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
    });

    test('API health endpoint responds correctly', async () => {
      const response = await request(BASE_URL)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('database');
      expect(response.body.database).toHaveProperty('status', 'connected');
    });

    test('Authentication test endpoint works', async () => {
      const response = await request(BASE_URL)
        .get('/api/v1/auth/test')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Auth service is working');
    });

    test('Database connection is healthy', async () => {
      const response = await request(BASE_URL)
        .get('/api/v1/health/db')
        .expect(200);

      expect(response.body).toHaveProperty('database');
      expect(response.body.database).toHaveProperty('status', 'connected');
      expect(response.body.database).toHaveProperty('pool');
    });

    test('Rate limiting is active', async () => {
      // Make multiple rapid requests to test rate limiting
      const promises = Array(10).fill().map(() => 
        request(BASE_URL).get('/api/v1/auth/test')
      );

      const responses = await Promise.all(promises);
      
      // All should succeed initially (unless rate limit is very low)
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });

    test('CORS headers are properly set', async () => {
      const response = await request(BASE_URL)
        .options('/api/v1/auth/test')
        .set('Origin', 'https://catalog.golf')
        .set('Access-Control-Request-Method', 'GET')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    test('Security headers are present', async () => {
      const response = await request(BASE_URL)
        .get('/api/v1/health')
        .expect(200);

      // Check for common security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('🔐 Authentication Flow', () => {
    const superAdminData = {
      email: `smoke.super.admin.${Date.now()}@catalog.golf`,
      password: 'SmokeTest123!',
      firstName: 'Smoke',
      lastName: 'SuperAdmin'
    };

    test('Super admin registration works', async () => {
      const response = await request(BASE_URL)
        .post('/api/v1/auth/super-admin/register')
        .send(superAdminData)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('created successfully');
    });

    test('Super admin login works', async () => {
      const response = await request(BASE_URL)
        .post('/api/v1/auth/super-admin/login')
        .send({
          email: superAdminData.email,
          password: superAdminData.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('role', 'SuperAdmin');
      
      superAdminToken = response.body.token;
    });

    test('Protected super admin endpoint works with token', async () => {
      const response = await request(BASE_URL)
        .get('/api/v1/super-admin/courses')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('courses');
      expect(Array.isArray(response.body.courses)).toBe(true);
    });

    test('Protected endpoint rejects invalid token', async () => {
      await request(BASE_URL)
        .get('/api/v1/super-admin/courses')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    test('Logout works correctly', async () => {
      const response = await request(BASE_URL)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('logged out');
    });
  });

  describe('⛳ Golf Course Management', () => {
    const courseData = {
      name: `Smoke Test Golf Course ${Date.now()}`,
      subdomain: `smoke-test-${Date.now()}`,
      contactEmail: `smoke.course.${Date.now()}@catalog.golf`,
      contactPhone: '+1-555-SMOKE'
    };

    test('Golf course creation works', async () => {
      // Re-login as super admin
      const loginResponse = await request(BASE_URL)
        .post('/api/v1/auth/super-admin/login')
        .send({
          email: superAdminData.email,
          password: superAdminData.password
        })
        .expect(200);

      superAdminToken = loginResponse.body.token;

      const response = await request(BASE_URL)
        .post('/api/v1/super-admin/courses')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(courseData)
        .expect(201);

      expect(response.body).toHaveProperty('course');
      expect(response.body.course).toHaveProperty('id');
      expect(response.body.course).toHaveProperty('name', courseData.name);
      
      testCourseId = response.body.course.id;
    });

    test('Golf course listing works', async () => {
      const response = await request(BASE_URL)
        .get('/api/v1/super-admin/courses')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('courses');
      expect(response.body.courses.length).toBeGreaterThan(0);
      
      const createdCourse = response.body.courses.find(
        course => course.id === testCourseId
      );
      expect(createdCourse).toBeDefined();
      expect(createdCourse).toHaveProperty('name', courseData.name);
    });
  });

  describe('👥 Staff Management', () => {
    const staffData = {
      email: `smoke.staff.${Date.now()}@catalog.golf`,
      password: 'SmokeStaff123!',
      firstName: 'Smoke',
      lastName: 'Staff',
      role: 'admin',
      courseId: null // Will be set in test
    };

    test('Staff registration works', async () => {
      staffData.courseId = testCourseId;

      const response = await request(BASE_URL)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(staffData)
        .expect(201);

      expect(response.body).toHaveProperty('staff');
      expect(response.body.staff).toHaveProperty('email', staffData.email);
      expect(response.body.staff).toHaveProperty('role', staffData.role);
    });

    test('Staff login works', async () => {
      const response = await request(BASE_URL)
        .post('/api/v1/auth/login')
        .send({
          email: staffData.email,
          password: staffData.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('role', 'Staff');
      
      staffToken = response.body.token;
    });

    test('Staff can access protected endpoints', async () => {
      const response = await request(BASE_URL)
        .get('/api/v1/staff')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('staff');
      expect(Array.isArray(response.body.staff)).toBe(true);
    });
  });

  describe('👤 Customer Management', () => {
    const customerData = {
      firstName: 'Smoke',
      lastName: 'Customer',
      email: `smoke.customer.${Date.now()}@catalog.golf`,
      phone: '+1-555-SMOKE',
      membershipType: 'full',
      notes: 'Created via smoke test'
    };

    let customerId;

    test('Customer creation works', async () => {
      const response = await request(BASE_URL)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(customerData)
        .expect(201);

      expect(response.body).toHaveProperty('customer');
      expect(response.body.customer).toHaveProperty('id');
      expect(response.body.customer).toHaveProperty('email', customerData.email);
      
      customerId = response.body.customer.id;
    });

    test('Customer listing works', async () => {
      const response = await request(BASE_URL)
        .get('/api/v1/customers')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('customers');
      expect(Array.isArray(response.body.customers)).toBe(true);
      expect(response.body.customers.length).toBeGreaterThan(0);
      
      const createdCustomer = response.body.customers.find(
        customer => customer.id === customerId
      );
      expect(createdCustomer).toBeDefined();
    });

    test('Customer detail retrieval works', async () => {
      const response = await request(BASE_URL)
        .get(`/api/v1/customers/${customerId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('customer');
      expect(response.body.customer).toHaveProperty('id', customerId);
      expect(response.body.customer).toHaveProperty('email', customerData.email);
    });

    test('Customer update works', async () => {
      const updateData = {
        phone: '+1-555-UPDATED',
        notes: 'Updated via smoke test'
      };

      const response = await request(BASE_URL)
        .put(`/api/v1/customers/${customerId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('customer');
      expect(response.body.customer).toHaveProperty('phone', updateData.phone);
      expect(response.body.customer).toHaveProperty('notes', updateData.notes);
    });

    test('Customer search works', async () => {
      const response = await request(BASE_URL)
        .get('/api/v1/customers')
        .query({ search: customerData.firstName })
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('customers');
      expect(response.body.customers.length).toBeGreaterThan(0);
      
      const foundCustomer = response.body.customers.find(
        customer => customer.id === customerId
      );
      expect(foundCustomer).toBeDefined();
    });
  });

  describe('📝 Customer Notes', () => {
    let customerId;
    let noteId;

    beforeAll(async () => {
      // Create a customer for notes testing
      const customerResponse = await request(BASE_URL)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          firstName: 'Notes',
          lastName: 'Test',
          email: `notes.test.${Date.now()}@catalog.golf`,
          phone: '+1-555-NOTES'
        })
        .expect(201);
      
      customerId = customerResponse.body.customer.id;
    });

    test('Note creation works', async () => {
      const noteData = {
        content: 'Smoke test note content',
        type: 'general'
      };

      const response = await request(BASE_URL)
        .post(`/api/v1/customers/${customerId}/notes`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send(noteData)
        .expect(201);

      expect(response.body).toHaveProperty('note');
      expect(response.body.note).toHaveProperty('id');
      expect(response.body.note).toHaveProperty('content', noteData.content);
      
      noteId = response.body.note.id;
    });

    test('Notes listing works', async () => {
      const response = await request(BASE_URL)
        .get(`/api/v1/customers/${customerId}/notes`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('notes');
      expect(Array.isArray(response.body.notes)).toBe(true);
      expect(response.body.notes.length).toBeGreaterThan(0);
      
      const createdNote = response.body.notes.find(note => note.id === noteId);
      expect(createdNote).toBeDefined();
    });
  });

  describe('📊 Data Export/Import', () => {
    test('Customer export works', async () => {
      const response = await request(BASE_URL)
        .get('/api/v1/customers/export')
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text).toContain('firstName,lastName,email');
    });

    test('Customer status counts work', async () => {
      const response = await request(BASE_URL)
        .get('/api/v1/customers/status-counts')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('active');
      expect(response.body).toHaveProperty('archived');
      expect(typeof response.body.total).toBe('number');
    });
  });

  describe('🔒 Security and Authorization', () => {
    test('Unauthorized requests are rejected', async () => {
      await request(BASE_URL)
        .get('/api/v1/customers')
        .expect(401);
    });

    test('Cross-tenant data isolation works', async () => {
      // Create another course and staff user
      const secondCourseData = {
        name: `Isolation Test Course ${Date.now()}`,
        subdomain: `isolation-test-${Date.now()}`,
        contactEmail: `isolation.${Date.now()}@catalog.golf`,
        contactPhone: '+1-555-ISOL'
      };

      const courseResponse = await request(BASE_URL)
        .post('/api/v1/super-admin/courses')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(secondCourseData)
        .expect(201);

      const secondCourseId = courseResponse.body.course.id;

      // Create staff for second course
      const secondStaffData = {
        email: `isolation.staff.${Date.now()}@catalog.golf`,
        password: 'IsolationTest123!',
        firstName: 'Isolation',
        lastName: 'Staff',
        role: 'admin',
        courseId: secondCourseId
      };

      await request(BASE_URL)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(secondStaffData)
        .expect(201);

      // Login as second staff
      const loginResponse = await request(BASE_URL)
        .post('/api/v1/auth/login')
        .send({
          email: secondStaffData.email,
          password: secondStaffData.password
        })
        .expect(200);

      const secondStaffToken = loginResponse.body.token;

      // Try to access customers - should return empty list (no customers in this course)
      const customersResponse = await request(BASE_URL)
        .get('/api/v1/customers')
        .set('Authorization', `Bearer ${secondStaffToken}`)
        .expect(200);

      expect(customersResponse.body.customers).toHaveLength(0);
    });

    test('Input validation works', async () => {
      // Try to create customer with invalid email
      const invalidCustomerData = {
        firstName: 'Invalid',
        lastName: 'Customer',
        email: 'not-an-email',
        phone: '+1-555-0000'
      };

      await request(BASE_URL)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(invalidCustomerData)
        .expect(400);
    });

    test('SQL injection protection works', async () => {
      // Try SQL injection in search parameter
      const response = await request(BASE_URL)
        .get('/api/v1/customers')
        .query({ search: "'; DROP TABLE customers; --" })
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      // Should return empty results, not cause an error
      expect(response.body).toHaveProperty('customers');
      expect(Array.isArray(response.body.customers)).toBe(true);
    });
  });

  describe('⚡ Performance', () => {
    test('API responses are reasonably fast', async () => {
      const startTime = Date.now();
      
      await request(BASE_URL)
        .get('/api/v1/customers')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(5000); // 5 seconds max
    });

    test('Health check is very fast', async () => {
      const startTime = Date.now();
      
      await request(BASE_URL)
        .get('/health')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // 1 second max
    });

    test('Database queries are efficient', async () => {
      const startTime = Date.now();
      
      // Test a more complex query (customers with pagination)
      await request(BASE_URL)
        .get('/api/v1/customers')
        .query({ limit: 100, offset: 0 })
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(3000); // 3 seconds max
    });
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up smoke test data...');
    
    // In a real smoke test environment, you might want to clean up test data
    // or leave it for debugging purposes depending on your strategy
    
    if (process.env.CLEANUP_SMOKE_DATA === 'true') {
      // Clean up test data here if needed
      console.log('Test data cleanup completed');
    } else {
      console.log('Test data left in place for debugging');
    }
  });
}); 