const { signToken, verifyToken } = require('../../src/auth/jwt');

describe('JWT Authentication', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = 'test-secret-key-for-jest';
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('signToken', () => {
    test('should sign a payload and return a valid JWT', async () => {
      const payload = {
        userId: '123',
        role: 'admin',
        courseId: 'golf-123',
      };

      const token = await signToken(payload);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    test('should accept custom options for token signing', async () => {
      const payload = { userId: '123' };
      const options = { expiresIn: '1h' };

      const token = await signToken(payload, options);
      expect(token).toBeTruthy();

      const decoded = await verifyToken(token);
      expect(decoded).toHaveProperty('exp');
    });

    test('should throw error if JWT_SECRET is not set', async () => {
      delete process.env.JWT_SECRET;

      const payload = { userId: '123' };
      await expect(signToken(payload)).rejects.toThrow(
        'JWT_SECRET must be set'
      );
    });
  });

  describe('verifyToken', () => {
    test('should verify a valid token and return the payload', async () => {
      const payload = {
        userId: '123',
        role: 'admin',
        courseId: 'golf-123',
      };

      const token = await signToken(payload);
      const decoded = await verifyToken(token);

      expect(decoded).toMatchObject(payload);
    });

    test('should throw error for invalid token', async () => {
      await expect(verifyToken('invalid-token')).rejects.toThrow();
    });

    test('should throw error for expired token', async () => {
      const payload = { userId: '123' };
      const token = await signToken(payload, { expiresIn: '0s' });

      // Wait a moment to ensure token expires
      await new Promise(resolve => setTimeout(resolve, 10));

      await expect(verifyToken(token)).rejects.toThrow('jwt expired');
    });

    test('should throw error if JWT_SECRET is not set', async () => {
      delete process.env.JWT_SECRET;

      const token = 'some.valid.token';
      await expect(verifyToken(token)).rejects.toThrow(
        'JWT_SECRET must be set'
      );
    });
  });
});
