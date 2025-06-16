/* eslint-env jest */
// Simple test setup without database synchronization
// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';

// Simple test that doesn't require database setup for most tests
console.log('Test environment variables set up successfully.');
