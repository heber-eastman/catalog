'use strict';

// Usage: node scripts/regenerate.js <TEE_SHEET_ID> <YYYY-MM-DD>

(async () => {
  try {
    const [,, sheetId, dateISO] = process.argv;
    if (!sheetId || !dateISO) {
      console.error('Usage: node scripts/regenerate.js <TEE_SHEET_ID> <YYYY-MM-DD>');
      process.exit(1);
    }
    const { generateForDateV2 } = require('../src/services/teeSheetGenerator.v2');
    const res = await generateForDateV2({ teeSheetId: sheetId, dateISO });
    console.log('Regenerated', { sheetId, dateISO, ...res });
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();


