/* eslint-env jest */
const { sequelize, TeeSheet, TeeSheetSide, GolfCourseInstance, TeeSheetOverride, TeeSheetOverrideVersion, TeeSheetOverrideWindow, TeeTime, TeeSheetTemplate, TeeSheetTemplateVersion } = require('../../src/models');
const { generateForDateV2 } = require('../../src/services/teeSheetGenerator.v2');

describe('generator v2', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });
  beforeEach(async () => {
    await sequelize.query('TRUNCATE "TeeTimes" RESTART IDENTITY CASCADE');
    await sequelize.query('TRUNCATE "TeeSheetOverrideWindows", "TeeSheetOverrideVersions", "TeeSheetOverrides", "TeeSheetTemplateSidePrices", "TeeSheetTemplateSideAccess", "TeeSheetTemplateSides", "TeeSheetTemplateVersions", "TeeSheetTemplates" RESTART IDENTITY CASCADE');
    await sequelize.query('TRUNCATE "TeeSheetSides", "TeeSheets" RESTART IDENTITY CASCADE');
  });

  it('generates slots for fixed windows', async () => {
    const course = await GolfCourseInstance.create({ name: 'C2', subdomain: `c-${Date.now()}`, status: 'Active', timezone: 'UTC' });
    const sheet = await TeeSheet.create({ name: 'S2', course_id: course.id });
    const side = await TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'A', valid_from: '2025-01-01', interval_mins: 30 });

    const tmpl = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 30 });
    const tv = await TeeSheetTemplateVersion.create({ template_id: tmpl.id, version_number: 1 });
    const ov = await TeeSheetOverride.create({ tee_sheet_id: sheet.id, status: 'draft', date: '2025-08-15' });
    const ovv = await TeeSheetOverrideVersion.create({ override_id: ov.id });
    await TeeSheetOverrideWindow.create({ override_version_id: ovv.id, side_id: side.id, start_mode: 'fixed', end_mode: 'fixed', start_time_local: '08:00:00', end_time_local: '09:00:00', template_version_id: tv.id });
    ov.published_version_id = ovv.id; ov.status = 'published'; await ov.save();

    const { generated } = await generateForDateV2({ teeSheetId: sheet.id, dateISO: '2025-08-15' });
    expect(generated).toBeGreaterThan(0);
    const slots = await TeeTime.findAll({ where: { tee_sheet_id: sheet.id } });
    expect(slots.length).toBe(generated);
  });
});


