const crypto = require('crypto');

/**
 * Generates a random 32-byte hex string
 * @returns {string} Random hex string
 */
function generateTokenString() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Checks if a timestamp is in the past
 * @param {number} expiryTimestamp - Timestamp to check
 * @returns {boolean} True if expired, false otherwise
 */
function isTokenExpired(expiryTimestamp) {
  if (!expiryTimestamp || isNaN(Number(expiryTimestamp))) {
    return true;
  }

  return Date.now() >= Number(expiryTimestamp);
}

module.exports = {
  generateTokenString,
  isTokenExpired,
};
