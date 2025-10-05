'use strict';

const { DateTime } = require('luxon');
const { getSunTimes } = require('./solar');
const { courseTz } = require('../lib/time');
const { GolfCourseInstance, TeeSheet, TeeSheetTemplateVersion, TeeSheetTemplateSide } = require('../models');

function clampToDay({ start, end }) {
  const startClamped = start < start.startOf('day') ? start.startOf('day') : start;
  const endOfDay = end.startOf('day').plus({ days: 1 });
  const endClamped = end > endOfDay ? endOfDay : end;
  return { start: startClamped, end: endClamped };
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

  const sun = getSunTimes({ date: dateLocal.toJSDate(), latitude: course?.latitude, longitude: course?.longitude, timezone: zone });
  const sunrise = tz.fromJSDate(sun.sunrise);
  const sunset = tz.fromJSDate(sun.sunset);

  const compiled = [];
  for (const w of windows) {
    // Resolve start/end by modes
    let startLocal;
    let endLocal;
    if (w.start_mode === 'fixed') {
      const [h, m = '0', s = '0'] = (w.start_time_local || '00:00:00').split(':');
      startLocal = DateTime.fromObject({ year: dateLocal.year, month: dateLocal.month, day: dateLocal.day, hour: Number(h), minute: Number(m), second: Number(s) }, { zone });
    } else {
      startLocal = sunrise.plus({ minutes: Number(w.start_offset_mins || 0) });
    }
    if (w.end_mode === 'fixed') {
      const [h, m = '0', s = '0'] = (w.end_time_local || '23:59:59').split(':');
      endLocal = DateTime.fromObject({ year: dateLocal.year, month: dateLocal.month, day: dateLocal.day, hour: Number(h), minute: Number(m), second: Number(s) }, { zone });
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
    const tv = await TeeSheetTemplateVersion.findByPk(tvId);
    const template = tv ? await tv.getTemplate?.() : null;
    const interval = template?.interval_mins || 10;
    const snappedStart = start.startOf('minute');

    // Expand season windows to all sides in the template version. Override windows may already carry side_id.
    let sides = [];
    if (w.side_id) {
      sides = [{ side_id: w.side_id, start_slots_enabled: true }];
    } else {
      sides = await TeeSheetTemplateSide.findAll({ where: { version_id: tvId } });
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


