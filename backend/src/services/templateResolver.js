'use strict';

const { DateTime } = require('luxon');
const { Op } = require('sequelize');
const {
  sequelize,
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
  let override = null;
  try {
    override = await TeeSheetOverride.findOne({
      where: { tee_sheet_id: teeSheetId, status: 'published', date: dateLocal.toISODate() },
    });
  } catch (e) {
    const code = e && (e.parent?.code || e.original?.code);
    if (String(code) !== '42P01' && String(code) !== '42703') throw e;
  }
  if (override && override.published_version_id) {
    // Side-agnostic: list all windows ordered by start_time
    let windows = [];
    try {
      windows = await TeeSheetOverrideWindow.findAll({
        where: { override_version_id: override.published_version_id },
        order: [['start_time_local', 'ASC'], ['created_at', 'ASC']],
      });
    } catch (e) {
      const code = e && (e.parent?.code || e.original?.code);
      if (String(code) !== '42P01' && String(code) !== '42703') throw e;
      windows = [];
    }
    // Prefer override even if it has zero windows (explicit no-windows override)
    return { source: 'override', windows };
  }

  // 2) Published season covering the date (consider ALL published seasons)
  let seasons = [];
  try {
    seasons = await TeeSheetSeason.findAll({ where: { tee_sheet_id: teeSheetId, status: 'published' }, order: [['created_at', 'ASC']] });
  } catch (e) {
    const code = e && (e.parent?.code || e.original?.code);
    if (String(code) === '42P01' || String(code) === '42703') {
      return { source: null, windows: [] };
    }
    throw e;
  }
  for (const s of seasons) {
    if (!s.published_version_id) continue;
    let seasonVersion = null;
    try {
      seasonVersion = await TeeSheetSeasonVersion.findByPk(s.published_version_id);
    } catch (e) {
      const code = e && (e.parent?.code || e.original?.code);
      if (String(code) === '42P01' || String(code) === '42703') {
        continue;
      }
      throw e;
    }
    if (!seasonVersion) continue;
    const dayIso = dateLocal.toISODate();
    if (seasonVersion.start_date <= dayIso && seasonVersion.end_date_exclusive > dayIso) {
      // Support legacy datasets where Sunday was stored as 7 instead of 0
      const wdWhere = (weekday === 0) ? { [Op.in]: [0, 7] } : weekday;
      let windows = [];
      try {
        windows = await TeeSheetSeasonWeekdayWindow.findAll({
          where: { season_version_id: seasonVersion.id, weekday: wdWhere },
          order: [['position', 'ASC']],
        });
      } catch (e) {
        const code = e && (e.parent?.code || e.original?.code);
        if (String(code) === '42P01' || String(code) === '42703') {
          windows = [];
        } else {
          throw e;
        }
      }
      return { source: 'season', windows };
    }
  }

  return { source: null, windows: [] };
}

module.exports = { resolveEffectiveWindows };


