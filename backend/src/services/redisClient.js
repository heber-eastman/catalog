'use strict';

const Redis = require('ioredis');
let RedisMock;

let client;

function getRedisClient() {
  if (client) return client;

  const url = process.env.REDIS_URL || '';
  const useMock = url.startsWith('mock://') || process.env.NODE_ENV === 'test';

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
    // eslint-disable-next-line no-console
    console.error('Redis error:', err.message);
  });

  return client;
}

module.exports = { getRedisClient };


