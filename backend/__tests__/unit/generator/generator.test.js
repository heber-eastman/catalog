'use strict';

const SequelizeLib = require('sequelize');
const models = require('../../../src/models');
const generator = require('../../../src/services/teeSheetGenerator');

const courseMigration = require('../../../migrations/20250612171419-create-golfcourseinstance');
const addGeoTz = require('../../../migrations/20250625010000-add-course-geo-tz');
const customerMigration = require('../../../migrations/20250612171422-create-customer');
const teeSchemaMigration = require('../../../migrations/20250625000000-create-tee-sheet-schema');

describe('teeSheetGenerator', () => {
  const sequelize = models.sequelize;
  const qi = sequelize.getQueryInterface();

  beforeAll(async () => {
    await sequelize.authenticate();
    await qi.dropAllTables();
    await courseMigration.up(qi, SequelizeLib);
    await addGeoTz.up(qi, SequelizeLib);
    await customerMigration.up(qi, SequelizeLib);
    await teeSchemaMigration.up(qi, SequelizeLib);
    // Ensure TeeTimes denormalized columns exist for current model mapping
    try { await require('../../../migrations/20251031180000-add-teetime-reround-fields').up(qi, SequelizeLib); } catch (_) {}
  });

  afterAll(async () => {
    try { await sequelize.close(); } catch (e) {}
  });

  test('generates slots for assigned template with interval', async () => {
    const course = await models.GolfCourseInstance.create({ name: 'Gen Course', subdomain: 'gen', status: 'Active', timezone: 'America/New_York' });
    const sheet = await models.TeeSheet.create({ course_id: course.id, name: 'Gen Sheet' });
    const side = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Front', valid_from: '2025-06-01' });
    const tmpl = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: 'Weekday' });
    const tf = await models.Timeframe.create({
      tee_sheet_id: sheet.id,
      side_id: side.id,
      day_template_id: tmpl.id,
      start_time_local: '07:00:00',
      end_time_local: '07:30:00',
      interval_mins: 10,
      start_slots_enabled: true,
    });

    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date: '2025-07-01', day_template_id: tmpl.id });

    const res = await generator.generateForDate({ teeSheetId: sheet.id, dateISO: '2025-07-01' });
    expect(res.generated).toBeGreaterThan(0);

    const slots = await models.TeeTime.findAll({ where: { tee_sheet_id: sheet.id, side_id: side.id } });
    expect(slots.length).toBe(3); // 07:00, 07:10, 07:20
  });

  test('DST spring forward: non-existent local times are skipped without errors', async () => {
    const course = await models.GolfCourseInstance.create({ name: 'DST Course', subdomain: 'dst', status: 'Active', timezone: 'America/New_York' });
    const sheet = await models.TeeSheet.create({ course_id: course.id, name: 'DST Sheet' });
    const side = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Front', valid_from: '2025-03-01' });
    const tmpl = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: 'DST' });
    await models.Timeframe.create({
      tee_sheet_id: sheet.id,
      side_id: side.id,
      day_template_id: tmpl.id,
      start_time_local: '01:00:00',
      end_time_local: '04:00:00',
      interval_mins: 30,
      start_slots_enabled: true,
    });

    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date: '2025-03-09', day_template_id: tmpl.id });

    const res = await generator.generateForDate({ teeSheetId: sheet.id, dateISO: '2025-03-09' });
    expect(res.generated).toBeGreaterThanOrEqual(1);
  });
});


