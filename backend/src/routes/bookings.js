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
  TeeSheetSide,
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
const { recordEvent } = require('../services/eventBus');
const { requireAuth: _unused } = require('../middleware/auth');

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
  requireAuth(['Admin', 'Manager', 'Staff', 'SuperAdmin', 'Customer']),
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
            owner_customer_id: ['Customer'].includes(req.userRole || '') ? req.userId : null,
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

      // Event: booking.created
      recordEvent({
        courseId: (await TeeSheet.findByPk(teeSheetId)).course_id,
        entityType: 'Booking',
        entityId: null,
        action: 'booking.created',
        actorType: 'Staff',
        actorId: req.userId,
        metadata: { tee_time_ids: teeTimeIds, players: players.length, total_price_cents: totalPriceCents },
      });
      return res.status(201).json({ success: true, total_price_cents: totalPriceCents });
    } catch (e) {
      if (e && e.status) return res.status(e.status).json({ error: e.message || 'Booking failed' });
      return res.status(500).json({ error: 'Booking failed' });
    }
  }
);

// Edit players: add/remove and optional owner transfer
const editPlayersSchema = Joi.object({
  add: Joi.number().integer().min(0).default(0),
  remove: Joi.number().integer().min(0).default(0),
  transfer_owner_to: Joi.string().uuid().allow(null),
}).custom((val, helpers) => {
  if ((val.add || 0) + (val.remove || 0) === 0 && !('transfer_owner_to' in val)) {
    return helpers.error('any.invalid');
  }
  return val;
}, 'at least one change');

router.patch(
  '/bookings/:id/reschedule',
  requireAuth(['Admin', 'Manager', 'Staff', 'SuperAdmin', 'Customer']),
  async (req, res) => {
    const rescheduleSchema = Joi.object({
      classId: Joi.string().required(),
      legs: Joi.array()
        .items(
          Joi.object({
            tee_time_id: Joi.string().uuid().required(),
            leg_index: Joi.number().integer().min(0).max(1).required(),
          })
        )
        .min(1)
        .max(2)
        .required(),
    });

    const { error, value } = rescheduleSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const booking = await Booking.findByPk(req.params.id, {
      include: [{ model: BookingRoundLeg, as: 'legs' }],
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Customer can only reschedule own booking
    const isStaff = ['Admin', 'Manager', 'Staff', 'SuperAdmin'].includes(req.userRole || '');
    if (!isStaff) {
      if (!booking.owner_customer_id || booking.owner_customer_id !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    // Ensure legs match
    const existingLegs = (booking.legs || []).sort((a, b) => a.leg_index - b.leg_index);
    const requestedLegs = [...value.legs].sort((a, b) => a.leg_index - b.leg_index);
    if (requestedLegs.length !== existingLegs.length) {
      return res.status(400).json({ error: 'Leg count mismatch' });
    }

    // Load new tee times
    const newTeeTimeIds = requestedLegs.map(l => l.tee_time_id);
    const newTeeTimes = await TeeTime.findAll({ where: { id: { [Op.in]: newTeeTimeIds } }, order: [['start_time', 'ASC']] });
    if (newTeeTimes.length !== newTeeTimeIds.length) return res.status(404).json({ error: 'Tee time not found' });
    // Must be same tee sheet
    if (!newTeeTimes.every(tt => tt.tee_sheet_id === booking.tee_sheet_id)) {
      return res.status(400).json({ error: 'Must reschedule within same tee sheet' });
    }

    // Determine players count from first leg assignments
    const firstLeg = existingLegs[0];
    const playersCount = await TeeTimeAssignment.count({ where: { booking_round_leg_id: firstLeg.id } });
    if (playersCount <= 0) return res.status(400).json({ error: 'No players to reschedule' });

    // Per-leg timeframe validation and pricing for new tee times
    let newTotalPrice = 0;
    const perLeg = [];
    const classId = value.classId;
    for (let i = 0; i < existingLegs.length; i++) {
      const leg = existingLegs[i];
      const reqLeg = requestedLegs[i];
      const newTt = newTeeTimes.find(t => t.id === reqLeg.tee_time_id);

      // Find template and timeframe for the new tee time
      const date = newTt.start_time.toISOString().substring(0, 10);
      const template = await findTemplateForDate(booking.tee_sheet_id, date);
      if (!template) return res.status(400).json({ error: 'No calendar assignment for date' });
      const timeframe = await findTimeframeForSlot(booking.tee_sheet_id, newTt.side_id, template.day_template_id, newTt.start_time);
      if (!timeframe) return res.status(400).json({ error: 'Window not open' });

      // Access rules
      const access = await TimeframeAccessRule.findAll({ where: { timeframe_id: timeframe.id } });
      if (!isClassAllowed({ access_rules: access }, classId)) return res.status(403).json({ error: 'Access denied' });

      // Min players
      const min = await TimeframeMinPlayers.findOne({ where: { timeframe_id: timeframe.id } });
      const tfWithMin = { min_players: min ? { min_players: min.min_players } : undefined };
      if (!enforceMinPlayers(tfWithMin, playersCount)) return res.status(400).json({ error: 'Minimum players not met' });

      // Mode (assume ride by default like create flow)
      const modeRow = await TimeframeMode.findOne({ where: { timeframe_id: timeframe.id } });
      const mode = (modeRow && modeRow.mode) || 'Both';
      if (mode === 'WalkOnly') {
        // All riders by default would violate WalkOnly
        return res.status(400).json({ error: 'Ride not allowed in this timeframe' });
      }

      // Pricing: assume all players ride by default
      const pricing = await TimeframePricingRule.findAll({ where: { timeframe_id: timeframe.id } });
      const perPlayer = calcFeesForLeg(pricing, classId, 'ride', undefined);
      const legPrice = perPlayer * playersCount;
      newTotalPrice += legPrice;
      perLeg.push({ leg, newTt, legPrice });
    }

    try {
      await sequelize.transaction(async t => {
        // Lock all new tee times and also lock old ones that will be decremented
        const lockIds = new Set();
        for (const { newTt } of perLeg) lockIds.add(newTt.id);
        for (const leg of existingLegs) {
          const anyAssign = await TeeTimeAssignment.findOne({ where: { booking_round_leg_id: leg.id }, transaction: t });
          if (anyAssign) lockIds.add(anyAssign.tee_time_id);
        }
        const lockRows = await TeeTime.findAll({ where: { id: { [Op.in]: Array.from(lockIds) } }, transaction: t, lock: t.LOCK.UPDATE });
        const lockMap = new Map(lockRows.map(r => [r.id, r]));

        // Capacity checks on all new tee times before moving
        for (const { newTt } of perLeg) {
          const row = lockMap.get(newTt.id);
          const remaining = row.capacity - row.assigned_count;
          if (remaining < playersCount) throw Object.assign(new Error('Insufficient capacity'), { status: 409 });
        }

        // Move assignments and update counts
        for (const { leg, newTt, legPrice } of perLeg) {
          // Get current tee time for this leg
          const assignments = await TeeTimeAssignment.findAll({ where: { booking_round_leg_id: leg.id }, transaction: t, lock: t.LOCK.UPDATE });
          if (assignments.length !== playersCount) throw Object.assign(new Error('Assignment mismatch'), { status: 400 });
          const oldTtId = assignments[0].tee_time_id;
          if (oldTtId !== newTt.id) {
            // Update assignments to point to new tee time
            const ids = assignments.map(a => a.id);
            await TeeTimeAssignment.update({ tee_time_id: newTt.id }, { where: { id: { [Op.in]: ids } }, transaction: t });
            // Update counts
            const oldRow = lockMap.get(oldTtId);
            const newRow = lockMap.get(newTt.id);
            await oldRow.update({ assigned_count: Math.max(0, oldRow.assigned_count - playersCount) }, { transaction: t });
            await newRow.update({ assigned_count: newRow.assigned_count + playersCount }, { transaction: t });
          }
          // Update leg price
          await leg.update({ price_cents: legPrice }, { transaction: t });
        }

        // Update booking total
        await booking.update({ total_price_cents: newTotalPrice }, { transaction: t });
      });
    } catch (e) {
      if (e && e.status) return res.status(e.status).json({ error: e.message });
      return res.status(500).json({ error: 'Reschedule failed' });
    }

    // Event: booking.rescheduled
    recordEvent({
      courseId: (await TeeSheet.findByPk(booking.tee_sheet_id)).course_id,
      entityType: 'Booking',
      entityId: booking.id,
      action: 'booking.rescheduled',
      actorType: 'Staff',
      actorId: req.userId,
      metadata: { new_total_price_cents: newTotalPrice },
    });
    return res.json({ success: true, total_price_cents: newTotalPrice });
  }
);

router.patch(
  '/bookings/:id/players',
  requireAuth(['Admin', 'Manager', 'Staff', 'SuperAdmin']),
  async (req, res) => {
    const { error, value } = editPlayersSchema.validate(req.body);
    if (error) return res.status(400).json({ error: 'No changes specified' });

    const booking = await Booking.findByPk(req.params.id, {
      include: [{ model: BookingRoundLeg, as: 'legs' }],
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Determine current players as assignment count on first leg
    const firstLeg = booking.legs && booking.legs[0];
    if (!firstLeg) return res.status(400).json({ error: 'Invalid booking legs' });

    // Load an example assignment to locate tee time and timeframe
    const exampleAssignment = await TeeTimeAssignment.findOne({ where: { booking_round_leg_id: firstLeg.id } });
    if (!exampleAssignment) return res.status(400).json({ error: 'No assignments found' });

    const teeTime = await TeeTime.findByPk(exampleAssignment.tee_time_id);
    if (!teeTime) return res.status(400).json({ error: 'Tee time missing' });

    const date = teeTime.start_time.toISOString().substring(0, 10);
    const template = await findTemplateForDate(booking.tee_sheet_id, date);
    if (!template) return res.status(400).json({ error: 'No calendar assignment for date' });
    const timeframe = await findTimeframeForSlot(booking.tee_sheet_id, teeTime.side_id, template.day_template_id, teeTime.start_time);
    if (!timeframe) return res.status(400).json({ error: 'Window not open' });
    const minRow = await TimeframeMinPlayers.findOne({ where: { timeframe_id: timeframe.id } });
    const minPlayers = minRow ? minRow.min_players : 1;

    const currentCount = await TeeTimeAssignment.count({ where: { booking_round_leg_id: firstLeg.id } });
    const addCount = Number(value.add || 0);
    const removeCount = Number(value.remove || 0);

    if (removeCount > 0) {
      if (currentCount - removeCount < minPlayers) {
        return res.status(400).json({ error: 'Minimum players not met' });
      }
    }

    try {
      await sequelize.transaction(async t => {
        // Owner transfer (staff-only)
        if (Object.prototype.hasOwnProperty.call(value, 'transfer_owner_to')) {
          if (!['Admin', 'Manager', 'Staff', 'SuperAdmin'].includes(req.userRole || '')) {
            throw Object.assign(new Error('Insufficient permissions'), { status: 403 });
          }
          await booking.update({ owner_customer_id: value.transfer_owner_to || null }, { transaction: t });
        }

        // Handle removals: delete N assignments per leg and decrement counts
        if (removeCount > 0) {
          for (const leg of booking.legs) {
            const assigns = await TeeTimeAssignment.findAll({ where: { booking_round_leg_id: leg.id }, limit: removeCount, transaction: t, lock: t.LOCK.UPDATE });
            const ids = assigns.map(a => a.id);
            const ttIds = assigns.map(a => a.tee_time_id);
            if (ids.length < removeCount) throw Object.assign(new Error('Not enough players to remove'), { status: 400 });
            await TeeTimeAssignment.destroy({ where: { id: { [Op.in]: ids } }, transaction: t });
            // decrement per affected tee time
            const byTt = ttIds.reduce((acc, id) => { acc[id] = (acc[id] || 0) + 1; return acc; }, {});
            for (const [id, dec] of Object.entries(byTt)) {
              const ttRow = await TeeTime.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
              await ttRow.update({ assigned_count: Math.max(0, ttRow.assigned_count - dec) }, { transaction: t });
            }
          }
        }

        // Handle additions: capacity check on each leg's tee time and create N assignments
        if (addCount > 0) {
          for (const leg of booking.legs) {
            const legAssign = await TeeTimeAssignment.findOne({ where: { booking_round_leg_id: leg.id }, transaction: t });
            if (!legAssign) throw Object.assign(new Error('Assignments missing'), { status: 400 });
            const ttRow = await TeeTime.findByPk(legAssign.tee_time_id, { transaction: t, lock: t.LOCK.UPDATE });
            const remaining = ttRow.capacity - ttRow.assigned_count;
            if (remaining < addCount) throw Object.assign(new Error('Insufficient capacity'), { status: 409 });
          }
          // Create after checks
          for (const leg of booking.legs) {
            const legAssign = await TeeTimeAssignment.findOne({ where: { booking_round_leg_id: leg.id }, transaction: t });
            const ttRow = await TeeTime.findByPk(legAssign.tee_time_id, { transaction: t, lock: t.LOCK.UPDATE });
            const rows = Array.from({ length: addCount }).map(() => ({ booking_round_leg_id: leg.id, tee_time_id: ttRow.id }));
            await TeeTimeAssignment.bulkCreate(rows, { transaction: t });
            await ttRow.update({ assigned_count: ttRow.assigned_count + addCount }, { transaction: t });
          }
        }
      });
    } catch (e) {
      if (e && e.status) return res.status(e.status).json({ error: e.message });
      return res.status(500).json({ error: 'Update failed' });
    }

    // Event: booking.players_edited
    recordEvent({
      courseId: (await TeeSheet.findByPk(booking.tee_sheet_id)).course_id,
      entityType: 'Booking',
      entityId: booking.id,
      action: 'booking.players_edited',
      actorType: 'Staff',
      actorId: req.userId,
      metadata: { add: value.add || 0, remove: value.remove || 0, transfer_owner_to: value.transfer_owner_to || null },
    });
    return res.json({ success: true });
  }
);

// Cancel booking: enforce cutoff for customers; staff override allowed
router.delete(
  '/bookings/:id',
  requireAuth(['Admin', 'Manager', 'Staff', 'SuperAdmin', 'Customer']),
  async (req, res) => {
    const booking = await Booking.findByPk(req.params.id, { include: [{ model: BookingRoundLeg, as: 'legs' }] });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Customer can only cancel own booking (unless booking has no owner set)
    const isStaff = ['Admin', 'Manager', 'Staff', 'SuperAdmin'].includes(req.userRole || '');
    if (!isStaff) {
      if (booking.owner_customer_id && booking.owner_customer_id !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    // Find earliest tee time for cutoff check
    const firstLeg = booking.legs && booking.legs[0];
    if (!firstLeg) return res.status(400).json({ error: 'Invalid booking legs' });
    const anyAssign = await TeeTimeAssignment.findOne({ where: { booking_round_leg_id: firstLeg.id }, include: [{ model: TeeTime, as: 'tee_time' }] });
    if (!anyAssign || !anyAssign.tee_time) return res.status(400).json({ error: 'No tee time found' });

    const teeTimeRow = await TeeTime.findByPk(anyAssign.tee_time_id);
    const startMs = new Date(teeTimeRow.start_time).getTime();
    const nowMs = Date.now();
    const cutoffHours = Number(process.env.CANCEL_CUTOFF_HOURS || 24);
    const cutoffAllowed = startMs - nowMs >= cutoffHours * 60 * 60 * 1000;

    // If not staff, enforce cutoff
    if (!isStaff && !cutoffAllowed) {
      return res.status(400).json({ error: 'Cancellation window has passed' });
    }

    try {
      await sequelize.transaction(async t => {
        // Load all assignments across legs
        const legs = await BookingRoundLeg.findAll({ where: { booking_id: booking.id }, transaction: t });
        const allAssigns = await TeeTimeAssignment.findAll({ where: { booking_round_leg_id: { [Op.in]: legs.map(l => l.id) } }, transaction: t, lock: t.LOCK.UPDATE });
        const ttCounts = allAssigns.reduce((acc, a) => { acc[a.tee_time_id] = (acc[a.tee_time_id] || 0) + 1; return acc; }, {});
        // Decrement counts per tee time
        const ttRows = await TeeTime.findAll({ where: { id: { [Op.in]: Object.keys(ttCounts) } }, transaction: t, lock: t.LOCK.UPDATE });
        for (const row of ttRows) {
          const dec = ttCounts[row.id] || 0;
          await row.update({ assigned_count: Math.max(0, row.assigned_count - dec) }, { transaction: t });
        }
        // Delete assignments and mark booking cancelled
        await TeeTimeAssignment.destroy({ where: { booking_round_leg_id: { [Op.in]: legs.map(l => l.id) } }, transaction: t });
        await booking.update({ status: 'Cancelled' }, { transaction: t });
      });
    } catch (e) {
      return res.status(500).json({ error: 'Cancellation failed' });
    }

    // Event: booking.cancelled
    recordEvent({
      courseId: (await TeeSheet.findByPk(booking.tee_sheet_id)).course_id,
      entityType: 'Booking',
      entityId: booking.id,
      action: 'booking.cancelled',
      actorType: ['Admin', 'Manager', 'Staff', 'SuperAdmin'].includes(req.userRole || '') ? 'Staff' : 'Customer',
      actorId: req.userId || null,
      metadata: { cutoffHours: Number(process.env.CANCEL_CUTOFF_HOURS || 24) },
    });
    return res.json({ success: true });
  }
);

module.exports = router;

// List current user's bookings (customer)
router.get('/bookings/mine', requireAuth(['Customer']), async (req, res) => {
  try {
    const rows = await Booking.findAll({
      where: { owner_customer_id: req.userId, status: 'Active' },
      include: [
        {
          model: BookingRoundLeg,
          as: 'legs',
          include: [
            {
              model: TeeTimeAssignment,
              as: 'assignments',
              include: [{ model: TeeTime, as: 'tee_time' }],
            },
          ],
        },
      ],
      order: [[{ model: BookingRoundLeg, as: 'legs' }, 'leg_index', 'ASC']],
    });

    const out = rows.map(b => ({
      id: b.id,
      tee_sheet_id: b.tee_sheet_id,
      total_price_cents: b.total_price_cents,
      status: b.status,
      legs: (b.legs || []).map(l => ({
        leg_index: l.leg_index,
        tee_time: l.assignments && l.assignments[0] && l.assignments[0].tee_time
          ? {
              id: l.assignments[0].tee_time.id,
              start_time: l.assignments[0].tee_time.start_time,
              side_id: l.assignments[0].tee_time.side_id,
            }
          : null,
        price_cents: l.price_cents,
      })),
    }));
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load bookings' });
  }
});


