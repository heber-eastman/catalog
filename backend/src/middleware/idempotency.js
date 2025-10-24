'use strict';

const { getRedisClient } = require('../services/redisClient');

// Usage: requireIdempotency(['POST','PATCH','DELETE']) on write routes
function requireIdempotency(allowedMethods = ['POST']) {
  return async (req, res, next) => {
    try {
      if (!allowedMethods.includes(req.method)) return next();
      const key = req.get('Idempotency-Key') || req.headers['idempotency-key'];
      if (!key) return res.status(400).json({ error: 'Idempotency-Key header required' });

      const redis = getRedisClient();
      let redisReady = true;
      try { await redis.connect(); } catch (_) { redisReady = false; }

      // If Redis is not available, skip caching but still allow the request to proceed
      if (!redisReady) return next();

      const cacheKey = `idem:${key}`;
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          return res.status(parsed.statusCode || 200).json(parsed.body);
        }
      } catch (_) {
        // On any Redis error, bypass cache and proceed
        return next();
      }

      // Monkey-patch res.json to capture body
      const originalJson = res.json.bind(res);
      res.json = async body => {
        try {
          const payload = JSON.stringify({ statusCode: res.statusCode || 200, body });
          await redis.setex(cacheKey, 600, payload); // 10 minutes TTL
        } catch (_) {}
        return originalJson(body);
      };

      next();
    } catch (e) {
      next(e);
    }
  };
}

module.exports = { requireIdempotency };


