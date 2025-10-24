'use strict';

const { DateTime } = require('luxon');
const { courseTz, createSunAdapter } = require('../lib/time');
let SunCalc;
try { SunCalc = require('suncalc'); } catch { SunCalc = null; }

// Adapter: if suncalc is available and lat/lng provided, use real times; else fallback 07:00 → 18:00 local.
let sunAdapter = createSunAdapter(({ date, latitude, longitude, timezone }) => {
  try {
    // Coerce lat/lon to numbers; Sequelize DECIMAL returns strings in many configs
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (SunCalc && Number.isFinite(lat) && Number.isFinite(lon)) {
      const times = SunCalc.getTimes(date, lat, lon);
      // Normalize to course-local zone
      const { fromJSDate } = courseTz(timezone || 'UTC');
      const sunrise = fromJSDate(times.sunrise || date).toJSDate();
      const sunset = fromJSDate(times.sunset || date).toJSDate();
      return { sunrise, sunset };
    }
  } catch {}
  // Fallback
  const { fromJSDate } = courseTz(timezone || 'UTC');
  const d = fromJSDate(date);
  const sunrise = DateTime.fromObject({ year: d.year, month: d.month, day: d.day, hour: 7, minute: 0, second: 0 }, { zone: d.zone });
  const sunset = DateTime.fromObject({ year: d.year, month: d.month, day: d.day, hour: 18, minute: 0, second: 0 }, { zone: d.zone });
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


