'use strict';

const express = require('express');
const router = express.Router();
const { generateForDate } = require('../services/teeSheetGenerator');
const { addClient } = require('../services/broadcast');
const { requireAuth } = require('../middleware/auth');
const {
  TeeSheet,
  TeeSheetSide,
  DayTemplate,
  Timeframe,
  CalendarAssignment,
} = require('../models');

router.post('/internal/generate', requireAuth(['Admin', 'SuperAdmin']), async (req, res) => {
  if (process.env.ENABLE_INTERNAL_ENDPOINTS !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }
  const { tee_sheet_id, date } = req.query;
  if (!tee_sheet_id || !date) return res.status(400).json({ error: 'tee_sheet_id and date required' });
  try {
    const result = await generateForDate({ teeSheetId: tee_sheet_id, dateISO: date });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Generation failed' });
  }
});

module.exports = router;

// Server-Sent Events for tee sheet updates (simple fallback to websockets)
router.get('/internal/stream', (req, res) => {
  if (process.env.ENABLE_EVENTS_STREAM !== 'true') return res.status(404).end();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('\n');
  addClient(res);
});


// Bootstrap minimal tee sheet defaults for the current course and generate today's slots
router.post('/internal/bootstrap-defaults', requireAuth(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    if (process.env.ENABLE_INTERNAL_ENDPOINTS !== 'true') {
      return res.status(404).json({ error: 'Not found' });
    }

    const courseId = req.courseId;
    if (!courseId) return res.status(400).json({ error: 'Missing course context' });

    // 1) Tee Sheet
    const [sheet] = await TeeSheet.findOrCreate({
      where: { course_id: courseId, name: 'Main' },
      defaults: { timezone: 'UTC' },
    });

    // 2) Side
    const [side] = await TeeSheetSide.findOrCreate({
      where: { tee_sheet_id: sheet.id, name: 'Main' },
      defaults: {},
    });

    // 3) Day Template
    const [tpl] = await DayTemplate.findOrCreate({
      where: { tee_sheet_id: sheet.id, name: 'Default' },
      defaults: {},
    });

    // 4) Timeframe (08:00-16:00 every 10 mins)
    const [tf] = await Timeframe.findOrCreate({
      where: {
        tee_sheet_id: sheet.id,
        day_template_id: tpl.id,
        side_id: side.id,
        start_time_local: '08:00:00',
        end_time_local: '16:00:00',
      },
      defaults: {
        interval_mins: 10,
        start_slots_enabled: true,
      },
    });

    // 5) Assign template to today
    const today = new Date().toISOString().slice(0, 10);
    await CalendarAssignment.findOrCreate({
      where: { tee_sheet_id: sheet.id, date: today },
      defaults: { day_template_id: tpl.id },
    });

    // 6) Generate tee times
    const result = await generateForDate({ teeSheetId: sheet.id, dateISO: today });

    res.json({ ok: true, tee_sheet_id: sheet.id, generated: result.generated, date: today });
  } catch (e) {
    console.error('Bootstrap defaults failed:', e);
    res.status(500).json({ error: e.message || 'Bootstrap failed' });
  }
});

