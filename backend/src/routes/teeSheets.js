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
  // V2 models
  TeeSheetTemplate,
  TeeSheetTemplateVersion,
  TeeSheetTemplateSide,
  TeeSheetTemplateSideAccess,
  TeeSheetTemplateSidePrices,
  TeeSheetSeason,
  TeeSheetSeasonVersion,
  TeeSheetSeasonWeekdayWindow,
  TeeSheetOverride,
  TeeSheetOverrideVersion,
  TeeSheetOverrideWindow,
} = require('../models');

const router = express.Router();
const { DateTime } = require('luxon');
const { generateForDateV2 } = require('../services/teeSheetGenerator.v2');
const { prevalidateSeasonVersion } = require('../services/seasonPrevalidation');
const { regenerateApplyNow } = require('../services/cascadeEngine');

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
  hole_count: Joi.number().integer().min(1).default(9),
  interval_mins: Joi.number().integer().min(1).max(60).default(8),
  start_slots_enabled: Joi.boolean().default(true),
  sunrise_offset_mins: Joi.number().integer().min(-180).max(180).default(0),
  sunset_offset_mins: Joi.number().integer().min(-180).max(180).default(0),
});

// Allow partial updates for name / hole_count / valid_to etc.
const sideUpdateSchema = Joi.object({
  name: Joi.string().min(1).optional(),
  hole_count: Joi.number().integer().min(1).optional(),
  valid_to: Joi.date().iso().allow(null),
}).min(1);

const templateSchema = Joi.object({
  name: Joi.string().min(1).required(),
  description: Joi.string().allow('', null),
});

// V2 template schemas
const v2TemplateCreateSchema = Joi.object({
  interval_mins: Joi.number().integer().min(1).max(60).default(10),
});

const v2TemplateVersionCreateSchema = Joi.object({
  notes: Joi.string().allow('', null),
});

const v2TemplatePublishSchema = Joi.object({
  version_id: Joi.string().uuid().required(),
  apply_now: Joi.boolean().default(false),
  start_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// V2 season schemas
const v2SeasonCreateSchema = Joi.object({});
const v2SeasonVersionCreateSchema = Joi.object({
  start_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  end_date_exclusive: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  notes: Joi.string().allow('', null),
});
const v2SeasonWeekdayWindowSchema = Joi.object({
  weekday: Joi.number().integer().min(0).max(6).required(),
  start_mode: Joi.string().valid('fixed', 'sunrise_offset').required(),
  end_mode: Joi.string().valid('fixed', 'sunset_offset').required(),
  start_time_local: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null),
  end_time_local: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null),
  start_offset_mins: Joi.number().integer().allow(null),
  end_offset_mins: Joi.number().integer().allow(null),
  template_version_id: Joi.string().uuid().required(),
});
const v2SeasonWeekdayReorderSchema = Joi.object({
  weekday: Joi.number().integer().min(0).max(6).required(),
  order: Joi.array().items(Joi.string().uuid()).min(1).required(),
});
const v2SeasonPublishSchema = Joi.object({ version_id: Joi.string().uuid().required(), apply_now: Joi.boolean().default(false), start_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(), end_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional() });

// V2 override schemas
const v2OverrideCreateSchema = Joi.object({ date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required() });
const v2OverrideVersionCreateSchema = Joi.object({ notes: Joi.string().allow('', null) });
const v2OverrideWindowSchema = Joi.object({
  side_id: Joi.string().uuid().required(),
  start_mode: Joi.string().valid('fixed', 'sunrise_offset').required(),
  end_mode: Joi.string().valid('fixed', 'sunset_offset').required(),
  start_time_local: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null),
  end_time_local: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null),
  start_offset_mins: Joi.number().integer().allow(null),
  end_offset_mins: Joi.number().integer().allow(null),
  template_version_id: Joi.string().uuid().required(),
});
const v2OverridePublishSchema = Joi.object({ version_id: Joi.string().uuid().required(), apply_now: Joi.boolean().default(false) });

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

router.put('/tee-sheets/:id/sides/:sideId', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = sideUpdateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const side = await TeeSheetSide.findOne({ where: { id: req.params.sideId, tee_sheet_id: sheet.id } });
  if (!side) return res.status(404).json({ error: 'Side not found' });
  await side.update(value);
  res.json(side);
});

// V1 (legacy) DayTemplates
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

// V2 Templates API
router.get('/tee-sheets/:id/v2/templates', requireAuth(['Admin', 'Manager', 'SuperAdmin']), async (req, res) => {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const items = await TeeSheetTemplate.findAll({
    where: { tee_sheet_id: sheet.id },
    include: [{ model: TeeSheetTemplateVersion, as: 'versions' }, { model: TeeSheetTemplateVersion, as: 'published_version' }],
    order: [['created_at', 'ASC']],
  });
  res.json(items);
});

router.post('/tee-sheets/:id/v2/templates', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2TemplateCreateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const created = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: value.interval_mins });
  res.status(201).json(created);
});

router.post('/tee-sheets/:id/v2/templates/:templateId/versions', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2TemplateVersionCreateSchema.validate(req.body || {});
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const tmpl = await TeeSheetTemplate.findOne({ where: { id: req.params.templateId, tee_sheet_id: sheet.id } });
  if (!tmpl) return res.status(404).json({ error: 'Template not found' });
  const maxRow = await TeeSheetTemplateVersion.findOne({
    where: { template_id: tmpl.id },
    order: [['version_number', 'DESC']],
  });
  const next = (maxRow?.version_number || 0) + 1;
  const created = await TeeSheetTemplateVersion.create({ template_id: tmpl.id, version_number: next, notes: value.notes || null });
  res.status(201).json(created);
});

router.post('/tee-sheets/:id/v2/templates/:templateId/publish', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2TemplatePublishSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const tmpl = await TeeSheetTemplate.findOne({ where: { id: req.params.templateId, tee_sheet_id: sheet.id } });
  if (!tmpl) return res.status(404).json({ error: 'Template not found' });
  const ver = await TeeSheetTemplateVersion.findOne({ where: { id: value.version_id, template_id: tmpl.id } });
  if (!ver) return res.status(404).json({ error: 'Version not found' });
  try {
    tmpl.published_version_id = ver.id;
    tmpl.status = 'published';
    await tmpl.save();
    if (value.apply_now) {
      const today = DateTime.now().toISODate();
      await regenerateApplyNow({ teeSheetId: sheet.id, startDateISO: value.start_date || today, endDateISO: value.end_date || today });
    }
    const reloaded = await TeeSheetTemplate.findByPk(tmpl.id, {
      include: [{ model: TeeSheetTemplateVersion, as: 'versions' }, { model: TeeSheetTemplateVersion, as: 'published_version' }],
    });
    res.json(reloaded);
  } catch (e) {
    const status = e.status || 400;
    res.status(status).json({ error: e.message || 'Publish failed' });
  }
});

// V2 Seasons API
router.get('/tee-sheets/:id/v2/seasons', requireAuth(['Admin', 'Manager', 'SuperAdmin']), async (req, res) => {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const items = await TeeSheetSeason.findAll({
    where: { tee_sheet_id: sheet.id },
    include: [{ model: TeeSheetSeasonVersion, as: 'versions' }, { model: TeeSheetSeasonVersion, as: 'published_version' }],
    order: [['created_at', 'ASC']],
  });
  res.json(items);
});

router.post('/tee-sheets/:id/v2/seasons', requireAuth(['Admin']), async (req, res) => {
  const { error } = v2SeasonCreateSchema.validate(req.body || {});
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const created = await TeeSheetSeason.create({ tee_sheet_id: sheet.id, status: 'draft' });
  res.status(201).json(created);
});

router.post('/tee-sheets/:id/v2/seasons/:seasonId/versions', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2SeasonVersionCreateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const season = await TeeSheetSeason.findOne({ where: { id: req.params.seasonId, tee_sheet_id: sheet.id } });
  if (!season) return res.status(404).json({ error: 'Season not found' });
  const created = await TeeSheetSeasonVersion.create({ season_id: season.id, start_date: value.start_date, end_date_exclusive: value.end_date_exclusive, notes: value.notes || null });
  res.status(201).json(created);
});

router.post('/tee-sheets/:id/v2/seasons/:seasonId/versions/:versionId/weekday-windows', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2SeasonWeekdayWindowSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const season = await TeeSheetSeason.findOne({ where: { id: req.params.seasonId, tee_sheet_id: sheet.id } });
  if (!season) return res.status(404).json({ error: 'Season not found' });
  const version = await TeeSheetSeasonVersion.findOne({ where: { id: req.params.versionId, season_id: season.id } });
  if (!version) return res.status(404).json({ error: 'Season version not found' });
  // Compute next position for this weekday
  const [[{ max_pos }]] = await sequelize.query(
    'SELECT COALESCE(MAX(position), -1) AS max_pos FROM "TeeSheetSeasonWeekdayWindows" WHERE season_version_id = :vid AND weekday = :wd',
    { replacements: { vid: version.id, wd: value.weekday } }
  );
  const nextPos = (max_pos === null || max_pos === -1) ? 0 : (parseInt(max_pos, 10) + 1);
  const created = await TeeSheetSeasonWeekdayWindow.create({
    season_version_id: version.id,
    weekday: value.weekday,
    position: nextPos,
    start_mode: value.start_mode,
    end_mode: value.end_mode,
    start_time_local: value.start_time_local || null,
    end_time_local: value.end_time_local || null,
    start_offset_mins: value.start_offset_mins || null,
    end_offset_mins: value.end_offset_mins || null,
    template_version_id: value.template_version_id,
  });
  res.status(201).json(created);
});

router.patch('/tee-sheets/:id/v2/seasons/:seasonId/versions/:versionId/weekday-windows/reorder', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2SeasonWeekdayReorderSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const season = await TeeSheetSeason.findOne({ where: { id: req.params.seasonId, tee_sheet_id: sheet.id } });
  if (!season) return res.status(404).json({ error: 'Season not found' });
  const version = await TeeSheetSeasonVersion.findOne({ where: { id: req.params.versionId, season_id: season.id } });
  if (!version) return res.status(404).json({ error: 'Season version not found' });

  // Fetch existing window ids for weekday
  const existing = await TeeSheetSeasonWeekdayWindow.findAll({
    where: { season_version_id: version.id, weekday: value.weekday },
    order: [['position', 'ASC']],
  });
  const existingIds = existing.map(w => w.id);
  // Validate set equality
  const requested = value.order;
  if (existingIds.length !== requested.length || existingIds.some(id => !requested.includes(id))) {
    return res.status(400).json({ error: 'Reorder must include all and only existing windows for the weekday' });
  }

  const tx = await sequelize.transaction();
  try {
    // Temporarily shift all positions to avoid unique constraint conflicts during reorder
    await TeeSheetSeasonWeekdayWindow.update(
      { position: Sequelize.literal('position + 1000') },
      { where: { season_version_id: version.id, weekday: value.weekday }, transaction: tx }
    );
    for (let i = 0; i < requested.length; i++) {
      const id = requested[i];
      await TeeSheetSeasonWeekdayWindow.update(
        { position: i },
        { where: { id, season_version_id: version.id, weekday: value.weekday }, transaction: tx }
      );
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    return res.status(400).json({ error: e.message || 'Failed to reorder windows' });
  }

  const reloaded = await TeeSheetSeasonWeekdayWindow.findAll({
    where: { season_version_id: version.id, weekday: value.weekday },
    order: [['position', 'ASC']],
  });
  res.json({ success: true, windows: reloaded });
});

router.post('/tee-sheets/:id/v2/seasons/:seasonId/publish', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2SeasonPublishSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const season = await TeeSheetSeason.findOne({ where: { id: req.params.seasonId, tee_sheet_id: sheet.id } });
  if (!season) return res.status(404).json({ error: 'Season not found' });
  const ver = await TeeSheetSeasonVersion.findOne({ where: { id: value.version_id, season_id: season.id } });
  if (!ver) return res.status(404).json({ error: 'Season version not found' });
  // Pre-validate season version across its date range
  const result = await prevalidateSeasonVersion({ teeSheetId: sheet.id, seasonVersionId: ver.id });
  if (!result.ok) {
    return res.status(400).json({ error: 'Prevalidation failed', violations: result.violations });
  }
  try {
    season.published_version_id = ver.id;
    season.status = 'published';
    await season.save();
    if (value.apply_now) {
      const startIso = value.start_date || ver.start_date;
      const endIso = value.end_date || ver.end_date_exclusive;
      await regenerateApplyNow({ teeSheetId: sheet.id, startDateISO: startIso, endDateISO: endIso });
    }
    const reloaded = await TeeSheetSeason.findByPk(season.id, { include: [{ model: TeeSheetSeasonVersion, as: 'versions' }, { model: TeeSheetSeasonVersion, as: 'published_version' }] });
    res.json(reloaded);
  } catch (e) {
    const status = e.status || 400;
    res.status(status).json({ error: e.message || 'Publish failed' });
  }
});

// V2 Overrides API
router.get('/tee-sheets/:id/v2/overrides', requireAuth(['Admin', 'Manager', 'SuperAdmin']), async (req, res) => {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const items = await TeeSheetOverride.findAll({
    where: { tee_sheet_id: sheet.id },
    include: [{ model: TeeSheetOverrideVersion, as: 'versions' }, { model: TeeSheetOverrideVersion, as: 'published_version' }],
    order: [['date', 'ASC']],
  });
  res.json(items);
});

router.post('/tee-sheets/:id/v2/overrides', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2OverrideCreateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  try {
    const created = await TeeSheetOverride.create({ tee_sheet_id: sheet.id, status: 'draft', date: value.date });
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Failed to create override' });
  }
});

router.post('/tee-sheets/:id/v2/overrides/:overrideId/versions', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2OverrideVersionCreateSchema.validate(req.body || {});
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const ov = await TeeSheetOverride.findOne({ where: { id: req.params.overrideId, tee_sheet_id: sheet.id } });
  if (!ov) return res.status(404).json({ error: 'Override not found' });
  const created = await TeeSheetOverrideVersion.create({ override_id: ov.id, notes: value.notes || null });
  res.status(201).json(created);
});

router.post('/tee-sheets/:id/v2/overrides/:overrideId/versions/:versionId/windows', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2OverrideWindowSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const ov = await TeeSheetOverride.findOne({ where: { id: req.params.overrideId, tee_sheet_id: sheet.id } });
  if (!ov) return res.status(404).json({ error: 'Override not found' });
  const ver = await TeeSheetOverrideVersion.findOne({ where: { id: req.params.versionId, override_id: ov.id } });
  if (!ver) return res.status(404).json({ error: 'Override version not found' });
  const created = await TeeSheetOverrideWindow.create({
    override_version_id: ver.id,
    side_id: value.side_id,
    start_mode: value.start_mode,
    end_mode: value.end_mode,
    start_time_local: value.start_time_local || null,
    end_time_local: value.end_time_local || null,
    start_offset_mins: value.start_offset_mins || null,
    end_offset_mins: value.end_offset_mins || null,
    template_version_id: value.template_version_id,
  });
  res.status(201).json(created);
});

router.post('/tee-sheets/:id/v2/overrides/:overrideId/publish', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2OverridePublishSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const ov = await TeeSheetOverride.findOne({ where: { id: req.params.overrideId, tee_sheet_id: sheet.id } });
  if (!ov) return res.status(404).json({ error: 'Override not found' });
  const ver = await TeeSheetOverrideVersion.findOne({ where: { id: value.version_id, override_id: ov.id } });
  if (!ver) return res.status(404).json({ error: 'Override version not found' });
  try {
    ov.published_version_id = ver.id;
    ov.status = 'published';
    await ov.save();
    if (value.apply_now) {
      await regenerateApplyNow({ teeSheetId: sheet.id, startDateISO: ov.date, endDateISO: ov.date });
    }
    const reloaded = await TeeSheetOverride.findByPk(ov.id, { include: [{ model: TeeSheetOverrideVersion, as: 'versions' }, { model: TeeSheetOverrideVersion, as: 'published_version' }] });
    res.json(reloaded);
  } catch (e) {
    const status = e.status || 400;
    res.status(status).json({ error: e.message || 'Publish failed' });
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


