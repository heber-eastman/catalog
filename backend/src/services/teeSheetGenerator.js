'use strict';

const { DateTime } = require('luxon');
const {
  TeeSheet,
  TeeSheetSide,
  DayTemplate,
  Timeframe,
  ClosureBlock,
  TeeTime,
  CalendarAssignment,
  GolfCourseInstance,
  sequelize,
} = require('../models');
const { Op } = require('sequelize');

async function generateForDate({ teeSheetId, dateISO }) {
  const sheet = await TeeSheet.findByPk(teeSheetId);
  if (!sheet) throw new Error('TeeSheet not found');
  const course = await GolfCourseInstance.findByPk(sheet.course_id);
  const zone = course?.timezone || 'UTC';
  const date = DateTime.fromISO(dateISO, { zone });

  const assignment = await CalendarAssignment.findOne({ where: { tee_sheet_id: teeSheetId, date: date.toISODate() } });
  if (!assignment) return { generated: 0 };

  const template = await DayTemplate.findByPk(assignment.day_template_id);
  if (!template) return { generated: 0 };

  const timeframes = await Timeframe.findAll({ where: { tee_sheet_id: teeSheetId, day_template_id: template.id } });
  let generated = 0;

  for (const tf of timeframes) {
    const side = await TeeSheetSide.findByPk(tf.side_id);
    if (!side) continue;

    const start = DateTime.fromISO(`${date.toISODate()}T${tf.start_time_local}`, { zone });
    const end = DateTime.fromISO(`${date.toISODate()}T${tf.end_time_local}`, { zone });
    const interval = tf.interval_mins;
    const startsEnabled = tf.start_slots_enabled;

    for (let t = start; t < end; t = t.plus({ minutes: interval })) {
      if (!startsEnabled) continue;

      const startsAt = t.toUTC().toJSDate();

      // Check closure overlaps
      const whereClause = {
        tee_sheet_id: teeSheetId,
        starts_at: { [Op.lte]: startsAt },
        ends_at: { [Op.gt]: startsAt },
      };
      if (side.id) {
        whereClause[Op.or] = [{ side_id: side.id }, { side_id: null }];
      }
      const closure = await ClosureBlock.findOne({ where: whereClause });

      const [row, created] = await TeeTime.findOrCreate({
        where: { tee_sheet_id: teeSheetId, side_id: side.id, start_time: startsAt },
        defaults: {
          capacity: 4,
          assigned_count: 0,
          is_blocked: !!closure,
          blocked_reason: closure ? (closure.reason || 'Closure') : null,
        },
      });
      if (!created) {
        // If existing and closure now present, update block state
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

module.exports = { generateForDate };


