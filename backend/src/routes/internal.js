'use strict';

const express = require('express');
const router = express.Router();
const { generateForDate } = require('../services/teeSheetGenerator');
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


