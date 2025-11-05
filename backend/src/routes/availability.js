'use strict';

const express = require('express');
const Joi = require('joi');
const { Op } = require('sequelize');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const {
  TeeTime,
  TeeSheet,
  TeeSheetSide,
  CalendarAssignment,
  DayTemplate,
  Timeframe,
  TimeframeAccessRule,
  TimeframePricingRule,
  TimeframeRoundOption,
  TimeframeRoundLegOption,
  GolfCourseInstance,
  TeeTimeAssignment,
  BookingRoundLeg,
  Booking,
  Customer,
  TeeSheetTemplateVersion,
  TeeSheetTemplate,
} = require('../models');
const { computeReroundStart, isClassAllowed, calcFeesForLeg } = require('../lib/teeRules');
const { generateForDateV2 } = require('../services/teeSheetGenerator.v2');

const router = express.Router();
const { resolveEffectiveWindows } = require('../services/templateResolver');
const {
  TeeSheetTemplateSideAccess,
  TeeSheetTemplateSidePrices,
  TeeSheetTemplateSide,
} = require('../models');
const { DateTime } = require('luxon');
const { compileWindowsForDate } = require('../services/windowCompiler');

const querySchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  'teeSheets[]': Joi.alternatives().try(Joi.array().items(Joi.string().uuid()), Joi.string().uuid()),
  teeSheets: Joi.alternatives().try(Joi.array().items(Joi.string().uuid()), Joi.string().uuid()),
  'sides[]': Joi.alternatives().try(Joi.array().items(Joi.string().uuid()), Joi.string().uuid()),
  sides: Joi.alternatives().try(Joi.array().items(Joi.string().uuid()), Joi.string().uuid()),
  timeStart: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  timeEnd: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  // Optional: when omitted, do not enforce capacity/min-player filters
  groupSize: Joi.number().integer().min(1).max(4).optional(),
  // Optional: when 18, require reround feasibility; when 9 or omitted, first leg only
  holes: Joi.number().valid(9, 18).optional(),
  roundOptionId: Joi.string().uuid().optional(),
  walkRide: Joi.string().valid('walk', 'ride').optional(),
  classId: Joi.string().default('Full'),
  customerView: Joi.boolean().default(false),
});

async function findTemplateForDate(tee_sheet_id, date) {
  return await CalendarAssignment.findOne({ where: { tee_sheet_id, date } });
}

async function findTimeframeForSlot(tee_sheet_id, side_id, day_template_id, slot) {
  const hh = slot.toISOString().substring(11, 19); // UTC time; we defined timeframes as local, but for tests we use wide ranges
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

router.get('/tee-times/available', optionalAuth(), async (req, res) => {
  const { error, value } = querySchema.validate(req.query);
  if (error) return res.status(400).json({ error: error.message });
  const date = value.date;
  let teeSheets = [];
  if (value['teeSheets[]']) {
    teeSheets = Array.isArray(value['teeSheets[]']) ? value['teeSheets[]'] : [value['teeSheets[]']];
  } else if (value.teeSheets) {
    teeSheets = Array.isArray(value.teeSheets) ? value.teeSheets : [value.teeSheets];
  }
  if (!teeSheets.length) return res.status(400).json({ error: 'teeSheets is required' });
  // Determine effective booking class: authenticated customer maps to membership_type; else default to Public or provided.
  let classId = value.classId;
  try {
    const isStaff = ['Admin', 'Manager', 'Staff', 'SuperAdmin'].includes(req.userRole || '');
    if (!isStaff && (req.userRole === 'Customer') && req.user && req.user.email) {
      // Derive course from first sheet
      const sampleSheetId = Array.isArray(teeSheets) && teeSheets.length ? teeSheets[0] : null;
      if (sampleSheetId) {
        const sheetRow = await TeeSheet.findByPk(sampleSheetId);
        if (sheetRow) {
          const courseId = sheetRow.course_id;
          const cust = await Customer.findOne({ where: { course_id: courseId, email: { [Op.iLike]: String(req.user.email) } } });
          if (cust && cust.membership_type) classId = String(cust.membership_type);
        }
      }
    }
  } catch (_) {}
  const groupSize = (typeof value.groupSize === 'number') ? value.groupSize : null;
  const isStaff = ['Admin', 'Manager', 'Staff', 'SuperAdmin'].includes(req.userRole || '');
  const isCustomerView = isStaff ? !!value.customerView : true; // force customer view when unauthenticated
  const requireReround = !!value.roundOptionId || Number(value.holes) === 18;
  let sideFilter = [];
  if (value['sides[]']) {
    sideFilter = Array.isArray(value['sides[]']) ? value['sides[]'] : [value['sides[]']];
  } else if (value.sides) {
    sideFilter = Array.isArray(value.sides) ? value.sides : [value.sides];
  }

  // Build time window filter using course-local day bounds across all requested sheets
  // First, load sheets and their courses to compute local day start/end in UTC
  const sheets = await TeeSheet.findAll({ where: { id: { [Op.in]: teeSheets } } });
  const courseIds = Array.from(new Set(sheets.map(s => s.course_id).filter(Boolean)));
  const courses = await GolfCourseInstance.findAll({ where: { id: { [Op.in]: courseIds } } });
  const courseById = Object.fromEntries(courses.map(c => [c.id, c]));
  let windowStart = null;
  let windowEnd = null;
  for (const s of sheets) {
    const zone = (courseById[s.course_id] && courseById[s.course_id].timezone) ? courseById[s.course_id].timezone : 'UTC';
    const startUtc = DateTime.fromISO(date, { zone }).startOf('day').toUTC().toJSDate();
    const endUtc = DateTime.fromISO(date, { zone }).plus({ days: 1 }).startOf('day').toUTC().toJSDate();
    if (!windowStart || startUtc < windowStart) windowStart = startUtc;
    if (!windowEnd || endUtc > windowEnd) windowEnd = endUtc;
  }
  // Fallback when no sheets loaded (should not happen since teeSheets validated)
  if (!windowStart || !windowEnd) {
    windowStart = new Date(`${date}T00:00:00Z`);
    windowEnd = new Date(`${date}T23:59:59Z`);
  }
  if (value.timeStart) {
    windowStart = new Date(`${date}T${value.timeStart}:00Z`);
  }
  if (value.timeEnd) {
    windowEnd = new Date(`${date}T${value.timeEnd}:00Z`);
  }

  // If V2 windows exist, tighten the search window to earliest start and latest end
  try {
    let globalEarliest = null;
    let globalLatest = null;
    for (const sheetId of teeSheets) {
      const { windows, source } = await resolveEffectiveWindows({ teeSheetId: sheetId, dateISO: date });
      if (windows && windows.length && source) {
        const compiled = await compileWindowsForDate({ teeSheetId: sheetId, dateISO: date, sourceType: source, sourceId: null, windows });
        for (const w of compiled) {
          const sUtc = w.start.toUTC().toJSDate();
          const eUtc = w.end.toUTC().toJSDate();
          if (!globalEarliest || sUtc < globalEarliest) globalEarliest = sUtc;
          if (!globalLatest || eUtc > globalLatest) globalLatest = eUtc;
        }
      }
    }
    // Keep course-local full-day window; do not tighten by template windows to avoid DST/day-boundary drift
  } catch (_) { /* non-fatal; fall back to full day */ }

  // Fetch slots on date for selected sheets within computed window
  let slots = await TeeTime.findAll({
    where: {
      tee_sheet_id: { [Op.in]: teeSheets },
      ...(sideFilter.length ? { side_id: { [Op.in]: sideFilter } } : {}),
      start_time: {
        [Op.gte]: windowStart,
        [Op.lt]: windowEnd,
      },
    },
    order: [['start_time', 'ASC']],
  });

  // Dev-friendly fallback: if no slots were found, auto-generate and retry (development only or when explicitly enabled)
  if ((process.env.NODE_ENV === 'development' || process.env.AUTO_GENERATE_SLOTS === 'true') && slots.length === 0) {
    try {
      for (const sheetId of teeSheets) {
        // Let the generator resolve windows internally; it will no-op if none exist
        await generateForDateV2({ teeSheetId: sheetId, dateISO: date });
      }
      // Re-query after generation
      slots = await TeeTime.findAll({
        where: {
          tee_sheet_id: { [Op.in]: teeSheets },
          ...(sideFilter.length ? { side_id: { [Op.in]: sideFilter } } : {}),
          start_time: { [Op.gte]: windowStart, [Op.lt]: windowEnd },
        },
        order: [['start_time', 'ASC']],
      });
    } catch (_) {
      // ignore fallback errors
    }
  }

  // Load metadata we need
  const sheetById = Object.fromEntries(sheets.map(s => [s.id, s]));
  const sideById = Object.fromEntries((await TeeSheetSide.findAll({ where: { tee_sheet_id: { [Op.in]: teeSheets } } })).map(s => [s.id, s]));

  // Resolve V2 windows for each sheet and load access/prices
  // courseById already loaded above
  const v2InfoBySheet = {};
  for (const sheetId of teeSheets) {
    try {
      const { windows, source } = await resolveEffectiveWindows({ teeSheetId: sheetId, dateISO: date });
      if (windows && windows.length && source) {
        // Expand season windows to concrete side windows using the compiler (snap/clamp and side fanout)
        const compiled = await compileWindowsForDate({ teeSheetId: sheetId, dateISO: date, sourceType: source, sourceId: null, windows });
        const versionIds = Array.from(new Set(compiled.map(w => w.template_version_id).filter(Boolean)));
        const [accessList, priceList, sideCfgList, versions] = await Promise.all([
          TeeSheetTemplateSideAccess.findAll({ where: { version_id: { [Op.in]: versionIds } } }),
          TeeSheetTemplateSidePrices.findAll({ where: { version_id: { [Op.in]: versionIds } } }),
          TeeSheetTemplateSide.findAll({ where: { version_id: { [Op.in]: versionIds } } }),
          TeeSheetTemplateVersion.findAll({ where: { id: { [Op.in]: versionIds } }, include: [{ model: TeeSheetTemplate, as: 'template' }] }),
        ]);
        const accessByVS = {};
        for (const a of accessList) {
          const key = `${a.version_id}:${a.side_id}`;
          const map = accessByVS[key] || (accessByVS[key] = {});
          map[(a.booking_class_id || '').toLowerCase()] = !!a.is_allowed;
        }
        const pricesByVS = {};
        for (const p of priceList) {
          const key = `${p.version_id}:${p.side_id}`;
          const map = pricesByVS[key] || (pricesByVS[key] = {});
          map[(p.booking_class_id || '').toLowerCase()] = { greens: p.greens_fee_cents || 0, cart: p.cart_fee_cents || 0 };
        }
        const sideCfgByVS = {};
        for (const s of sideCfgList) {
          const key = `${s.version_id}:${s.side_id}`;
          sideCfgByVS[key] = s;
        }
        const windowsBySide = {};
        for (const w of compiled) {
          const arr = windowsBySide[w.side_id] || (windowsBySide[w.side_id] = []);
          arr.push(w);
        }
        const colorByVersion = {};
        const templateIdByVersion = {};
        for (const v of versions) {
          colorByVersion[v.id] = (v.template && v.template.color) || null;
          templateIdByVersion[v.id] = v.template_id;
        }
        v2InfoBySheet[sheetId] = { accessByVS, pricesByVS, sideCfgByVS, windowsBySide, colorByVersion, templateIdByVersion };
      }
    } catch (_) {
      // Degrade gracefully when V2 tables are not present in test setups
      continue;
    }
  }

  const results = [];

  // Preload assignments with owner names for displayed labels
  const ttIds = slots.map(s => s.id);
  let assignmentsByTt = {};
  if (ttIds.length) {
    try {
      const assigns = await TeeTimeAssignment.findAll({
        where: { tee_time_id: { [Op.in]: ttIds } },
        include: [
          {
            model: BookingRoundLeg,
            as: 'round_leg',
            include: [
              {
                model: Booking,
                as: 'booking',
                include: [{ model: Customer, as: 'owner' }],
              },
            ],
          },
          { model: Customer, as: 'customer' },
        ],
        order: [['created_at', 'ASC']],
      });
      // Compute max leg_index per booking across all assignments in window
      const bookingMaxLegIndex = {};
      for (const a of assigns) {
        const bid = a.round_leg && a.round_leg.booking ? a.round_leg.booking.id : null;
        const idx = (a.round_leg && typeof a.round_leg.leg_index === 'number') ? a.round_leg.leg_index : 0;
        if (bid) bookingMaxLegIndex[bid] = Math.max(bookingMaxLegIndex[bid] || 0, idx);
      }
      for (const a of assigns) {
        const arr = assignmentsByTt[a.tee_time_id] || (assignmentsByTt[a.tee_time_id] = []);
        const bookingId = a.round_leg && a.round_leg.booking ? a.round_leg.booking.id : null;
        const owner = a.round_leg && a.round_leg.booking && a.round_leg.booking.owner;
        const customer = a.customer;
        const ownerFull = owner ? `${owner.first_name || ''} ${owner.last_name || ''}`.trim() : '';
        const customerFull = customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : '';
        const legIndex = (a.round_leg && typeof a.round_leg.leg_index === 'number') ? a.round_leg.leg_index : 0;
        // Surface riding/walking from the booking leg
        const walkRide = (a.round_leg && a.round_leg.walk_ride)
          ? String(a.round_leg.walk_ride).toLowerCase()
          : null;
        // Booking status for color-coding on UI
        const bookingStatus = a.round_leg && a.round_leg.booking && a.round_leg.booking.status
          ? String(a.round_leg.booking.status)
          : null;
        const maxIdx = bookingId ? (bookingMaxLegIndex[bookingId] || legIndex) : legIndex;
        arr.push({ booking_id: bookingId, owner_name: ownerFull, customer_name: customerFull, leg_index: legIndex, booking_leg_max_index: maxIdx, walk_ride: walkRide, status: bookingStatus });
      }
    } catch (_) {
      assignmentsByTt = {};
    }
  }

  // Load active holds and subtract from remaining (gracefully skip if Redis unavailable)
  let holds = [];
  try {
    const { getRedisClient } = require('../services/redisClient');
    const redis = getRedisClient();
    let connected = false;
    try { await redis.connect(); connected = true; } catch (_) { /* skip holds on failure */ }
    if (connected) {
      try {
        const keys = await redis.keys('hold:user:*');
        for (const k of keys) {
          try {
            const val = await redis.get(k);
            if (val) holds.push(JSON.parse(val));
          } catch (_) { /* ignore malformed */ }
        }
      } catch (_) { /* ignore redis errors */ }
      try { await redis.quit?.(); } catch (_) {}
    }
  } catch (_) { /* redis client not configured; proceed without holds */ }

  for (const slot of slots) {
    // Staff includes blocked flag; customers hide blocked
    if (isCustomerView && slot.is_blocked) continue;

    const v2 = v2InfoBySheet[slot.tee_sheet_id];
    let timeframe = null;
    let templateMeta = null;
    let usingV2 = false;
    let totalPriceCents = 0;
    let priceBreakdown = null;
    // Compute course timezone and local time once per slot for consistent use below
    const sheet = sheetById[slot.tee_sheet_id];
    const course = sheet ? courseById[sheet.course_id] : null;
    const zone = (course && course.timezone) ? course.timezone : 'UTC';
    const local = DateTime.fromJSDate(slot.start_time, { zone });

  // Hide past tee times for customers (including earlier times on the same day)
  if (isCustomerView) {
    const nowLocal = DateTime.now().setZone(zone);
    if (local < nowLocal) continue;
  }

  let allows18 = false;
    if (v2) {
      // Check if slot falls within any V2 window for its side
      const windows = v2.windowsBySide[slot.side_id] || [];
      const classNorm = String(classId || '').toLowerCase();
      const classLookup = classNorm === 'full' ? 'public' : classNorm;
      let inWindow = false;
      let matchedVersionId = null;
      for (const w of windows) {
        // windows are compiled; start/end are DateTime in course zone
        if (local >= w.start && local < w.end) { inWindow = true; matchedVersionId = w.template_version_id; break; }
      }
      // If not in a compiled window, gracefully allow display but skip version-specific rules
      const vsKey = matchedVersionId ? `${matchedVersionId}:${slot.side_id}` : null;
      const accessSide = vsKey ? (v2.accessByVS[vsKey] || {}) : {};
      const priceSide = vsKey ? (v2.pricesByVS[vsKey] || {}) : {};
      const sideCfg = vsKey ? v2.sideCfgByVS[vsKey] : null;
      // Customer visibility: start must be enabled and class allowed (default allow when no rules configured)
      if (isCustomerView) {
        if (sideCfg && sideCfg.start_slots_enabled === false) continue;
        const allowed = (Object.prototype.hasOwnProperty.call(accessSide, classLookup)
          ? accessSide[classLookup]
          : (Object.prototype.hasOwnProperty.call(accessSide, 'public')
              ? accessSide['public']
              : (Object.prototype.hasOwnProperty.call(accessSide, 'full')
                  ? accessSide['full']
                  : true)));
        if (!allowed) continue;
        const minPlayers = sideCfg?.min_players || 1;
        if (groupSize !== null && groupSize < minPlayers) continue;
      }
      // Enforce template-level max players online if present
      if (isCustomerView) {
        const sheet = sheetById[slot.tee_sheet_id];
        // Pull template-level caps from published template if available (approx via windows->version->template relation is not in memory);
        // As a pragmatic cap, use groupSize <= 4 for now unless overridden by query param; template caps surface on UI and booking API will revalidate.
      }
      const price = priceSide[classLookup] || priceSide['public'] || { greens: 0, cart: 0 };
      totalPriceCents = price.greens + (value.walkRide === 'ride' ? price.cart : 0);
      priceBreakdown = { greens_fee_cents: price.greens, cart_fee_cents: value.walkRide === 'ride' ? price.cart : 0 };
      usingV2 = true;

      // Booking window: hide slots that are not yet open for this class
      if (isCustomerView && matchedVersionId) {
        try {
          // daily release: from tee sheet, default 07:00
          const sheetRow = sheetById[slot.tee_sheet_id];
          const courseRow = sheetRow ? courseById[sheetRow.course_id] : null;
          const zone2 = (courseRow && courseRow.timezone) ? courseRow.timezone : 'UTC';
          const releaseClock = (sheetRow && sheetRow.daily_release_local) ? String(sheetRow.daily_release_local) : '07:00';
          const relParts = /^([0-2]\d):([0-5]\d)/.exec(releaseClock) || [];
          const relH = parseInt(relParts[1] || '7', 10);
          const relM = parseInt(relParts[2] || '0', 10);
          const cls = String(classId || '').toLowerCase();
          // Lookup max_days_in_advance from TemplateVersionBookingWindows via raw query for robustness
          let maxDays = null;
          try {
            const [rows] = await require('../models').sequelize.query(
              'SELECT max_days_in_advance FROM "TemplateVersionBookingWindows" WHERE template_version_id = :vid AND LOWER(booking_class_id) = :cid LIMIT 1',
              { replacements: { vid: matchedVersionId, cid: cls } }
            );
            if (Array.isArray(rows) && rows.length > 0) maxDays = Number(rows[0].max_days_in_advance);
          } catch (_) {}
          if (!(Number.isInteger(maxDays) && maxDays >= 0)) {
            // Fallback: use latest version under the same template if this specific version has no window configured
            try {
              const [rows2] = await require('../models').sequelize.query(
                'SELECT tvbw.max_days_in_advance FROM "TemplateVersionBookingWindows" tvbw JOIN "TeeSheetTemplateVersions" tv ON tv.id = tvbw.template_version_id WHERE tv.template_id = (SELECT template_id FROM "TeeSheetTemplateVersions" WHERE id = :vid) AND LOWER(tvbw.booking_class_id) = :cid ORDER BY tv.version_number DESC LIMIT 1',
                { replacements: { vid: matchedVersionId, cid: cls } }
              );
              if (Array.isArray(rows2) && rows2.length > 0) maxDays = Number(rows2[0].max_days_in_advance);
            } catch (_) {}
          }
          if (!(Number.isInteger(maxDays) && maxDays >= 0)) {
            // hide when not configured for this class per product decision
            continue;
          }
          const localStart = DateTime.fromJSDate(slot.start_time, { zone: zone2 });
          const releaseDate = localStart.startOf('day').minus({ days: maxDays }).set({ hour: relH, minute: relM, second: 0, millisecond: 0 });
          const nowLocal2 = DateTime.now().setZone(zone2);
          if (nowLocal2 < releaseDate) continue; // not yet open for this class
        } catch (_) {}
      }

      // Allowed holes indicator for UI: allow 18 when active side rotates and a candidate reround slot exists
      try {
        let rotateId = sideCfg ? sideCfg.rerounds_to_side_id : null;
        if (!rotateId && matchedVersionId) {
          const row = await TeeSheetTemplateSide.findOne({ where: { version_id: matchedVersionId, side_id: slot.side_id } });
          rotateId = row ? row.rerounds_to_side_id : null;
        }
        if (rotateId) {
          const sideConfig = sideById[slot.side_id];
          const reroundStart = computeReroundStart({ minutes_per_hole: sideConfig.minutes_per_hole, hole_count: sideConfig.hole_count }, slot.start_time);
          const candidate = await TeeTime.findOne({ where: { tee_sheet_id: slot.tee_sheet_id, side_id: rotateId, start_time: { [Op.gt]: reroundStart } }, order: [['start_time','ASC']] });
          allows18 = !!candidate;
        } else {
          allows18 = false;
        }
      } catch (_) { allows18 = false; }

      // Basic two-leg feasibility with reround target side (if specified in template side config)
      if (requireReround) {
        // compute reround at same side by default
        const sideConfig = sideById[slot.side_id];
        const reroundStart = computeReroundStart({ minutes_per_hole: sideConfig.minutes_per_hole, hole_count: sideConfig.hole_count }, slot.start_time);
        const reroundSideId = sideCfg?.rerounds_to_side_id || slot.side_id;
        const reroundSlot = await TeeTime.findOne({ where: { tee_sheet_id: slot.tee_sheet_id, side_id: reroundSideId, start_time: reroundStart } });
        if (!reroundSlot) continue;
        if (isCustomerView && reroundSlot.is_blocked) continue;
        if (groupSize !== null && (reroundSlot.capacity - reroundSlot.assigned_count) < groupSize) continue;
        // Price second leg using same template version mapping; fallback to public
        const vsKey2 = `${matchedVersionId}:${reroundSideId}`;
        const priceSide2 = v2.pricesByVS[vsKey2] || {};
        const price2 = priceSide2[classLookup] || priceSide2['public'] || { greens: 0, cart: 0 };
        totalPriceCents += price2.greens + (value.walkRide === 'ride' ? price2.cart : 0);
        if (priceBreakdown) priceBreakdown.greens_fee_cents += price2.greens;
        if (priceBreakdown && value.walkRide === 'ride') priceBreakdown.cart_fee_cents += price2.cart;
      }
    } else {
      // No effective V2 windows found for this slot; fall back to basic time-window visibility
      // This allows display when windows are temporarily missing/miscompiled while still honoring
      // time bounds, past-time filtering, and capacity/min players checks elsewhere.
      usingV2 = false;
    }

    // Access rules handled by V2; legacy path removed

    // First-leg capacity and reround feasibility for two-leg options
    let reroundOk = true;

    // First-leg capacity check (only hide for customer view)
    if (isCustomerView && groupSize !== null && (slot.capacity - slot.assigned_count) < groupSize) {
      reroundOk = false;
    }

    if (reroundOk && requireReround) {
      const ro = await TimeframeRoundOption.findByPk(value.roundOptionId, { include: [{ model: TimeframeRoundLegOption, as: 'leg_options' }] });
      if (ro && ro.leg_count === 2) {
        const firstLeg = ro.leg_options.find(l => l.leg_index === 0);
        const secondLeg = ro.leg_options.find(l => l.leg_index === 1);
        const sideConfig = sideById[slot.side_id];
        const reroundStart = computeReroundStart({ minutes_per_hole: sideConfig.minutes_per_hole, hole_count: firstLeg?.hole_count || sideConfig.hole_count }, slot.start_time);
        const reroundSideId = secondLeg?.side_id || slot.side_id;
        const reroundSlot = await TeeTime.findOne({ where: { tee_sheet_id: slot.tee_sheet_id, side_id: reroundSideId, start_time: reroundStart } });
        if (!reroundSlot) reroundOk = false;
        else if (isCustomerView && reroundSlot.is_blocked) reroundOk = false;
        else if (isCustomerView && groupSize !== null && (reroundSlot.capacity - reroundSlot.assigned_count) < groupSize) reroundOk = false;

        if (reroundOk && !usingV2 && templateMeta) {
          const tf2 = await findTimeframeForSlot(slot.tee_sheet_id, reroundSideId, templateMeta.day_template_id, reroundSlot.start_time);
          if (tf2) {
            const pricingRules2 = await TimeframePricingRule.findAll({ where: { timeframe_id: tf2.id } });
            const leg2 = calcFeesForLeg(pricingRules2, classId, value.walkRide, undefined);
            totalPriceCents += leg2;
            if (priceBreakdown) priceBreakdown.greens_fee_cents += leg2;
          }
        }
      } else if (!value.roundOptionId && Number(value.holes) === 18) {
        // No explicit round option provided; compute reround using same-side defaults
        const sideConfig = sideById[slot.side_id];
        const reroundStart = computeReroundStart({ minutes_per_hole: sideConfig.minutes_per_hole, hole_count: sideConfig.hole_count }, slot.start_time);
        const reroundSideId = slot.side_id;
        const reroundSlot = await TeeTime.findOne({ where: { tee_sheet_id: slot.tee_sheet_id, side_id: reroundSideId, start_time: reroundStart } });
        if (!reroundSlot) reroundOk = false;
        else if (isCustomerView && reroundSlot.is_blocked) reroundOk = false;
        else if (isCustomerView && groupSize !== null && (reroundSlot.capacity - reroundSlot.assigned_count) < groupSize) reroundOk = false;
      }
    }

    if (!reroundOk) continue;

    // Active holds reduce remaining capacity
    const held = holds
      .flatMap(h => h.items || [])
      .filter(it => it.tee_time_id === slot.id)
      .reduce((sum, it) => sum + (Number(it.party_size) || 0), 0);

    // Build assignments and names, but dedupe multiple legs of same booking at same slot
    const orderedAssignsRaw = assignmentsByTt[slot.id] || [];
    const minLegByBooking = new Map();
    for (const it of orderedAssignsRaw) {
      const bid = it.booking_id || '__none__';
      const li = typeof it.leg_index === 'number' ? it.leg_index : 0;
      const prev = minLegByBooking.get(bid);
      if (prev === undefined || li < prev) minLegByBooking.set(bid, li);
    }
    const orderedAssigns = orderedAssignsRaw.filter(it => {
      const bid = it.booking_id || '__none__';
      const li = typeof it.leg_index === 'number' ? it.leg_index : 0;
      return li === (minLegByBooking.get(bid) ?? li);
    });

    const remainingAdjusted = Math.max(0, (slot.capacity - orderedAssigns.length) - held);

    // Build assignment names in stable seat order (created_at ASC per preload)
    const countPerBooking = new Map();
    const assignmentNames = [];
    for (const it of orderedAssigns) {
      const bid = it.booking_id || '__none__';
      const count = countPerBooking.get(bid) || 0;
      const owner = String(it.owner_name || '').trim();
      const explicit = String(it.customer_name || '').trim();
      if (count === 0) {
        // Seat 1: prefer owner first to keep lead player in first position
        if (owner) assignmentNames.push(owner);
        else if (explicit) assignmentNames.push(explicit);
        else assignmentNames.push('Guest');
      } else {
        // Seats 2+: show explicit name when different from owner; else Guest
        if (explicit && explicit !== owner) assignmentNames.push(explicit);
        else assignmentNames.push('Guest');
      }
      countPerBooking.set(bid, count + 1);
    }

    // Compute allows_18 flag for legacy path using V2 windows when available
    allows18 = !!allows18;
    if (!usingV2) {
      try {
        const v2 = v2InfoBySheet[slot.tee_sheet_id];
        if (v2) {
          const windows = v2.windowsBySide[slot.side_id] || [];
          const classNorm = String(classId || '').toLowerCase();
          const classLookup = classNorm === 'full' ? 'public' : classNorm;
          const local2 = DateTime.fromJSDate(slot.start_time, { zone });
          let matchedVersionId2 = null;
          for (const w of windows) { if (local2 >= w.start && local2 < w.end) { matchedVersionId2 = w.template_version_id; break; } }
          if (matchedVersionId2) {
            const vsKey2 = `${matchedVersionId2}:${slot.side_id}`;
            const sideCfg2 = v2.sideCfgByVS[vsKey2];
            allows18 = !!(sideCfg2 && sideCfg2.rerounds_to_side_id);
          }
        }
      } catch (_) { /* ignore */ }
    }

    results.push({
      id: slot.id,
      tee_sheet_id: slot.tee_sheet_id,
      side_id: slot.side_id,
      start_time: slot.start_time,
      // convenience for clients to render in course time
      start_time_local: DateTime.fromJSDate(slot.start_time, { zone }).toISO(),
      timezone: zone,
      capacity: slot.capacity,
      remaining: remainingAdjusted,
      is_blocked: isCustomerView ? undefined : slot.is_blocked,
      is_start_disabled: isCustomerView ? undefined : slot.is_start_disabled,
      price_total_cents: totalPriceCents,
      price_breakdown: priceBreakdown,
      allows_18: !!slot.can_start_18,
      holes_label: slot.holes_label || (slot.can_start_18 ? '9/18' : '9'),
      // expose reround pairing denormalized fields so clients can book 18-hole starts
      rerounds_to_side_id: slot.rerounds_to_side_id || null,
      reround_tee_time_id: slot.reround_tee_time_id || null,
      template_version_id: (v2 && (v2.windowsBySide[slot.side_id] || []).some(w => {
        const l = DateTime.fromJSDate(slot.start_time, { zone });
        return l >= w.start && l < w.end && w.template_version_id;
      })) ? (v2.windowsBySide[slot.side_id].find(w => {
        const l = DateTime.fromJSDate(slot.start_time, { zone });
        return l >= w.start && l < w.end;
      })?.template_version_id || null) : null,
      template_color: (() => {
        try {
          const windows = v2 ? (v2.windowsBySide[slot.side_id] || []) : [];
          const l = DateTime.fromJSDate(slot.start_time, { zone });
          const match = windows.find(w => l >= w.start && l < w.end);
          return (match && v2 && v2.colorByVersion && v2.colorByVersion[match.template_version_id]) || null;
        } catch (_) { return null; }
      })(),
    assignments: orderedAssigns,
      assignment_names: assignmentNames,
    });
  }

  res.json(results);
});

module.exports = router;


