'use strict';

const { DateTime } = require('luxon');
const { getSunTimes } = require('./solar');
const { courseTz } = require('../lib/time');
const { GolfCourseInstance, TeeSheet, TeeSheetTemplateVersion, TeeSheetTemplateSide, TeeSheetSide } = require('../models');

function clampToDay({ start, end }) {
  const startClamped = start < start.startOf('day') ? start.startOf('day') : start;
  const endOfDay = end.startOf('day').plus({ days: 1 });
  const endClamped = end > endOfDay ? endOfDay : end;
  return { start: startClamped, end: endClamped };
}

function parseClock({ dateLocal, clock, zone }) {
  if (!clock || typeof clock !== 'string') return null;
  const candidates = [
    'HH:mm:ss', 'HH:mm', 'H:mm', 'h:mm a', 'hh:mm a', 'h a', 'hh a'
  ];
  for (const fmt of candidates) {
    const dt = DateTime.fromFormat(clock.trim(), fmt, { zone });
    if (dt.isValid) {
      return DateTime.fromObject({
        year: dateLocal.year, month: dateLocal.month, day: dateLocal.day,
        hour: dt.hour, minute: dt.minute, second: dt.second || 0,
      }, { zone });
    }
  }
  // Fallback: tolerate values like "05:15 PM" with uppercase or extra spaces
  const cleaned = clock.trim().replace(/\s+/g, ' ').toUpperCase();
  const dt2 = DateTime.fromFormat(cleaned, 'h:mm A', { zone });
  if (dt2.isValid) {
    return DateTime.fromObject({ year: dateLocal.year, month: dateLocal.month, day: dateLocal.day, hour: dt2.hour, minute: dt2.minute, second: dt2.second || 0 }, { zone });
  }
  return null;
}

async function compileWindowsForDate({ teeSheetId, dateISO, sourceType, sourceId, windows }) {
  // windows: raw rows from season weekday windows or override windows
  // normalize with sunrise/sunset and clamp to [00:00,24:00)
  const sheet = await TeeSheet.findByPk(teeSheetId);
  if (!sheet) throw new Error('TeeSheet not found');
  const course = await GolfCourseInstance.findByPk(sheet.course_id);
  const zone = course?.timezone || 'UTC';
  const tz = courseTz(zone);
  const dateLocal = tz.fromISO(`${dateISO}T00:00:00`);

  // Use a timezone-agnostic anchor (UTC noon) for SunCalc to avoid off-by-one when
  // the host system timezone differs from the course timezone.
  const dateForSun = DateTime.fromObject({ year: dateLocal.year, month: dateLocal.month, day: dateLocal.day, hour: 12, minute: 0, second: 0 }, { zone: 'UTC' }).toJSDate();
  const sun = getSunTimes({ date: dateForSun, latitude: course?.latitude, longitude: course?.longitude, timezone: zone });
  const sunrise = tz.fromJSDate(sun.sunrise);
  const sunset = tz.fromJSDate(sun.sunset);

  const compiled = [];
  for (const w of windows) {
    // Resolve start/end by modes
    let startLocal;
    let endLocal;
    if (w.start_mode === 'fixed') {
      startLocal = parseClock({ dateLocal, clock: w.start_time_local || '00:00:00', zone });
      if (!startLocal || !startLocal.isValid) continue;
    } else {
      startLocal = sunrise.plus({ minutes: Number(w.start_offset_mins || 0) });
    }
    if (w.end_mode === 'fixed') {
      endLocal = parseClock({ dateLocal, clock: w.end_time_local || '23:59:59', zone });
      if (!endLocal || !endLocal.isValid) continue;
    } else {
      endLocal = sunset.plus({ minutes: Number(w.end_offset_mins || 0) });
    }

    // Clamp to same day
    let { start, end } = clampToDay({ start: startLocal, end: endLocal });
    if (!end || !start || end <= start) {
      // auto-close invalid window
      continue;
    }

    // Use the exact window start time (minute precision) as the first slot start
    const tvId = w.template_version_id;
    let tv = null;
    try {
      tv = await TeeSheetTemplateVersion.findByPk(tvId);
    } catch (e) {
      const code = e && (e.parent?.code || e.original?.code);
      if (String(code) !== '42P01' && String(code) !== '42703') throw e;
    }
    let interval = 10;
    if (tv) {
      try {
        const template = await tv.getTemplate?.();
        if (template && typeof template.interval_mins === 'number') interval = template.interval_mins;
      } catch (_) {
        // fallback to raw if association not wired
        try {
          const [rows] = await require('../models').sequelize.query('SELECT t.interval_mins FROM "TeeSheetTemplates" t WHERE t.id = :tid', { replacements: { tid: tv.template_id } });
          if (Array.isArray(rows) && rows.length && typeof rows[0].interval_mins === 'number') interval = rows[0].interval_mins;
        } catch (_) {}
      }
    } else {
      // As a last resort, attempt raw join from version id → template interval
      try {
        const [rows] = await require('../models').sequelize.query(
          'SELECT t.interval_mins FROM "TeeSheetTemplateVersions" v JOIN "TeeSheetTemplates" t ON t.id = v.template_id WHERE v.id = :vid',
          { replacements: { vid: tvId } }
        );
        if (Array.isArray(rows) && rows.length && typeof rows[0].interval_mins === 'number') interval = rows[0].interval_mins;
      } catch (_) {}
    }
    const snappedStart = start.startOf('minute');

    // Expand season windows to all sides in the template version. Override windows may already carry side_id.
    let sides = [];
    if (w.side_id) {
      sides = [{ side_id: w.side_id, start_slots_enabled: true }];
    } else {
      // Prefer explicit side mappings for the template version
      const mapped = await TeeSheetTemplateSide.findAll({ where: { version_id: tvId } });
      if (mapped && mapped.length) {
        sides = mapped;
      } else {
        // Fallback: when a version has no side mappings yet, fan out to all sides on the sheet
        const allSides = await TeeSheetSide.findAll({ where: { tee_sheet_id: teeSheetId } });
        sides = allSides.map(s => ({ side_id: s.id, start_slots_enabled: true }));
      }
    }

    for (const s of sides) {
      const sideId = s.side_id || s?.dataValues?.side_id;
      if (!sideId) continue;
      const startsEnabled = (typeof s.start_slots_enabled === 'boolean') ? s.start_slots_enabled : true;
      compiled.push({
        side_id: sideId,
        template_version_id: tvId,
        start: snappedStart,
        end,
        interval_mins: interval,
        start_slots_enabled: startsEnabled,
        sourceType,
        sourceId,
      });
    }
  }

  // Order by side, start
  compiled.sort((a, b) => (a.side_id === b.side_id ? a.start - b.start : String(a.side_id).localeCompare(String(b.side_id))));
  return compiled;
}

module.exports = { compileWindowsForDate };


