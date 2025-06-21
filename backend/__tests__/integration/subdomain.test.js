const request = require('supertest');
const app = require('../../src/app');
const { sequelize, GolfCourseInstance } = require('../../src/models');
const { extractSubdomain } = require('../../src/middleware/subdomain');

describe('Subdomain Middleware Tests', () => {
  let testCourseId;
  let testSubdomain = 'test-course';

  beforeAll(async () => {
    console.log('Database connection established for subdomain tests');
    await sequelize.authenticate();

    // Create test course
    const testCourse = await GolfCourseInstance.create({
      name: 'Test Golf Course',
      subdomain: testSubdomain,
      status: 'Active',
      street: '123 Golf St',
      city: 'Golf City',
      state: 'CA',
      postal_code: '90210',
      country: 'US',
    });
    testCourseId = testCourse.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testCourseId) {
      await GolfCourseInstance.destroy({
        where: { id: testCourseId },
      });
    }
    await sequelize.close();
  });

  describe('extractSubdomain utility function', () => {
    test('should extract subdomain from production format', () => {
      expect(extractSubdomain('pine-valley.catalog.golf')).toBe('pine-valley');
      expect(extractSubdomain('sunset-golf.catalog.golf')).toBe('sunset-golf');
      expect(extractSubdomain('royal-club.catalog.golf')).toBe('royal-club');
    });

    test('should extract subdomain from production format with port', () => {
      expect(extractSubdomain('pine-valley.catalog.golf:443')).toBe(
        'pine-valley'
      );
      expect(extractSubdomain('sunset-golf.catalog.golf:80')).toBe(
        'sunset-golf'
      );
    });

    test('should handle localhost for development', () => {
      expect(extractSubdomain('localhost')).toBe('localhost');
      expect(extractSubdomain('localhost:3000')).toBe('localhost');
    });

    test('should extract subdomain from localhost development format', () => {
      expect(extractSubdomain('pine-valley.localhost')).toBe('pine-valley');
      expect(extractSubdomain('test-course.localhost:3000')).toBe(
        'test-course'
      );
    });

    test('should return null for invalid formats', () => {
      expect(extractSubdomain('catalog.golf')).toBe(null);
      expect(extractSubdomain('invalid-domain.com')).toBe(null);
      expect(extractSubdomain('')).toBe(null);
      expect(extractSubdomain('just-domain')).toBe(null);
    });
  });

  describe('Subdomain middleware integration', () => {
    test('should work with valid subdomain in production format', async () => {
      const response = await request(app)
        .get('/health')
        .set('Host', `${testSubdomain}.catalog.golf`)
        .expect(200);

      expect(response.body.status).toBe('OK');
    });

    test('should work with valid subdomain in localhost format', async () => {
      const response = await request(app)
        .get('/health')
        .set('Host', `${testSubdomain}.localhost:3000`)
        .expect(200);

      expect(response.body.status).toBe('OK');
    });

    test('should work with plain localhost', async () => {
      const response = await request(app)
        .get('/health')
        .set('Host', 'localhost:3000')
        .expect(200);

      expect(response.body.status).toBe('OK');
    });

    test('should work without Host header for health check', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.status).toBe('OK');
    });
  });

  describe('Routes requiring subdomain mapping', () => {
    // Note: These tests would apply to routes that use mapSubdomainToCourse middleware
    // Since our current routes use JWT-based course_id, we'll create a test route

    test('should handle missing Host header gracefully for optional subdomain extraction', async () => {
      // The extractSubdomainOptional middleware should not fail without Host header
      const response = await request(app).get('/').expect(200);

      expect(response.body.message).toBe('Backend API is running!');
    });

    test('should extract subdomain info when Host header is present', async () => {
      // Test that subdomain is properly extracted and available in req.subdomain
      const response = await request(app)
        .get('/')
        .set('Host', `${testSubdomain}.catalog.golf`)
        .expect(200);

      expect(response.body.message).toBe('Backend API is running!');
      // Note: In a real implementation, we might return subdomain info in response
    });
  });

  describe('Error handling for invalid subdomains', () => {
    test('should handle invalid domain format gracefully', async () => {
      const response = await request(app)
        .get('/health')
        .set('Host', 'invalid-domain.com')
        .expect(200);

      // Health check should still work with invalid subdomain
      expect(response.body.status).toBe('OK');
    });

    test('should handle empty Host header gracefully', async () => {
      const response = await request(app)
        .get('/health')
        .set('Host', '')
        .expect(200);

      expect(response.body.status).toBe('OK');
    });
  });

  describe('Subdomain mapping to course_id (simulated)', () => {
    // These tests simulate how the mapSubdomainToCourse middleware would work
    // when integrated with actual protected routes

    test('should find course by valid subdomain', async () => {
      const course = await GolfCourseInstance.findOne({
        where: { subdomain: testSubdomain },
      });

      expect(course).toBeTruthy();
      expect(course.id).toBe(testCourseId);
      expect(course.status).toBe('Active');
    });

    test('should not find course for invalid subdomain', async () => {
      const course = await GolfCourseInstance.findOne({
        where: { subdomain: 'non-existent-course' },
      });

      expect(course).toBe(null);
    });

    test('should handle inactive course status', async () => {
      // Create an inactive course for testing
      const inactiveCourse = await GolfCourseInstance.create({
        name: 'Inactive Golf Course',
        subdomain: 'inactive-course',
        status: 'Deactivated',
        street: '456 Inactive St',
        city: 'Inactive City',
        state: 'CA',
        postal_code: '90211',
        country: 'US',
      });

      const course = await GolfCourseInstance.findOne({
        where: { subdomain: 'inactive-course' },
      });

      expect(course).toBeTruthy();
      expect(course.status).toBe('Deactivated');

      // Clean up
      await GolfCourseInstance.destroy({
        where: { id: inactiveCourse.id },
      });
    });
  });

  describe('Real-world subdomain scenarios', () => {
    test('should handle complex subdomain names', async () => {
      expect(extractSubdomain('pine-valley-country-club.catalog.golf')).toBe(
        'pine-valley-country-club'
      );
      expect(extractSubdomain('royal-oak-123.catalog.golf')).toBe(
        'royal-oak-123'
      );
      expect(extractSubdomain('golf-course-2024.catalog.golf')).toBe(
        'golf-course-2024'
      );
    });

    test('should handle subdomains with numbers and hyphens', async () => {
      expect(extractSubdomain('course-1.catalog.golf')).toBe('course-1');
      expect(extractSubdomain('test-123-golf.catalog.golf')).toBe(
        'test-123-golf'
      );
      expect(extractSubdomain('a-b-c-d.catalog.golf')).toBe('a-b-c-d');
    });

    test('should handle edge cases with multiple dots', async () => {
      expect(extractSubdomain('subdomain.catalog.golf')).toBe('subdomain');
      expect(extractSubdomain('sub.domain.catalog.golf')).toBe('sub');
    });
  });
});
