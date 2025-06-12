/* eslint-env jest */
const { sequelize } = require('../src/models');

// Clean up database after all tests
afterAll(async () => {
  await sequelize.close();
});

// Clean up database before each test
beforeEach(async () => {
  await sequelize.sync({ force: true, match: /_test$/, logging: false });
});

// Basic test to ensure test environment is working
describe('Test Environment', () => {
  it('should be properly configured', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.DB_DATABASE).toMatch(/_test$/);
    expect(process.env.JWT_SECRET).toBeDefined();
    expect(process.env.AWS_REGION).toBeDefined();
    expect(process.env.AWS_ACCESS_KEY_ID).toBeDefined();
  });
});

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';

// Mock AWS SES
jest.mock('aws-sdk', () => ({
  SES: jest.fn(() => ({
    sendEmail: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
    }),
  })),
}));

describe('Test Environment Setup', () => {
  it('should set up test environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.JWT_SECRET).toBe('test-secret-key');
    expect(process.env.AWS_REGION).toBe('us-east-1');
    expect(process.env.AWS_ACCESS_KEY_ID).toBe('test');
    expect(process.env.AWS_SECRET_ACCESS_KEY).toBe('test');
  });
});
