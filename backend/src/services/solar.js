'use strict';

const { DateTime } = require('luxon');
const { courseTz, createSunAdapter } = require('../lib/time');

// Default adapter: simple 07:00 → 18:00 local fallback (override in tests)
let sunAdapter = createSunAdapter(({ date, latitude, longitude, timezone }) => {
  const { fromJSDate } = courseTz(timezone || 'UTC');
  const d = fromJSDate(date);
  const sunrise = DateTime.fromObject({
    year: d.year,
    month: d.month,
    day: d.day,
    hour: 7,
    minute: 0,
    second: 0,
  }, { zone: d.zone });
  const sunset = DateTime.fromObject({
    year: d.year,
    month: d.month,
    day: d.day,
    hour: 18,
    minute: 0,
    second: 0,
  }, { zone: d.zone });
  return { sunrise: sunrise.toJSDate(), sunset: sunset.toJSDate() };
});

function setSunAdapter(adapter) {
  sunAdapter = adapter;
}

function getSunTimes({ date, latitude, longitude, timezone }) {
  return sunAdapter.getSunTimes({ date, latitude, longitude, timezone });
}

module.exports = {
  getSunTimes,
  setSunAdapter,
};


