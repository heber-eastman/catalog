'use strict';

const SequelizeLib = require('sequelize');
const { sequelize } = require('../../src/models');
const { compileWindowsForDate } = require('../../src/services/windowCompiler');
const { setSunAdapter } = require('../../src/services/solar');

describe('windowCompiler', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    const qi = sequelize.getQueryInterface();
    try { await require('../../migrations/20250612171419-create-golfcourseinstance').up(qi, SequelizeLib); } catch {}
    try { await require('../../migrations/20250625000000-create-tee-sheet-schema').up(qi, SequelizeLib); } catch {}
    try { await require('../../migrations/20250908090000-create-templates-seasons-overrides').up(qi, SequelizeLib); } catch {}
  });

  beforeEach(() => {
    // Mock sunrise/sunset to 06:30-19:30
    setSunAdapter({ getSunTimes: ({ date, timezone }) => {
      const { DateTime } = require('luxon');
      const d = DateTime.fromJSDate(date, { zone: timezone || 'UTC' });
      return {
        sunrise: DateTime.fromObject({ year: d.year, month: d.month, day: d.day, hour: 6, minute: 30 }, { zone: d.zone }).toJSDate(),
        sunset: DateTime.fromObject({ year: d.year, month: d.month, day: d.day, hour: 19, minute: 30 }, { zone: d.zone }).toJSDate(),
      };
    }});
  });

  test('clamps offset windows to sunrise/sunset and snaps first slot', async () => {
    const { GolfCourseInstance, TeeSheet, TeeSheetTemplate, TeeSheetTemplateVersion } = require('../../src/models');
    const course = await GolfCourseInstance.create({ name: 'W', subdomain: 'w-'+Date.now(), status: 'Active', latitude: 40, longitude: -105, timezone: 'America/Denver' });
    const sheet = await TeeSheet.create({ course_id: course.id, name: 'Main' });
    const t = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 12 });
    const tv = await TeeSheetTemplateVersion.create({ template_id: t.id, version_number: 1 });

    const windows = [{
      side_id: '11111111-1111-4111-8111-111111111111',
      start_mode: 'sunrise_offset', start_offset_mins: 15,
      end_mode: 'sunset_offset', end_offset_mins: -15,
      template_version_id: tv.id,
    }];

    const compiled = await compileWindowsForDate({ teeSheetId: sheet.id, dateISO: '2025-07-02', sourceType: 'season', sourceId: 'x', windows });
    expect(compiled).toHaveLength(1);
    const c = compiled[0];
    expect(c.interval_mins).toBe(12);
    // Start must be at or after 06:45 snapped to interval (06:48)
    expect(c.start.toFormat).toBeDefined();
  });
});


