'use strict';

const express = require('express');
const Joi = require('joi');
const { Op } = require('sequelize');
const { requireAuth } = require('../middleware/auth');
const { getRedisClient } = require('../services/redisClient');
const {
  TeeTime,
  CalendarAssignment,
  Timeframe,
  TimeframeAccessRule,
  TeeTimeWaitlist,
} = require('../models');
const { isClassAllowed } = require('../lib/teeRules');
const { recordEvent } = require('../services/eventBus');

const router = express.Router();

const joinSchema = Joi.object({
  tee_time_id: Joi.string().uuid().required(),
  party_size: Joi.number().integer().min(1).max(4).required(),
  classId: Joi.string().required(),
});

async function findTemplateForDate(tee_sheet_id, date) {
  return await CalendarAssignment.findOne({ where: { tee_sheet_id, date } });
}

async function findTimeframeForSlot(tee_sheet_id, side_id, day_template_id, slot) {
  const hh = slot.toISOString().substring(11, 19);
  return await Timeframe.findOne({
    where: {
      tee_sheet_id,
      side_id,
      day_template_id,
      start_time_local: { [Op.lte]: hh },
      end_time_local: { [Op.gt]: hh },
    },
  });
}

// Helper to compute currently held seats from Redis (all holds)
async function loadHeldCounts(redis) {
  const keys = await redis.keys('hold:user:*');
  const heldByTeeTime = {};
  for (const k of keys) {
    try {
      const val = await redis.get(k);
      if (!val) continue;
      const parsed = JSON.parse(val);
      for (const it of parsed.items || []) {
        heldByTeeTime[it.tee_time_id] = (heldByTeeTime[it.tee_time_id] || 0) + (Number(it.party_size) || 0);
      }
    } catch (_) {}
  }
  return heldByTeeTime;
}

// POST /api/waitlist - join waitlist; if capacity available, issue offer immediately
router.post('/waitlist', requireAuth(['Admin', 'Manager', 'Staff', 'SuperAdmin', 'Customer']), async (req, res) => {
  const { error, value } = joinSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const tt = await TeeTime.findByPk(value.tee_time_id);
  if (!tt) return res.status(404).json({ error: 'Tee time not found' });

  const date = tt.start_time.toISOString().substring(0, 10);
  const template = await findTemplateForDate(tt.tee_sheet_id, date);
  if (!template) return res.status(400).json({ error: 'No calendar assignment for date' });
  const timeframe = await findTimeframeForSlot(tt.tee_sheet_id, tt.side_id, template.day_template_id, tt.start_time);
  if (!timeframe) return res.status(400).json({ error: 'Window not open' });

  // Access eligibility
  const access = await TimeframeAccessRule.findAll({ where: { timeframe_id: timeframe.id } });
  if (!isClassAllowed({ access_rules: access }, value.classId)) return res.status(403).json({ error: 'Access denied' });

  // Create waitlist entry (oldest-first is by created_at)
  const wl = await TeeTimeWaitlist.create({
    tee_time_id: tt.id,
    party_size: value.party_size,
    round_option_id: null,
    booking_class_id: value.classId,
    status: 'Waiting',
  });
  recordEvent({ courseId: null, entityType: 'TeeTime', entityId: tt.id, action: 'waitlist.join', actorType: req.userRole || 'Customer', actorId: req.userId || null, metadata: { waitlist_id: wl.id, party_size: value.party_size, classId: value.classId } });

  // Check capacity including existing holds; oldest-first: offer only if no active offer exists
  // and this entry is the head-of-line
  const redis = getRedisClient();
  try { await redis.connect(); } catch (_) {}
  const heldByTt = await loadHeldCounts(redis);
  const remaining = tt.capacity - tt.assigned_count - (heldByTt[tt.id] || 0);
  const offerTtl = Number(process.env.WAITLIST_OFFER_TTL_SEC || 900);

  // If any active offer exists for this tee time, do not offer a new one
  const existingOffers = await TeeTimeWaitlist.findOne({ where: { tee_time_id: tt.id, status: 'Offered' }, order: [['created_at', 'ASC']] });
  if (!existingOffers) {
    // Determine head-of-line waiting entry
    const head = await TeeTimeWaitlist.findOne({ where: { tee_time_id: tt.id, status: 'Waiting' }, order: [['created_at', 'ASC']] });
    if (head && head.id === wl.id && remaining >= value.party_size) {
      const token = `${wl.id}:${Math.random().toString(36).slice(2, 10)}`;
      await redis.setex(`waitlist:offer:${wl.id}`, offerTtl, token);
      await wl.update({ status: 'Offered' });
      recordEvent({ courseId: null, entityType: 'TeeTime', entityId: tt.id, action: 'waitlist.offer', actorType: 'System', actorId: null, metadata: { waitlist_id: wl.id } });
      return res.status(201).json({ success: true, waitlist_id: wl.id, offered: true, accept_token: token, expires_in_seconds: offerTtl });
    }
  }

  return res.status(201).json({ success: true, waitlist_id: wl.id, offered: false });
});

// POST /api/waitlist/:id/accept - accept via magic link token, creates a waitlist hold with precedence
router.post('/waitlist/:id/accept', async (req, res) => {
  const wlId = req.params.id;
  const token = req.body && req.body.token || req.query && req.query.token;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const redis = getRedisClient();
  try { await redis.connect(); } catch (_) {}
  const key = `waitlist:offer:${wlId}`;
  const stored = await redis.get(key);
  if (!stored || stored !== token) return res.status(400).json({ error: 'Offer expired or invalid' });

  const wl = await TeeTimeWaitlist.findByPk(wlId);
  if (!wl || wl.status !== 'Offered') return res.status(400).json({ error: 'Invalid waitlist state' });
  const tt = await TeeTime.findByPk(wl.tee_time_id);
  if (!tt) return res.status(404).json({ error: 'Tee time not found' });

  // Check capacity at accept time considering all holds
  const heldByTt = await loadHeldCounts(redis);
  const remaining = tt.capacity - tt.assigned_count - (heldByTt[tt.id] || 0);
  if (remaining < wl.party_size) return res.status(409).json({ error: 'Capacity no longer available' });

  // Create synthetic user hold for this waitlist id
  const holdTtl = Number(process.env.WAITLIST_HOLD_TTL_SEC || 600);
  const payload = {
    user_id: `wl-${wl.id}`,
    source: 'waitlist',
    items: [{ tee_time_id: tt.id, party_size: wl.party_size }],
    created_at: Date.now(),
  };
  await redis.setex(`hold:user:wl-${wl.id}`, holdTtl, JSON.stringify(payload));
  await wl.update({ status: 'Accepted' });
  recordEvent({ courseId: null, entityType: 'TeeTime', entityId: tt.id, action: 'waitlist.accept', actorType: 'Customer', actorId: null, metadata: { waitlist_id: wl.id } });

  return res.json({ success: true, expires_in_seconds: holdTtl, hold: payload });
});

// POST /api/waitlist/:id/promote - staff manual promotion to offer
router.post('/waitlist/:id/promote', requireAuth(['Admin', 'Manager', 'Staff', 'SuperAdmin']), async (req, res) => {
  const wl = await TeeTimeWaitlist.findByPk(req.params.id);
  if (!wl) return res.status(404).json({ error: 'Waitlist not found' });
  if (wl.status !== 'Waiting') return res.status(400).json({ error: 'Not in waiting state' });
  const tt = await TeeTime.findByPk(wl.tee_time_id);
  if (!tt) return res.status(404).json({ error: 'Tee time not found' });

  const redis = getRedisClient();
  try { await redis.connect(); } catch (_) {}
  const heldByTt = await loadHeldCounts(redis);
  const remaining = tt.capacity - tt.assigned_count - (heldByTt[tt.id] || 0);
  if (remaining < wl.party_size) return res.status(409).json({ error: 'Insufficient capacity to offer' });

  // Enforce oldest-first: ensure this is the first waiting entry
  const head = await TeeTimeWaitlist.findOne({ where: { tee_time_id: tt.id, status: 'Waiting' }, order: [['created_at', 'ASC']] });
  if (!head || head.id !== wl.id) return res.status(409).json({ error: 'Older requests pending' });

  const offerTtl = Number(process.env.WAITLIST_OFFER_TTL_SEC || 900);
  const token = `${wl.id}:${Math.random().toString(36).slice(2, 10)}`;
  await redis.setex(`waitlist:offer:${wl.id}`, offerTtl, token);
  await wl.update({ status: 'Offered' });
  recordEvent({ courseId: null, entityType: 'TeeTime', entityId: tt.id, action: 'waitlist.offer', actorType: 'Staff', actorId: req.userId, metadata: { waitlist_id: wl.id } });
  return res.json({ success: true, waitlist_id: wl.id, offered: true, accept_token: token, expires_in_seconds: offerTtl });
});

module.exports = router;



