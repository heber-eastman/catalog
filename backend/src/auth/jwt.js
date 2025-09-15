const jwt = require('jsonwebtoken');

/**
 * Signs a payload into a JWT token
 * @param {Object} payload - Data to be signed
 * @param {Object} [options] - JWT sign options (e.g., expiresIn)
 * @returns {Promise<string>} Signed JWT token
 */
async function signToken(payload, options = {}) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set');
  }

  return new Promise((resolve, reject) => {
    jwt.sign(payload, process.env.JWT_SECRET, { ...options }, (err, token) => {
      if (err) return reject(err);
      resolve(token);
    });
  });
}

/**
 * Verifies a JWT token and returns the decoded payload
 * @param {string} token - JWT token to verify
 * @returns {Promise<Object>} Decoded token payload
 */
async function verifyToken(token) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set');
  }

  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

module.exports = {
  signToken,
  verifyToken,
};
