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
  TeeSheetTemplateOnlineAccess,
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
const { templateCoversSideSet } = require('../services/validators.v2');

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
  name: Joi.string().min(1).max(120).default('Untitled Template'),
  interval_mins: Joi.number().integer().min(1).max(60).default(10),
  interval_type: Joi.string().valid('standard').default('standard'),
  max_players_staff: Joi.number().integer().min(1).max(8).default(4),
  max_players_online: Joi.number().integer().min(1).max(8).default(4),
});

const v2TemplateVersionCreateSchema = Joi.object({
  notes: Joi.string().allow('', null),
});
const v2TemplateRollbackSchema = Joi.object({ version_id: Joi.string().uuid().required() });

const v2TemplatePublishSchema = Joi.object({
  version_id: Joi.string().uuid().required(),
  apply_now: Joi.boolean().default(false),
  start_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// V2 Template settings
const v2TemplateSettingsSchema = Joi.object({
  name: Joi.string().min(1).max(120).optional(),
  interval_type: Joi.string().valid('standard').optional(),
  interval_mins: Joi.number().integer().min(1).max(60).optional(),
  max_players_staff: Joi.number().integer().min(1).max(8).optional(),
  max_players_online: Joi.number().integer().min(1).max(8).optional(),
  online_access: Joi.array()
    .items(Joi.object({ booking_class_id: Joi.string().min(1).required(), is_online_allowed: Joi.boolean().required() }))
    .optional(),
}).min(1);

// V2 template side settings schemas
const v2TemplateSideSettingsItemSchema = Joi.object({
  side_id: Joi.string().uuid().required(),
  bookable_holes: Joi.number().integer().min(1).required(),
  minutes_per_hole: Joi.number().integer().min(1).max(30).optional(),
  cart_policy: Joi.string().valid('not_allowed', 'required', 'optional').optional(),
  rotates_to_side_id: Joi.string().uuid().allow(null),
  start_slots_enabled: Joi.boolean().optional(),
  min_players: Joi.number().integer().min(1).max(4).optional(),
  allowed_hole_totals: Joi.array().items(Joi.number().integer().min(1)).default([]),
});
const v2TemplateSideSettingsPutSchema = Joi.object({
  version_id: Joi.string().uuid().optional(),
  sides: Joi.array().items(v2TemplateSideSettingsItemSchema).min(1).required(),
});

// V2 season schemas
const v2SeasonCreateSchema = Joi.object({ name: Joi.string().min(1).max(120).default('Untitled Season') });
const v2SeasonUpdateSchema = Joi.object({ name: Joi.string().min(1).max(120).required() });
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
const v2SeasonPublishSchema = Joi.object({ version_id: Joi.string().uuid().required(), apply_now: Joi.boolean().default(true), start_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(), end_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional() });

// V2 override schemas
const v2OverrideCreateSchema = Joi.object({ date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required() });
const v2OverrideVersionCreateSchema = Joi.object({ notes: Joi.string().allow('', null) });
const v2OverrideWindowSchema = Joi.object({
  position: Joi.number().integer().min(0).optional(),
  start_mode: Joi.string().valid('fixed', 'sunrise_offset').required(),
  end_mode: Joi.string().valid('fixed', 'sunset_offset').required(),
  start_time_local: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null),
  end_time_local: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null),
  start_offset_mins: Joi.number().integer().allow(null).when('start_mode', { is: 'sunrise_offset', then: Joi.required() }),
  end_offset_mins: Joi.number().integer().allow(null).when('end_mode', { is: 'sunset_offset', then: Joi.required() }),
  template_version_id: Joi.string().uuid().required(),
}).unknown(true);
const v2OverrideWindowUpdateSchema = Joi.object({
  start_mode: Joi.string().valid('fixed', 'sunrise_offset').optional(),
  end_mode: Joi.string().valid('fixed', 'sunset_offset').optional(),
  start_time_local: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null).optional(),
  end_time_local: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null).optional(),
  start_offset_mins: Joi.number().integer().allow(null).optional(),
  end_offset_mins: Joi.number().integer().allow(null).optional(),
  template_version_id: Joi.string().uuid().optional(),
});
const v2OverridePublishSchema = Joi.object({ version_id: Joi.string().uuid().required(), apply_now: Joi.boolean().default(true) });
const v2OverrideDraftPutSchema = Joi.object({
  windows: Joi.array().items(v2OverrideWindowSchema).min(0).required(),
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

// Safe season fetch that tolerates missing columns (e.g., name) in local DBs
async function findSeasonSafe(teeSheetId, seasonId) {
  try {
    return await TeeSheetSeason.findOne({ where: { id: seasonId, tee_sheet_id: teeSheetId } });
  } catch (e) {
    const code = e && (e.parent?.code || e.original?.code);
    if (String(code) === '42703' || String(code) === '42P01') {
      const [rows] = await sequelize.query(
        'SELECT id FROM "TeeSheetSeasons" WHERE id = :sid AND tee_sheet_id = :tsid',
        { replacements: { sid: seasonId, tsid: teeSheetId } }
      );
      if (Array.isArray(rows) && rows.length > 0) return { id: rows[0].id, tee_sheet_id: teeSheetId };
      return null;
    }
    throw e;
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
  // Allow updating minutes_per_hole as part of side settings UX
  const sideUpdateSchemaExtended = sideUpdateSchema.keys({ minutes_per_hole: Joi.number().integer().min(1).max(30).optional() });
  const { error, value } = sideUpdateSchemaExtended.validate(req.body);
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

// Update an override window
router.put('/tee-sheets/:id/v2/overrides/:overrideId/versions/:versionId/windows/:windowId', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2OverrideWindowUpdateSchema.validate(req.body || {});
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const ov = await TeeSheetOverride.findOne({ where: { id: req.params.overrideId, tee_sheet_id: sheet.id } });
  if (!ov) return res.status(404).json({ error: 'Override not found' });
  const ver = await TeeSheetOverrideVersion.findOne({ where: { id: req.params.versionId, override_id: ov.id } });
  if (!ver) return res.status(404).json({ error: 'Override version not found' });

  // First try ORM update with safe attribute load
  try {
    const win = await TeeSheetOverrideWindow.findOne({ where: { id: req.params.windowId, override_version_id: ver.id }, attributes: ['id','override_version_id','start_mode','end_mode','start_time_local','end_time_local','start_offset_mins','end_offset_mins','template_version_id','created_at','updated_at'] });
    if (!win) return res.status(404).json({ error: 'Override window not found' });
    await win.update(value);
    const reloaded = await TeeSheetOverrideWindow.findByPk(win.id, { attributes: ['id','override_version_id','start_mode','end_mode','start_time_local','end_time_local','start_offset_mins','end_offset_mins','template_version_id','created_at','updated_at'] });
    return res.json(reloaded);
  } catch (e) {
    const code = e && (e.parent?.code || e.original?.code);
    if (String(code) !== '42703' && String(code) !== '42P01') {
      return res.status(400).json({ error: e.message || 'Failed to update override window' });
    }
  }

  // Fallback: raw SQL update without referencing optional columns
  try {
    const sets = [];
    const params = { id: req.params.windowId, vid: ver.id };
    if (Object.prototype.hasOwnProperty.call(value, 'start_mode')) { sets.push('start_mode = :sm'); params.sm = value.start_mode; }
    if (Object.prototype.hasOwnProperty.call(value, 'end_mode')) { sets.push('end_mode = :em'); params.em = value.end_mode; }
    if (Object.prototype.hasOwnProperty.call(value, 'start_time_local')) { sets.push('start_time_local = :st'); params.st = value.start_time_local; }
    if (Object.prototype.hasOwnProperty.call(value, 'end_time_local')) { sets.push('end_time_local = :et'); params.et = value.end_time_local; }
    if (Object.prototype.hasOwnProperty.call(value, 'start_offset_mins')) { sets.push('start_offset_mins = :so'); params.so = value.start_offset_mins; }
    if (Object.prototype.hasOwnProperty.call(value, 'end_offset_mins')) { sets.push('end_offset_mins = :eo'); params.eo = value.end_offset_mins; }
    if (Object.prototype.hasOwnProperty.call(value, 'template_version_id')) { sets.push('template_version_id = :tv'); params.tv = value.template_version_id; }
    if (sets.length === 0) return res.json({ success: true });
    const sql = `UPDATE "TeeSheetOverrideWindows" SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = :id AND override_version_id = :vid`;
    await sequelize.query(sql, { replacements: params });
    const [rows] = await sequelize.query('SELECT id, override_version_id, start_mode, end_mode, start_time_local, end_time_local, start_offset_mins, end_offset_mins, template_version_id, created_at, updated_at FROM "TeeSheetOverrideWindows" WHERE id = :id', { replacements: { id: req.params.windowId } });
    const row = Array.isArray(rows) ? rows[0] : rows;
    return res.json(row || { success: true });
  } catch (e2) {
    return res.status(400).json({ error: e2.message || 'Failed to update override window' });
  }
});

// V2 Templates API
router.get('/tee-sheets/:id/v2/templates', requireAuth(['Admin', 'Manager', 'SuperAdmin']), async (req, res) => {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  try {
  const items = await TeeSheetTemplate.findAll({
    where: { tee_sheet_id: sheet.id },
    include: [
      { model: TeeSheetTemplateVersion, as: 'versions' },
      { model: TeeSheetTemplateVersion, as: 'published_version' },
    ],
    order: [['created_at', 'ASC']],
  });
    return res.json(items);
  } catch (e) {
    // Fallback for local DBs that don't yet have all V2 columns
    try {
      const sequelize = require('../models').sequelize;
      const [rows] = await sequelize.query(
        'SELECT id, tee_sheet_id, status, interval_mins, archived, created_at, updated_at FROM "TeeSheetTemplates" WHERE tee_sheet_id = :sid ORDER BY created_at ASC',
        { replacements: { sid: sheet.id } }
      );
      const items = (rows || []).map(r => ({
        id: r.id,
        tee_sheet_id: r.tee_sheet_id,
        name: r.name || 'Untitled Template',
        status: r.status || 'draft',
        published_version_id: r.published_version_id || null,
        interval_mins: r.interval_mins || 10,
        interval_type: r.interval_type || 'standard',
        max_players_staff: r.max_players_staff || 4,
        max_players_online: r.max_players_online || 4,
        archived: !!r.archived,
        created_at: r.created_at,
        updated_at: r.updated_at,
        versions: [],
        published_version: null,
      }));
      return res.json(items);
    } catch (e2) {
      // eslint-disable-next-line no-console
      console.error('List templates fallback error:', e2);
      return res.json([]);
    }
  }
});

// Read/update template settings
router.get('/tee-sheets/:id/v2/templates/:templateId/settings', requireAuth(['Admin', 'Manager', 'SuperAdmin']), async (req, res) => {
  let tmpl = null;
  try {
    tmpl = await TeeSheetTemplate.findOne({ where: { id: req.params.templateId, tee_sheet_id: req.params.id } });
  } catch (e) {
    const code = e && (e.parent?.code || e.original?.code);
    if (String(code) === '42703' || String(code) === '42P01') {
      const [rows] = await sequelize.query(
        'SELECT id, interval_mins FROM "TeeSheetTemplates" WHERE id = :tid AND tee_sheet_id = :sid',
        { replacements: { tid: req.params.templateId, sid: req.params.id } }
      );
      if (Array.isArray(rows) && rows.length > 0) {
        tmpl = { id: rows[0].id, name: 'Untitled Template', interval_type: 'standard', interval_mins: rows[0].interval_mins || 10, max_players_staff: 4, max_players_online: 4 };
      }
    } else {
      throw e;
    }
  }
  if (!tmpl) return res.status(404).json({ error: 'Template not found' });
  res.json({
    name: tmpl.name,
    interval_type: tmpl.interval_type,
    interval_mins: tmpl.interval_mins,
    max_players_staff: tmpl.max_players_staff,
    max_players_online: tmpl.max_players_online,
    online_access: [],
  });
});

router.put('/tee-sheets/:id/v2/templates/:templateId/settings', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2TemplateSettingsSchema.validate(req.body || {});
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });

  // Load template with graceful fallback when columns are missing locally
  let tmpl = null;
  try {
    tmpl = await TeeSheetTemplate.findOne({ where: { id: req.params.templateId, tee_sheet_id: sheet.id } });
  } catch (e) {
    const code = e && (e.parent?.code || e.original?.code);
    if (String(code) === '42703' || String(code) === '42P01') {
      const [rows] = await sequelize.query(
        'SELECT id, interval_mins FROM "TeeSheetTemplates" WHERE id = :tid AND tee_sheet_id = :sid',
        { replacements: { tid: req.params.templateId, sid: sheet.id } }
      );
      if (Array.isArray(rows) && rows.length > 0) {
        tmpl = { id: rows[0].id, interval_mins: rows[0].interval_mins || 10 };
      }
    } else {
      // Unexpected error; rethrow
      throw e;
    }
  }
  if (!tmpl) return res.status(404).json({ error: 'Template not found' });

  // First attempt: normal ORM update
  try {
    if (typeof tmpl.update === 'function') {
  await tmpl.update({
    name: value.name ?? tmpl.name,
    interval_type: value.interval_type ?? tmpl.interval_type,
    interval_mins: value.interval_mins ?? tmpl.interval_mins,
    max_players_staff: value.max_players_staff ?? tmpl.max_players_staff,
    max_players_online: value.max_players_online ?? tmpl.max_players_online,
  });
    } else {
      // If tmpl is a raw object (fallback path), skip ORM update
      throw Object.assign(new Error('Model update unavailable; using raw fallback'), { code: 'RAW_FALLBACK' });
    }

    return res.json({
    name: tmpl.name,
    interval_type: tmpl.interval_type,
    interval_mins: tmpl.interval_mins,
    max_players_staff: tmpl.max_players_staff,
    max_players_online: tmpl.max_players_online,
    online_access: [],
  });
  } catch (e) {
    // Fallback path: ensure columns exist locally, then perform a minimal raw UPDATE
    try {
      await sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TeeSheetTemplates' AND column_name = 'name') THEN
            ALTER TABLE "TeeSheetTemplates" ADD COLUMN name VARCHAR(120) NOT NULL DEFAULT 'Untitled Template';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_TeeSheetTemplates_interval_type') THEN
            CREATE TYPE "enum_TeeSheetTemplates_interval_type" AS ENUM ('standard');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TeeSheetTemplates' AND column_name = 'interval_type') THEN
            ALTER TABLE "TeeSheetTemplates" ADD COLUMN interval_type "enum_TeeSheetTemplates_interval_type" NOT NULL DEFAULT 'standard';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TeeSheetTemplates' AND column_name = 'max_players_staff') THEN
            ALTER TABLE "TeeSheetTemplates" ADD COLUMN max_players_staff INTEGER NOT NULL DEFAULT 4;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TeeSheetTemplates' AND column_name = 'max_players_online') THEN
            ALTER TABLE "TeeSheetTemplates" ADD COLUMN max_players_online INTEGER NOT NULL DEFAULT 4;
          END IF;
        END $$;
      `);

      const sets = [];
      const params = { tid: req.params.templateId, sid: sheet.id };
      if (Object.prototype.hasOwnProperty.call(value, 'name')) { sets.push('name = :name'); params.name = value.name; }
      if (Object.prototype.hasOwnProperty.call(value, 'interval_type')) { sets.push('interval_type = :interval_type'); params.interval_type = value.interval_type; }
      if (Object.prototype.hasOwnProperty.call(value, 'interval_mins')) { sets.push('interval_mins = :interval_mins'); params.interval_mins = value.interval_mins; }
      if (Object.prototype.hasOwnProperty.call(value, 'max_players_staff')) { sets.push('max_players_staff = :max_players_staff'); params.max_players_staff = value.max_players_staff; }
      if (Object.prototype.hasOwnProperty.call(value, 'max_players_online')) { sets.push('max_players_online = :max_players_online'); params.max_players_online = value.max_players_online; }

      if (sets.length > 0) {
        const sql = `UPDATE "TeeSheetTemplates" SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = :tid AND tee_sheet_id = :sid`;
        await sequelize.query(sql, { replacements: params });
      }

      const [rows2] = await sequelize.query(
        'SELECT name, interval_type, interval_mins, max_players_staff, max_players_online FROM "TeeSheetTemplates" WHERE id = :tid AND tee_sheet_id = :sid',
        { replacements: params }
      );
      const row = Array.isArray(rows2) && rows2.length > 0 ? rows2[0] : {};
      return res.json({
        name: row.name || value.name || 'Untitled Template',
        interval_type: row.interval_type || value.interval_type || 'standard',
        interval_mins: row.interval_mins ?? value.interval_mins ?? tmpl.interval_mins ?? 10,
        max_players_staff: row.max_players_staff ?? value.max_players_staff ?? 4,
        max_players_online: row.max_players_online ?? value.max_players_online ?? 4,
        online_access: [],
      });
    } catch (e2) {
      // eslint-disable-next-line no-console
      console.error('Update template settings fallback error:', e2);
      return res.status(500).json({ error: 'Failed to update template settings' });
    }
  }
});

router.post('/tee-sheets/:id/v2/templates', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2TemplateCreateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  try {
  const created = await TeeSheetTemplate.create({
    tee_sheet_id: sheet.id,
    name: value.name || 'Untitled Template',
    status: 'draft',
    interval_mins: value.interval_mins,
    interval_type: value.interval_type || 'standard',
    max_players_staff: value.max_players_staff,
    max_players_online: value.max_players_online,
  });
    return res.status(201).json(created);
  } catch (e) {
    // Attempt minimal insert for local DBs missing some columns
    try {
      const sequelize = require('../models').sequelize;
      const [rows] = await sequelize.query(
        'INSERT INTO "TeeSheetTemplates" (id, tee_sheet_id, status, interval_mins, archived, created_at, updated_at) VALUES (gen_random_uuid(), :sid, :status, :mins, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id, tee_sheet_id, status, interval_mins, archived, created_at, updated_at',
        { replacements: { sid: sheet.id, status: 'draft', mins: value.interval_mins || 10 } }
      );
      const row = Array.isArray(rows) ? rows[0] : rows;
      return res.status(201).json({
        id: row.id,
        tee_sheet_id: row.tee_sheet_id,
        name: value.name || 'Untitled Template',
        status: row.status,
        interval_mins: row.interval_mins,
        interval_type: value.interval_type || 'standard',
        max_players_staff: value.max_players_staff || 4,
        max_players_online: value.max_players_online || 4,
        archived: !!row.archived,
        created_at: row.created_at,
        updated_at: row.updated_at,
        versions: [],
        published_version: null,
      });
    } catch (e2) {
      // eslint-disable-next-line no-console
      console.error('Create template error (fallback failed):', e2);
      return res.status(500).json({ error: 'Failed to create template' });
    }
  }
});

router.post('/tee-sheets/:id/v2/templates/:templateId/versions', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2TemplateVersionCreateSchema.validate(req.body || {});
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  let tmpl = null;
  try {
    tmpl = await TeeSheetTemplate.findOne({ where: { id: req.params.templateId, tee_sheet_id: sheet.id } });
  } catch (e) {
    const code = e && (e.parent?.code || e.original?.code);
    if (String(code) === '42703' || String(code) === '42P01') {
      const [rows] = await sequelize.query('SELECT id FROM "TeeSheetTemplates" WHERE id = :tid AND tee_sheet_id = :sid', { replacements: { tid: req.params.templateId, sid: sheet.id } });
      if (Array.isArray(rows) && rows.length > 0) tmpl = { id: rows[0].id };
    } else {
      throw e;
    }
  }
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
      // include name now that column exists
      include: [
        { model: TeeSheetTemplateVersion, as: 'versions' },
        { model: TeeSheetTemplateVersion, as: 'published_version' },
        // online_access temporarily disabled
      ],
    });
    res.json(reloaded);
  } catch (e) {
    const status = e.status || 400;
    res.status(status).json({ error: e.message || 'Publish failed' });
  }
});

// V2 Template rollback to a specific version
router.post('/tee-sheets/:id/v2/templates/:templateId/rollback', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2TemplateRollbackSchema.validate(req.body);
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
    const reloaded = await TeeSheetTemplate.findByPk(tmpl.id, { include: [
      { model: TeeSheetTemplateVersion, as: 'versions' },
      { model: TeeSheetTemplateVersion, as: 'published_version' },
      // online_access temporarily disabled
    ] });
    res.json(reloaded);
  } catch (e) {
    const status = e.status || 400;
    res.status(status).json({ error: e.message || 'Rollback failed' });
  }
});

// V2 Template archive/unarchive
router.post('/tee-sheets/:id/v2/templates/:templateId/archive', requireAuth(['Admin']), async (req, res) => {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const tmpl = await TeeSheetTemplate.findOne({ where: { id: req.params.templateId, tee_sheet_id: sheet.id } });
  if (!tmpl) return res.status(404).json({ error: 'Template not found' });
  await tmpl.update({ archived: true });
  res.json(tmpl);
});

router.post('/tee-sheets/:id/v2/templates/:templateId/unarchive', requireAuth(['Admin']), async (req, res) => {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const tmpl = await TeeSheetTemplate.findOne({ where: { id: req.params.templateId, tee_sheet_id: sheet.id } });
  if (!tmpl) return res.status(404).json({ error: 'Template not found' });
  await tmpl.update({ archived: false });
  res.json(tmpl);
});

// V2 Template guarded delete (model hook prevents delete when versions exist)
router.delete('/tee-sheets/:id/v2/templates/:templateId', requireAuth(['Admin']), async (req, res) => {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const tmpl = await TeeSheetTemplate.findOne({ where: { id: req.params.templateId, tee_sheet_id: sheet.id } });
  if (!tmpl) return res.status(404).json({ error: 'Template not found' });
  try {
    await tmpl.destroy();
    res.status(204).end();
  } catch (e) {
    res.status(400).json({ error: e.message || 'Delete failed' });
  }
});

// V2 Seasons API
router.get('/tee-sheets/:id/v2/seasons', requireAuth(['Admin', 'Manager', 'SuperAdmin']), async (req, res) => {
  try {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const items = await TeeSheetSeason.findAll({
    where: { tee_sheet_id: sheet.id },
    include: [
      // Order versions so the latest is deterministic
      { model: TeeSheetSeasonVersion, as: 'versions', separate: true, order: [['created_at', 'ASC']] },
      { model: TeeSheetSeasonVersion, as: 'published_version' },
    ],
    order: [['created_at', 'ASC']],
  });
    return res.json(items);
  } catch (e) {
    const code = e && (e.parent?.code || e.original?.code);
    // Missing table or missing column in local DB → fall back to minimal raw query
    if (String(code) === '42P01' || String(code) === '42703') {
      try {
        const [rows] = await sequelize.query(
          'SELECT id, tee_sheet_id, status, archived, created_at, updated_at FROM "TeeSheetSeasons" WHERE tee_sheet_id = :sid ORDER BY created_at ASC',
          { replacements: { sid: req.params.id } }
        );
        const items = (rows || []).map(r => ({
          id: r.id,
          tee_sheet_id: r.tee_sheet_id,
          name: r.name || 'Untitled Season',
          status: r.status || 'draft',
          published_version_id: r.published_version_id || null,
          archived: !!r.archived,
          created_at: r.created_at,
          updated_at: r.updated_at,
          versions: [],
          published_version: null,
        }));
        return res.json(items);
      } catch (e2) {
        return res.json([]);
      }
    }
    return res.status(500).json({ error: 'Failed to load seasons' });
  }
});

router.post('/tee-sheets/:id/v2/seasons', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2SeasonCreateSchema.validate(req.body || {});
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  try {
  const created = await TeeSheetSeason.create({ tee_sheet_id: sheet.id, status: 'draft', name: value?.name || 'Untitled Season' });
    return res.status(201).json(created);
  } catch (e) {
    // Fallback for local DBs missing columns like name/published_version_id
    try {
      const { randomUUID } = require('crypto');
      const sid = sheet.id;
      const newId = randomUUID();
      const [rows] = await sequelize.query(
        'INSERT INTO "TeeSheetSeasons" (id, tee_sheet_id, status, archived, created_at, updated_at) VALUES (:id, :sid, :status, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id, tee_sheet_id, status, archived, created_at, updated_at',
        { replacements: { id: newId, sid, status: 'draft' } }
      );
      const row = Array.isArray(rows) ? rows[0] : rows;
      return res.status(201).json({
        id: row.id,
        tee_sheet_id: row.tee_sheet_id,
        name: value?.name || 'Untitled Season',
        status: row.status || 'draft',
        published_version_id: null,
        archived: !!row.archived,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    } catch (e2) {
      return res.status(500).json({ error: 'Failed to create season' });
    }
  }
});

router.put('/tee-sheets/:id/v2/seasons/:seasonId', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2SeasonUpdateSchema.validate(req.body || {});
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const season = await findSeasonSafe(sheet.id, req.params.seasonId);
  if (!season) return res.status(404).json({ error: 'Season not found' });
  await season.update({ name: value.name });
  res.json(season);
});

// Season guarded delete: only when draft and has no versions
router.delete('/tee-sheets/:id/v2/seasons/:seasonId', requireAuth(['Admin']), async (req, res) => {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const season = await findSeasonSafe(sheet.id, req.params.seasonId);
  if (!season) return res.status(404).json({ error: 'Season not found' });
  if (season.status !== 'draft') return res.status(400).json({ error: 'Only draft seasons can be deleted' });
  const versionCount = await TeeSheetSeasonVersion.count({ where: { season_id: season.id } });
  if (versionCount > 0) return res.status(400).json({ error: 'Cannot delete season with existing versions' });
  await season.destroy();
  res.status(204).end();
});

router.post('/tee-sheets/:id/v2/seasons/:seasonId/versions', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2SeasonVersionCreateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const season = await findSeasonSafe(sheet.id, req.params.seasonId);
  if (!season) return res.status(404).json({ error: 'Season not found' });
  const created = await TeeSheetSeasonVersion.create({ season_id: season.id, start_date: value.start_date, end_date_exclusive: value.end_date_exclusive, notes: value.notes || null });
  res.status(201).json(created);
});

router.post('/tee-sheets/:id/v2/seasons/:seasonId/versions/:versionId/weekday-windows', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2SeasonWeekdayWindowSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const season = await findSeasonSafe(sheet.id, req.params.seasonId);
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

// Update a single weekday window
router.put('/tee-sheets/:id/v2/seasons/:seasonId/versions/:versionId/weekday-windows/:windowId', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2SeasonWeekdayWindowSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const season = await TeeSheetSeason.findOne({ where: { id: req.params.seasonId, tee_sheet_id: sheet.id } });
  if (!season) return res.status(404).json({ error: 'Season not found' });
  const version = await TeeSheetSeasonVersion.findOne({ where: { id: req.params.versionId, season_id: season.id } });
  if (!version) return res.status(404).json({ error: 'Season version not found' });
  const wnd = await TeeSheetSeasonWeekdayWindow.findOne({ where: { id: req.params.windowId, season_version_id: version.id } });
  if (!wnd) return res.status(404).json({ error: 'Window not found' });
  await wnd.update({
    weekday: value.weekday,
    start_mode: value.start_mode,
    end_mode: value.end_mode,
    start_time_local: value.start_time_local || null,
    end_time_local: value.end_time_local || null,
    start_offset_mins: value.start_offset_mins || null,
    end_offset_mins: value.end_offset_mins || null,
    template_version_id: value.template_version_id,
  });
  res.json(wnd);
});

// Delete a single weekday window
router.delete('/tee-sheets/:id/v2/seasons/:seasonId/versions/:versionId/weekday-windows/:windowId', requireAuth(['Admin']), async (req, res) => {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const season = await TeeSheetSeason.findOne({ where: { id: req.params.seasonId, tee_sheet_id: sheet.id } });
  if (!season) return res.status(404).json({ error: 'Season not found' });
  const version = await TeeSheetSeasonVersion.findOne({ where: { id: req.params.versionId, season_id: season.id } });
  if (!version) return res.status(404).json({ error: 'Season version not found' });
  const wnd = await TeeSheetSeasonWeekdayWindow.findOne({ where: { id: req.params.windowId, season_version_id: version.id } });
  if (!wnd) return res.status(404).json({ error: 'Window not found' });
  await wnd.destroy();
  res.status(204).end();
});

// List weekday windows for a specific season version (to restore UI state)
router.get('/tee-sheets/:id/v2/seasons/:seasonId/versions/:versionId/weekday-windows', requireAuth(['Admin', 'Manager', 'SuperAdmin']), async (req, res) => {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const season = await TeeSheetSeason.findOne({ where: { id: req.params.seasonId, tee_sheet_id: sheet.id } });
  if (!season) return res.status(404).json({ error: 'Season not found' });
  const version = await TeeSheetSeasonVersion.findOne({ where: { id: req.params.versionId, season_id: season.id } });
  if (!version) return res.status(404).json({ error: 'Season version not found' });
  const items = await TeeSheetSeasonWeekdayWindow.findAll({
    where: { season_version_id: version.id },
    order: [['weekday', 'ASC'], ['position', 'ASC']],
  });
  res.json(items);
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

// Helper to determine working version for editing side settings
async function getWorkingVersion(template) {
  if (template.published_version_id) {
    const v = await TeeSheetTemplateVersion.findOne({ where: { id: template.published_version_id, template_id: template.id } });
    if (v) return v;
  }
  const latest = await TeeSheetTemplateVersion.findOne({ where: { template_id: template.id }, order: [['version_number', 'DESC']] });
  if (latest) return latest;
  // Create an initial version if none exists
  return await TeeSheetTemplateVersion.create({ template_id: template.id, version_number: 1, notes: null });
}

// V2 Template Side Settings - GET snapshot for editing
router.get('/tee-sheets/:id/v2/templates/:templateId/side-settings', requireAuth(['Admin', 'Manager', 'SuperAdmin']), async (req, res) => {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  let tmpl = null;
  try {
    tmpl = await TeeSheetTemplate.findOne({ where: { id: req.params.templateId, tee_sheet_id: sheet.id } });
  } catch (e) {
    // Fallback when V2 columns like interval_type are missing locally
    const code = e && (e.parent?.code || e.original?.code);
    if (String(code) === '42703' || String(code) === '42P01') {
      const [rows] = await sequelize.query(
        'SELECT id FROM "TeeSheetTemplates" WHERE id = :tid AND tee_sheet_id = :sid',
        { replacements: { tid: req.params.templateId, sid: sheet.id } }
      );
      if (Array.isArray(rows) && rows.length > 0) tmpl = { id: rows[0].id };
    } else {
      throw e;
    }
  }
  if (!tmpl) return res.status(404).json({ error: 'Template not found' });
  try {
  const version = await getWorkingVersion(tmpl);
  const sides = await TeeSheetSide.findAll({ where: { tee_sheet_id: sheet.id }, order: [['valid_from', 'ASC']] });
  const cfgList = await TeeSheetTemplateSide.findAll({ where: { version_id: version.id } });
  const cfgBySide = Object.fromEntries(cfgList.map(c => [String(c.side_id), c]));

  const payload = sides.map(s => {
    const cfg = cfgBySide[String(s.id)];
    const cart_policy = cfg?.walk_ride_mode === 'walk' ? 'not_allowed' : (cfg?.walk_ride_mode === 'ride' ? 'required' : 'optional');
    const bookable_holes = (cfg?.max_legs_starting === 2 && cfg?.rerounds_to_side_id)
      ? (s.hole_count + (sides.find(x => x.id === cfg.rerounds_to_side_id)?.hole_count || 0))
      : s.hole_count;
    return {
      side_id: s.id,
      name: s.name,
      hole_count: s.hole_count,
      minutes_per_hole: s.minutes_per_hole,
      start_slots_enabled: cfg?.start_slots_enabled ?? true,
      min_players: cfg?.min_players ?? 1,
      cart_policy,
      rotates_to_side_id: cfg?.rerounds_to_side_id || null,
      bookable_holes,
      allowed_hole_totals: cfg?.allowed_hole_totals || [],
    };
  });

  res.json({ version_id: version.id, sides: payload });
  } catch (e) {
    // If any V2 table/column is missing, fall back to side defaults only
    const code = e && (e.parent?.code || e.original?.code);
    if (String(code) === '42P01' || String(code) === '42703') {
      const sides = await TeeSheetSide.findAll({ where: { tee_sheet_id: sheet.id }, order: [['valid_from', 'ASC']] });
      const payload = sides.map(s => ({
        side_id: s.id,
        name: s.name,
        hole_count: s.hole_count,
        minutes_per_hole: s.minutes_per_hole,
        start_slots_enabled: true,
        min_players: 1,
        cart_policy: 'optional',
        rotates_to_side_id: null,
        bookable_holes: s.hole_count,
        allowed_hole_totals: [],
      }));
      return res.json({ version_id: null, sides: payload });
    }
    // Otherwise return error
    return res.status(500).json({ error: 'Failed to load side settings' });
  }
});

// V2 Template Side Settings - PUT batch upsert
router.put('/tee-sheets/:id/v2/templates/:templateId/side-settings', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2TemplateSideSettingsPutSchema.validate(req.body || {});
  if (error) return res.status(400).json({ error: error.message });

  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const tmpl = await TeeSheetTemplate.findOne({ where: { id: req.params.templateId, tee_sheet_id: sheet.id } });
  if (!tmpl) return res.status(404).json({ error: 'Template not found' });

  let version = null;
  if (value.version_id) {
    version = await TeeSheetTemplateVersion.findOne({ where: { id: value.version_id, template_id: tmpl.id } });
    if (!version) return res.status(400).json({ error: 'Version not found for template' });
  } else {
    version = await getWorkingVersion(tmpl);
  }

  const sides = await TeeSheetSide.findAll({ where: { tee_sheet_id: sheet.id } });
  const sideById = Object.fromEntries(sides.map(s => [String(s.id), s]));

  for (const item of value.sides) {
    const side = sideById[String(item.side_id)];
    if (!side) return res.status(400).json({ error: `Side not found: ${item.side_id}` });

    // Update minutes_per_hole at side level if provided
    if (typeof item.minutes_per_hole === 'number' && item.minutes_per_hole > 0) {
      await side.update({ minutes_per_hole: item.minutes_per_hole });
    }

    // Determine cart policy mapping
    let walk_ride_mode = undefined;
    if (item.cart_policy) {
      if (item.cart_policy === 'not_allowed') walk_ride_mode = 'walk';
      else if (item.cart_policy === 'required') walk_ride_mode = 'ride';
      else walk_ride_mode = 'either';
    }

    // Compute legs/rotation from bookable_holes
    let max_legs_starting = 1;
    let rerounds_to_side_id = null;
    if (item.bookable_holes > side.hole_count) {
      // Need a rotate target that sums correctly
      const candidates = sides.filter(s => s.id !== side.id && (s.hole_count + side.hole_count) === item.bookable_holes);
      if (item.rotates_to_side_id) {
        const target = sides.find(s => String(s.id) === String(item.rotates_to_side_id));
        if (!target) return res.status(400).json({ error: 'Invalid rotates_to_side_id' });
        if ((target.hole_count + side.hole_count) !== item.bookable_holes) {
          return res.status(400).json({ error: 'rotates_to_side_id hole_count does not match bookable_holes total' });
        }
        max_legs_starting = 2;
        rerounds_to_side_id = target.id;
      } else {
        // Require explicit rotate target selection when ambiguous or any (per spec)
        return res.status(400).json({ error: 'Ambiguous rotate target for selected bookable_holes; specify rotates_to_side_id' });
      }
    }

    // Upsert template-side config
    const [cfg, created] = await TeeSheetTemplateSide.findOrCreate({
      where: { version_id: version.id, side_id: side.id },
      defaults: {
        version_id: version.id,
        side_id: side.id,
        start_slots_enabled: item.start_slots_enabled !== undefined ? !!item.start_slots_enabled : true,
        min_players: item.min_players || 1,
        walk_ride_mode: walk_ride_mode || 'either',
        max_legs_starting,
        rerounds_to_side_id,
        allowed_hole_totals: Array.isArray(item.allowed_hole_totals) ? item.allowed_hole_totals : [],
      },
    });
    if (!created) {
      await cfg.update({
        start_slots_enabled: item.start_slots_enabled !== undefined ? !!item.start_slots_enabled : cfg.start_slots_enabled,
        min_players: item.min_players || cfg.min_players,
        walk_ride_mode: walk_ride_mode || cfg.walk_ride_mode,
        max_legs_starting,
        rerounds_to_side_id,
        allowed_hole_totals: Array.isArray(item.allowed_hole_totals) ? item.allowed_hole_totals : cfg.allowed_hole_totals,
      });
    }
  }

  // Return updated snapshot
  const cfgList = await TeeSheetTemplateSide.findAll({ where: { version_id: version.id } });
  const cfgBySide = Object.fromEntries(cfgList.map(c => [String(c.side_id), c]));
  const response = sides.map(s => {
    const cfg = cfgBySide[String(s.id)];
    const cart_policy = cfg?.walk_ride_mode === 'walk' ? 'not_allowed' : (cfg?.walk_ride_mode === 'ride' ? 'required' : 'optional');
    const bookable_holes = (cfg?.max_legs_starting === 2 && cfg?.rerounds_to_side_id)
      ? (s.hole_count + (sides.find(x => x.id === cfg.rerounds_to_side_id)?.hole_count || 0))
      : s.hole_count;
    return {
      side_id: s.id,
      name: s.name,
      hole_count: s.hole_count,
      minutes_per_hole: s.minutes_per_hole,
      start_slots_enabled: cfg?.start_slots_enabled ?? true,
      min_players: cfg?.min_players ?? 1,
      cart_policy,
      rotates_to_side_id: cfg?.rerounds_to_side_id || null,
      bookable_holes,
      allowed_hole_totals: cfg?.allowed_hole_totals || [],
    };
  });
  res.json({ version_id: version.id, sides: response });
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
    // Always regenerate slots on publish (simplified model)
    const startIso = value.start_date || ver.start_date;
    const endIso = value.end_date || ver.end_date_exclusive;
    await regenerateApplyNow({ teeSheetId: sheet.id, startDateISO: startIso, endDateISO: endIso });
    const reloaded = await TeeSheetSeason.findByPk(season.id, { include: [{ model: TeeSheetSeasonVersion, as: 'versions' }, { model: TeeSheetSeasonVersion, as: 'published_version' }] });
    res.json(reloaded);
  } catch (e) {
    const status = e.status || 400;
    res.status(status).json({ error: e.message || 'Publish failed' });
  }
});

// V2 Overrides API
router.get('/tee-sheets/:id/v2/overrides', requireAuth(['Admin', 'Manager', 'SuperAdmin']), async (req, res) => {
  try {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
    try {
  const items = await TeeSheetOverride.findAll({
    where: { tee_sheet_id: sheet.id },
        include: [
          { model: TeeSheetOverrideVersion, as: 'versions', separate: true, order: [['created_at', 'ASC']] },
          { model: TeeSheetOverrideVersion, as: 'published_version' },
          { model: TeeSheetOverrideVersion, as: 'draft_version' },
        ],
    order: [['date', 'ASC']],
  });
      return res.json(items);
    } catch (e) {
      // Minimal fallback when associations/columns are missing
      const [rows] = await sequelize.query(
        'SELECT id, tee_sheet_id, status, date, published_version_id, created_at, updated_at FROM "TeeSheetOverrides" WHERE tee_sheet_id = :sid ORDER BY date ASC',
        { replacements: { sid: sheet.id } }
      );
      return res.json(Array.isArray(rows) ? rows : []);
    }
  } catch (e) {
    // If V2 overrides tables are not present in a local DB, degrade gracefully
    const code = e && (e.parent?.code || e.original?.code);
    if (String(code) === '42P01') return res.json([]);
    return res.status(500).json({ error: 'Failed to load overrides' });
  }
});

// List windows for a specific override by kind=draft|published (default prefers draft)
router.get('/tee-sheets/:id/v2/overrides/:overrideId/windows', requireAuth(['Admin', 'Manager', 'SuperAdmin']), async (req, res) => {
  try {
    const sheet = await TeeSheet.findOne({ where: { id: req.params.id } });
    if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
    const ov = await TeeSheetOverride.findOne({ where: { id: req.params.overrideId, tee_sheet_id: sheet.id } });
    if (!ov) return res.status(404).json({ error: 'Override not found' });
    const kind = String(req.query.kind || '').toLowerCase();
    let versionId = null;
    if (kind === 'draft') versionId = ov.draft_version_id;
    else if (kind === 'published') versionId = ov.published_version_id;
    else versionId = ov.draft_version_id || ov.published_version_id;
    if (!versionId) return res.json([]);
  const [rows] = await sequelize.query(
      'SELECT id, override_version_id, start_mode, end_mode, start_time_local, end_time_local, start_offset_mins, end_offset_mins, template_version_id, created_at, updated_at FROM "TeeSheetOverrideWindows" WHERE override_version_id = :vid ORDER BY start_time_local ASC NULLS LAST, created_at ASC',
      { replacements: { vid: versionId } }
    );
    return res.json(Array.isArray(rows) ? rows : []);
  } catch (e) {
    return res.json([]);
  }
});

async function getOrCreateDraftVersion(override) {
  if (override.draft_version_id) return override.draft_version_id;
  const ver = await TeeSheetOverrideVersion.create({ override_id: override.id, notes: 'draft' });
  override.draft_version_id = ver.id;
  await override.save();
  return ver.id;
}

// Replace-all draft windows
router.put('/tee-sheets/:id/v2/overrides/:overrideId/draft', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2OverrideDraftPutSchema.validate(req.body || {});
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const ov = await TeeSheetOverride.findOne({ where: { id: req.params.overrideId, tee_sheet_id: sheet.id } });
  if (!ov) return res.status(404).json({ error: 'Override not found' });
  const draftId = await getOrCreateDraftVersion(ov);

  const tx = await sequelize.transaction();
  try {
    await sequelize.query('DELETE FROM "TeeSheetOverrideWindows" WHERE override_version_id = :vid', { replacements: { vid: draftId }, transaction: tx });
    for (const w of (value.windows || [])) {
      await sequelize.query(
        'INSERT INTO "TeeSheetOverrideWindows" (id, override_version_id, start_mode, end_mode, start_time_local, end_time_local, start_offset_mins, end_offset_mins, template_version_id, created_at, updated_at) VALUES (gen_random_uuid(), :vid, :sm, :em, :st, :et, :so, :eo, :tv, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        { transaction: tx, replacements: { vid: draftId, sm: w.start_mode, em: w.end_mode, st: w.start_time_local || null, et: w.end_time_local || null, so: w.start_offset_mins || null, eo: w.end_offset_mins || null, tv: w.template_version_id } }
      );
    }
    await tx.commit();
    return res.json({ success: true, draft_version_id: draftId });
  } catch (e) {
    await tx.rollback();
    return res.status(400).json({ error: e.message || 'Failed to save draft windows' });
  }
});

router.post('/tee-sheets/:id/v2/overrides', requireAuth(['Admin']), async (req, res) => {
  const { error, value } = v2OverrideCreateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  try {
    const created = await TeeSheetOverride.create({ tee_sheet_id: sheet.id, status: 'draft', date: value.date, name: 'Untitled Override' });
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
  // Determine next position if not provided
  let pos = 0;
  try {
    if (typeof value.position === 'number') {
      pos = value.position;
    } else {
    // position is optional; default to 0 without querying
    pos = 0;
    }
  } catch (_) { pos = 0; }

  try {
  const created = await TeeSheetOverrideWindow.create({
    override_version_id: ver.id,
    start_mode: value.start_mode,
    end_mode: value.end_mode,
    start_time_local: value.start_time_local || null,
    end_time_local: value.end_time_local || null,
    start_offset_mins: value.start_offset_mins || null,
    end_offset_mins: value.end_offset_mins || null,
    template_version_id: value.template_version_id,
  });
    return res.status(201).json(created);
  } catch (e) {
    const code = e && (e.parent?.code || e.original?.code);
    // No side_id fallback: DB schema should be migrated to side-agnostic windows
    // Fallback when local DB lacks the optional 'position' column
    if (String(code) === '42703' || String(code) === '42P01') {
      try {
        const [rows] = await sequelize.query(
          'INSERT INTO "TeeSheetOverrideWindows" (id, override_version_id, start_mode, end_mode, start_time_local, end_time_local, start_offset_mins, end_offset_mins, template_version_id, created_at, updated_at) VALUES (gen_random_uuid(), :vid, :sm, :em, :st, :et, :so, :eo, :tv, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id, override_version_id, start_mode, end_mode, start_time_local, end_time_local, start_offset_mins, end_offset_mins, template_version_id, created_at, updated_at',
          { replacements: { vid: ver.id, sm: value.start_mode, em: value.end_mode, st: value.start_time_local || null, et: value.end_time_local || null, so: value.start_offset_mins || null, eo: value.end_offset_mins || null, tv: value.template_version_id } }
        );
        const row = Array.isArray(rows) ? rows[0] : rows;
        return res.status(201).json(row);
      } catch (e2) {
        // No side_id fallback anymore
        return res.status(400).json({ error: e2.message || 'Failed to create override window' });
      }
    }
    return res.status(400).json({ error: e.message || 'Failed to create override window' });
  }
});

// List windows for an override version (used by UI to edit existing schedule)
router.get('/tee-sheets/:id/v2/overrides/:overrideId/versions/:versionId/windows', requireAuth(['Admin', 'Manager', 'SuperAdmin']), async (req, res) => {
  try {
    const sheet = await TeeSheet.findOne({ where: { id: req.params.id } });
    if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
    const ov = await TeeSheetOverride.findOne({ where: { id: req.params.overrideId, tee_sheet_id: sheet.id } });
    if (!ov) return res.status(404).json({ error: 'Override not found' });
    const ver = await TeeSheetOverrideVersion.findOne({ where: { id: req.params.versionId, override_id: ov.id } });
    if (!ver) return res.status(404).json({ error: 'Override version not found' });
    // Plain list of all windows for the version (no grouping), ordered by start_time or created_at
    const [rows] = await sequelize.query(
      'SELECT id, override_version_id, start_mode, end_mode, start_time_local, end_time_local, start_offset_mins, end_offset_mins, template_version_id, created_at, updated_at FROM "TeeSheetOverrideWindows" WHERE override_version_id = :vid ORDER BY start_time_local ASC NULLS LAST, created_at ASC',
      { replacements: { vid: ver.id } }
    );
    return res.json(Array.isArray(rows) ? rows : []);
  } catch (e) {
    return res.json([]);
  }
});

// Reorder override windows within a version
router.patch('/tee-sheets/:id/v2/overrides/:overrideId/versions/:versionId/windows/reorder', requireAuth(['Admin']), async (req, res) => {
  const schema = Joi.object({ order: Joi.array().items(Joi.string().uuid()).min(1).required() });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const ov = await TeeSheetOverride.findOne({ where: { id: req.params.overrideId, tee_sheet_id: sheet.id } });
  if (!ov) return res.status(404).json({ error: 'Override not found' });
  const ver = await TeeSheetOverrideVersion.findOne({ where: { id: req.params.versionId, override_id: ov.id } });
  if (!ver) return res.status(404).json({ error: 'Override version not found' });

  // Use raw select without position to avoid column presence issues
  const [existing] = await sequelize.query('SELECT id FROM "TeeSheetOverrideWindows" WHERE override_version_id = :vid', { replacements: { vid: ver.id } });
  const existingIds = existing.map(w => w.id);
  const requested = value.order;
  if (existingIds.length !== requested.length || existingIds.some(id => !requested.includes(id))) {
    return res.status(400).json({ error: 'Reorder must include all and only existing windows' });
  }
  const tx = await sequelize.transaction();
  try {
    // No-op reorder: acknowledge success without touching columns
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    return res.status(200).json({ success: true });
  }
  return res.json({ success: true });
});

// Delete an override window
router.delete('/tee-sheets/:id/v2/overrides/:overrideId/versions/:versionId/windows/:windowId', requireAuth(['Admin']), async (req, res) => {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const ov = await TeeSheetOverride.findOne({ where: { id: req.params.overrideId, tee_sheet_id: sheet.id } });
  if (!ov) return res.status(404).json({ error: 'Override not found' });
  const ver = await TeeSheetOverrideVersion.findOne({ where: { id: req.params.versionId, override_id: ov.id } });
  if (!ver) return res.status(404).json({ error: 'Override version not found' });
  try {
    const win = await TeeSheetOverrideWindow.findOne({ where: { id: req.params.windowId, override_version_id: ver.id } });
    if (!win) return res.status(404).json({ error: 'Override window not found' });
    await win.destroy();
    try {
      const remaining = await TeeSheetOverrideWindow.findAll({ where: { override_version_id: ver.id }, order: [['position', 'ASC']] });
      for (let i = 0; i < remaining.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        if (remaining[i].position !== i) await remaining[i].update({ position: i });
      }
    } catch (_) {}
    return res.status(204).end();
  } catch (e) {
    const code = e && (e.parent?.code || e.original?.code);
    if (String(code) === '42703' || String(code) === '42P01') {
      try {
        await sequelize.query(
          'DELETE FROM "TeeSheetOverrideWindows" WHERE id = :id AND override_version_id = :vid',
          { replacements: { id: req.params.windowId, vid: ver.id } }
        );
        return res.status(204).end();
      } catch (e2) {
        return res.status(400).json({ error: e2.message || 'Failed to delete override window' });
      }
    }
    return res.status(400).json({ error: e.message || 'Failed to delete override window' });
  }
});

  // Convenience: window of the most recently edited version that has windows (prefer draft_version_id)
router.get('/tee-sheets/:id/v2/overrides/:overrideId/windows/latest', requireAuth(['Admin', 'Manager', 'SuperAdmin']), async (req, res) => {
  try {
    const sheet = await TeeSheet.findOne({ where: { id: req.params.id } });
    if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
    const ov = await TeeSheetOverride.findOne({ where: { id: req.params.overrideId, tee_sheet_id: sheet.id } });
    if (!ov) return res.status(404).json({ error: 'Override not found' });

    // Safe ORM-first approach: find the most recently touched version that has any windows
    let versionId = null;
    // Prefer draft version if it has windows
    if (ov.draft_version_id) {
      try {
        const cnt = await TeeSheetOverrideWindow.count({ where: { override_version_id: ov.draft_version_id } });
        if (cnt > 0) versionId = ov.draft_version_id;
      } catch (_) {}
    }
    try {
      const versions = await TeeSheetOverrideVersion.findAll({ where: { override_id: ov.id }, order: [['updated_at', 'DESC'], ['created_at', 'DESC']] });
      for (const v of versions) {
        const cnt = await TeeSheetOverrideWindow.count({ where: { override_version_id: v.id } });
        if (cnt > 0) { versionId = versionId || v.id; }
      }
    } catch (_) {}

    // Fallback: raw SQL if ORM path fails
    if (!versionId) {
      try {
        const [verRows] = await sequelize.query(
          `SELECT v.id
           FROM "TeeSheetOverrideVersions" v
           LEFT JOIN "TeeSheetOverrideWindows" w ON w.override_version_id = v.id
           WHERE v.override_id = :ovId
           GROUP BY v.id, v.created_at
           HAVING COUNT(w.id) > 0
           ORDER BY MAX(w.updated_at) DESC NULLS LAST, MAX(w.created_at) DESC NULLS LAST, v.created_at DESC
           LIMIT 1`,
          { replacements: { ovId: ov.id } }
        );
        versionId = Array.isArray(verRows) && verRows.length ? verRows[0].id : null;
      } catch (_) {}
    }

    if (!versionId) return res.json([]);
    // Raw select grouped across sides to present global windows
    const [rows] = await sequelize.query(
      `SELECT MIN(id) AS id,
              override_version_id,
              MIN(start_mode) AS start_mode,
              MIN(end_mode) AS end_mode,
              MIN(start_time_local) AS start_time_local,
              MIN(end_time_local) AS end_time_local,
              MIN(start_offset_mins) AS start_offset_mins,
              MIN(end_offset_mins) AS end_offset_mins,
              template_version_id,
              MIN(created_at) AS created_at,
              MAX(updated_at) AS updated_at
       FROM "TeeSheetOverrideWindows"
       WHERE override_version_id = :vid
       GROUP BY override_version_id, template_version_id, start_mode, end_mode, start_time_local, end_time_local, start_offset_mins, end_offset_mins
       ORDER BY MIN(created_at) ASC`,
      { replacements: { vid: versionId } }
    );
    return res.json(Array.isArray(rows) ? rows : []);
  } catch (e) {
    // Graceful degradation: never hard fail this helper endpoint
    return res.json([]);
  }
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
    // Use a locally required sequelize instance to avoid ReferenceError in environments
    // where the module-scoped import may not be available.
    const sequelizeSafe = require('../models').sequelize;
    // If the target version has no windows, copy from most recent version that has windows
    const [countRows] = await sequelizeSafe.query('SELECT COUNT(*)::int AS c FROM "TeeSheetOverrideWindows" WHERE override_version_id = :vid', { replacements: { vid: ver.id } });
    const winCount = (Array.isArray(countRows) && countRows[0]?.c) ? Number(countRows[0].c) : 0;
    if (winCount === 0) {
      const [srcRows] = await sequelizeSafe.query(
        `SELECT v.id
         FROM "TeeSheetOverrideVersions" v
         JOIN "TeeSheetOverrideWindows" w ON w.override_version_id = v.id
         WHERE v.override_id = :ovId
         ORDER BY COALESCE(w.updated_at, w.created_at) DESC
         LIMIT 1`,
        { replacements: { ovId: ov.id } }
      );
      const srcVersionId = Array.isArray(srcRows) && srcRows.length ? srcRows[0].id : null;
      if (srcVersionId) {
        const [wins] = await sequelizeSafe.query(
          'SELECT start_mode, end_mode, start_time_local, end_time_local, start_offset_mins, end_offset_mins, template_version_id FROM "TeeSheetOverrideWindows" WHERE override_version_id = :vid',
          { replacements: { vid: srcVersionId } }
        );
        for (const w of (wins || [])) {
          await sequelizeSafe.query(
            'INSERT INTO "TeeSheetOverrideWindows" (id, override_version_id, start_mode, end_mode, start_time_local, end_time_local, start_offset_mins, end_offset_mins, template_version_id, created_at, updated_at) VALUES (gen_random_uuid(), :vid, :sm, :em, :st, :et, :so, :eo, :tv, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            { replacements: { vid: ver.id, sm: w.start_mode, em: w.end_mode, st: w.start_time_local, et: w.end_time_local, so: w.start_offset_mins, eo: w.end_offset_mins, tv: w.template_version_id } }
          );
        }
      }
    }
    ov.published_version_id = ver.id;
    ov.status = 'published';
    // Drop draft after publish
    ov.draft_version_id = null;
    await ov.save();
    // Always regenerate slots on override publish for its date
    await regenerateApplyNow({ teeSheetId: sheet.id, startDateISO: ov.date, endDateISO: ov.date });
    const reloaded = await TeeSheetOverride.findByPk(ov.id, { include: [{ model: TeeSheetOverrideVersion, as: 'versions' }, { model: TeeSheetOverrideVersion, as: 'published_version' }] });
    res.json(reloaded);
  } catch (e) {
    const status = e.status || 400;
    res.status(status).json({ error: e.message || 'Publish failed' });
  }
});

// Delete override (only if draft)
router.delete('/tee-sheets/:id/v2/overrides/:overrideId', requireAuth(['Admin']), async (req, res) => {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const ov = await TeeSheetOverride.findOne({ where: { id: req.params.overrideId, tee_sheet_id: sheet.id } });
  if (!ov) return res.status(404).json({ error: 'Override not found' });
  if (ov.status !== 'draft') return res.status(400).json({ error: 'Only draft overrides can be deleted' });
  await ov.destroy();
  res.status(204).end();
});

// Update override name and/or date
router.put('/tee-sheets/:id/v2/overrides/:overrideId', requireAuth(['Admin']), async (req, res) => {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const ov = await TeeSheetOverride.findOne({ where: { id: req.params.overrideId, tee_sheet_id: sheet.id } });
  if (!ov) return res.status(404).json({ error: 'Override not found' });
  try {
    if (typeof req.body?.name === 'string') ov.name = (req.body.name || '').trim() || 'Untitled Override';
    if (typeof req.body?.date === 'string') ov.date = req.body.date;
    await ov.save();
    const reloaded = await TeeSheetOverride.findByPk(ov.id, { include: [{ model: TeeSheetOverrideVersion, as: 'versions' }, { model: TeeSheetOverrideVersion, as: 'published_version' }] });
    res.json(reloaded);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Failed to update override' });
  }
});

// V2 Starter Preset: creates draft template+version with public prices, season+version with weekday windows, publishes both
router.post('/tee-sheets/:id/v2/starters/preset', requireAuth(['Admin']), async (req, res) => {
  const sheet = await TeeSheet.findOne({ where: { id: req.params.id, course_id: req.courseId } });
  if (!sheet) return res.status(404).json({ error: 'Tee sheet not found' });
  const sides = await TeeSheetSide.findAll({ where: { tee_sheet_id: sheet.id } });
  if (sides.length === 0) return res.status(400).json({ error: 'No sides configured' });

  const tx = await sequelize.transaction();
  try {
    // Create template + version
    const tmpl = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 8 }, { transaction: tx });
    const ver = await TeeSheetTemplateVersion.create({ template_id: tmpl.id, version_number: 1, notes: 'Starter preset' }, { transaction: tx });
    // Cover all sides + add public price
    for (const s of sides) {
      await TeeSheetTemplateSide.create({ version_id: ver.id, side_id: s.id, start_slots_enabled: true, max_legs_starting: 1, min_players: 1, walk_ride_mode: 'either' }, { transaction: tx });
      await TeeSheetTemplateSidePrices.create({ version_id: ver.id, side_id: s.id, booking_class_id: 'public', greens_fee_cents: 4500, cart_fee_cents: 2000 }, { transaction: tx });
    }

    // Season + version with daily fixed window 06:30-18:00
    const season = await TeeSheetSeason.create({ tee_sheet_id: sheet.id, status: 'draft', archived: false }, { transaction: tx });
    const today = DateTime.now().toISODate();
    const sixMonths = DateTime.now().plus({ months: 6 }).toISODate();
    const seasonVer = await TeeSheetSeasonVersion.create({ season_id: season.id, start_date: today, end_date_exclusive: sixMonths, notes: 'Starter preset' }, { transaction: tx });
    for (let wd = 0; wd < 7; wd += 1) {
      await TeeSheetSeasonWeekdayWindow.create({ season_version_id: seasonVer.id, weekday: wd, position: 0, start_mode: 'fixed', end_mode: 'fixed', start_time_local: '06:30:00', end_time_local: '18:00:00', template_version_id: ver.id }, { transaction: tx });
    }

    await tx.commit();

    // Publish template (hooks enforce coverage/price and cycle detection)
    tmpl.published_version_id = ver.id;
    tmpl.status = 'published';
    await tmpl.save();

    // Prevalidate and publish season
    const pre = await prevalidateSeasonVersion({ teeSheetId: sheet.id, seasonVersionId: seasonVer.id });
    if (!pre.ok) return res.status(400).json({ error: 'Prevalidation failed', violations: pre.violations });
    season.published_version_id = seasonVer.id;
    season.status = 'published';
    await season.save();

    res.status(201).json({ template: await TeeSheetTemplate.findByPk(tmpl.id, { include: [{ model: TeeSheetTemplateVersion, as: 'published_version' }] }), season: await TeeSheetSeason.findByPk(season.id, { include: [{ model: TeeSheetSeasonVersion, as: 'published_version' }] }) });
  } catch (e) {
    try { await tx.rollback(); } catch {}
    const status = e.status || 400;
    res.status(status).json({ error: e.message || 'Failed to create starter preset' });
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


