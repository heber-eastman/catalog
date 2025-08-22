'use strict';

const { DateTime } = require('luxon');

// computeReroundStart(sideConfig, startTime)
// sideConfig: { minutes_per_hole: number, hole_count: number }
// startTime: Date or ISO string
function computeReroundStart(sideConfig, startTime) {
  if (!sideConfig || typeof sideConfig.minutes_per_hole !== 'number' || typeof sideConfig.hole_count !== 'number') {
    throw new Error('Invalid sideConfig');
  }
  const minutesToAdd = sideConfig.minutes_per_hole * sideConfig.hole_count;
  const dt = DateTime.fromJSDate(new Date(startTime));
  return dt.plus({ minutes: minutesToAdd }).toJSDate();
}

// snapToNextSlot(orderedSlots, targetTime)
// orderedSlots: Date[] | ISO strings[] sorted ascending
function snapToNextSlot(orderedSlots, targetTime) {
  const t = new Date(targetTime).getTime();
  for (const s of orderedSlots || []) {
    const ts = new Date(s).getTime();
    if (ts >= t) return new Date(ts);
  }
  return null;
}

// isClassAllowed(timeframe, bookingClassId)
// timeframe: { access_rules?: [{ booking_class_id, is_allowed }] }
function isClassAllowed(timeframe, bookingClassId) {
  if (!timeframe || !Array.isArray(timeframe.access_rules)) return false;
  const rule = timeframe.access_rules.find(r => r.booking_class_id === bookingClassId);
  return !!(rule && rule.is_allowed === true);
}

// calcFeesForLeg(pricingRules, classId, walkRide, combineFees)
// pricingRules: [{ booking_class_id, walk_fee_cents, ride_fee_cents, combine_fees }]
function calcFeesForLeg(pricingRules, classId, walkRide, combineFees) {
  const rules = Array.isArray(pricingRules) ? pricingRules : [];
  const rule = rules.find(r => r.booking_class_id === classId) || { walk_fee_cents: 0, ride_fee_cents: 0, combine_fees: false };
  const effectiveCombine = combineFees ?? rule.combine_fees ?? false;

  if (effectiveCombine) {
    return (rule.walk_fee_cents || 0) + (rule.ride_fee_cents || 0);
  }

  const mode = (walkRide || '').toLowerCase();
  if (mode === 'walk' || mode === 'walking') return rule.walk_fee_cents || 0;
  // Default to riding if ambiguous
  return rule.ride_fee_cents || 0;
}

// enforceMinPlayers(timeframe, partySize)
// timeframe: { min_players?: { min_players } }
function enforceMinPlayers(timeframe, partySize) {
  const configuredMinimum =
    timeframe && timeframe.min_players && typeof timeframe.min_players.min_players === 'number'
      ? timeframe.min_players.min_players
      : 1;
  return Number(partySize) >= configuredMinimum;
}

module.exports = {
  computeReroundStart,
  snapToNextSlot,
  isClassAllowed,
  calcFeesForLeg,
  enforceMinPlayers,
};


