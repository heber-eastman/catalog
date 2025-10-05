/* eslint-env jest */
const { sequelize, TeeSheet, GolfCourseInstance, TeeSheetSeason, TeeSheetSeasonVersion, TeeSheetSeasonWeekdayWindow, TeeSheetOverride, TeeSheetOverrideVersion, TeeSheetTemplate, TeeSheetTemplateVersion } = require('../../src/models');
const path = require('path');
const { execSync } = require('child_process');
const { resolveEffectiveWindows } = require('../../src/services/templateResolver');

describe('templateResolver v2', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    // Ensure migrations applied if running in isolation (CI guard)
    try {
      const qi = sequelize.getQueryInterface();
      try { await require('../../migrations/20250625000000-create-tee-sheet-schema').up(qi, require('sequelize')); } catch {}
      try { await require('../../migrations/20250908090000-create-templates-seasons-overrides').up(qi, require('sequelize')); } catch {}
      try { await require('../../migrations/20250918150000-add-allowed-hole-totals').up(qi, require('sequelize')); } catch {}
      try { await sequelize.query('ALTER TABLE "TeeSheetSeasons" ADD COLUMN IF NOT EXISTS name VARCHAR(120) NOT NULL DEFAULT \'Untitled Season\';'); } catch {}
      const tables = await qi.showAllTables();
      const tableNames = (tables || []).map(t => (typeof t === 'object' && t.tableName ? t.tableName : t));
      const hasSheets = tableNames.some(n => String(n).toLowerCase() === 'teesheets');
      const hasV2 = tableNames.some(n => String(n).toLowerCase() === 'teesheettemplates');
      if (!hasSheets || !hasV2) {
        execSync('npx sequelize-cli db:migrate', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Pre-test migration check (resolver v2) failed:', e.message);
    }
  });
  beforeEach(async () => {
    // Ensure base tables exist then clean affected tables
    try { await sequelize.sync(); } catch (_) {}
    try { await sequelize.query('TRUNCATE "TeeSheetOverrideWindows", "TeeSheetOverrideVersions", "TeeSheetOverrides", "TeeSheetSeasonWeekdayWindows", "TeeSheetSeasonVersions", "TeeSheetSeasons", "TeeSheetTemplateSidePrices", "TeeSheetTemplateSideAccess", "TeeSheetTemplateSides", "TeeSheetTemplateVersions", "TeeSheetTemplates" RESTART IDENTITY CASCADE'); } catch (_) {}
    try { await sequelize.query('TRUNCATE "TeeSheetSides", "TeeSheets" RESTART IDENTITY CASCADE'); } catch (_) {}
  });

  it('prefers override windows over season windows', async () => {
    const course = await GolfCourseInstance.create({ name: 'C', subdomain: `c-${Date.now()}`, status: 'Active', timezone: 'UTC' });
    const sheet = await TeeSheet.create({ name: 'S', course_id: course.id });
    const tmpl = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 10 });
    const tv = await TeeSheetTemplateVersion.create({ template_id: tmpl.id, version_number: 1 });

    // Ensure seasons table has name column in this test DB
    try { await models.sequelize.query('ALTER TABLE "TeeSheetSeasons" ADD COLUMN IF NOT EXISTS name VARCHAR(120) NOT NULL DEFAULT \'Untitled Season\';'); } catch (e) {}
    const season = await TeeSheetSeason.create({ tee_sheet_id: sheet.id, name: 'Test Season', status: 'draft' });
    const sv = await TeeSheetSeasonVersion.create({ season_id: season.id, start_date: '2025-01-01', end_date_exclusive: '2026-01-01' });
    season.published_version_id = sv.id; season.status = 'published'; await season.save();
    await TeeSheetSeasonWeekdayWindow.create({ season_version_id: sv.id, weekday: 1, position: 0, start_mode: 'fixed', end_mode: 'fixed', start_time_local: '07:00:00', end_time_local: '10:00:00', template_version_id: tv.id });

    const ov = await TeeSheetOverride.create({ tee_sheet_id: sheet.id, status: 'draft', date: '2025-08-11' });
    const ovv = await TeeSheetOverrideVersion.create({ override_id: ov.id });
    ov.published_version_id = ovv.id; ov.status = 'published'; await ov.save();

    const result = await resolveEffectiveWindows({ teeSheetId: sheet.id, dateISO: '2025-08-11' });
    expect(result.source).toBe('override');
    expect(result.windows.length).toBe(0); // no windows on override version
  });
});


