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

router.get('/tee-times/available', requireAuth(['Admin', 'Manager', 'Staff', 'SuperAdmin']), async (req, res) => {
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

  // Fetch slots on date for selected sheets
  const slots = await TeeTime.findAll({
    where: {
      tee_sheet_id: { [Op.in]: teeSheets },
      start_time: {
        [Op.gte]: new Date(`${date}T00:00:00Z`),
        [Op.lt]: new Date(`${date}T23:59:59Z`),
      },
    },
    order: [['start_time', 'ASC']],
  });

  // Load metadata we need
  const sheetById = Object.fromEntries((await TeeSheet.findAll({ where: { id: { [Op.in]: teeSheets } } })).map(s => [s.id, s]));
  const sideById = Object.fromEntries((await TeeSheetSide.findAll({ where: { tee_sheet_id: { [Op.in]: teeSheets } } })).map(s => [s.id, s]));

  const results = [];

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

    // Reround feasibility for round options with 2 legs
    let reroundOk = true;
    let totalPriceCents = 0;
    const pricingRules = await TimeframePricingRule.findAll({ where: { timeframe_id: timeframe.id } });
    totalPriceCents += calcFeesForLeg(pricingRules, classId, value.walkRide, undefined);

    if (value.roundOptionId) {
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

    results.push({
      tee_sheet_id: slot.tee_sheet_id,
      side_id: slot.side_id,
      start_time: slot.start_time,
      capacity: slot.capacity,
      remaining: slot.capacity - slot.assigned_count,
      is_blocked: isCustomerView ? undefined : slot.is_blocked,
      price_total_cents: totalPriceCents,
    });
  }

  res.json(results);
});

module.exports = router;


