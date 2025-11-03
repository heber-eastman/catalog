'use strict';

// Usage: node scripts/backfill-range.js <TEE_SHEET_ID> <START_YYYY-MM-DD> <END_YYYY-MM-DD>

(async () => {
  try {
    const { DateTime } = require('luxon');
    const [,, sheetId, startISO, endISO] = process.argv;
    if (!sheetId || !startISO || !endISO) {
      console.error('Usage: node scripts/backfill-range.js <TEE_SHEET_ID> <START> <END>');
      process.exit(1);
    }
    const start = DateTime.fromISO(startISO);
    const end = DateTime.fromISO(endISO);
    if (!start.isValid || !end.isValid || end < start) {
      console.error('Invalid date range');
      process.exit(1);
    }
    const { generateForDateV2 } = require('../src/services/teeSheetGenerator.v2');
    let total = 0;
    for (let d = start; d <= end; d = d.plus({ days: 1 })) {
      const r = await generateForDateV2({ teeSheetId: sheetId, dateISO: d.toISODate() });
      total += r?.generated || 0;
      console.log('Day', d.toISODate(), r);
    }
    console.log('Backfill complete', { sheetId, start: startISO, end: endISO, total });
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();


