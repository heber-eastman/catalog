const { generateTokenString, isTokenExpired } = require('../../src/auth/tokenUtil');

describe('Token Utilities', () => {
  describe('generateTokenString', () => {
    test('should generate a 32-byte hex string', () => {
      const token = generateTokenString();
      expect(token).toMatch(/^[0-9a-f]{64}$/i);
    });

    test('should generate unique tokens on each call', () => {
      const token1 = generateTokenString();
      const token2 = generateTokenString();
      expect(token1).not.toBe(token2);
    });
  });

  describe('isTokenExpired', () => {
    test('should return true for past timestamps', () => {
      const pastTimestamp = Date.now() - 1000; // 1 second ago
      expect(isTokenExpired(pastTimestamp)).toBe(true);
    });

    test('should return false for future timestamps', () => {
      const futureTimestamp = Date.now() + 1000000; // Far in future
      expect(isTokenExpired(futureTimestamp)).toBe(false);
    });

    test('should return true for current timestamp', () => {
      const currentTimestamp = Date.now();
      expect(isTokenExpired(currentTimestamp)).toBe(true);
    });

    test('should handle invalid timestamp values', () => {
      expect(isTokenExpired(null)).toBe(true);
      expect(isTokenExpired(undefined)).toBe(true);
      expect(isTokenExpired('invalid')).toBe(true);
    });
  });
}); 