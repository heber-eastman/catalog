'use strict';

const express = require('express');
const Joi = require('joi');
const { Op } = require('sequelize');
const { requireAuth } = require('../middleware/auth');
const { requireIdempotency } = require('../middleware/idempotency');
const { attemptCaps } = require('../middleware/attemptCaps');
const {
  sequelize,
  TeeTime,
  TeeSheet,
  CalendarAssignment,
  Timeframe,
  TimeframeAccessRule,
  TimeframePricingRule,
  TimeframeMinPlayers,
  TimeframeMode,
  Booking,
  BookingRoundLeg,
  TeeTimeAssignment,
} = require('../models');
const { computeReroundStart, isClassAllowed, calcFeesForLeg, enforceMinPlayers } = require('../lib/teeRules');
const { sendEmail } = require('../services/emailService');

const router = express.Router();

const bookingSchema = Joi.object({
  tee_sheet_id: Joi.string().uuid().required(),
  classId: Joi.string().required(),
  players: Joi.array()
    .items(
      Joi.object({
        email: Joi.string().email().allow(null, ''),
        walkRide: Joi.string().valid('walk', 'ride').allow(null),
      })
    )
    .min(1)
    .max(4)
    .required(),
  legs: Joi.array()
    .items(
      Joi.object({
        tee_time_id: Joi.string().uuid().required(),
        round_option_id: Joi.string().uuid().allow(null),
        leg_index: Joi.number().integer().min(0).max(1).required(),
      })
    )
    .min(1)
    .max(2)
    .required(),
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

router.post(
  '/bookings',
  requireAuth(['Admin', 'Manager', 'Staff', 'SuperAdmin']),
  requireIdempotency(['POST']),
  attemptCaps(),
  async (req, res) => {
    const { error, value } = bookingSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const teeSheetId = value.tee_sheet_id;
    const classId = value.classId;
    const players = value.players.map(p => ({ ...p, walkRide: p.walkRide || 'ride' }));
    const legCount = value.legs.length;

    // Load tee times
    const teeTimeIds = value.legs.map(l => l.tee_time_id);
    const teeTimes = await TeeTime.findAll({ where: { id: { [Op.in]: teeTimeIds } }, order: [['start_time', 'ASC']] });
    if (teeTimes.length !== teeTimeIds.length) return res.status(404).json({ error: 'One or more tee times not found' });
    if (!teeTimes.every(t => t.tee_sheet_id === teeSheetId)) return res.status(400).json({ error: 'Tee times must belong to the same tee sheet' });

    // Determine date and template
    const date = teeTimes[0].start_time.toISOString().substring(0, 10);
    const template = await findTemplateForDate(teeSheetId, date);
    if (!template) return res.status(400).json({ error: 'No calendar assignment for date' });

    // Per-leg timeframe validation; access/min/mode and capacity pre-check (non-locking)
    let totalPriceCents = 0;
    const legsComputed = [];

    for (const tt of teeTimes) {
      const timeframe = await findTimeframeForSlot(teeSheetId, tt.side_id, template.day_template_id, tt.start_time);
      if (!timeframe) return res.status(400).json({ error: 'Window not open' });

      // Access rules
      const access = await TimeframeAccessRule.findAll({ where: { timeframe_id: timeframe.id } });
      if (!isClassAllowed({ access_rules: access }, classId)) return res.status(403).json({ error: 'Access denied' });

      // Min players
      const min = await TimeframeMinPlayers.findOne({ where: { timeframe_id: timeframe.id } });
      const tfWithMin = { min_players: min ? { min_players: min.min_players } : undefined };
      if (!enforceMinPlayers(tfWithMin, players.length)) return res.status(400).json({ error: 'Minimum players not met' });

      // Mode
      const modeRow = await TimeframeMode.findOne({ where: { timeframe_id: timeframe.id } });
      const mode = (modeRow && modeRow.mode) || 'Both';
      if (mode === 'WalkOnly' && players.some(p => (p.walkRide || 'ride') === 'ride')) {
        return res.status(400).json({ error: 'Ride not allowed in this timeframe' });
      }
      if (mode === 'RideOnly' && players.some(p => (p.walkRide || 'ride') === 'walk')) {
        return res.status(400).json({ error: 'Walk not allowed in this timeframe' });
      }

      // Pricing
      const pricing = await TimeframePricingRule.findAll({ where: { timeframe_id: timeframe.id } });
      const perPlayer = players.map(p => calcFeesForLeg(pricing, classId, p.walkRide, undefined));
      const legPrice = perPlayer.reduce((a, b) => a + b, 0);
      totalPriceCents += legPrice;

      legsComputed.push({ tt, timeframe, legPrice });
    }

    // Transactional capacity check and insertions
    try {
      const result = await sequelize.transaction(async t => {
        // Lock tee times in a stable order
        const locked = await TeeTime.findAll({
          where: { id: { [Op.in]: teeTimeIds } },
          order: [['start_time', 'ASC']],
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        // Capacity strict across all legs
        for (const row of locked) {
          const remaining = row.capacity - row.assigned_count;
          if (remaining < players.length) {
            const err = new Error('Insufficient capacity');
            err.status = 409;
            throw err;
          }
        }

        const booking = await Booking.create(
          {
            tee_sheet_id: teeSheetId,
            owner_customer_id: null,
            status: 'Active',
            total_price_cents: totalPriceCents,
            notes: null,
          },
          { transaction: t }
        );

        // Create legs and assignments
        for (let i = 0; i < legsComputed.length; i++) {
          const { tt, legPrice } = legsComputed[i];
          const leg = await BookingRoundLeg.create(
            {
              booking_id: booking.id,
              round_option_id: null,
              leg_index: i,
              walk_ride: null,
              price_cents: legPrice,
            },
            { transaction: t }
          );

          // Assign each player to the tee time (one assignment per player)
          const assignments = players.map(() => ({ booking_round_leg_id: leg.id, tee_time_id: tt.id }));
          await TeeTimeAssignment.bulkCreate(assignments, { transaction: t });

          // Update counts
          await tt.update({ assigned_count: tt.assigned_count + players.length }, { transaction: t });
        }

        return { ok: true };
      });

      if (!result.ok) return res.status(500).json({ error: 'Booking failed' });

      // Notify verified contacts (best-effort)
      try {
        const recipients = (players || [])
          .map(p => (p.email || '').trim())
          .filter(e => !!e);
        for (const to of recipients) {
          await sendEmail({
            to,
            subject: 'Your tee time booking is confirmed',
            text: 'Your booking has been confirmed.',
            html: '<p>Your booking has been confirmed.</p>',
          });
        }
      } catch (e) {
        // ignore notification failures
      }

      return res.status(201).json({ success: true, total_price_cents: totalPriceCents });
    } catch (e) {
      if (e && e.status) return res.status(e.status).json({ error: e.message || 'Booking failed' });
      return res.status(500).json({ error: 'Booking failed' });
    }
  }
);

module.exports = router;


