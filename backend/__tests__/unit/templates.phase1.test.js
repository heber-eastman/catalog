/* eslint-env jest */
const { sequelize, TeeSheet, GolfCourseInstance } = require('../../src/models');
const SequelizeLib = require('sequelize');
const path = require('path');
const { execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

async function createSheet(course, name) {
  try {
    return await TeeSheet.create({ id: uuidv4(), name, course_id: course.id });
  } catch (e) {
    // Log full parent error details in CI for diagnosis
    // eslint-disable-next-line no-console
    console.error('TeeSheet.create failed:', e && (e.parent || e));
    throw e;
  }
}

describe('Phase1 integrity - templates/seasons/overrides', () => {
  beforeAll(async () => {
    // Ensure DB is up and required tables exist (CI guard)
    await sequelize.authenticate();
    const qi = sequelize.getQueryInterface();
    try { await require('../../migrations/20250612171419-create-golfcourseinstance').up(qi, SequelizeLib); } catch (e) {}
    try { await require('../../migrations/20250625000000-create-tee-sheet-schema').up(qi, SequelizeLib); } catch (e) {}
    try { await require('../../migrations/20250908090000-create-templates-seasons-overrides').up(qi, SequelizeLib); } catch (e) {}
    // Ensure columns used by models exist in this test DB
    try { await require('../../migrations/20250918150000-add-allowed-hole-totals').up(qi, SequelizeLib); } catch (e) {}
    try { await qi.sequelize.query('ALTER TABLE "TeeSheetSeasons" ADD COLUMN IF NOT EXISTS name VARCHAR(120) NOT NULL DEFAULT \'Untitled Season\';'); } catch (e) {}
    // Ensure overrides-related incremental migrations
    try { await require('../../migrations/20251008090500-add-name-to-overrides').up(qi, SequelizeLib); } catch (e) {}
    try { await require('../../migrations/20251010114500-add-draft-version-to-overrides').up(qi, SequelizeLib); } catch (e) {}
    try { await require('../../migrations/20251010090000-add-position-to-override-windows').up(qi, SequelizeLib); } catch (e) {}
    try { await require('../../migrations/20251010101500-remove-side-from-override-windows').up(qi, SequelizeLib); } catch (e) {}
    try { await require('../../migrations/20251017090000-add-color-to-seasons').up(qi, SequelizeLib); } catch (e) {}
    try { await require('../../migrations/20251017090500-add-color-to-overrides').up(qi, SequelizeLib); } catch (e) {}
  });

  it('creates versioned template tables and prevents delete when versions exist', async () => {
    const { TeeSheetTemplate, TeeSheetTemplateVersion } = require('../../src/models');

    const course = await GolfCourseInstance.create({ name: 'CourseA', subdomain: `c-${Date.now()}`, status: 'Active' });
    const sheet = await createSheet(course, 'Test Sheet');

    const t = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 10 });
    await TeeSheetTemplateVersion.create({ template_id: t.id, version_number: 1 });

    await expect(t.destroy()).rejects.toThrow(/versions/);
  });

  it('enforces override unique per (tee_sheet_id, date)', async () => {
    const { TeeSheetOverride } = require('../../src/models');
    const course = await GolfCourseInstance.create({ name: 'CourseB', subdomain: `c2-${Date.now()}`, status: 'Active' });
    const sheet = await createSheet(course, 'Sheet U');
    const date = '2025-08-15';
    await TeeSheetOverride.create({ tee_sheet_id: sheet.id, status: 'draft', date });
    await expect(
      TeeSheetOverride.create({ tee_sheet_id: sheet.id, status: 'draft', date })
    ).rejects.toThrow();
  });

  it('enforces unique (template_id, version_number) on template versions', async () => {
    const { TeeSheetTemplate, TeeSheetTemplateVersion } = require('../../src/models');
    const course = await GolfCourseInstance.create({ name: 'CourseC', subdomain: `c3-${Date.now()}`, status: 'Active' });
    const sheet = await createSheet(course, 'Sheet C');
    const tmpl = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 10 });
    await TeeSheetTemplateVersion.create({ template_id: tmpl.id, version_number: 1 });
    await expect(
      TeeSheetTemplateVersion.create({ template_id: tmpl.id, version_number: 1 })
    ).rejects.toThrow();
  });

  it('enforces unique (season_version_id, weekday, position) on weekday windows', async () => {
    const { TeeSheetSeason, TeeSheetSeasonVersion, TeeSheetSeasonWeekdayWindow, TeeSheetTemplate, TeeSheetTemplateVersion } = require('../../src/models');
    const course = await GolfCourseInstance.create({ name: 'CourseD', subdomain: `c4-${Date.now()}`, status: 'Active' });
    const sheet = await createSheet(course, 'Sheet D');
    const tmpl = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 10 });
    const tmplV = await TeeSheetTemplateVersion.create({ template_id: tmpl.id, version_number: 1 });
    const season = await TeeSheetSeason.create({ tee_sheet_id: sheet.id, name: 'Test Season', status: 'draft' });
    const seasonV = await TeeSheetSeasonVersion.create({ season_id: season.id, start_date: '2025-01-01', end_date_exclusive: '2025-12-31' });
    await TeeSheetSeasonWeekdayWindow.create({ season_version_id: seasonV.id, weekday: 1, position: 0, start_mode: 'fixed', end_mode: 'fixed', start_time_local: '07:00:00', end_time_local: '18:00:00', template_version_id: tmplV.id });
    await expect(
      TeeSheetSeasonWeekdayWindow.create({ season_version_id: seasonV.id, weekday: 1, position: 0, start_mode: 'fixed', end_mode: 'fixed', start_time_local: '08:00:00', end_time_local: '17:00:00', template_version_id: tmplV.id })
    ).rejects.toThrow();
    // Contiguity guard: next position must be 1
    await expect(
      TeeSheetSeasonWeekdayWindow.create({ season_version_id: seasonV.id, weekday: 1, position: 2, start_mode: 'fixed', end_mode: 'fixed', start_time_local: '09:00:00', end_time_local: '17:00:00', template_version_id: tmplV.id })
    ).rejects.toThrow(/contiguous/);
  });

  it('enforces unique (version_id, side_id, booking_class_id) for access and prices', async () => {
    const { TeeSheetTemplate, TeeSheetTemplateVersion, TeeSheetTemplateSideAccess, TeeSheetTemplateSidePrices } = require('../../src/models');
    const course = await GolfCourseInstance.create({ name: 'CourseE', subdomain: `c5-${Date.now()}`, status: 'Active' });
    const sheet = await createSheet(course, 'Sheet E');
    const side = await require('../../src/models').TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Front', valid_from: '2025-01-01' });
    const tmpl = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 10 });
    const tmplV = await TeeSheetTemplateVersion.create({ template_id: tmpl.id, version_number: 1 });
    await TeeSheetTemplateSideAccess.create({ version_id: tmplV.id, side_id: side.id, booking_class_id: 'public', is_allowed: true });
    await expect(
      TeeSheetTemplateSideAccess.create({ version_id: tmplV.id, side_id: side.id, booking_class_id: 'public', is_allowed: false })
    ).rejects.toThrow();
    await TeeSheetTemplateSidePrices.create({ version_id: tmplV.id, side_id: side.id, booking_class_id: 'public', greens_fee_cents: 1000, cart_fee_cents: 2000 });
    await expect(
      TeeSheetTemplateSidePrices.create({ version_id: tmplV.id, side_id: side.id, booking_class_id: 'public', greens_fee_cents: 1500, cart_fee_cents: 2500 })
    ).rejects.toThrow();
  });

  it('prevents publishing template without full side coverage or public prices', async () => {
    const { TeeSheetTemplate, TeeSheetTemplateVersion, TeeSheetTemplateSide } = require('../../src/models');
    const course = await GolfCourseInstance.create({ name: 'CourseF', subdomain: `c6-${Date.now()}`, status: 'Active' });
    const sheet = await createSheet(course, 'Sheet F');
    const sideA = await require('../../src/models').TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'A', valid_from: '2025-01-01' });
    const sideB = await require('../../src/models').TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'B', valid_from: '2025-01-01' });
    const tmpl = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 10 });
    const v1 = await TeeSheetTemplateVersion.create({ template_id: tmpl.id, version_number: 1 });
    // Cover only side A, and add no public prices
    await TeeSheetTemplateSide.create({ version_id: v1.id, side_id: sideA.id, start_slots_enabled: true, max_legs_starting: 1, min_players: 1, walk_ride_mode: 'either' });
    await expect(
      (async () => { tmpl.published_version_id = v1.id; await tmpl.save(); })()
    ).rejects.toThrow(/all sides/);
  });

  it('prevents deleting published versions (template/season/override)', async () => {
    const { TeeSheetTemplate, TeeSheetTemplateVersion, TeeSheetSeason, TeeSheetSeasonVersion, TeeSheetOverride, TeeSheetOverrideVersion } = require('../../src/models');
    const course = await GolfCourseInstance.create({ name: 'CourseG', subdomain: `c7-${Date.now()}`, status: 'Active' });
    const sheet = await createSheet(course, 'Sheet G');
    const tmpl = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 10 });
    const tv = await TeeSheetTemplateVersion.create({ template_id: tmpl.id, version_number: 1 });
    tmpl.published_version_id = tv.id; await tmpl.save();
    await expect(tv.destroy()).rejects.toThrow(/published/);

    const season = await TeeSheetSeason.create({ tee_sheet_id: sheet.id, status: 'draft' });
    const sv = await TeeSheetSeasonVersion.create({ season_id: season.id, start_date: '2025-01-01', end_date_exclusive: '2025-12-31' });
    season.published_version_id = sv.id; await season.save();
    await expect(sv.destroy()).rejects.toThrow(/published/);

    const ov = await TeeSheetOverride.create({ tee_sheet_id: sheet.id, status: 'draft', date: '2025-08-15' });
    const ovv = await TeeSheetOverrideVersion.create({ override_id: ov.id });
    ov.published_version_id = ovv.id; await ov.save();
    await expect(ovv.destroy()).rejects.toThrow(/published/);
  });
});


