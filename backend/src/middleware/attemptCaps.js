'use strict';

const { getRedisClient } = require('../services/redisClient');

// Caps: user 5/10m (2m cooldown), IP 20/10m (5m cooldown)
function attemptCaps() {
  return async (req, res, next) => {
    const env = (process.env.NODE_ENV || '').toLowerCase();
    if (env !== 'production') return next();
    let redis;
    try {
      redis = getRedisClient();
      await redis.connect();
    } catch (_) {
      // If Redis is unavailable, skip caps rather than failing the request
      return next();
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const userKey = req.userId ? `cap:user:${req.userId}` : null;
    const ipKey = `cap:ip:${req.ip}`;

    async function incrWithTtl(key, windowSec) {
      try {
        const count = await redis.incr(key);
        if (count === 1) await redis.expire(key, windowSec);
        return count;
      } catch (_) {
        // On any Redis error, disable caps for this request
        return 1; // benign value
      }
    }

    // IP cap: 20/10m, cooldown 5m when exceeded
    try {
      const ipCount = await incrWithTtl(ipKey, 600);
      if (ipCount > 20) {
        await redis.expire(ipKey, 300); // set cooldown 5m
        return res.status(429).json({ error: 'Too many attempts from IP. Try again later.' });
      }
    } catch (_) { return next(); }

    // User cap: 5/10m, cooldown 2m when exceeded
    if (userKey) {
      try {
        const userCount = await incrWithTtl(userKey, 600);
        if (userCount > 5) {
          await redis.expire(userKey, 120);
          return res.status(429).json({ error: 'Too many attempts. Please wait a moment.' });
        }
      } catch (_) { /* ignore */ }
    }

    next();
  };
}

module.exports = { attemptCaps };


