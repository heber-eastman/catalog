'use strict';

const SequelizeLib = require('sequelize');
const { sequelize } = require('../../src/models');
const { regenerateApplyNow } = require('../../src/services/cascadeEngine');

describe('cascadeEngine', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    const qi = sequelize.getQueryInterface();
    try { await require('../../migrations/20250612171419-create-golfcourseinstance').up(qi, SequelizeLib); } catch {}
    try { await require('../../migrations/20250625000000-create-tee-sheet-schema').up(qi, SequelizeLib); } catch {}
    try { await require('../../migrations/20250908090000-create-templates-seasons-overrides').up(qi, SequelizeLib); } catch {}
  });

  test('regenerateApplyNow regenerates for a day', async () => {
    const { GolfCourseInstance, TeeSheet, TeeSheetSide, TeeSheetTemplate, TeeSheetTemplateVersion, TeeSheetTemplateSide, TeeSheetTemplateSidePrices, TeeSheetSeason, TeeSheetSeasonVersion, TeeSheetSeasonWeekdayWindow, TeeTime } = require('../../src/models');
    const course = await GolfCourseInstance.create({ name: 'CE', subdomain: 'ce-'+Date.now(), status: 'Active', timezone: 'UTC' });
    const sheet = await TeeSheet.create({ course_id: course.id, name: 'Main' });
    const side = await TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'A', valid_from: '2025-01-01', interval_mins: 10 });
    const t = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 10 });
    const tv = await TeeSheetTemplateVersion.create({ template_id: t.id, version_number: 1 });
    await TeeSheetTemplateSide.create({ version_id: tv.id, side_id: side.id, start_slots_enabled: true });
    await TeeSheetTemplateSidePrices.create({ version_id: tv.id, side_id: side.id, booking_class_id: 'public', greens_fee_cents: 0, cart_fee_cents: 0 });
    t.published_version_id = tv.id; t.status = 'published'; await t.save();
    const season = await TeeSheetSeason.create({ tee_sheet_id: sheet.id, status: 'draft' });
    const sv = await TeeSheetSeasonVersion.create({ season_id: season.id, start_date: '2025-08-01', end_date_exclusive: '2025-08-03' });
    await TeeSheetSeasonWeekdayWindow.create({ season_version_id: sv.id, weekday: 5, position: 0, start_mode: 'fixed', end_mode: 'fixed', start_time_local: '08:00:00', end_time_local: '09:00:00', template_version_id: tv.id });
    season.published_version_id = sv.id; season.status = 'published'; await season.save();

    // Also create a published override on that date to guarantee effective windows
    const { TeeSheetOverride, TeeSheetOverrideVersion, TeeSheetOverrideWindow } = require('../../src/models');
    const ov = await TeeSheetOverride.create({ tee_sheet_id: sheet.id, status: 'draft', date: '2025-08-01' });
    const ovv = await TeeSheetOverrideVersion.create({ override_id: ov.id });
    await TeeSheetOverrideWindow.create({ override_version_id: ovv.id, side_id: side.id, start_mode: 'fixed', end_mode: 'fixed', start_time_local: '08:00:00', end_time_local: '09:00:00', template_version_id: tv.id });
    ov.published_version_id = ovv.id; ov.status = 'published'; await ov.save();

    const res = await regenerateApplyNow({ teeSheetId: sheet.id, startDateISO: '2025-08-01', endDateISO: '2025-08-01' });
    expect(res.regenerated).toBeGreaterThan(0);
    const rows = await TeeTime.findAll({ where: { tee_sheet_id: sheet.id } });
    expect(rows.length).toBeGreaterThan(0);
  });
});


