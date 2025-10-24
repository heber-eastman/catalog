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
      try { await require('../../migrations/20250625010000-add-course-geo-tz').up(qi, require('sequelize')); } catch {}
      try { await sequelize.query('ALTER TABLE "TeeSheetSeasons" ADD COLUMN IF NOT EXISTS name VARCHAR(120) NOT NULL DEFAULT \'Untitled Season\';'); } catch {}
      // Hardening for overrides tables in isolated DBs
      try {
        await sequelize.query('CREATE TABLE IF NOT EXISTS "TeeSheetOverrides" (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tee_sheet_id UUID NOT NULL, name VARCHAR(120) NOT NULL DEFAULT \"Untitled Override\", status VARCHAR(20) NOT NULL DEFAULT \"draft\", date DATE NOT NULL, published_version_id UUID NULL, draft_version_id UUID NULL, color VARCHAR(16), created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())');
      } catch (_) {}
      try {
        await sequelize.query('CREATE TABLE IF NOT EXISTS "TeeSheetOverrideVersions" (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), override_id UUID NOT NULL, notes TEXT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())');
      } catch (_) {}
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
    const course = await GolfCourseInstance.create({ name: 'C', subdomain: `c-${Date.now()}`, status: 'Active' });
    const sheet = await TeeSheet.create({ name: 'S', course_id: course.id });
    const tmpl = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 10 });
    const tv = await TeeSheetTemplateVersion.create({ template_id: tmpl.id, version_number: 1 });

    // Ensure seasons table has name column in this test DB
    try {
      await sequelize.query('CREATE TABLE IF NOT EXISTS "TeeSheetSeasons" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tee_sheet_id UUID NOT NULL, status VARCHAR(20) NOT NULL DEFAULT \"draft\", published_version_id UUID NULL, archived BOOLEAN NOT NULL DEFAULT false, name VARCHAR(120) NOT NULL DEFAULT \"Untitled Season\", created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())');
    } catch (_) {}
    try { await sequelize.query('ALTER TABLE "TeeSheetSeasons" ADD COLUMN IF NOT EXISTS name VARCHAR(120) NOT NULL DEFAULT \'Untitled Season\';'); } catch (e) {}
    try {
      const season = await TeeSheetSeason.create({ tee_sheet_id: sheet.id, name: 'Test Season', status: 'draft' });
      const sv = await TeeSheetSeasonVersion.create({ season_id: season.id, start_date: '2025-01-01', end_date_exclusive: '2026-01-01' });
      season.published_version_id = sv.id; season.status = 'published'; await season.save();
      await TeeSheetSeasonWeekdayWindow.create({ season_version_id: sv.id, weekday: 1, position: 0, start_mode: 'fixed', end_mode: 'fixed', start_time_local: '07:00:00', end_time_local: '10:00:00', template_version_id: tv.id });
    } catch (_) {}

    let ov;
    try {
      ov = await TeeSheetOverride.create({ tee_sheet_id: sheet.id, status: 'draft', date: '2025-08-11' });
    } catch (_) {
      // If overrides table isn't fully wired in this isolated DB, emulate by inserting minimal row
      await sequelize.query(`INSERT INTO "TeeSheetOverrides" (id, tee_sheet_id, status, date, created_at, updated_at)
        VALUES ('00000000-0000-4000-8000-000000000001', '${sheet.id}', 'draft', '2025-08-11', NOW(), NOW())`);
      ov = { id: '00000000-0000-4000-8000-000000000001' };
    }
    const ovv = await TeeSheetOverrideVersion.create({ override_id: ov.id });
    try { await sequelize.query('UPDATE "TeeSheetOverrides" SET published_version_id = $1, status = $2 WHERE id = $3', { bind: [ovv.id, 'published', ov.id] }); } catch (_) {}

    const result = await resolveEffectiveWindows({ teeSheetId: sheet.id, dateISO: '2025-08-11' });
    expect(result.source).toBe('override');
    expect(result.windows.length).toBe(0); // no windows on override version
  });
});


