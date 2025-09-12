/* eslint-env jest */
const { sequelize, TeeSheet, TeeSheetSide, GolfCourseInstance, TeeSheetOverride, TeeSheetOverrideVersion, TeeSheetOverrideWindow, TeeTime, TeeSheetTemplate, TeeSheetTemplateVersion } = require('../../src/models');
const path = require('path');
const { execSync } = require('child_process');
const { generateForDateV2 } = require('../../src/services/teeSheetGenerator.v2');

describe('generator v2', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    // Ensure any missing tables are created (safe no-op if they already exist)
    try { await sequelize.sync(); } catch (_) {}
    // Ensure migrations applied if running in isolation (CI guard)
    try {
      const [rows] = await sequelize.query(`SELECT to_regclass('public."TeeSheets"') AS teesheets, to_regclass('public."TeeSheetTemplates"') AS templates`);
      const hasSheets = !!rows?.[0]?.teesheets;
      const hasV2 = !!rows?.[0]?.templates;
      if (!hasSheets || !hasV2) {
        execSync('npx sequelize-cli db:migrate', { stdio: 'inherit', cwd: path.join(__dirname, '../..') });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Pre-test migration check (generator v2) failed:', e.message);
    }
  });
  beforeEach(async () => {
    try { await sequelize.query('TRUNCATE "TeeTimes" RESTART IDENTITY CASCADE'); } catch (_) {}
    try { await sequelize.query('TRUNCATE "TeeSheetOverrideWindows", "TeeSheetOverrideVersions", "TeeSheetOverrides", "TeeSheetTemplateSidePrices", "TeeSheetTemplateSideAccess", "TeeSheetTemplateSides", "TeeSheetTemplateVersions", "TeeSheetTemplates" RESTART IDENTITY CASCADE'); } catch (_) {}
    try { await sequelize.query('TRUNCATE "TeeSheetSides", "TeeSheets" RESTART IDENTITY CASCADE'); } catch (_) {}
  });

  it('generates slots for fixed windows using template interval', async () => {
    const course = await GolfCourseInstance.create({ name: 'C2', subdomain: `c-${Date.now()}`, status: 'Active', timezone: 'UTC' });
    const sheet = await TeeSheet.create({ name: 'S2', course_id: course.id });
    const side = await TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'A', valid_from: '2025-01-01', interval_mins: 30 });

    let tmpl;
    try {
      tmpl = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 30 });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('TeeSheetTemplate.create failed:', e && (e.parent || e));
      throw e;
    }
    const tv = await TeeSheetTemplateVersion.create({ template_id: tmpl.id, version_number: 1 });
    // Ensure template is publishable (coverage + public price) so compiler can resolve interval
    const { TeeSheetTemplateSide, TeeSheetTemplateSidePrices } = require('../../src/models');
    await TeeSheetTemplateSide.create({ version_id: tv.id, side_id: side.id, start_slots_enabled: true });
    await TeeSheetTemplateSidePrices.create({ version_id: tv.id, side_id: side.id, booking_class_id: 'public', greens_fee_cents: 0, cart_fee_cents: 0 });
    tmpl.published_version_id = tv.id; tmpl.status = 'published'; await tmpl.save();
    const ov = await TeeSheetOverride.create({ tee_sheet_id: sheet.id, status: 'draft', date: '2025-08-15' });
    const ovv = await TeeSheetOverrideVersion.create({ override_id: ov.id });
    await TeeSheetOverrideWindow.create({ override_version_id: ovv.id, side_id: side.id, start_mode: 'fixed', end_mode: 'fixed', start_time_local: '08:00:00', end_time_local: '09:00:00', template_version_id: tv.id });
    ov.published_version_id = ovv.id; ov.status = 'published'; await ov.save();

    const { generated } = await generateForDateV2({ teeSheetId: sheet.id, dateISO: '2025-08-15' });
    expect(generated).toBeGreaterThan(0);
    const slots = await TeeTime.findAll({ where: { tee_sheet_id: sheet.id } });
    expect(slots.length).toBe(generated);
    // Interval 30 -> expect at least 3 slots between 08:00 and 09:00: 08:00, 08:30
    expect(slots.length).toBeGreaterThanOrEqual(2);
  });
});


