'use strict';

const express = require('express');
const Joi = require('joi');
const { Op, Sequelize } = require('sequelize');
const { requireAuth } = require('../middleware/auth');
const {
  TeeSheet,
  TeeSheetSide,
  DayTemplate,
  Timeframe,
  TimeframeAccessRule,
  TimeframePricingRule,
  TimeframeRoundOption,
  TimeframeRoundLegOption,
  TimeframeMinPlayers,
  TimeframeMode,
  CalendarAssignment,
  ClosureBlock,
  sequelize,
} = require('../models');

const router = express.Router();
const { DateTime } = require('luxon');

// Validation schemas
const teeSheetSchema = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  description: Joi.string().allow('', null),
  is_active: Joi.boolean().optional(),
});

const sideSchema = Joi.object({
  name: Joi.string().min(1).required(),
  valid_from: Joi.date().iso().required(),
  valid_to: Joi.date().iso().allow(null),
  minutes_per_hole: Joi.number().integer().min(1).max(30).default(12),
  hole_count: Joi.number().integer().valid(9, 18).default(9),
  interval_mins: Joi.number().integer().min(1).max(60).default(8),
  start_slots_enabled: Joi.boolean().default(true),
  sunrise_offset_mins: Joi.number().integer().min(-180).max(180).default(0),
  sunset_offset_mins: Joi.number().integer().min(-180).max(180).default(0),
});

const templateSchema = Joi.object({
  name: Joi.string().min(1).required(),
  description: Joi.string().allow('', null),
});

const timeframeSchema = Joi.object({
  side_id: Joi.string().uuid().required(),
  start_time_local: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required(),
  end_time_local: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required(),
  interval_mins: Joi.number().integer().min(1).max(60).default(8),
  start_slots_enabled: Joi.boolean().default(true),
  access_rules: Joi.array()
    .items(
      Joi.object({
        booking_class_id: Joi.string().min(1).required(),
        is_allowed: Joi.boolean().required(),
      })
    )
    .default([]),
  pricing_rules: Joi.array()
    .items(
      Joi.object({
        booking_class_id: Joi.string().min(1).required(),
        walk_fee_cents: Joi.number().integer().min(0).default(0),
        ride_fee_cents: Joi.number().integer().min(0).default(0),
        combine_fees: Joi.boolean().default(false),
      })
    )
    .default([]),
  min_players: Joi.object({ min_players: Joi.number().integer().min(1).max(4).required() }).optional(),
  mode: Joi.object({ mode: Joi.string().valid('Standard', 'Shotgun', 'Blocked').required() }).optional(),
  round_options: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        leg_count: Joi.number().integer().min(1).max(2).default(1),
        leg_options: Joi.array()
          .items(
            Joi.object({
              leg_index: Joi.number().integer().min(0).max(1).required(),
              hole_count: Joi.number().integer().valid(9, 18).default(9),
              side_id: Joi.string().uuid().allow(null),
            })
          )
          .default([]),
      })
    )
    .default([]),
});

const calendarSchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  day_template_id: Joi.string().uuid().required(),
  recurring: Joi.object({
    start_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    end_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    days: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).required(),
  }).optional(),
  overrides: Joi.array()
    .items(
      Joi.object({
        date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
        day_template_id: Joi.string().uuid().required(),
      })
    )
    .default([]),
}).xor('date', 'recurring');

const closureSchema = Joi.object({
  side_id: Joi.string().uuid().allow(null),
  starts_at: Joi.date().iso().required(),
  ends_at: Joi.date().iso().greater(Joi.ref('starts_at')).required(),
  reason: Joi.string().allow('', null),
});

// Helpers
function normalizeTime(t) {
  return t.length === 5 ? `${t}:00` : t;
}

async function ensureNoOverlap({ tee_sheet_id, side_id, day_template_id, start_time_local, end_time_local }) {
  const start = normalizeTime(start_time_local);
  const end = normalizeTime(end_time_local);

  if (end <= start) {
    const err = new Error('end_time_local must be after start_time_local');
    err.status = 400;
    throw err;
  }

  const conflict = await Timeframe.findOne({
    where: {
      tee_sheet_id,
      side_id,
      day_template_id,
      start_time_local: { [Op.lt]: end },
      end_time_local: { [Op.gt]: start },
    },
  });
  if (conflict) {
    const err = new Error('Timeframe overlaps existing timeframe for side');
    err.status = 400;
    throw err;
  }
}

// Routes
router.get('/tee-sheets', requireAuth(['Admin', 'Manager', 'SuperAdmin']), async (req, res) => {
  const items = await TeeSheet.findAll({ where: { course_id: req.userRole === 'SuperAdmin' ? { [Op.ne]: null } : req.courseId } });
  res.json(items);
});

router.post('/tee-sheets', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = teeSheetSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const created = await TeeSheet.create({ ...value, course_id: req.courseId });
  res.status(201).json(created);
});

router.put('/tee-sheets/:id', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = teeSheetSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Not found' });
  await sheet.update(value);
  res.json(sheet);
});

router.get('/tee-sheets/:id/sides', requireAuth(['Admin', 'Manager', 'SuperAdmin']), async (req, res) => {
  const where = { tee_sheet_id: req.params.id };
  res.json(await TeeSheetSide.findAll({ where, order: [['valid_from', 'ASC']] }));
});

router.post('/tee-sheets/:id/sides', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = sideSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  // Insert-only effective-dated
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const created = await TeeSheetSide.create({ ...value, tee_sheet_id: sheet.id });
  res.status(201).json(created);
});

router.get('/tee-sheets/:id/templates', requireAuth(['Admin', 'Manager', 'SuperAdmin']), async (req, res) => {
  const where = { tee_sheet_id: req.params.id };
  res.json(await DayTemplate.findAll({ where, order: [['created_at', 'ASC']] }));
});

router.post('/tee-sheets/:id/templates', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = templateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const created = await DayTemplate.create({ ...value, tee_sheet_id: sheet.id });
  res.status(201).json(created);
});

router.put('/tee-sheets/:id/templates/:templateId', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = templateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const template = await DayTemplate.findOne({ where: { id: req.params.templateId, tee_sheet_id: req.params.id } });
  if (!template) return res.status(404).json({ error: 'Template not found' });
  await template.update(value);
  res.json(template);
});

router.get('/tee-sheets/:id/templates/:templateId/timeframes', requireAuth(['Admin', 'Manager', 'SuperAdmin']), async (req, res) => {
  const where = { tee_sheet_id: req.params.id, day_template_id: req.params.templateId };
  const items = await Timeframe.findAll({
    where,
    include: [
      { model: TimeframeAccessRule, as: 'access_rules' },
      { model: TimeframePricingRule, as: 'pricing_rules' },
      { model: TimeframeRoundOption, as: 'round_options', include: [{ model: TimeframeRoundLegOption, as: 'leg_options' }] },
      { model: TimeframeMinPlayers, as: 'min_players' },
      { model: TimeframeMode, as: 'mode' },
    ],
    order: [['start_time_local', 'ASC']],
  });
  res.json(items);
});

router.post('/tee-sheets/:id/templates/:templateId/timeframes', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = timeframeSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const template = await DayTemplate.findOne({ where: { id: req.params.templateId, tee_sheet_id: sheet.id } });
  if (!template) return res.status(404).json({ error: 'Template not found' });

  try {
    await ensureNoOverlap({
      tee_sheet_id: sheet.id,
      side_id: value.side_id,
      day_template_id: template.id,
      start_time_local: value.start_time_local,
      end_time_local: value.end_time_local,
    });
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ error: e.message || 'Overlap validation failed' });
  }

  const tx = await sequelize.transaction();
  try {
    const tf = await Timeframe.create(
      {
        tee_sheet_id: sheet.id,
        side_id: value.side_id,
        day_template_id: template.id,
        start_time_local: normalizeTime(value.start_time_local),
        end_time_local: normalizeTime(value.end_time_local),
        interval_mins: value.interval_mins,
        start_slots_enabled: value.start_slots_enabled,
      },
      { transaction: tx }
    );

    if (value.access_rules?.length) {
      await TimeframeAccessRule.bulkCreate(
        value.access_rules.map(r => ({ ...r, timeframe_id: tf.id })),
        { transaction: tx }
      );
    }
    if (value.pricing_rules?.length) {
      await TimeframePricingRule.bulkCreate(
        value.pricing_rules.map(r => ({ ...r, timeframe_id: tf.id })),
        { transaction: tx }
      );
    }
    if (value.min_players) {
      await TimeframeMinPlayers.create({ ...value.min_players, timeframe_id: tf.id }, { transaction: tx });
    }
    if (value.mode) {
      await TimeframeMode.create({ ...value.mode, timeframe_id: tf.id }, { transaction: tx });
    }
    if (value.round_options?.length) {
      for (const ro of value.round_options) {
        const createdRo = await TimeframeRoundOption.create(
          { timeframe_id: tf.id, name: ro.name, leg_count: ro.leg_count },
          { transaction: tx }
        );
        if (ro.leg_options?.length) {
          await TimeframeRoundLegOption.bulkCreate(
            ro.leg_options.map(lo => ({ ...lo, round_option_id: createdRo.id })),
            { transaction: tx }
          );
        }
      }
    }

    await tx.commit();

    const reloaded = await Timeframe.findByPk(tf.id, {
      include: [
        { model: TimeframeAccessRule, as: 'access_rules' },
        { model: TimeframePricingRule, as: 'pricing_rules' },
        { model: TimeframeRoundOption, as: 'round_options', include: [{ model: TimeframeRoundLegOption, as: 'leg_options' }] },
        { model: TimeframeMinPlayers, as: 'min_players' },
        { model: TimeframeMode, as: 'mode' },
      ],
    });
    res.status(201).json(reloaded);
  } catch (e) {
    await tx.rollback();
    const status = e.status || 500;
    res.status(status).json({ error: e.message || 'Failed to create timeframe' });
  }
});

module.exports = router;

// Calendar assignment (recurring + overrides), and closures
router.post('/tee-sheets/:id/calendar', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = calendarSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });

  const targetDates = new Set();
  if (value.date) {
    targetDates.add(value.date);
  }
  if (value.recurring) {
    const start = DateTime.fromISO(value.recurring.start_date, { zone: 'UTC' });
    const end = DateTime.fromISO(value.recurring.end_date, { zone: 'UTC' });
    for (let d = start; d <= end; d = d.plus({ days: 1 })) {
      if (value.recurring.days.includes(d.weekday % 7)) {
        targetDates.add(d.toISODate());
      }
    }
  }
  for (const ov of value.overrides || []) {
    targetDates.add(ov.date);
  }

  // Check bookings exist on any target date
  const datesArr = Array.from(targetDates);
  if (datesArr.length === 0) return res.status(400).json({ error: 'No dates provided' });

  // Detect booked tee times on any of the dates
  const bookedConflict = await sequelize.query(
    `SELECT tt.start_time::date AS dt
     FROM "TeeTimes" tt
     JOIN "TeeTimeAssignments" tta ON tta.tee_time_id = tt.id
     WHERE tt.tee_sheet_id = :sheetId AND tt.start_time::date IN (:dates)
     LIMIT 1`,
    {
      replacements: { sheetId: sheet.id, dates: datesArr },
      type: Sequelize.QueryTypes.SELECT,
    }
  );
  if (bookedConflict.length > 0) {
    return res.status(400).json({ error: 'Calendar changes blocked: bookings exist on one or more dates' });
  }

  // Upsert assignments
  const results = [];
  for (const dateStr of datesArr) {
    const override = (value.overrides || []).find(o => o.date === dateStr);
    const dayTemplateId = override ? override.day_template_id : value.day_template_id;
    const [assignment] = await sequelize.transaction(async tx => {
      const existing = await CalendarAssignment.findOne({
        where: { tee_sheet_id: sheet.id, date: dateStr },
        transaction: tx,
      });
      if (existing) {
        await existing.update({ day_template_id: dayTemplateId }, { transaction: tx });
        return [existing];
      }
      const created = await CalendarAssignment.create(
        { tee_sheet_id: sheet.id, date: dateStr, day_template_id: dayTemplateId },
        { transaction: tx }
      );
      return [created];
    });
    results.push({ id: assignment.id, date: dateStr, day_template_id: assignment.day_template_id });
  }

  return res.status(201).json({ assignments: results });
});

router.post('/tee-sheets/:id/closures', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = closureSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });

  // Check for overlapping booked slots
  const params = {
    sheetId: sheet.id,
    starts: new Date(value.starts_at),
    ends: new Date(value.ends_at),
  };
  let sideClause = '';
  if (value.side_id) {
    sideClause = 'AND tt.side_id = :sideId';
    params.sideId = value.side_id;
  }

  const overlap = await sequelize.query(
    `SELECT tt.id
     FROM "TeeTimes" tt
     JOIN "TeeTimeAssignments" tta ON tta.tee_time_id = tt.id
     WHERE tt.tee_sheet_id = :sheetId
       ${sideClause}
       AND tt.start_time < :ends AND tt.start_time >= :starts
     LIMIT 1`,
    { replacements: params, type: Sequelize.QueryTypes.SELECT }
  );

  if (overlap.length > 0) {
    return res.status(400).json({ error: 'Closure overlaps booked slots' });
  }

  const created = await ClosureBlock.create({
    tee_sheet_id: sheet.id,
    side_id: value.side_id || null,
    starts_at: value.starts_at,
    ends_at: value.ends_at,
    reason: value.reason || null,
  });
  return res.status(201).json(created);
});


