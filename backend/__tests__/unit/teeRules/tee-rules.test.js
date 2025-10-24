'use strict';

const { computeReroundStart, snapToNextSlot, isClassAllowed, calcFeesForLeg, enforceMinPlayers } = require('../../../src/lib/teeRules');
const { courseTz, isDst, createSunAdapter } = require('../../../src/lib/time');

describe('teeRules helpers', () => {
  test('computeReroundStart adds minutes correctly', () => {
    const side = { minutes_per_hole: 10, hole_count: 9 };
    const start = new Date('2025-03-09T06:50:00Z');
    const reround = computeReroundStart(side, start);
    expect((reround - start) / 60000).toBe(90);
  });

  test('snapToNextSlot finds first >= target', () => {
    const base = new Date('2025-01-01T10:00:00Z');
    const slots = [0, 10, 20, 30].map(m => new Date(base.getTime() + m * 60000));
    const target = new Date('2025-01-01T10:05:00Z');
    const snapped = snapToNextSlot(slots, target);
    expect(snapped.getTime()).toBe(slots[1].getTime());
  });

  test('isClassAllowed denies by default and respects explicit allow', () => {
    expect(isClassAllowed({}, 'Full')).toBe(false);
    const timeframe = { access_rules: [{ booking_class_id: 'Full', is_allowed: true }] };
    expect(isClassAllowed(timeframe, 'Full')).toBe(true);
    expect(isClassAllowed(timeframe, 'Junior')).toBe(false);
  });

  test('calcFeesForLeg supports walk/ride and combine', () => {
    const rules = [
      { booking_class_id: 'Full', walk_fee_cents: 1000, ride_fee_cents: 1500, combine_fees: false },
    ];
    expect(calcFeesForLeg(rules, 'Full', 'walk', false)).toBe(1000);
    expect(calcFeesForLeg(rules, 'Full', 'ride', false)).toBe(1500);
    expect(calcFeesForLeg(rules, 'Full', 'walk', true)).toBe(2500);
    // Default to ride if ambiguous
    expect(calcFeesForLeg(rules, 'Full', undefined, undefined)).toBe(1500);
  });

  test('enforceMinPlayers honors timeframe min', () => {
    const timeframe = { min_players: { min_players: 3 } };
    expect(enforceMinPlayers(timeframe, 2)).toBe(false);
    expect(enforceMinPlayers(timeframe, 3)).toBe(true);
  });
});

describe('time utils (DST & sun adapter)', () => {
  test('courseTz creates zoned DateTimes and detects DST', () => {
    const tz = courseTz('America/New_York');
    const before = tz.fromISO('2025-03-09T01:59:00'); // before spring forward
    const after = tz.fromISO('2025-03-09T03:01:00'); // after spring forward
    expect(before.offset).not.toBe(after.offset); // offset changes across DST jump

    const isDstBefore = isDst(before.toJSDate(), 'America/New_York');
    const isDstAfter = isDst(after.toJSDate(), 'America/New_York');
    expect(isDstBefore).toBe(false);
    expect(isDstAfter).toBe(true);
  });

  test('sun adapter is mockable', () => {
    const adapter = createSunAdapter(({ date, latitude, longitude, timezone }) => {
      expect(latitude).toBeCloseTo(40.7, 1);
      expect(longitude).toBeCloseTo(-73.9, 1);
      expect(timezone).toBe('America/New_York');
      const d = new Date(date);
      return {
        sunrise: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 11, 0, 0)),
        sunset: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 0, 0)),
      };
    });

    const res = adapter.getSunTimes({ date: new Date('2025-07-01T00:00:00Z'), latitude: 40.7, longitude: -73.9, timezone: 'America/New_York' });
    expect(res.sunrise instanceof Date).toBe(true);
    expect(res.sunset instanceof Date).toBe(true);
  });
});


