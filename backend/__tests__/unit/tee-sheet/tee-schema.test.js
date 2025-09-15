'use strict';

const { v4: uuidv4 } = require('uuid');
const SequelizeLib = require('sequelize');
const models = require('../../../src/models');

// Import the migration so we can run it programmatically
const teeSheetMigration = require('../../../migrations/20250625000000-create-tee-sheet-schema');
const courseMigration = require('../../../migrations/20250612171419-create-golfcourseinstance');

describe('Tee Sheet schema: migrations and basic invariants', () => {
  const sequelize = models.sequelize;
  const qi = sequelize.getQueryInterface();

  beforeAll(async () => {
    // Ensure DB connection
    await sequelize.authenticate();
    // Attempt to run our migration; ignore if already applied
    try {
      await courseMigration.up(qi, SequelizeLib);
      await teeSheetMigration.up(qi, SequelizeLib);
    } catch (e) {
      // ignore if tables already exist
    }
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('CalendarAssignment enforces unique (tee_sheet_id, date)', async () => {
    const course = await models.GolfCourseInstance.create({
      name: 'Course A',
      subdomain: `course-a-${Date.now()}`,
      status: 'Active',
    });
    const sheet = await models.TeeSheet.create({ course_id: course.id, name: 'Main Sheet' });
    const template = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: 'Weekday' });

    const date = '2025-07-01';
    await models.CalendarAssignment.create({
      tee_sheet_id: sheet.id,
      date,
      day_template_id: template.id,
    });

    await expect(
      models.CalendarAssignment.create({
        tee_sheet_id: sheet.id,
        date,
        day_template_id: template.id,
      })
    ).rejects.toThrow();
  });

  test('TeeTime enforces unique (tee_sheet_id, side_id, start_time)', async () => {
    const course = await models.GolfCourseInstance.create({
      name: 'Course B',
      subdomain: `course-b-${Date.now()}`,
      status: 'Active',
    });
    const sheet = await models.TeeSheet.create({ course_id: course.id, name: 'Main Sheet 2' });
    const side = await models.TeeSheetSide.create({
      tee_sheet_id: sheet.id,
      name: 'Front Nine',
      valid_from: '2025-06-01',
      valid_to: null,
    });

    const startTime = new Date('2025-07-01T07:00:00.000Z');
    await models.TeeTime.create({
      tee_sheet_id: sheet.id,
      side_id: side.id,
      start_time: startTime,
      capacity: 4,
    });

    await expect(
      models.TeeTime.create({
        tee_sheet_id: sheet.id,
        side_id: side.id,
        start_time: startTime,
        capacity: 4,
      })
    ).rejects.toThrow();
  });

  test('Associations: TeeSheet has sides, templates, tee_times', async () => {
    const course = await models.GolfCourseInstance.create({
      name: 'Course C',
      subdomain: `course-c-${Date.now()}`,
      status: 'Active',
    });
    const sheet = await models.TeeSheet.create({ course_id: course.id, name: 'Assoc Sheet' });
    const side = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Back Nine', valid_from: '2025-06-01' });
    const template = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: 'Weekend' });
    const tt = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side.id, start_time: new Date('2025-07-01T09:00:00Z') });

    const reloaded = await models.TeeSheet.findByPk(sheet.id, {
      include: [
        { model: models.TeeSheetSide, as: 'sides' },
        { model: models.DayTemplate, as: 'day_templates' },
        { model: models.TeeTime, as: 'tee_times' },
      ],
      order: [
        [{ model: models.TeeSheetSide, as: 'sides' }, 'created_at', 'ASC'],
        [{ model: models.DayTemplate, as: 'day_templates' }, 'created_at', 'ASC'],
        [{ model: models.TeeTime, as: 'tee_times' }, 'created_at', 'ASC'],
      ],
    });

    expect(reloaded.sides.map(s => s.name)).toContain('Back Nine');
    expect(reloaded.day_templates.map(t => t.name)).toContain('Weekend');
    expect(reloaded.tee_times.map(t => t.id)).toContain(tt.id);
  });
});


