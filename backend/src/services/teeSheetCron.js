'use strict';

const cron = require('node-cron');
const { DateTime } = require('luxon');
const { GolfCourseInstance, TeeSheet } = require('../models');
const { generateForDateV2 } = require('./teeSheetGenerator.v2');
const { sendReminders } = require('./reminderService');

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
          const horizonDays = Number(process.env.CRON_GENERATION_HORIZON_DAYS || 1);
          for (const sheet of sheets) {
            for (let d = 0; d < horizonDays; d += 1) {
              const day = nowLocal.plus({ days: d }).toISODate();
              await generateForDateV2({ teeSheetId: sheet.id, dateISO: day });
            }
          }
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('teeSheetCron error', e);
    }
  });

  // Also schedule reminder cron if enabled: top of each hour
  if (process.env.ENABLE_REMINDER_CRON === 'true') {
    cron.schedule('0 * * * *', async () => {
      try {
        await sendReminders();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('reminderCron error', e);
      }
    });
  }

  return task;
}

module.exports = { startTeeSheetCron };


