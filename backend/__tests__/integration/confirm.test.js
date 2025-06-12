const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../../src/app');
const { GolfCourseInstance, StaffUser, sequelize } = require('../../src/models');
const { signToken } = require('../../src/auth/jwt');
const { generateTokenString } = require('../../src/auth/tokenUtil');

describe('GET /api/v1/confirm', () => {
  let testUser;
  let testCourse;
  const validPassword = 'Password123!';

  beforeAll(async () => {
    // Sync database
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // Create a test golf course instance
    testCourse = await GolfCourseInstance.create({
      name: 'Test Golf Course',
      street: '123 Test St',
      city: 'Testville',
      state: 'TS',
      postal_code: '12345',
      country: 'Test Country',
      subdomain: 'test-golf-course',
      status: 'Pending'
    });

    // Create a test staff user with invitation token
    const invitationToken = generateTokenString();
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24); // Token expires in 24 hours

    // Hash the password
    const password_hash = await bcrypt.hash(validPassword, 10);

    testUser = await StaffUser.create({
      email: 'test@example.com',
      password_hash,
      first_name: 'Test',
      last_name: 'User',
      role: 'Admin',
      is_active: false,
      course_id: testCourse.id,
      invitation_token: invitationToken,
      token_expires_at: tokenExpiresAt
    });
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

  it('should activate user and course with valid token', async () => {
    const response = await request(app)
      .get(`/api/v1/confirm?token=${testUser.invitation_token}`);

    // Assert response
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(`https://test-golf-course.devstreet.co/dashboard`);
    
    // Assert cookie is set
    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/^jwt=/);
    expect(cookies[0]).toMatch(/HttpOnly/);
    
    // Verify database updates
    const updatedUser = await StaffUser.findByPk(testUser.id);
    expect(updatedUser.is_active).toBe(true);
    expect(updatedUser.invitation_token).toBeNull();
    expect(updatedUser.token_expires_at).toBeNull();

    const updatedCourse = await GolfCourseInstance.findByPk(testCourse.id);
    expect(updatedCourse.status).toBe('Active');
  });

  it('should return 400 for expired token', async () => {
    // Set token to expired
    await testUser.update({
      token_expires_at: new Date(Date.now() - 86400000) // 24 hours ago
    });

    const response = await request(app)
      .get(`/api/v1/confirm?token=${testUser.invitation_token}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invitation token has expired');

    // Verify no changes were made
    const user = await StaffUser.findByPk(testUser.id);
    expect(user.is_active).toBe(false);
    
    const course = await GolfCourseInstance.findByPk(testCourse.id);
    expect(course.status).toBe('Pending');
  });

  it('should return 400 for invalid token', async () => {
    const response = await request(app)
      .get('/api/v1/confirm?token=invalid-token');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid invitation token');
  });

  it('should return 400 when token is missing', async () => {
    const response = await request(app)
      .get('/api/v1/confirm');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Token is required');
  });
}); 