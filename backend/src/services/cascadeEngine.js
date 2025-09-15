'use strict';

const { DateTime } = require('luxon');
const { generateForDateV2 } = require('./teeSheetGenerator.v2');

/**
 * Minimal cascade engine: apply-now regeneration for a tee sheet over a date or range.
 * Skips holds/waitlists/grandfathering (to be added later per blueprint).
 */
async function regenerateApplyNow({ teeSheetId, startDateISO, endDateISO }) {
  const start = DateTime.fromISO(startDateISO, { zone: 'UTC' });
  const end = DateTime.fromISO(endDateISO || startDateISO, { zone: 'UTC' });
  if (!start.isValid || !end.isValid || end < start) throw new Error('Invalid date range');
  let total = 0;
  for (let d = start; d <= end; d = d.plus({ days: 1 })) {
    const { generated } = await generateForDateV2({ teeSheetId, dateISO: d.toISODate() });
    total += generated;
  }
  return { regenerated: total };
}

module.exports = { regenerateApplyNow };


