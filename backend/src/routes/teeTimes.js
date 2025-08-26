'use strict';

const express = require('express');
const Joi = require('joi');
const { requireAuth } = require('../middleware/auth');
const { TeeTime } = require('../models');
const { getRedisClient } = require('../services/redisClient');
const { broadcast } = require('../services/broadcast');

const router = express.Router();

const blockSchema = Joi.object({
  reason: Joi.string().allow('', null).default('Blocked by admin'),
});

router.post('/tee-times/:id/block', requireAuth(['Admin', 'Manager']), async (req, res) => {
  const { error, value } = blockSchema.validate(req.body || {});
  if (error) return res.status(400).json({ error: error.message });
  const tt = await TeeTime.findByPk(req.params.id);
  if (!tt) return res.status(404).json({ error: 'Tee time not found' });
  if (tt.is_blocked) return res.status(200).json({ success: true, already: true });
  await tt.update({ is_blocked: true, blocked_reason: value.reason || 'Blocked' });
  const redis = getRedisClient();
  try { await redis.connect(); } catch (_) {}
  const undoToken = `${tt.id}:${Date.now()}`;
  await redis.setex(`undo:block:${tt.id}`, 5, undoToken);
  try { broadcast({ type: 'tee_time_updated', id: tt.id }); } catch (_) {}
  return res.json({ success: true, undo_token: undoToken, undo_expires_in_seconds: 5 });
});

const undoSchema = Joi.object({ undo_token: Joi.string().required() });

router.post('/tee-times/:id/unblock', requireAuth(['Admin', 'Manager']), async (req, res) => {
  const { error, value } = undoSchema.validate(req.body || {});
  if (error) return res.status(400).json({ error: error.message });
  const tt = await TeeTime.findByPk(req.params.id);
  if (!tt) return res.status(404).json({ error: 'Tee time not found' });
  const redis = getRedisClient();
  try { await redis.connect(); } catch (_) {}
  const stored = await redis.get(`undo:block:${tt.id}`);
  if (!stored || stored !== value.undo_token) return res.status(400).json({ error: 'Undo expired' });
  await tt.update({ is_blocked: false, blocked_reason: null });
  try { await redis.del(`undo:block:${tt.id}`); } catch (_) {}
  try { broadcast({ type: 'tee_time_updated', id: tt.id }); } catch (_) {}
  return res.json({ success: true });
});

module.exports = router;


