'use strict';

const { DateTime } = require('luxon');
const { Op } = require('sequelize');
const {
  TeeSheet,
  TeeSheetSide,
  TeeTime,
  ClosureBlock,
  GolfCourseInstance,
  TeeSheetTemplateSide,
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
  const versionIds = Array.from(new Set(compiled.map(w => w.template_version_id).filter(Boolean)));
  const sideCfgList = versionIds.length
    ? await TeeSheetTemplateSide.findAll({ where: { version_id: { [Op.in]: versionIds } } })
    : [];
  const sideCfgByVS = {};
  for (const s of sideCfgList) sideCfgByVS[`${s.version_id}:${s.side_id}`] = s;
  const windowsBySide = {};
  for (const w of compiled) { (windowsBySide[w.side_id] || (windowsBySide[w.side_id] = [])).push(w); }

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

  // Pairing pass: annotate reround pairing and holes label
  const dayStartUtc = DateTime.fromISO(`${dateISO}T00:00:00`, { zone }).toUTC().toJSDate();
  const dayEndUtc = DateTime.fromISO(`${dateISO}T23:59:59`, { zone }).toUTC().toJSDate();
  const allRows = await TeeTime.findAll({
    where: { tee_sheet_id: teeSheetId, start_time: { [Op.gte]: dayStartUtc, [Op.lte]: dayEndUtc } },
    order: [['start_time', 'ASC']],
  });
  const bySideRows = {};
  for (const r of allRows) { (bySideRows[r.side_id] || (bySideRows[r.side_id] = [])).push(r); }

  function findVersionFor(sideId, startTime) {
    const wins = windowsBySide[sideId] || [];
    const local = DateTime.fromJSDate(startTime, { zone });
    for (const w of wins) { if (local >= w.start && local < w.end) return w.template_version_id; }
    return null;
  }

  for (const row of allRows) {
    const versionId = findVersionFor(row.side_id, row.start_time);
    const cfg = versionId ? sideCfgByVS[`${versionId}:${row.side_id}`] : null;
    let can18 = false; let rotateId = null; let reroundId = null; let holes = '9';
    if (cfg && cfg.rerounds_to_side_id) {
      rotateId = cfg.rerounds_to_side_id;
      const side = sides[row.side_id];
      const reroundStart = DateTime.fromJSDate(row.start_time, { zone })
        .plus({ minutes: (side.minutes_per_hole || 10) * (side.hole_count || 9) })
        .toUTC()
        .toJSDate();
      const candidates = bySideRows[rotateId] || [];
      const c = candidates.find(r => r.start_time > reroundStart);
      if (c) { can18 = true; reroundId = c.id; holes = '9/18'; }
    }
    const needsUpdate = (
      row.can_start_18 !== can18 ||
      String(row.rerounds_to_side_id || '') !== String(rotateId || '') ||
      String(row.reround_tee_time_id || '') !== String(reroundId || '') ||
      String(row.holes_label || '9') !== holes
    );
    if (needsUpdate) {
      try {
        await row.update({
          can_start_18: can18,
          rerounds_to_side_id: rotateId,
          reround_tee_time_id: reroundId,
          holes_label: holes,
        });
      } catch (_) {}
    }
  }

  return { generated };
}

module.exports = { generateForDateV2 };



