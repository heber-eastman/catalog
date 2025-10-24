'use strict';

const SequelizeLib = require('sequelize');
const { sequelize } = require('../../src/models');
const { prevalidateSeasonVersion } = require('../../src/services/seasonPrevalidation');

describe('seasonPrevalidation', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    const qi = sequelize.getQueryInterface();
    try { await require('../../migrations/20250612171419-create-golfcourseinstance').up(qi, SequelizeLib); } catch {}
    try { await require('../../migrations/20250625000000-create-tee-sheet-schema').up(qi, SequelizeLib); } catch {}
    try { await require('../../migrations/20250908090000-create-templates-seasons-overrides').up(qi, SequelizeLib); } catch {}
    try { await require('../../migrations/20250918150000-add-allowed-hole-totals').up(qi, SequelizeLib); } catch {}
    try { await sequelize.query('ALTER TABLE "TeeSheetSeasons" ADD COLUMN IF NOT EXISTS name VARCHAR(120) NOT NULL DEFAULT \'Untitled Season\';'); } catch {}
    try { await require('../../migrations/20251008090500-add-name-to-overrides').up(qi, SequelizeLib); } catch {}
    try { await require('../../migrations/20251010114500-add-draft-version-to-overrides').up(qi, SequelizeLib); } catch {}
    try { await require('../../migrations/20251010090000-add-position-to-override-windows').up(qi, SequelizeLib); } catch {}
    try { await require('../../migrations/20251010101500-remove-side-from-override-windows').up(qi, SequelizeLib); } catch {}
    try { await require('../../migrations/20251017090000-add-color-to-seasons').up(qi, SequelizeLib); } catch {}
    try { await require('../../migrations/20251017090500-add-color-to-overrides').up(qi, SequelizeLib); } catch {}
  });

  test('returns ok when windows cover sides and template is published', async () => {
    const { GolfCourseInstance, TeeSheet, TeeSheetSide, TeeSheetTemplate, TeeSheetTemplateVersion, TeeSheetTemplateSide, TeeSheetTemplateSidePrices, TeeSheetSeason, TeeSheetSeasonVersion, TeeSheetSeasonWeekdayWindow } = require('../../src/models');
    const course = await GolfCourseInstance.create({ name: 'PV', subdomain: 'pv-'+Date.now(), status: 'Active' });
    const sheet = await TeeSheet.create({ course_id: course.id, name: 'Main' });
    const s1 = await TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'A', valid_from: new Date(), minutes_per_hole: 12, hole_count: 9, interval_mins: 10 });
    const s2 = await TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'B', valid_from: new Date(), minutes_per_hole: 12, hole_count: 9, interval_mins: 10 });
    const t = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 10 });
    const tv = await TeeSheetTemplateVersion.create({ template_id: t.id, version_number: 1 });
    await TeeSheetTemplateSide.bulkCreate([
      { version_id: tv.id, side_id: s1.id, start_slots_enabled: true },
      { version_id: tv.id, side_id: s2.id, start_slots_enabled: true },
    ]);
    await TeeSheetTemplateSidePrices.bulkCreate([
      { version_id: tv.id, side_id: s1.id, booking_class_id: 'public', greens_fee_cents: 1000, cart_fee_cents: 0 },
      { version_id: tv.id, side_id: s2.id, booking_class_id: 'public', greens_fee_cents: 1000, cart_fee_cents: 0 },
    ]);
    t.published_version_id = tv.id;
    t.status = 'published';
    await t.save();

    const season = await TeeSheetSeason.create({ tee_sheet_id: sheet.id, name: 'Test Season', status: 'draft' });
    const sv = await TeeSheetSeasonVersion.create({ season_id: season.id, start_date: '2025-07-01', end_date_exclusive: '2025-07-03' });
    await TeeSheetSeasonWeekdayWindow.create({ season_version_id: sv.id, weekday: 3, position: 0, start_mode: 'fixed', end_mode: 'fixed', start_time_local: '08:00:00', end_time_local: '17:00:00', template_version_id: tv.id });

    const res = await prevalidateSeasonVersion({ teeSheetId: sheet.id, seasonVersionId: sv.id });
    expect(res.ok).toBe(true);
    expect(res.violations).toEqual([]);
  });
});


