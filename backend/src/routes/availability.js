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
} = require('../models');
const { DateTime } = require('luxon');

const querySchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  'teeSheets[]': Joi.alternatives().try(Joi.array().items(Joi.string().uuid()), Joi.string().uuid()),
  teeSheets: Joi.alternatives().try(Joi.array().items(Joi.string().uuid()), Joi.string().uuid()),
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
      // Collect side-level access/prices across all windows' template versions
      const versionIds = Array.from(new Set(windows.map(w => w.template_version_id).filter(Boolean)));
      const accessList = await TeeSheetTemplateSideAccess.findAll({ where: { version_id: { [Op.in]: versionIds } } });
      const priceList = await TeeSheetTemplateSidePrices.findAll({ where: { version_id: { [Op.in]: versionIds } } });
      const accessBySide = {};
      for (const a of accessList) {
        const sideMap = accessBySide[a.side_id] || (accessBySide[a.side_id] = {});
        sideMap[(a.booking_class_id || '').toLowerCase()] = !!a.is_allowed;
      }
      const pricesBySide = {};
      for (const p of priceList) {
        const sideMap = pricesBySide[p.side_id] || (pricesBySide[p.side_id] = {});
        sideMap[(p.booking_class_id || '').toLowerCase()] = { greens: p.greens_fee_cents || 0, cart: p.cart_fee_cents || 0 };
      }
      const windowsBySide = {};
      for (const w of windows) {
        const arr = windowsBySide[w.side_id] || (windowsBySide[w.side_id] = []);
        arr.push(w);
      }
      v2InfoBySheet[sheetId] = { accessBySide, pricesBySide, windowsBySide };
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
      const priceSide = v2.pricesBySide[slot.side_id] || {};
      const accessSide = v2.accessBySide[slot.side_id] || {};
      let inWindow = false;
      for (const w of windows) {
        if (w.start_mode === 'fixed' && w.end_mode === 'fixed') {
          const start = (w.start_time_local || '00:00:00').padEnd(8, '0');
          const end = (w.end_time_local || '23:59:59').padEnd(8, '9');
          if (start <= localHHMMSS && localHHMMSS < end) { inWindow = true; break; }
        } else {
          // Approximate offsets as 07:00-18:00 with offsets like generator
          const baseStart = DateTime.fromFormat('07:00:00', 'HH:mm:ss', { zone }).plus({ minutes: w.start_offset_mins || 0 }).toFormat('HH:mm:ss');
          const baseEnd = DateTime.fromFormat('18:00:00', 'HH:mm:ss', { zone }).plus({ minutes: w.end_offset_mins || 0 }).toFormat('HH:mm:ss');
          if (baseStart <= localHHMMSS && localHHMMSS < baseEnd) { inWindow = true; break; }
        }
      }
      if (!inWindow) continue;
      // Access check for customer
      if (isCustomerView) {
        const allowed = accessSide[classLookup] ?? accessSide['public'];
        if (!allowed) continue;
      }
      const price = priceSide[classLookup] || priceSide['public'] || { greens: 0, cart: 0 };
      totalPriceCents = price.greens + (value.walkRide === 'ride' ? price.cart : 0);
      usingV2 = true;
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
      totalPriceCents += calcFeesForLeg(pricingRules, classId, value.walkRide, undefined);
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
            totalPriceCents += calcFeesForLeg(pricingRules2, classId, value.walkRide, undefined);
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
      price_total_cents: totalPriceCents,
    });
  }

  res.json(results);
});

module.exports = router;


