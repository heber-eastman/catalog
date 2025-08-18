'use strict';

const { DateTime, IANAZone } = require('luxon');

// courseTz(timezone) -> returns a function to get course-local DateTime
function courseTz(timezone) {
  const zone = new IANAZone(timezone || 'UTC');
  if (!zone.isValid) throw new Error('Invalid timezone');
  return {
    fromJSDate: (date) => DateTime.fromJSDate(date, { zone }),
    fromISO: (iso) => DateTime.fromISO(iso, { zone }),
    now: () => DateTime.now().setZone(zone),
  };
}

// DST helpers
function isDst(input, timezone) {
  if (input && typeof input.isInDST === 'boolean') {
    return input.isInDST;
  }
  const zone = timezone ? new IANAZone(timezone) : undefined;
  const dt = zone ? DateTime.fromJSDate(input, { zone }) : DateTime.fromJSDate(input);
  return dt.isInDST;
}

// sunrise/sunset adapter (mockable)
// signature: getSunTimes({ date: Date, latitude: number, longitude: number, timezone: string })
// returns { sunrise: Date, sunset: Date }
function createSunAdapter(impl) {
  if (typeof impl !== 'function') throw new Error('Sun adapter requires a function');
  return {
    getSunTimes: (args) => impl(args),
  };
}

module.exports = {
  courseTz,
  isDst,
  createSunAdapter,
};


