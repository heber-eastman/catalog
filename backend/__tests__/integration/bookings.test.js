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

    course = await models.GolfCourseInstance.create({ name: 'B Course', subdomain: 'b', status: 'Active' });
    const staff = await models.StaffUser.create({ course_id: course.id, email: 's@ex.com', password: 'p', role: 'Staff', is_active: true });
    token = jwt.sign({ user_id: staff.id, course_id: course.id, role: 'Staff', email: staff.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    sheet = await models.TeeSheet.create({ course_id: course.id, name: 'Sheet' });
    side1 = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Front', valid_from: '2025-01-01', minutes_per_hole: 10, hole_count: 9 });
    side2 = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Back', valid_from: '2025-01-01', minutes_per_hole: 10, hole_count: 9 });
    tmpl = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: 'Any' });
  });

  afterAll(async () => {
    try { await sequelize.close(); } catch (e) {}
  });

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
      players: [{ email: 'a@ex.com' }, { email: 'b@ex.com' }],
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


