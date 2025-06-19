const rateLimit = require('express-rate-limit');

/**
 * Create a conditional rate limiter that skips rate limiting in test environment
 */
const createConditionalRateLimit = (options) => {
  if (process.env.NODE_ENV === 'test') {
    // Return a no-op middleware for testing
    return (req, res, next) => next();
  }
  return rateLimit(options);
};

/**
 * Standard rate limiting for most API endpoints
 * 100 requests per 15 minutes per IP
 */
const rateLimitMiddleware = createConditionalRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP',
    retryAfter: 15 * 60, // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful responses to prevent abuse
  skipSuccessfulRequests: false,
  // Skip failed requests
  skipFailedRequests: true,

  // Custom handler for rate limit exceeded
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Strict rate limiting for sensitive endpoints (auth, registration)
 * 10 requests per 15 minutes per IP
 */
const strictRateLimitMiddleware = createConditionalRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,

  // Custom handler for rate limit exceeded
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many authentication attempts from this IP.',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Very strict rate limiting for password reset and sensitive operations
 * 3 requests per hour per IP
 */
const veryStrictRateLimitMiddleware = createConditionalRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  message: {
    error: 'Too many password reset attempts',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,

  // Custom handler for rate limit exceeded
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many password reset attempts from this IP.',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },

  // Custom key generator to include user agent for better tracking
  keyGenerator: req => {
    const userAgent = req.get('User-Agent') || 'unknown';
    return `${req.ip}_${userAgent.substring(0, 50)}`;
  },

  // Only count failed requests for password resets
  skip: req => {
    return req.method === 'GET'; // Skip GET requests
  },
});

module.exports = {
  rateLimitMiddleware,
  strictRateLimitMiddleware,
  veryStrictRateLimitMiddleware,
};
