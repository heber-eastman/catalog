const rateLimit = require('express-rate-limit');

/**
 * Rate limiting middleware
 * Limits to 60 requests per minute with burst of 10
 */
const rateLimitMiddleware = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  
  // Skip rate limiting for certain conditions
  skip: (req, res) => {
    // Skip rate limiting for health checks
    if (req.path === '/health' || req.path === '/') {
      return true;
    }
    
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test') {
      return true;
    }
    
    return false;
  },
  
  // Custom key generator (default is IP-based)
  keyGenerator: (req, res) => {
    // Rate limit by IP address
    return req.ip || req.connection.remoteAddress;
  },
  
  // Handler for when rate limit is exceeded
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: 60,
      limit: 60,
      windowMs: 60000
    });
  }
});

/**
 * Stricter rate limiting for sensitive endpoints (like signup, login)
 * Limits to 10 requests per minute
 */
const strictRateLimitMiddleware = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    error: 'Too many attempts from this IP, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  skip: (req, res) => {
    return process.env.NODE_ENV === 'test';
  },
  
  keyGenerator: (req, res) => {
    return req.ip || req.connection.remoteAddress;
  },
  
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many attempts from this IP, please try again later.',
      retryAfter: 60,
      limit: 10,
      windowMs: 60000
    });
  }
});

/**
 * Get current rate limit status for an IP
 */
function getRateLimitStatus(req) {
  const rateLimitHeader = res.get('RateLimit-Remaining');
  const rateLimitResetHeader = res.get('RateLimit-Reset');
  
  return {
    remaining: rateLimitHeader ? parseInt(rateLimitHeader) : null,
    resetTime: rateLimitResetHeader ? parseInt(rateLimitResetHeader) : null,
    limit: 60,
    windowMs: 60000
  };
}

module.exports = {
  rateLimitMiddleware,
  strictRateLimitMiddleware,
  getRateLimitStatus
}; 