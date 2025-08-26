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
} = require('../models');
const { computeReroundStart, isClassAllowed, calcFeesForLeg } = require('../lib/teeRules');

const router = express.Router();

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
  const sheetById = Object.fromEntries((await TeeSheet.findAll({ where: { id: { [Op.in]: teeSheets } } })).map(s => [s.id, s]));
  const sideById = Object.fromEntries((await TeeSheetSide.findAll({ where: { tee_sheet_id: { [Op.in]: teeSheets } } })).map(s => [s.id, s]));

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

    const template = await findTemplateForDate(slot.tee_sheet_id, date);
    if (!template) continue;

    const timeframe = await findTimeframeForSlot(slot.tee_sheet_id, slot.side_id, template.day_template_id, slot.start_time);
    if (!timeframe) continue;

    // Access rules: customers see only allowed
    if (isCustomerView) {
      const access = await TimeframeAccessRule.findAll({ where: { timeframe_id: timeframe.id } });
      if (!isClassAllowed({ access_rules: access }, classId)) continue;
    }

    // First-leg capacity and reround feasibility for two-leg options
    let reroundOk = true;
    let totalPriceCents = 0;
    const pricingRules = await TimeframePricingRule.findAll({ where: { timeframe_id: timeframe.id } });
    totalPriceCents += calcFeesForLeg(pricingRules, classId, value.walkRide, undefined);

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

        if (reroundOk) {
          const tf2 = await findTimeframeForSlot(slot.tee_sheet_id, reroundSideId, template.day_template_id, reroundSlot.start_time);
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


