module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  verbose: true,
  collectCoverage: false,
  maxWorkers: 1, // Run tests sequentially
  testTimeout: 10000, // Increase timeout for database operations
  detectOpenHandles: true,
  forceExit: true,
};
