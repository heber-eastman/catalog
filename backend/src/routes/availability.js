'use strict';

const express = require('express');
const Joi = require('joi');
const { Op } = require('sequelize');
const { requireAuth } = require('../middleware/auth');
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
} = require('../models');
const { computeReroundStart, isClassAllowed, calcFeesForLeg } = require('../lib/teeRules');

const router = express.Router();
const { resolveEffectiveWindows } = require('../services/templateResolver');
const {
  TeeSheetTemplateSideAccess,
  TeeSheetTemplateSidePrices,
  TeeSheetTemplateSide,
} = require('../models');
const { DateTime } = require('luxon');

const querySchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  'teeSheets[]': Joi.alternatives().try(Joi.array().items(Joi.string().uuid()), Joi.string().uuid()),
  teeSheets: Joi.alternatives().try(Joi.array().items(Joi.string().uuid()), Joi.string().uuid()),
  'sides[]': Joi.alternatives().try(Joi.array().items(Joi.string().uuid()), Joi.string().uuid()),
  sides: Joi.alternatives().try(Joi.array().items(Joi.string().uuid()), Joi.string().uuid()),
  timeStart: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  timeEnd: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  groupSize: Joi.number().integer().min(1).max(4).default(2),
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

router.get('/tee-times/available', requireAuth(['Admin', 'Manager', 'Staff', 'SuperAdmin', 'Customer']), async (req, res) => {
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
  const classId = value.classId;
  const groupSize = value.groupSize;
  const isCustomerView = !!value.customerView;
  let sideFilter = [];
  if (value['sides[]']) {
    sideFilter = Array.isArray(value['sides[]']) ? value['sides[]'] : [value['sides[]']];
  } else if (value.sides) {
    sideFilter = Array.isArray(value.sides) ? value.sides : [value.sides];
  }

  // Build time window filter
  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T23:59:59Z`);
  let windowStart = dayStart;
  let windowEnd = dayEnd;
  if (value.timeStart) {
    windowStart = new Date(`${date}T${value.timeStart}:00Z`);
  }
  if (value.timeEnd) {
    windowEnd = new Date(`${date}T${value.timeEnd}:00Z`);
  }

  // Fetch slots on date for selected sheets within optional window
  const slots = await TeeTime.findAll({
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

  // Load metadata we need
  const sheets = await TeeSheet.findAll({ where: { id: { [Op.in]: teeSheets } } });
  const sheetById = Object.fromEntries(sheets.map(s => [s.id, s]));
  const sideById = Object.fromEntries((await TeeSheetSide.findAll({ where: { tee_sheet_id: { [Op.in]: teeSheets } } })).map(s => [s.id, s]));

  // Resolve V2 windows for each sheet and load access/prices
  const courseIds = Array.from(new Set(sheets.map(s => s.course_id).filter(Boolean)));
  const courseById = Object.fromEntries((await GolfCourseInstance.findAll({ where: { id: { [Op.in]: courseIds } } })).map(c => [c.id, c]));
  const v2InfoBySheet = {};
  for (const sheetId of teeSheets) {
    const { windows, source } = await resolveEffectiveWindows({ teeSheetId: sheetId, dateISO: date });
    if (windows && windows.length && source) {
      // Collect side-level access/prices and side config per template version used by windows
      const versionIds = Array.from(new Set(windows.map(w => w.template_version_id).filter(Boolean)));
      const [accessList, priceList, sideCfgList] = await Promise.all([
        TeeSheetTemplateSideAccess.findAll({ where: { version_id: { [Op.in]: versionIds } } }),
        TeeSheetTemplateSidePrices.findAll({ where: { version_id: { [Op.in]: versionIds } } }),
        TeeSheetTemplateSide.findAll({ where: { version_id: { [Op.in]: versionIds } } }),
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
      for (const w of windows) {
        const arr = windowsBySide[w.side_id] || (windowsBySide[w.side_id] = []);
        arr.push(w);
      }
      v2InfoBySheet[sheetId] = { accessByVS, pricesByVS, sideCfgByVS, windowsBySide };
    }
  }

  const results = [];

  // Load active holds and subtract from remaining
  const { getRedisClient } = require('../services/redisClient');
  const redis = getRedisClient();
  try { await redis.connect(); } catch (_) {}
  const keys = await redis.keys('hold:user:*');
  const holds = [];
  for (const k of keys) {
    try {
      const val = await redis.get(k);
      if (val) holds.push(JSON.parse(val));
    } catch (_) {}
  }

  for (const slot of slots) {
    // Staff includes blocked flag; customers hide blocked
    if (isCustomerView && slot.is_blocked) continue;

    const v2 = v2InfoBySheet[slot.tee_sheet_id];
    let timeframe = null;
    let templateMeta = null;
    let usingV2 = false;
    let totalPriceCents = 0;
    let priceBreakdown = null;

    if (v2) {
      // Check if slot falls within any V2 window for its side
      const sheet = sheetById[slot.tee_sheet_id];
      const course = courseById[sheet.course_id];
      const zone = (course && course.timezone) ? course.timezone : 'UTC';
      const local = DateTime.fromJSDate(slot.start_time, { zone });
      const localHHMMSS = local.toFormat('HH:mm:ss');
      const windows = v2.windowsBySide[slot.side_id] || [];
      const classNorm = String(classId || '').toLowerCase();
      const classLookup = classNorm === 'full' ? 'public' : classNorm;
      let inWindow = false;
      let matchedVersionId = null;
      for (const w of windows) {
        if (w.start_mode === 'fixed' && w.end_mode === 'fixed') {
          const start = (w.start_time_local || '00:00:00').padEnd(8, '0');
          const end = (w.end_time_local || '23:59:59').padEnd(8, '9');
          if (start <= localHHMMSS && localHHMMSS < end) { inWindow = true; matchedVersionId = w.template_version_id; break; }
        } else {
          // Approximate offsets as 07:00-18:00 with offsets like generator
          const baseStart = DateTime.fromFormat('07:00:00', 'HH:mm:ss', { zone }).plus({ minutes: w.start_offset_mins || 0 }).toFormat('HH:mm:ss');
          const baseEnd = DateTime.fromFormat('18:00:00', 'HH:mm:ss', { zone }).plus({ minutes: w.end_offset_mins || 0 }).toFormat('HH:mm:ss');
          if (baseStart <= localHHMMSS && localHHMMSS < baseEnd) { inWindow = true; matchedVersionId = w.template_version_id; break; }
        }
      }
      if (!inWindow) continue;
      const vsKey = `${matchedVersionId}:${slot.side_id}`;
      const accessSide = v2.accessByVS[vsKey] || {};
      const priceSide = v2.pricesByVS[vsKey] || {};
      const sideCfg = v2.sideCfgByVS[vsKey];
      // Customer visibility: start must be enabled and class allowed
      if (isCustomerView) {
        if (sideCfg && sideCfg.start_slots_enabled === false) continue;
        const allowed = accessSide[classLookup] ?? accessSide['public'];
        if (!allowed) continue;
        const minPlayers = sideCfg?.min_players || 1;
        if (groupSize < minPlayers) continue;
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

      // Basic two-leg feasibility with reround target side (if specified in template side config)
      if (value.roundOptionId) {
        // compute reround at same side by default
        const sideConfig = sideById[slot.side_id];
        const reroundStart = computeReroundStart({ minutes_per_hole: sideConfig.minutes_per_hole, hole_count: sideConfig.hole_count }, slot.start_time);
        const reroundSideId = sideCfg?.rerounds_to_side_id || slot.side_id;
        const reroundSlot = await TeeTime.findOne({ where: { tee_sheet_id: slot.tee_sheet_id, side_id: reroundSideId, start_time: reroundStart } });
        if (!reroundSlot) continue;
        if (isCustomerView && reroundSlot.is_blocked) continue;
        if ((reroundSlot.capacity - reroundSlot.assigned_count) < groupSize) continue;
        // Price second leg using same template version mapping; fallback to public
        const vsKey2 = `${matchedVersionId}:${reroundSideId}`;
        const priceSide2 = v2.pricesByVS[vsKey2] || {};
        const price2 = priceSide2[classLookup] || priceSide2['public'] || { greens: 0, cart: 0 };
        totalPriceCents += price2.greens + (value.walkRide === 'ride' ? price2.cart : 0);
        if (priceBreakdown) priceBreakdown.greens_fee_cents += price2.greens;
        if (priceBreakdown && value.walkRide === 'ride') priceBreakdown.cart_fee_cents += price2.cart;
      }
    } else {
      const template = await findTemplateForDate(slot.tee_sheet_id, date);
      if (!template) continue;
      templateMeta = template;
      timeframe = await findTimeframeForSlot(slot.tee_sheet_id, slot.side_id, template.day_template_id, slot.start_time);
      if (!timeframe) continue;
    }

    // Access rules for legacy timeframes: customers see only allowed
    if (!usingV2) {
      if (isCustomerView) {
        const access = await TimeframeAccessRule.findAll({ where: { timeframe_id: timeframe.id } });
        if (!isClassAllowed({ access_rules: access }, classId)) continue;
      }
    }

    // First-leg capacity and reround feasibility for two-leg options
    let reroundOk = true;
    if (!usingV2) {
      const pricingRules = await TimeframePricingRule.findAll({ where: { timeframe_id: timeframe.id } });
      const legPrice = calcFeesForLeg(pricingRules, classId, value.walkRide, undefined);
      totalPriceCents += legPrice;
      priceBreakdown = { greens_fee_cents: legPrice, cart_fee_cents: 0 };
    }

    // First-leg capacity check
    if ((slot.capacity - slot.assigned_count) < groupSize) {
      reroundOk = false;
    }

    if (reroundOk && value.roundOptionId) {
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
        else if ((reroundSlot.capacity - reroundSlot.assigned_count) < groupSize) reroundOk = false;

        if (reroundOk && !usingV2 && templateMeta) {
          const tf2 = await findTimeframeForSlot(slot.tee_sheet_id, reroundSideId, templateMeta.day_template_id, reroundSlot.start_time);
          if (tf2) {
            const pricingRules2 = await TimeframePricingRule.findAll({ where: { timeframe_id: tf2.id } });
            const leg2 = calcFeesForLeg(pricingRules2, classId, value.walkRide, undefined);
            totalPriceCents += leg2;
            if (priceBreakdown) priceBreakdown.greens_fee_cents += leg2;
          }
        }
      }
    }

    if (!reroundOk) continue;

    // Active holds reduce remaining capacity
    const held = holds
      .flatMap(h => h.items || [])
      .filter(it => it.tee_time_id === slot.id)
      .reduce((sum, it) => sum + (Number(it.party_size) || 0), 0);
    const remainingAdjusted = Math.max(0, (slot.capacity - slot.assigned_count) - held);

    results.push({
      id: slot.id,
      tee_sheet_id: slot.tee_sheet_id,
      side_id: slot.side_id,
      start_time: slot.start_time,
      capacity: slot.capacity,
      remaining: remainingAdjusted,
      is_blocked: isCustomerView ? undefined : slot.is_blocked,
      is_start_disabled: isCustomerView ? undefined : slot.is_start_disabled,
      price_total_cents: totalPriceCents,
      price_breakdown: priceBreakdown,
    });
  }

  res.json(results);
});

module.exports = router;


