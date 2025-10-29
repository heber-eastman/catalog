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
  TeeSheetTemplateSide,
  CalendarAssignment,
  Timeframe,
  TimeframeAccessRule,
  TimeframePricingRule,
  TimeframeMinPlayers,
  TimeframeMode,
  Booking,
  BookingRoundLeg,
  TeeTimeAssignment,
  GolfCourseInstance,
  Customer,
} = require('../models');
const { resolveEffectiveWindows } = require('../services/templateResolver');
const { compileWindowsForDate } = require('../services/windowCompiler');
const { DateTime } = require('luxon');
const { computeReroundStart, isClassAllowed, calcFeesForLeg, enforceMinPlayers } = require('../lib/teeRules');
const { sendEmail } = require('../services/emailService');
const { recordEvent } = require('../services/eventBus');
const { requireAuth: _unused } = require('../middleware/auth');

const router = express.Router();

const bookingSchema = Joi.object({
  tee_sheet_id: Joi.string().uuid().required(),
  classId: Joi.string().required(),
  holes: Joi.number().valid(9, 18).default(9),
  owner_customer_id: Joi.string().uuid().optional(),
  lead_name: Joi.string().min(1).max(200).allow(null, ''),
  lead_email: Joi.string().email().allow(null, ''),
  players: Joi.array()
    .items(
      Joi.object({
        customer_id: Joi.string().uuid().allow(null),
        name: Joi.string().allow('', null).optional(),
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
  let teeTimes = await TeeTime.findAll({ where: { id: { [Op.in]: teeTimeIds } }, order: [['start_time', 'ASC']] });
    if (teeTimes.length !== teeTimeIds.length) return res.status(404).json({ error: 'One or more tee times not found' });
    if (!teeTimes.every(t => t.tee_sheet_id === teeSheetId)) return res.status(400).json({ error: 'Tee times must belong to the same tee sheet' });

  // Auto-compute reround for 18 holes when only first leg provided (strict; requires distinct next slot)
  if (value.holes === 18 && teeTimes.length === 1) {
    try {
      const first = teeTimes[0];
      const sides = await TeeSheetSide.findAll({ where: { tee_sheet_id: teeSheetId } });
      const startSide = sides.find(s => s.id === first.side_id) || (await TeeSheetSide.findByPk(first.side_id));

      // Determine reround target side from active template settings (v2)
      const sheetRow = await TeeSheet.findByPk(teeSheetId);
      const course = sheetRow ? await GolfCourseInstance.findByPk(sheetRow.course_id) : null;
      const zone = (course && course.timezone) ? course.timezone : 'UTC';
      const dateISO = first.start_time.toISOString().substring(0,10);
      const { windows, source } = await resolveEffectiveWindows({ teeSheetId, dateISO });
      let configuredReroundSideId = null;
      if (windows && windows.length && source) {
        const compiled = await compileWindowsForDate({ teeSheetId, dateISO, sourceType: source, sourceId: null, windows });
        const local = DateTime.fromJSDate(first.start_time, { zone });
        const match = compiled.find(w => w.side_id === first.side_id && local >= w.start && local < w.end);
        if (match && match.template_version_id) {
          const sideCfg = await TeeSheetTemplateSide.findOne({ where: { version_id: match.template_version_id, side_id: first.side_id } });
          if (sideCfg && sideCfg.rerounds_to_side_id) configuredReroundSideId = sideCfg.rerounds_to_side_id;
        }
      }

      // Compute reround start after first leg holes (usually 9)
      const reroundStart = computeReroundStart({ minutes_per_hole: startSide.minutes_per_hole, hole_count: startSide.hole_count }, first.start_time);

      // Primary target: configured reround side; fallback to any other side; lastly same side
      const otherSide = sides.find(s => s.id !== first.side_id) || startSide;
      const targets = [configuredReroundSideId, otherSide.id, startSide.id].filter(Boolean);
      let reround = null;
      for (const sid of targets) {
        reround = await TeeTime.findOne({
          where: { tee_sheet_id: teeSheetId, side_id: sid, start_time: { [Op.gt]: reroundStart } },
          order: [['start_time', 'ASC']],
        });
        if (reround) break;
      }
      if (!reround || reround.id === first.id) {
        return res.status(409).json({ error: 'Reround slot unavailable' });
      }
      teeTimes = [first, reround];
    } catch (e) {
      return res.status(400).json({ error: 'Failed to compute reround tee time' });
    }
  }

    // Determine date and prefer V2 seasons/overrides windows; fall back to legacy templates
    const date = teeTimes[0].start_time.toISOString().substring(0, 10);
    let totalPriceCents = 0;
    const legsComputed = [];

    // Try V2 first
    const sheet = await TeeSheet.findByPk(teeSheetId);
    if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
    const course = await GolfCourseInstance.findByPk(sheet.course_id);
    const zone = (course && course.timezone) ? course.timezone : 'UTC';
    let usedV2 = false;
    // Dev mode handled later via legacy fallback (no pre-push here to avoid duplicate legs)
    const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    try {
      const { windows, source } = await resolveEffectiveWindows({ teeSheetId, dateISO: date });
      if (source && windows && windows.length) {
        const compiled = await compileWindowsForDate({ teeSheetId, dateISO: date, sourceType: source, sourceId: null, windows });
        const bySide = {};
        for (const w of compiled) { (bySide[w.side_id] || (bySide[w.side_id] = [])).push(w); }
        // Ensure all requested tee times fall within compiled windows
        let allMatch = true;
        for (const tt of teeTimes) {
          const local = DateTime.fromJSDate(tt.start_time, { zone });
          const wins = bySide[tt.side_id] || [];
          const matches = wins.some(w => local >= w.start && local < w.end);
          if (!matches) { allMatch = false; break; }
        }
        if (allMatch) {
          for (const tt of teeTimes) {
            const legPrice = 0; // Pricing TBD for V2
            totalPriceCents += legPrice;
            legsComputed.push({ tt, timeframe: null, legPrice });
          }
          usedV2 = true;
        }
      }
    } catch (_) {
      // ignore and fall back to legacy below
    }

    if (!usedV2) {
      // Legacy DayTemplate/Timeframe path
      const template = await findTemplateForDate(teeSheetId, date);
      if (!template) {
        // Dev-friendly fallback: if no calendar assignment but tee times exist and are not blocked, allow booking
        const allUnblocked = teeTimes.every(tt => !tt.is_blocked);
        if (!allUnblocked || (process.env.NODE_ENV || '').toLowerCase() === 'production') {
          return res.status(400).json({ error: 'Window not open' });
        }
        // Push zero-priced legs without timeframe
        for (const tt of teeTimes) {
          legsComputed.push({ tt, timeframe: null, legPrice: 0 });
        }
      } else {
      for (const tt of teeTimes) {
        const timeframe = await findTimeframeForSlot(teeSheetId, tt.side_id, template.day_template_id, tt.start_time);
        if (!timeframe) {
          // Dev-friendly fallback: permit booking without timeframe when not in production
          if ((process.env.NODE_ENV || '').toLowerCase() !== 'production' && !tt.is_blocked) {
            legsComputed.push({ tt, timeframe: null, legPrice: 0 });
            continue;
          }
          return res.status(400).json({ error: 'Window not open' });
        }

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
    }
    }

    // De-duplicate legs by tee time id to prevent double-assignments (e.g., dev/V2 overlap)
    const legsToCreate = (() => {
      const seen = new Set();
      const out = [];
      for (const lg of legsComputed) {
        const id = lg && lg.tt && lg.tt.id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(lg);
      }
      return out;
    })();

    // Helper to find-or-create a customer by (course_id, first_name, last_name) or by email when provided
    async function findOrCreateCustomer({ courseId, firstName, lastName, email }) {
      const whereByName = {
        course_id: courseId,
        first_name: { [Op.iLike]: (firstName || '').trim() },
        last_name: { [Op.iLike]: (lastName || '').trim() },
      };
      // Prefer email match if provided
      if (email && String(email).includes('@')) {
        const byEmail = await Customer.findOne({ where: { course_id: courseId, email: { [Op.iLike]: String(email).trim() } } });
        if (byEmail) return byEmail.id;
      }
      const byName = await Customer.findOne({ where: whereByName });
      if (byName) return byName.id;
      try {
        const cust = await Customer.create({ course_id: courseId, first_name: firstName || 'Guest', last_name: lastName || 'Guest', email: email && String(email).includes('@') ? email : `guest+${Date.now()}@auto.local` });
        return cust.id;
      } catch (e) {
        // Unique name constraint may have raced; fetch existing
        const existing = await Customer.findOne({ where: whereByName });
        if (existing) return existing.id;
        throw e;
      }
    }

    // Determine booking owner (customer)
    let ownerCustomerId = null;
    if (value.owner_customer_id) {
      ownerCustomerId = value.owner_customer_id;
    } else if (['Customer'].includes(req.userRole || '')) {
      ownerCustomerId = req.userId;
    } else if (!ownerCustomerId && (value.lead_name || value.lead_email)) {
      try {
        const sheetRow = await TeeSheet.findByPk(teeSheetId);
        const courseId = sheetRow ? sheetRow.course_id : null;
        if (courseId) {
          const name = String(value.lead_name || '').trim();
          const parts = name.split(/\s+/).filter(Boolean);
          const firstName = parts.length > 1 ? parts.slice(0, parts.length - 1).join(' ') : (parts[0] || 'Guest');
          const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
          const email = (value.lead_email && String(value.lead_email).includes('@')) ? value.lead_email : null;
          ownerCustomerId = await findOrCreateCustomer({ courseId, firstName, lastName, email });
        }
      } catch (_) { /* best-effort; keep owner null on failure */ }
    }

    // Single-source owner: prefer first player info if owner still not set
    try {
      const p0 = players[0] || {};
      if (!ownerCustomerId) {
        const sourceName = (p0.name || value.lead_name || '').trim();
        const sourceEmail = (value.lead_email && String(value.lead_email).includes('@')) ? value.lead_email : null;
        if (sourceName) {
          const sheetRow = await TeeSheet.findByPk(teeSheetId);
          const courseId = sheetRow ? sheetRow.course_id : null;
          if (courseId) {
            const parts = sourceName.split(/\s+/).filter(Boolean);
            const firstName = parts.length > 1 ? parts.slice(0, parts.length - 1).join(' ') : (parts[0] || 'Guest');
            const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
            ownerCustomerId = await findOrCreateCustomer({ courseId, firstName, lastName, email: sourceEmail });
          }
        }
      }
      // Ensure first player is bound to owner id if available
      if (ownerCustomerId) {
        players[0] = Object.assign({}, players[0], { customer_id: ownerCustomerId, name: '' });
      }
    } catch (_) {}

    // Ensure lead player uses ownerCustomerId to avoid duplicate customer creation
    if (ownerCustomerId && Array.isArray(players) && players.length > 0) {
      try {
        if (!players[0].customer_id) {
          // If first slot provided only a name for the lead, bind it to the newly created owner
          players[0].customer_id = ownerCustomerId;
          players[0].name = '';
        }
      } catch (_) {}
    }

    // Resolve per-player customer IDs in call order (create if only a name is provided)
    const courseIdForPlayers = sheet.course_id;
    const leadNameNorm = (value.lead_name || '').trim().toLowerCase();
    const toCustomerId = async (p) => {
      if (p && p.customer_id) return p.customer_id;
      const name = (p && p.name ? String(p.name) : '').trim();
      if (!name) return null;
      // If this name matches the newly-created owner, reuse the owner id to avoid duplicates
      if (ownerCustomerId && leadNameNorm && name.toLowerCase() === leadNameNorm) {
        return ownerCustomerId;
      }
      try {
        const parts = name.split(/\s+/).filter(Boolean);
        const firstName = parts.length > 1 ? parts.slice(0, parts.length - 1).join(' ') : (parts[0] || 'Guest');
        const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
        const email = null;
        return await findOrCreateCustomer({ courseId: courseIdForPlayers, firstName, lastName, email });
      } catch (_) {
        return null;
      }
    };
    const resolvedCustomerIds = [];
    for (let i = 0; i < players.length; i++) {
      if (i === 0 && ownerCustomerId) {
        resolvedCustomerIds.push(ownerCustomerId);
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      resolvedCustomerIds.push(await toCustomerId(players[i]));
    }

    // Fallback: ensure every non-empty player name has a customer created
    for (let i = 0; i < players.length; i++) {
      if (!resolvedCustomerIds[i]) {
        const nm = (players[i] && players[i].name ? String(players[i].name) : '').trim();
        if (nm) {
          const parts = nm.split(/\s+/).filter(Boolean);
          const firstName = parts.length > 1 ? parts.slice(0, parts.length - 1).join(' ') : (parts[0] || 'Guest');
          const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
          const email = (players[i] && players[i].email && String(players[i].email).includes('@')) ? players[i].email : null;
          // eslint-disable-next-line no-await-in-loop
          resolvedCustomerIds[i] = await findOrCreateCustomer({ courseId: courseIdForPlayers, firstName, lastName, email });
        }
      }
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

        // Capacity strict across all legs (use actual assignment count, not cached field)
        for (const row of locked) {
          const currentAssigned = await TeeTimeAssignment.count({ where: { tee_time_id: row.id }, transaction: t });
          const remaining = row.capacity - currentAssigned;
          if (remaining < players.length) {
            const err = new Error('Insufficient capacity');
            err.status = 409;
            throw err;
          }
        }

        const booking = await Booking.create(
          {
            tee_sheet_id: teeSheetId,
            owner_customer_id: ownerCustomerId || null,
            status: 'Booked',
            total_price_cents: totalPriceCents,
            notes: null,
          },
          { transaction: t }
        );

        // Create legs and assignments
        // Determine leg walk/ride from players array (simple aggregate: any ride -> ride, else walk)
        const anyRideSelected = players.some(p => (p.walkRide || 'ride') === 'ride');
        const legWalkRide = anyRideSelected ? 'ride' : 'walk';

        const createdLegs = [];
        for (let i = 0; i < legsToCreate.length; i++) {
          const { tt, legPrice } = legsToCreate[i];
          const leg = await BookingRoundLeg.create(
            {
              booking_id: booking.id,
              round_option_id: null,
              leg_index: i,
              walk_ride: legWalkRide,
              price_cents: legPrice,
            },
            { transaction: t }
          );
          createdLegs.push({ id: leg.id, leg_index: i });

          // Assign each player to the tee time (one assignment per player)
          const assignments = players.map((p, idx) => ({
            booking_round_leg_id: leg.id,
            tee_time_id: tt.id,
            customer_id: resolvedCustomerIds[idx] || p.customer_id || (idx === 0 ? (ownerCustomerId || null) : null),
          }));
          await TeeTimeAssignment.bulkCreate(assignments, { transaction: t });

          // Update counts to exact current assignment count
          const newCount = await TeeTimeAssignment.count({ where: { tee_time_id: tt.id }, transaction: t });
          await tt.update({ assigned_count: newCount }, { transaction: t });
        }

        // Safety: if multiple legs pointed to the same tee time, keep assignments only for the smallest leg_index
        if (createdLegs.length > 1) {
          const legIdToIndex = new Map(createdLegs.map(l => [l.id, l.leg_index]));
          const legIds = createdLegs.map(l => l.id);
          const assigns = await TeeTimeAssignment.findAll({ where: { booking_round_leg_id: { [Op.in]: legIds } }, transaction: t, lock: t.LOCK.UPDATE });
          const byTt = new Map();
          for (const a of assigns) {
            const arr = byTt.get(a.tee_time_id) || [];
            arr.push(a);
            byTt.set(a.tee_time_id, arr);
          }
          for (const [ttId, arr] of byTt.entries()) {
            if (arr.length <= players.length) continue; // one leg worth expected
            // Determine preferred leg_index
            let minIdx = Infinity; let keepLegId = null;
            for (const a of arr) {
              const idx = legIdToIndex.get(a.booking_round_leg_id) ?? 0;
              if (idx < minIdx) { minIdx = idx; keepLegId = a.booking_round_leg_id; }
            }
            const toRemove = arr.filter(a => a.booking_round_leg_id !== keepLegId);
            if (toRemove.length) {
              const ids = toRemove.map(a => a.id);
              await TeeTimeAssignment.destroy({ where: { id: { [Op.in]: ids } }, transaction: t });
              const ttRow = await TeeTime.findByPk(ttId, { transaction: t, lock: t.LOCK.UPDATE });
              const cnt = await TeeTimeAssignment.count({ where: { tee_time_id: ttId }, transaction: t });
              await ttRow.update({ assigned_count: cnt }, { transaction: t });
            }
          }
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
      // eslint-disable-next-line no-console
      console.error('Booking create error:', e);
      if (e && e.status) return res.status(e.status).json({ error: e.message || 'Booking failed' });
      return res.status(500).json({ error: 'Booking failed' });
    }
  }
);

// Edit players: add/remove and optional owner transfer
const editPlayersSchema = Joi.object({
  add: Joi.number().integer().min(0).default(0),
  remove: Joi.number().integer().min(0).default(0),
  // Optional full desired players list; when provided, route will reconcile to match its length
  players: Joi.array().items(
    Joi.object({
      customer_id: Joi.string().uuid().allow(null),
      name: Joi.string().allow('').optional(),
      email: Joi.string().email().allow('').optional(),
    })
  ).optional(),
  transfer_owner_to: Joi.string().uuid().allow(null),
}).custom((val, helpers) => {
  const hasDelta = (val.add || 0) + (val.remove || 0) > 0;
  const hasPlayers = Array.isArray(val.players) && val.players.length > 0;
  if (!hasDelta && !hasPlayers && !('transfer_owner_to' in val)) {
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
    // Prefer V2 seasons/overrides windows, fallback to legacy day templates
    let minPlayers = 1;
    try {
      const sheet = await TeeSheet.findByPk(booking.tee_sheet_id);
      if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
      const course = await GolfCourseInstance.findByPk(sheet.course_id);
      const zone = (course && course.timezone) ? course.timezone : 'UTC';
      const { windows, source } = await resolveEffectiveWindows({ teeSheetId: booking.tee_sheet_id, dateISO: date });
      if (windows && windows.length && source) {
        const compiled = await require('../services/windowCompiler').compileWindowsForDate({ teeSheetId: booking.tee_sheet_id, dateISO: date, sourceType: source, sourceId: null, windows });
        const local = require('luxon').DateTime.fromJSDate(teeTime.start_time, { zone });
        const match = compiled.find(w => w.side_id === teeTime.side_id && local >= w.start && local < w.end);
        if (match && match.template_version_id) {
          const sideCfg = await TeeSheetTemplateSide.findOne({ where: { version_id: match.template_version_id, side_id: teeTime.side_id } });
          if (sideCfg && typeof sideCfg.min_players === 'number') minPlayers = sideCfg.min_players;
        } else {
          return res.status(400).json({ error: 'Window not open' });
        }
      } else {
        // Legacy fallback
        const template = await findTemplateForDate(booking.tee_sheet_id, date);
        if (!template) return res.status(400).json({ error: 'No calendar assignment for date' });
        const timeframe = await findTimeframeForSlot(booking.tee_sheet_id, teeTime.side_id, template.day_template_id, teeTime.start_time);
        if (!timeframe) return res.status(400).json({ error: 'Window not open' });
        const minRow = await TimeframeMinPlayers.findOne({ where: { timeframe_id: timeframe.id } });
        minPlayers = minRow ? minRow.min_players : 1;
      }
    } catch (e) {
      // On unexpected V2 errors, fall back to legacy
      try {
        const template = await findTemplateForDate(booking.tee_sheet_id, date);
        if (!template) return res.status(400).json({ error: 'No calendar assignment for date' });
        const timeframe = await findTimeframeForSlot(booking.tee_sheet_id, teeTime.side_id, template.day_template_id, teeTime.start_time);
        if (!timeframe) return res.status(400).json({ error: 'Window not open' });
        const minRow = await TimeframeMinPlayers.findOne({ where: { timeframe_id: timeframe.id } });
        minPlayers = minRow ? minRow.min_players : 1;
      } catch {
        return res.status(400).json({ error: 'Window not open' });
      }
    }

    const currentCount = await TeeTimeAssignment.count({ where: { booking_round_leg_id: firstLeg.id } });
    let addCount = Number(value.add || 0);
    let removeCount = Number(value.remove || 0);
    // If a full desired players list is provided, derive add/remove from it
    if (Array.isArray(value.players)) {
      const desired = Math.max(0, Number(value.players.length));
      if (desired > currentCount) { addCount = desired - currentCount; removeCount = 0; }
      else if (desired < currentCount) { removeCount = currentCount - desired; addCount = 0; }
      else { addCount = 0; removeCount = 0; }
    }

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

        // If caller supplied desired players list, reconcile assignment customer_ids to match
        if (Array.isArray(value.players)) {
          // Build final customer IDs, creating customers for entries without id but with a name
          const sheet = await TeeSheet.findByPk(booking.tee_sheet_id, { transaction: t });
          const courseId = sheet ? sheet.course_id : null;
          const toCustomerId = async (p) => {
            if (p && p.customer_id) return p.customer_id;
            const name = (p && p.name ? String(p.name) : '').trim();
            if (!name) return null;
            const parts = name.split(/\s+/).filter(Boolean);
            const firstName = parts.length > 1 ? parts.slice(0, parts.length - 1).join(' ') : (parts[0] || 'Guest');
            const lastName = parts.length > 1 ? parts[parts.length - 1] : 'Guest';
            const email = (p && p.email && String(p.email).includes('@')) ? p.email : `guest+${Date.now()}@auto.local`;
            const cust = await Customer.create({ course_id: courseId, first_name: firstName, last_name: lastName, email }, { transaction: t });
            return cust.id;
          };
          const desiredIds = [];
          for (const p of value.players) desiredIds.push(await toCustomerId(p));

          for (const leg of booking.legs) {
            const assigns = await TeeTimeAssignment.findAll({ where: { booking_round_leg_id: leg.id }, order: [['created_at','ASC']], transaction: t, lock: t.LOCK.UPDATE });
            if (assigns.length !== desiredIds.length) throw Object.assign(new Error('Assignment count mismatch'), { status: 400 });
            for (let i = 0; i < assigns.length; i++) {
              const id = desiredIds[i] || null;
              if (assigns[i].customer_id !== id) {
                await assigns[i].update({ customer_id: id }, { transaction: t });
              }
            }
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


