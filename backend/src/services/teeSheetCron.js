'use strict';

const cron = require('node-cron');
const { DateTime } = require('luxon');
const { GolfCourseInstance, TeeSheet } = require('../models');
const { generateForDate } = require('./teeSheetGenerator');

function startTeeSheetCron() {
  if (process.env.ENABLE_TEE_SHEET_CRON !== 'true') return { stop: () => {} };

  // Run every 5 minutes and trigger only when local time is 00:05 for each course
  const task = cron.schedule('*/5 * * * *', async () => {
    try {
      const courses = await GolfCourseInstance.findAll({ attributes: ['id', 'timezone'] });
      for (const course of courses) {
        const zone = course.timezone || 'UTC';
        const nowLocal = DateTime.now().setZone(zone);
        if (nowLocal.hour === 0 && nowLocal.minute === 5) {
          const sheets = await TeeSheet.findAll({ where: { course_id: course.id } });
          const dateISO = nowLocal.toISODate();
          for (const sheet of sheets) {
            await generateForDate({ teeSheetId: sheet.id, dateISO });
          }
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('teeSheetCron error', e);
    }
  });

  return task;
}

module.exports = { startTeeSheetCron };


