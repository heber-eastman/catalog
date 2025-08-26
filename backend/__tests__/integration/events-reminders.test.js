'use strict';

const SequelizeLib = require('sequelize');
const models = require('../../src/models');
const { sendReminders } = require('../../src/services/reminderService');

jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ MessageId: 'mock' })
}));
const { sendEmail } = require('../../src/services/emailService');

describe('Events and Reminders', () => {
  const sequelize = models.sequelize;
  const qi = sequelize.getQueryInterface();

  beforeAll(async () => {
    await sequelize.authenticate();
    await qi.dropAllTables();
    await require('../../migrations/20250612171419-create-golfcourseinstance').up(qi, SequelizeLib);
    await require('../../migrations/20250612171421-create-staffuser').up(qi, SequelizeLib);
    await require('../../migrations/20250612171422-create-customer').up(qi, SequelizeLib);
    await require('../../migrations/20250625000000-create-tee-sheet-schema').up(qi, SequelizeLib);
    await require('../../migrations/20250626000001-create-events').up(qi, SequelizeLib);
  });

  test('reminder selects upcoming bookings and sends emails', async () => {
    const course = await models.GolfCourseInstance.create({ name: 'E Course', subdomain: 'e', status: 'Active' });
    const sheet = await models.TeeSheet.create({ course_id: course.id, name: 'Sheet E' });
    const side = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Front', valid_from: '2025-01-01', minutes_per_hole: 10, hole_count: 9 });
    const tmpl = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: 'Any' });
    const tf = await models.Timeframe.create({ tee_sheet_id: sheet.id, side_id: side.id, day_template_id: tmpl.id, start_time_local: '00:00:00', end_time_local: '23:59:59', interval_mins: 60, start_slots_enabled: true });
    await models.TimeframeAccessRule.create({ timeframe_id: tf.id, booking_class_id: 'Full', is_allowed: true });

    const nowPlus23 = new Date(Date.now() + 23 * 60 * 60 * 1000);
    const date = nowPlus23.toISOString().substring(0,10);
    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date, day_template_id: tmpl.id });
    const tt = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side.id, start_time: nowPlus23, capacity: 4, assigned_count: 1, is_blocked: false });

    const booking = await models.Booking.create({ tee_sheet_id: sheet.id, status: 'Active', total_price_cents: 0 });
    const leg = await models.BookingRoundLeg.create({ booking_id: booking.id, leg_index: 0, price_cents: 0 });
    await models.TeeTimeAssignment.create({ booking_round_leg_id: leg.id, tee_time_id: tt.id });

    const result = await sendReminders(24);
    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(sendEmail).toHaveBeenCalled();
  });
});


