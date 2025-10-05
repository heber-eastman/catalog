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
const { compileWindowsForDate } = require('./windowCompiler');

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

  // Compile windows with clamp/snap and correct interval per template version
  const compiled = await compileWindowsForDate({ teeSheetId, dateISO, sourceType: 'effective', sourceId: null, windows });

  for (const c of compiled) {
    const side = sides[c.side_id];
    if (!side) continue;

    const startsEnabled = c.start_slots_enabled !== false; // may not exist; default true

    // Cleanup: remove misaligned, unassigned tee times inside this window for this side
    const windowStartUtc = c.start.toUTC().toJSDate();
    const windowEndUtc = c.end.toUTC().toJSDate();
    const expected = new Set();
    for (let t = c.start; t < c.end; t = t.plus({ minutes: c.interval_mins })) {
      expected.add(t.toUTC().toJSDate().getTime());
    }
    const existing = await TeeTime.findAll({
      where: {
        tee_sheet_id: teeSheetId,
        side_id: c.side_id,
        start_time: { [Op.gte]: windowStartUtc, [Op.lt]: windowEndUtc },
      },
      order: [['start_time', 'ASC']],
    });
    for (const row of existing) {
      const ts = row.start_time instanceof Date ? row.start_time.getTime() : new Date(row.start_time).getTime();
      if (!expected.has(ts) && Number(row.assigned_count || 0) === 0) {
        try { await row.destroy(); } catch (_) {}
      }
    }

    // Disallow cross-midnight: compiler already clamps to same day
    for (let t = c.start; t < c.end; t = t.plus({ minutes: c.interval_mins })) {
      if (!startsEnabled) continue; // generate no start rows if start-disabled

      const startsAt = t.toUTC().toJSDate();

      const whereClause = {
        tee_sheet_id: teeSheetId,
        starts_at: { [Op.lte]: startsAt },
        ends_at: { [Op.gt]: startsAt },
      };
      whereClause[Op.or] = [{ side_id: c.side_id }, { side_id: null }];
      const closure = await ClosureBlock.findOne({ where: whereClause });

      const [row, created] = await TeeTime.findOrCreate({
        where: { tee_sheet_id: teeSheetId, side_id: c.side_id, start_time: startsAt },
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



