'use strict';

const express = require('express');
const Joi = require('joi');
const { Op } = require('sequelize');
const { requireAuth } = require('../middleware/auth');
const { requireIdempotency } = require('../middleware/idempotency');
const { attemptCaps } = require('../middleware/attemptCaps');
const { getRedisClient } = require('../services/redisClient');
const { TeeTime } = require('../models');
const { recordEvent } = require('../services/eventBus');

const router = express.Router();

const holdSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        tee_time_id: Joi.string().uuid().required(),
        party_size: Joi.number().integer().min(1).max(4).required(),
      })
    )
    .min(1)
    .required(),
  source: Joi.string().valid('checkout', 'waitlist').default('checkout'),
});

router.post(
  '/holds/cart',
  requireAuth(),
  requireIdempotency(['POST']),
  attemptCaps(),
  async (req, res) => {
    const { error, value } = holdSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const redis = getRedisClient();
    try { await redis.connect(); } catch (_) {}

    const userKey = `hold:user:${req.userId}`;
    const activeHold = await redis.get(userKey);

    // If an active waitlist hold exists, it preempts checkout holds
    if (activeHold) {
      const parsed = JSON.parse(activeHold);
      if (parsed.source === 'waitlist' && value.source !== 'waitlist') {
        return res.status(409).json({ error: 'Waitlist hold in progress' });
      }
    }

    // Validate capacity for requested items
    const ids = value.items.map(i => i.tee_time_id);
    const rows = await TeeTime.findAll({ where: { id: { [Op.in]: ids } } });
    const rowById = Object.fromEntries(rows.map(r => [r.id, r]));

    for (const item of value.items) {
      const row = rowById[item.tee_time_id];
      if (!row) return res.status(404).json({ error: `TeeTime not found: ${item.tee_time_id}` });
      const remaining = row.capacity - row.assigned_count;
      if (remaining < item.party_size) {
        return res.status(409).json({ error: 'Insufficient capacity for one or more items' });
      }
    }

    // Store hold: TTL 300s; single active hold per user
    const payload = {
      user_id: req.userId,
      source: value.source,
      items: value.items,
      created_at: Date.now(),
    };
    await redis.setex(userKey, 300, JSON.stringify(payload));

    try {
      await recordEvent({
        courseId: req.courseId || null,
        entityType: 'Hold',
        entityId: null,
        action: 'hold.created',
        actorType: req.userRole || 'Customer',
        actorId: req.userId,
        metadata: payload,
      });
    } catch (_) {}

    return res.status(200).json({ success: true, expires_in_seconds: 300, hold: payload });
  }
);

module.exports = router;


