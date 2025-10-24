'use strict';

const SequelizeLib = require('sequelize');
const { sequelize } = require('../../src/models');
const { detectReroundCycles, templateCoversSideSet } = require('../../src/services/validators.v2');

describe('validators.v2', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    const qi = sequelize.getQueryInterface();
    try { await require('../../migrations/20250625000000-create-tee-sheet-schema').up(qi, SequelizeLib); } catch {}
    try { await require('../../migrations/20250908090000-create-templates-seasons-overrides').up(qi, SequelizeLib); } catch {}
    try { await require('../../migrations/20250918150000-add-allowed-hole-totals').up(qi, SequelizeLib); } catch {}
    try { await sequelize.query('ALTER TABLE "TeeSheetSeasons" ADD COLUMN IF NOT EXISTS name VARCHAR(120) NOT NULL DEFAULT \'Untitled Season\';'); } catch {}
  });

  test('detectReroundCycles throws on cycle', async () => {
    const { TeeSheet, GolfCourseInstance, TeeSheetSide, TeeSheetTemplate, TeeSheetTemplateVersion, TeeSheetTemplateSide } = require('../../src/models');
    const course = await GolfCourseInstance.create({ name: 'Cyc', subdomain: 'cyc-'+Date.now(), status: 'Active' });
    const sheet = await TeeSheet.create({ course_id: course.id, name: 'S' });
    const s1 = await TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Front 9', valid_from: new Date(), minutes_per_hole: 12, hole_count: 9, interval_mins: 10 });
    const s2 = await TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Back 9', valid_from: new Date(), minutes_per_hole: 12, hole_count: 9, interval_mins: 10 });
    const t = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 10 });
    const tv = await TeeSheetTemplateVersion.create({ template_id: t.id, version_number: 1 });
    await TeeSheetTemplateSide.create({ version_id: tv.id, side_id: s1.id, start_slots_enabled: true, rerounds_to_side_id: s2.id });
    await TeeSheetTemplateSide.create({ version_id: tv.id, side_id: s2.id, start_slots_enabled: true, rerounds_to_side_id: s1.id });

    await expect(detectReroundCycles(tv.id)).rejects.toThrow(/cycle/i);
  });

  test('templateCoversSideSet true when all sides present', async () => {
    const { TeeSheet, GolfCourseInstance, TeeSheetSide, TeeSheetTemplate, TeeSheetTemplateVersion, TeeSheetTemplateSide } = require('../../src/models');
    const course = await GolfCourseInstance.create({ name: 'Cov', subdomain: 'cov-'+Date.now(), status: 'Active' });
    const sheet = await TeeSheet.create({ course_id: course.id, name: 'S2' });
    const s1 = await TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'A', valid_from: new Date(), minutes_per_hole: 12, hole_count: 9, interval_mins: 10 });
    const s2 = await TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'B', valid_from: new Date(), minutes_per_hole: 12, hole_count: 9, interval_mins: 10 });
    const t = await TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 10 });
    const tv = await TeeSheetTemplateVersion.create({ template_id: t.id, version_number: 1 });
    await TeeSheetTemplateSide.create({ version_id: tv.id, side_id: s1.id, start_slots_enabled: true });
    await TeeSheetTemplateSide.create({ version_id: tv.id, side_id: s2.id, start_slots_enabled: true });

    await expect(templateCoversSideSet(tv.id, [s1.id, s2.id])).resolves.toBe(true);
  });
});


