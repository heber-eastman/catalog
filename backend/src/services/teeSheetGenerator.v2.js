'use strict';

const { DateTime } = require('luxon');
const { Op } = require('sequelize');
const {
  TeeSheet,
  TeeSheetSide,
  TeeTime,
  ClosureBlock,
  GolfCourseInstance,
} = require('../models');
const { resolveEffectiveWindows } = require('./templateResolver');

function toLocalDateTime({ dateISO, timeLocal, zone }) {
  return DateTime.fromISO(`${dateISO}T${timeLocal}`, { zone });
}

async function generateForDateV2({ teeSheetId, dateISO }) {
  const sheet = await TeeSheet.findByPk(teeSheetId);
  if (!sheet) throw new Error('TeeSheet not found');
  const course = await GolfCourseInstance.findByPk(sheet.course_id);
  const zone = course?.timezone || 'UTC';

  const { windows } = await resolveEffectiveWindows({ teeSheetId, dateISO });
  if (!windows.length) return { generated: 0 };

  const sides = Object.fromEntries((await TeeSheetSide.findAll({ where: { tee_sheet_id: teeSheetId } })).map(s => [s.id, s]));
  let generated = 0;

  for (const w of windows) {
    const side = sides[w.side_id];
    if (!side) continue;

    // Compute start/end in local time depending on modes
    let startLocal;
    let endLocal;
    if (w.start_mode === 'fixed' && w.end_mode === 'fixed') {
      startLocal = toLocalDateTime({ dateISO, timeLocal: w.start_time_local, zone });
      endLocal = toLocalDateTime({ dateISO, timeLocal: w.end_time_local, zone });
    } else {
      // For offsets, fall back to 07:00-18:00 plus offsets for now; refine later
      const baseStart = DateTime.fromISO(`${dateISO}T07:00:00`, { zone }).plus({ minutes: w.start_offset_mins || 0 });
      const baseEnd = DateTime.fromISO(`${dateISO}T18:00:00`, { zone }).plus({ minutes: w.end_offset_mins || 0 });
      startLocal = baseStart;
      endLocal = baseEnd;
    }

    const interval = side.interval_mins || 8;
    const startsEnabled = w.start_slots_enabled !== false; // default true

    for (let t = startLocal; t < endLocal; t = t.plus({ minutes: interval })) {
      if (!startsEnabled) continue;

      const startsAt = t.toUTC().toJSDate();

      // Check closure overlaps
      const whereClause = {
        tee_sheet_id: teeSheetId,
        starts_at: { [Op.lte]: startsAt },
        ends_at: { [Op.gt]: startsAt },
      };
      whereClause[Op.or] = [{ side_id: w.side_id }, { side_id: null }];
      const closure = await ClosureBlock.findOne({ where: whereClause });

      const [row, created] = await TeeTime.findOrCreate({
        where: { tee_sheet_id: teeSheetId, side_id: w.side_id, start_time: startsAt },
        defaults: {
          capacity: 4,
          assigned_count: 0,
          is_blocked: !!closure,
          blocked_reason: closure ? (closure.reason || 'Closure') : null,
        },
      });
      if (!created) {
        if (closure && (!row.is_blocked || row.blocked_reason !== closure.reason)) {
          await row.update({ is_blocked: true, blocked_reason: closure.reason || 'Closure' });
        }
      } else {
        generated += 1;
      }
    }
  }

  return { generated };
}

module.exports = { generateForDateV2 };


