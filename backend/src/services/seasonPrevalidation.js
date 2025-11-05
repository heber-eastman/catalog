'use strict';

const { DateTime } = require('luxon');
const {
  TeeSheet,
  TeeSheetSide,
  TeeSheetSeasonVersion,
  TeeSheetTemplate,
  TeeSheetTemplateVersion,
  TeeSheetSeasonWeekdayWindow,
  GolfCourseInstance,
} = require('../models');
const { templateCoversSideSet } = require('./validators.v2');
const { compileWindowsForDate } = require('./windowCompiler');

async function getEffectiveSideIds(teeSheetId, dateISO) {
  const date = DateTime.fromISO(dateISO).toJSDate();
  const sides = await TeeSheetSide.findAll({ where: { tee_sheet_id: teeSheetId } });
  return sides
    .filter(s => {
      const from = s.valid_from ? new Date(s.valid_from) : null;
      const to = s.valid_to ? new Date(s.valid_to) : null;
      const geFrom = !from || from <= date;
      const ltTo = !to || date < to;
      return geFrom && ltTo;
    })
    .map(s => s.id);
}

async function prevalidateSeasonVersion({ teeSheetId, seasonVersionId }) {
  const sheet = await TeeSheet.findByPk(teeSheetId);
  if (!sheet) throw new Error('TeeSheet not found');
  const course = await GolfCourseInstance.findByPk(sheet.course_id);
  const zone = course?.timezone || 'UTC';

  const ver = await TeeSheetSeasonVersion.findByPk(seasonVersionId);
  if (!ver) throw new Error('Season version not found');

  const windows = await TeeSheetSeasonWeekdayWindow.findAll({ where: { season_version_id: ver.id } });
  const violations = [];
  if (windows.length === 0) {
    return { ok: true, violations };
  }

  const start = DateTime.fromISO(ver.start_date, { zone });
  const end = DateTime.fromISO(ver.end_date_exclusive, { zone });
  for (let d = start; d < end; d = d.plus({ days: 1 })) {
    const dateISO = d.toISODate();
    const weekday = d.weekday % 7;
    const dayWindows = windows.filter(w => w.weekday === weekday);
    if (dayWindows.length === 0) continue; // no config for this weekday, skip
    const sideIds = await getEffectiveSideIds(teeSheetId, dateISO);
    for (const w of dayWindows) {
      // 1) referenced template version must exist and belong to a template
      const tv = await TeeSheetTemplateVersion.findByPk(w.template_version_id);
      if (!tv) {
        violations.push({ date: dateISO, code: 'missing_template_version', windowId: w.id });
        continue;
      }
      let tmpl = null;
      try {
        tmpl = await TeeSheetTemplate.findByPk(tv.template_id);
      } catch (e) {
        const code = e && (e.parent?.code || e.original?.code);
        if (String(code) === '42P01' || String(code) === '42703') {
          try {
            const [rows] = await require('../models').sequelize.query('SELECT id FROM "TeeSheetTemplates" WHERE id = :id LIMIT 1', { replacements: { id: tv.template_id } });
            tmpl = (Array.isArray(rows) && rows.length > 0) ? { id: rows[0].id } : null;
          } catch (_) {}
        } else {
          throw e;
        }
      }
      if (!tmpl) {
        violations.push({ date: dateISO, code: 'missing_template_for_version', windowId: w.id });
        continue;
      }
      // 2) template covers effective side set
      const covers = await templateCoversSideSet(tv.id, sideIds);
      if (!covers) {
        violations.push({ date: dateISO, code: 'template_missing_side_coverage', windowId: w.id });
      }
      // 3) compiled window must produce a valid interval
      const compiled = await compileWindowsForDate({ teeSheetId, dateISO, sourceType: 'season', sourceId: ver.id, windows: [w] });
      if (!compiled.length) {
        violations.push({ date: dateISO, code: 'invalid_window_after_clamp', windowId: w.id });
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

module.exports = { prevalidateSeasonVersion };


