'use strict';

const Redis = require('ioredis');
let RedisMock;

let client;

function getRedisClient() {
  if (client) return client;

  const url = process.env.REDIS_URL || '';
  const env = (process.env.NODE_ENV || '').toLowerCase();
  // Use in-memory mock for tests and local development when no REDIS_URL is configured
  const useMock = url.startsWith('mock://') || env === 'test' || (!url && env !== 'production');

  if (useMock) {
    RedisMock = RedisMock || require('ioredis-mock');
    client = new RedisMock();
  } else {
    const effectiveUrl = url || 'redis://127.0.0.1:6379';
    client = new Redis(effectiveUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  }

  client.on('error', err => {
    const env = (process.env.NODE_ENV || '').toLowerCase();
    if (env === 'production') {
      // eslint-disable-next-line no-console
      console.error('Redis error:', err.message);
    }
  });

  return client;
}

module.exports = { getRedisClient };


