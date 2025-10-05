'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const SequelizeLib = require('sequelize');
const app = require('../../src/app');
const models = require('../../src/models');
jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ MessageId: 'mock' })
}));
const { sendEmail } = require('../../src/services/emailService');

const courseMigration = require('../../migrations/20250612171419-create-golfcourseinstance');
const staffMigration = require('../../migrations/20250612171421-create-staffuser');
const customerMigration = require('../../migrations/20250612171422-create-customer');
const teeSchemaMigration = require('../../migrations/20250625000000-create-tee-sheet-schema');
const addCustomerToAssignment = require('../../migrations/20251003090000-add-customer-to-assignment');

describe('POST /api/v1/bookings', () => {
  const sequelize = models.sequelize;
  const qi = sequelize.getQueryInterface();
  let token;
  let course;
  let sheet;
  let side1;
  let side2;
  let tmpl;

  beforeAll(async () => {
    process.env.REDIS_URL = 'mock://redis';
    await sequelize.authenticate();
    await qi.dropAllTables();
    await courseMigration.up(qi, SequelizeLib);
    await staffMigration.up(qi, SequelizeLib);
    await customerMigration.up(qi, SequelizeLib);
    await teeSchemaMigration.up(qi, SequelizeLib);
    // Ensure TeeTimeAssignments has customer_id for tests
    await addCustomerToAssignment.up(qi, SequelizeLib);

    course = await models.GolfCourseInstance.create({ name: 'B Course', subdomain: 'b', status: 'Active' });
    const staff = await models.StaffUser.create({ course_id: course.id, email: 's@ex.com', password: 'p', role: 'Staff', is_active: true });
    token = jwt.sign({ user_id: staff.id, course_id: course.id, role: 'Staff', email: staff.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    sheet = await models.TeeSheet.create({ course_id: course.id, name: 'Sheet' });
    side1 = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Front', valid_from: '2025-01-01', minutes_per_hole: 10, hole_count: 9 });
    side2 = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Back', valid_from: '2025-01-01', minutes_per_hole: 10, hole_count: 9 });
    tmpl = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: 'Any' });
  });

  // Do not close sequelize here to allow subsequent booking-related tests to run

  async function seedTimeframe({ side, start='07:00:00', end='09:00:00', allowFull=true, min=1, priceWalk=1000, priceRide=1500, mode='Both' }) {
    // Create a fresh template per timeframe to avoid overlap across tests
    const localTmpl = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: `T-${Date.now()}-${Math.random()}` });
    const tf = await models.Timeframe.create({ tee_sheet_id: sheet.id, side_id: side.id, day_template_id: localTmpl.id, start_time_local: start, end_time_local: end, interval_mins: 60, start_slots_enabled: true });
    await models.TimeframeAccessRule.create({ timeframe_id: tf.id, booking_class_id: 'Full', is_allowed: allowFull });
    await models.TimeframeMinPlayers.create({ timeframe_id: tf.id, min_players: min });
    await models.TimeframePricingRule.create({ timeframe_id: tf.id, booking_class_id: 'Full', walk_fee_cents: priceWalk, ride_fee_cents: priceRide, combine_fees: false });
    await models.TimeframeMode.create({ timeframe_id: tf.id, mode });
    return { tf, localTmpl };
  }

  test('9-hole success', async () => {
    const { localTmpl } = await seedTimeframe({ side: side1 });
    const tt = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side1.id, start_time: new Date('2025-07-01T07:00:00Z'), capacity: 4, assigned_count: 0, is_blocked: false });
    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date: '2025-07-01', day_template_id: localTmpl.id });

    const body = {
      tee_sheet_id: sheet.id,
      classId: 'Full',
      players: [{ email: 'a@ex.com', walkRide: 'ride' }, { email: 'b@ex.com', walkRide: 'ride' }],
      legs: [{ tee_time_id: tt.id, round_option_id: null, leg_index: 0 }],
    };

    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Cookie', `jwt=${token}`)
      .set('Idempotency-Key', 'book-9-1')
      .send(body)
      .expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.total_price_cents).toBe(3000); // 2 players riding at 1500
    // Verify booking leg walk_ride persisted as ride
    const booking = await models.Booking.findOne({ where: { tee_sheet_id: sheet.id }, order: [['created_at','DESC']] });
    const legs = await models.BookingRoundLeg.findAll({ where: { booking_id: booking.id } });
    expect(legs[0].walk_ride).toBe('ride');
    // And availability reflects ride for that slot
    const dateStr = '2025-07-01';
    const avail = await request(app)
      .get(`/api/v1/tee-times/available?date=${encodeURIComponent(dateStr)}&teeSheets=${encodeURIComponent(sheet.id)}&customerView=false&classId=Full&groupSize=1`)
      .set('Cookie', `jwt=${token}`)
      .expect(200);
    const found = (avail.body || []).find(s => s.id === tt.id);
    expect(found).toBeTruthy();
    // Ensure at least one assignment reports ride via round_leg.walk_ride -> our reducer will show car icon
    const anyRide = (found.assignments || []).some(a => (a.walk_ride || '').toLowerCase() === 'ride' || (a.round_leg && String(a.round_leg.walk_ride||'').toLowerCase() === 'ride'));
    expect(anyRide).toBe(true);
    expect(sendEmail).toHaveBeenCalled();
  });

  test('18-hole success across two legs', async () => {
    // Use the same template for both legs so both timeframes are applicable
    const { localTmpl: sharedTmpl } = await seedTimeframe({ side: side1 });
    await models.Timeframe.create({ tee_sheet_id: sheet.id, side_id: side2.id, day_template_id: sharedTmpl.id, start_time_local: '07:00:00', end_time_local: '10:00:00', interval_mins: 60, start_slots_enabled: true });
    await models.TimeframeAccessRule.create({ timeframe_id: (await models.Timeframe.findOne({ where: { side_id: side2.id, day_template_id: sharedTmpl.id } })).id, booking_class_id: 'Full', is_allowed: true });
    await models.TimeframeMinPlayers.create({ timeframe_id: (await models.Timeframe.findOne({ where: { side_id: side2.id, day_template_id: sharedTmpl.id } })).id, min_players: 1 });
    await models.TimeframePricingRule.create({ timeframe_id: (await models.Timeframe.findOne({ where: { side_id: side2.id, day_template_id: sharedTmpl.id } })).id, booking_class_id: 'Full', walk_fee_cents: 1000, ride_fee_cents: 1500, combine_fees: false });
    await models.TimeframeMode.create({ timeframe_id: (await models.Timeframe.findOne({ where: { side_id: side2.id, day_template_id: sharedTmpl.id } })).id, mode: 'Both' });
    const tt1 = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side1.id, start_time: new Date('2025-07-02T07:00:00Z'), capacity: 4, assigned_count: 0, is_blocked: false });
    const tt2 = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side2.id, start_time: new Date('2025-07-02T08:30:00Z'), capacity: 4, assigned_count: 0, is_blocked: false });
    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date: '2025-07-02', day_template_id: sharedTmpl.id });

    const body = {
      tee_sheet_id: sheet.id,
      classId: 'Full',
      players: [{ email: 'a@ex.com' }, { email: 'b@ex.com' }],
      legs: [
        { tee_time_id: tt1.id, round_option_id: null, leg_index: 0 },
        { tee_time_id: tt2.id, round_option_id: null, leg_index: 1 },
      ],
    };

    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Cookie', `jwt=${token}`)
      .set('Idempotency-Key', 'book-18-1')
      .send(body)
      .expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.total_price_cents).toBe(6000); // two legs * 2 players * 1500
  });

  test('minimum players failure', async () => {
    const { localTmpl: t3 } = await seedTimeframe({ side: side1, min: 3 });
    const tt = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side1.id, start_time: new Date('2025-07-03T07:00:00Z'), capacity: 4, assigned_count: 0, is_blocked: false });
    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date: '2025-07-03', day_template_id: t3.id });

    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Cookie', `jwt=${token}`)
      .set('Idempotency-Key', 'book-min-fail')
      .send({ tee_sheet_id: sheet.id, classId: 'Full', players: [{}, {}], legs: [{ tee_time_id: tt.id, round_option_id: null, leg_index: 0 }] })
      .expect(400);
    expect(res.body.error).toMatch(/Minimum players/);
  });

  test('access denied', async () => {
    const { localTmpl: t4 } = await seedTimeframe({ side: side1, allowFull: false });
    const tt = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side1.id, start_time: new Date('2025-07-04T07:00:00Z'), capacity: 4, assigned_count: 0, is_blocked: false });
    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date: '2025-07-04', day_template_id: t4.id });

    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Cookie', `jwt=${token}`)
      .set('Idempotency-Key', 'book-access-denied')
      .send({ tee_sheet_id: sheet.id, classId: 'Full', players: [{}, {}], legs: [{ tee_time_id: tt.id, round_option_id: null, leg_index: 0 }] })
      .expect(403);
    expect(res.body.error).toMatch(/Access denied/);
  });

  test('window not open', async () => {
    // timeframe is 08-09, slot at 07:00
    const { localTmpl: t5 } = await seedTimeframe({ side: side1, start: '08:00:00', end: '09:00:00' });
    const tt = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side1.id, start_time: new Date('2025-07-05T07:00:00Z'), capacity: 4, assigned_count: 0, is_blocked: false });
    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date: '2025-07-05', day_template_id: t5.id });

    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Cookie', `jwt=${token}`)
      .set('Idempotency-Key', 'book-window')
      .send({ tee_sheet_id: sheet.id, classId: 'Full', players: [{}, {}], legs: [{ tee_time_id: tt.id, round_option_id: null, leg_index: 0 }] })
      .expect(400);
    expect(res.body.error).toMatch(/Window not open/);
  });

  test('capacity race: one succeeds, one fails', async () => {
    const { localTmpl: t6 } = await seedTimeframe({ side: side1 });
    const tt = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side1.id, start_time: new Date('2025-07-06T07:00:00Z'), capacity: 2, assigned_count: 0, is_blocked: false });
    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date: '2025-07-06', day_template_id: t6.id });

    const body = { tee_sheet_id: sheet.id, classId: 'Full', players: [{}, {}], legs: [{ tee_time_id: tt.id, round_option_id: null, leg_index: 0 }] };

    const req1 = request(app).post('/api/v1/bookings').set('Cookie', `jwt=${token}`).set('Idempotency-Key', 'race-1').send(body);
    const req2 = request(app).post('/api/v1/bookings').set('Cookie', `jwt=${token}`).set('Idempotency-Key', 'race-2').send(body);

    const [r1, r2] = await Promise.all([req1, req2]);
    const codes = [r1.statusCode, r2.statusCode].sort();
    expect(codes).toEqual([201, 409]);
  });

  test('idempotent retry returns same result', async () => {
    const { localTmpl: t7 } = await seedTimeframe({ side: side1 });
    const tt = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side1.id, start_time: new Date('2025-07-07T07:00:00Z'), capacity: 4, assigned_count: 0, is_blocked: false });
    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date: '2025-07-07', day_template_id: t7.id });

    const body = { tee_sheet_id: sheet.id, classId: 'Full', players: [{}, {}], legs: [{ tee_time_id: tt.id, round_option_id: null, leg_index: 0 }] };
    const key = 'idem-book-1';
    const r1 = await request(app).post('/api/v1/bookings').set('Cookie', `jwt=${token}`).set('Idempotency-Key', key).send(body).expect(201);
    const r2 = await request(app).post('/api/v1/bookings').set('Cookie', `jwt=${token}`).set('Idempotency-Key', key).send(body).expect(201);
    expect(r2.body).toEqual(r1.body);
  });
});

describe('PATCH /api/v1/bookings/:id/players', () => {
  const sequelize = models.sequelize;
  const qi = sequelize.getQueryInterface();
  let token;
  let course;
  let sheet;
  let side1;
  let tmpl;

  beforeAll(async () => {
    // Reuse the same connection; create a new course and sheet
    course = await models.GolfCourseInstance.create({ name: 'P Course', subdomain: 'p', status: 'Active' });
    const staff = await models.StaffUser.create({ course_id: course.id, email: 's2@ex.com', password: 'p', role: 'Staff', is_active: true });
    token = jwt.sign({ user_id: staff.id, course_id: course.id, role: 'Staff', email: staff.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    sheet = await models.TeeSheet.create({ course_id: course.id, name: 'Sheet P' });
    side1 = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Front', valid_from: '2025-01-01', minutes_per_hole: 10, hole_count: 9 });
    tmpl = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: 'Any' });
  });

  test('min enforcement blocks removing below minimum', async () => {
    const tf = await models.Timeframe.create({ tee_sheet_id: sheet.id, side_id: side1.id, day_template_id: tmpl.id, start_time_local: '07:00:00', end_time_local: '10:00:00', interval_mins: 60, start_slots_enabled: true });
    await models.TimeframeMinPlayers.create({ timeframe_id: tf.id, min_players: 2 });
    await models.TimeframeAccessRule.create({ timeframe_id: tf.id, booking_class_id: 'Full', is_allowed: true });
    await models.TimeframePricingRule.create({ timeframe_id: tf.id, booking_class_id: 'Full', walk_fee_cents: 1000, ride_fee_cents: 1500, combine_fees: false });
    const tt = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side1.id, start_time: new Date('2025-08-01T07:00:00Z'), capacity: 4, assigned_count: 0, is_blocked: false });
    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date: '2025-08-01', day_template_id: tmpl.id });

    // Create a 2-player booking
    await request(app)
      .post('/api/v1/bookings')
      .set('Cookie', `jwt=${token}`)
      .set('Idempotency-Key', 'players-book')
      .send({ tee_sheet_id: sheet.id, classId: 'Full', players: [{}, {}], legs: [{ tee_time_id: tt.id, round_option_id: null, leg_index: 0 }] })
      .expect(201);

    const booking = await models.Booking.findOne({ where: { tee_sheet_id: sheet.id } });

    // Attempt to remove 1 (would drop to 1 < min 2)
    await request(app)
      .patch(`/api/v1/bookings/${booking.id}/players`)
      .set('Cookie', `jwt=${token}`)
      .send({ remove: 1 })
      .expect(400);
  });
});

describe('PATCH /api/v1/bookings/:id/reschedule', () => {
  let token;
  let course;
  let sheet;
  let side1;

  beforeAll(async () => {
    course = await models.GolfCourseInstance.create({ name: 'R Course', subdomain: 'r', status: 'Active' });
    const staff = await models.StaffUser.create({ course_id: course.id, email: 'r@ex.com', password: 'p', role: 'Staff', is_active: true });
    token = jwt.sign({ user_id: staff.id, course_id: course.id, role: 'Staff', email: staff.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    sheet = await models.TeeSheet.create({ course_id: course.id, name: 'Sheet R' });
    side1 = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Front', valid_from: '2025-01-01', minutes_per_hole: 10, hole_count: 9 });
  });

  test('reschedule success recalculates price and moves assignments', async () => {
    const tmpl = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: `R1-${Date.now()}` });
    // Seed timeframe and two tee times on same day
    const tf = await models.Timeframe.create({ tee_sheet_id: sheet.id, side_id: side1.id, day_template_id: tmpl.id, start_time_local: '00:00:00', end_time_local: '23:59:59', interval_mins: 60, start_slots_enabled: true });
    await models.TimeframeAccessRule.create({ timeframe_id: tf.id, booking_class_id: 'Full', is_allowed: true });
    await models.TimeframeMinPlayers.create({ timeframe_id: tf.id, min_players: 1 });
    await models.TimeframePricingRule.create({ timeframe_id: tf.id, booking_class_id: 'Full', walk_fee_cents: 1000, ride_fee_cents: 1500, combine_fees: false });
    await models.TimeframeMode.create({ timeframe_id: tf.id, mode: 'Both' });

    const date = '2025-08-10';
    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date, day_template_id: tmpl.id });

    const ttA = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side1.id, start_time: new Date(`${date}T07:00:00Z`), capacity: 4, assigned_count: 0, is_blocked: false });
    const ttB = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side1.id, start_time: new Date(`${date}T09:00:00Z`), capacity: 4, assigned_count: 0, is_blocked: false });

    // Create booking at A with 2 players
    const createBody = { tee_sheet_id: sheet.id, classId: 'Full', players: [{}, {}], legs: [{ tee_time_id: ttA.id, round_option_id: null, leg_index: 0 }] };
    const created = await request(app).post('/api/v1/bookings').set('Cookie', `jwt=${token}`).set('Idempotency-Key', `resched-create-${Date.now()}`).send(createBody).expect(201);
    expect(created.body.total_price_cents).toBe(3000);

    const booking = await models.Booking.findOne({ where: { tee_sheet_id: sheet.id } });

    // Change pricing to make B more expensive for visibility
    await models.TimeframePricingRule.update({ ride_fee_cents: 2000 }, { where: { timeframe_id: tf.id } });

    const resched = await request(app)
      .patch(`/api/v1/bookings/${booking.id}/reschedule`)
      .set('Cookie', `jwt=${token}`)
      .send({ classId: 'Full', legs: [{ tee_time_id: ttB.id, leg_index: 0 }] })
      .expect(200);

    expect(resched.body.success).toBe(true);
    expect(resched.body.total_price_cents).toBe(4000); // 2 players * 2000

    const ttAAfter = await models.TeeTime.findByPk(ttA.id);
    const ttBAfter = await models.TeeTime.findByPk(ttB.id);
    expect(ttAAfter.assigned_count).toBe(0);
    expect(ttBAfter.assigned_count).toBe(2);
  });

  test('reschedule capacity conflict returns 409', async () => {
    const tmpl = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: `R2-${Date.now()}` });
    const date = '2025-08-11';
    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date, day_template_id: tmpl.id });
    const tf = await models.Timeframe.create({ tee_sheet_id: sheet.id, side_id: side1.id, day_template_id: tmpl.id, start_time_local: '07:00:00', end_time_local: '11:00:00', interval_mins: 60, start_slots_enabled: true });
    await models.TimeframeAccessRule.create({ timeframe_id: tf.id, booking_class_id: 'Full', is_allowed: true });
    await models.TimeframeMinPlayers.create({ timeframe_id: tf.id, min_players: 1 });
    await models.TimeframePricingRule.create({ timeframe_id: tf.id, booking_class_id: 'Full', walk_fee_cents: 1000, ride_fee_cents: 1500, combine_fees: false });
    await models.TimeframeMode.create({ timeframe_id: tf.id, mode: 'Both' });

    const tt1 = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side1.id, start_time: new Date(`${date}T07:00:00Z`), capacity: 1, assigned_count: 0, is_blocked: false });
    const tt2 = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side1.id, start_time: new Date(`${date}T09:00:00Z`), capacity: 1, assigned_count: 0, is_blocked: false });

    // Booking with 1 player at tt1
    const created = await request(app).post('/api/v1/bookings').set('Cookie', `jwt=${token}`).set('Idempotency-Key', `resched-cap-create-${Date.now()}`).send({ tee_sheet_id: sheet.id, classId: 'Full', players: [{}], legs: [{ tee_time_id: tt1.id, round_option_id: null, leg_index: 0 }] }).expect(201);
    expect(created.body.total_price_cents).toBe(1500);

    // Fill tt2 capacity by another booking
    await request(app).post('/api/v1/bookings').set('Cookie', `jwt=${token}`).set('Idempotency-Key', `resched-cap-fill-${Date.now()}`).send({ tee_sheet_id: sheet.id, classId: 'Full', players: [{}], legs: [{ tee_time_id: tt2.id, round_option_id: null, leg_index: 0 }] }).expect(201);

    const booking = await models.Booking.findOne({ where: { tee_sheet_id: sheet.id }, order: [['created_at', 'ASC']] });
    await request(app)
      .patch(`/api/v1/bookings/${booking.id}/reschedule`)
      .set('Cookie', `jwt=${token}`)
      .send({ classId: 'Full', legs: [{ tee_time_id: tt2.id, leg_index: 0 }] })
      .expect(409);
  });
});

describe('DELETE /api/v1/bookings/:id', () => {
  let tokenStaff;
  let tokenCustomer;
  let course;
  let sheet;
  let side1;

  beforeAll(async () => {
    course = await models.GolfCourseInstance.create({ name: 'C Course', subdomain: 'c', status: 'Active' });
    const staff = await models.StaffUser.create({ course_id: course.id, email: 'cstaff@ex.com', password: 'p', role: 'Staff', is_active: true });
    tokenStaff = jwt.sign({ user_id: staff.id, course_id: course.id, role: 'Staff', email: staff.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    // Simulate customer token by role not in staff list
    tokenCustomer = jwt.sign({ user_id: 'cust1', course_id: course.id, role: 'Customer', email: 'cust@ex.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    sheet = await models.TeeSheet.create({ course_id: course.id, name: 'Sheet C' });
    side1 = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Front', valid_from: '2025-01-01', minutes_per_hole: 10, hole_count: 9 });
  });

  test('customer blocked within cutoff; staff can override', async () => {
    const tmpl = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: `C-${Date.now()}` });
    const tf = await models.Timeframe.create({ tee_sheet_id: sheet.id, side_id: side1.id, day_template_id: tmpl.id, start_time_local: '07:00:00', end_time_local: '11:00:00', interval_mins: 60, start_slots_enabled: true });
    await models.TimeframeAccessRule.create({ timeframe_id: tf.id, booking_class_id: 'Full', is_allowed: true });
    await models.TimeframeMinPlayers.create({ timeframe_id: tf.id, min_players: 1 });
    await models.TimeframePricingRule.create({ timeframe_id: tf.id, booking_class_id: 'Full', walk_fee_cents: 1000, ride_fee_cents: 1500, combine_fees: false });
    await models.TimeframeMode.create({ timeframe_id: tf.id, mode: 'Both' });

    const fixed = new Date('2025-08-12T09:00:00Z');
    const dateStr = fixed.toISOString().substring(0,10);
    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date: dateStr, day_template_id: tmpl.id });
    const tt = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side1.id, start_time: fixed, capacity: 4, assigned_count: 0, is_blocked: false });

    // Create booking
    const created = await request(app).post('/api/v1/bookings').set('Cookie', `jwt=${tokenStaff}`).set('Idempotency-Key', `cancel-create-${Date.now()}`).send({ tee_sheet_id: sheet.id, classId: 'Full', players: [{}], legs: [{ tee_time_id: tt.id, round_option_id: null, leg_index: 0 }] }).expect(201);
    expect(created.body.success).toBe(true);
    const booking = await models.Booking.findOne({ where: { tee_sheet_id: sheet.id } });

    // Customer attempts cancel within 24h cutoff -> blocked (401 due to auth role or 400 cutoff). We simulate auth by sending Bearer token
    const resCustomer = await request(app)
      .delete(`/api/v1/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${tokenCustomer}`)
      .expect(400);
    expect(resCustomer.body.error).toMatch(/window has passed/);

    // Staff override allowed
    const resStaff = await request(app)
      .delete(`/api/v1/bookings/${booking.id}`)
      .set('Cookie', `jwt=${tokenStaff}`)
      .expect(200);
    expect(resStaff.body.success).toBe(true);
    const after = await models.Booking.findByPk(booking.id);
    expect(after.status).toBe('Cancelled');
  });
});


