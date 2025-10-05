'use strict';

const { DateTime } = require('luxon');
const { Op } = require('sequelize');
const {
  TeeSheet,
  TeeSheetOverride,
  TeeSheetOverrideVersion,
  TeeSheetOverrideWindow,
  TeeSheetSeason,
  TeeSheetSeasonVersion,
  TeeSheetSeasonWeekdayWindow,
  GolfCourseInstance,
} = require('../models');

/**
 * Resolve the effective windows for a tee sheet and date.
 * Priority: published override on date → published season covering date (by weekday) → none
 * Returns side windows with modes/times and their template_version_id.
 */
async function resolveEffectiveWindows({ teeSheetId, dateISO }) {
  const sheet = await TeeSheet.findByPk(teeSheetId);
  if (!sheet) throw new Error('TeeSheet not found');

  const course = await GolfCourseInstance.findByPk(sheet.course_id);
  const zone = course?.timezone || 'UTC';
  const dateLocal = DateTime.fromISO(dateISO, { zone });
  if (!dateLocal.isValid) throw new Error('Invalid date');

  // 0..6 Sunday..Saturday per our schema
  const weekday = (dateLocal.weekday % 7); // luxon: 1..7 Mon..Sun → mod7 gives 0 for Sun

  // 1) Published override on the date
  const override = await TeeSheetOverride.findOne({
    where: { tee_sheet_id: teeSheetId, status: 'published', date: dateLocal.toISODate() },
  });
  if (override && override.published_version_id) {
    const windows = await TeeSheetOverrideWindow.findAll({
      where: { override_version_id: override.published_version_id },
      order: [['side_id', 'ASC'], ['start_time_local', 'ASC']],
    });
    return { source: 'override', windows };
  }

  // 2) Published season: use its published_version_id only and verify date coverage
  const season = await TeeSheetSeason.findOne({ where: { tee_sheet_id: teeSheetId, status: 'published' } });
  if (season && season.published_version_id) {
    const seasonVersion = await TeeSheetSeasonVersion.findByPk(season.published_version_id);
    if (seasonVersion && seasonVersion.start_date <= dateLocal.toISODate() && seasonVersion.end_date_exclusive > dateLocal.toISODate()) {
      const windows = await TeeSheetSeasonWeekdayWindow.findAll({
        where: { season_version_id: seasonVersion.id, weekday },
        order: [['position', 'ASC']],
      });
      return { source: 'season', windows };
    }
  }

  return { source: null, windows: [] };
}

module.exports = { resolveEffectiveWindows };


