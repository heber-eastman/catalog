'use strict';

const express = require('express');
const router = express.Router();
const { generateForDate } = require('../services/teeSheetGenerator');
const { addClient } = require('../services/broadcast');
const { requireAuth } = require('../middleware/auth');

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


