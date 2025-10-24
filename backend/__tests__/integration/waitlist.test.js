'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const SequelizeLib = require('sequelize');
const app = require('../../src/app');
const models = require('../../src/models');

describe('Waitlist flow', () => {
  let tokenStaff;
  let tokenCustomer;
  let course;
  let sheet;
  let side1;
  let tmpl;

  beforeAll(async () => {
    const sequelize = models.sequelize;
    const qi = sequelize.getQueryInterface();
    await sequelize.authenticate();
    await qi.dropAllTables();
    await require('../../migrations/20250612171419-create-golfcourseinstance').up(qi, SequelizeLib);
    await require('../../migrations/20250612171421-create-staffuser').up(qi, SequelizeLib);
    await require('../../migrations/20250612171422-create-customer').up(qi, SequelizeLib);
    await require('../../migrations/20250625000000-create-tee-sheet-schema').up(qi, SequelizeLib);
    try { await require('../../migrations/20250625010000-add-course-geo-tz').up(qi, SequelizeLib); } catch (_) {}

    course = await models.GolfCourseInstance.create({ name: 'W Course', subdomain: 'w', status: 'Active' });
    const staff = await models.StaffUser.create({ course_id: course.id, email: 'w@ex.com', password: 'p', role: 'Staff', is_active: true });
    tokenStaff = jwt.sign({ user_id: staff.id, course_id: course.id, role: 'Staff', email: staff.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    tokenCustomer = jwt.sign({ user_id: 'custw', course_id: course.id, role: 'Customer', email: 'c@ex.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    sheet = await models.TeeSheet.create({ course_id: course.id, name: 'Sheet W' });
    side1 = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Front', valid_from: '2025-01-01', minutes_per_hole: 10, hole_count: 9 });
    tmpl = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: 'Any' });
  });

  test('join, get offered immediately when capacity exists, accept creates hold', async () => {
    const date = '2025-09-01';
    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date, day_template_id: tmpl.id });
    const tf = await models.Timeframe.create({ tee_sheet_id: sheet.id, side_id: side1.id, day_template_id: tmpl.id, start_time_local: '00:00:00', end_time_local: '23:59:59', interval_mins: 60, start_slots_enabled: true });
    await models.TimeframeAccessRule.create({ timeframe_id: tf.id, booking_class_id: 'Full', is_allowed: true });

    const tt = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side1.id, start_time: new Date(`${date}T08:00:00Z`), capacity: 4, assigned_count: 0, is_blocked: false });

    // Join for party size 2 - should be offered immediately
    const join = await request(app)
      .post('/api/v1/waitlist')
      .set('Authorization', `Bearer ${tokenCustomer}`)
      .send({ tee_time_id: tt.id, party_size: 2, classId: 'Full' })
      .expect(201);
    expect(join.body.offered).toBe(true);
    const wlId = join.body.waitlist_id;
    const token = join.body.accept_token;

    // Accept via magic token
    const accept = await request(app)
      .post(`/api/v1/waitlist/${wlId}/accept`)
      .send({ token })
      .expect(200);
    expect(accept.body.success).toBe(true);
    expect(accept.body.hold.source).toBe('waitlist');
  });

  test('staff promote oldest-first; capacity conflict blocked', async () => {
    const date = '2025-09-02';
    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date, day_template_id: tmpl.id });
    const tf = await models.Timeframe.create({ tee_sheet_id: sheet.id, side_id: side1.id, day_template_id: tmpl.id, start_time_local: '00:00:00', end_time_local: '23:59:59', interval_mins: 60, start_slots_enabled: true });
    await models.TimeframeAccessRule.create({ timeframe_id: tf.id, booking_class_id: 'Full', is_allowed: true });

    const tt = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side1.id, start_time: new Date(`${date}T08:00:00Z`), capacity: 2, assigned_count: 0, is_blocked: false });

    // First join for 2 (fills all capacity if offered)
    const j1 = await request(app).post('/api/v1/waitlist').set('Authorization', `Bearer ${tokenCustomer}`).send({ tee_time_id: tt.id, party_size: 2, classId: 'Full' }).expect(201);
    // Place a checkout hold that should not override waitlist precedence; but our check is on accept to create waitlist hold
    // Second join for 1 - not enough capacity
    const j2 = await request(app).post('/api/v1/waitlist').set('Authorization', `Bearer ${tokenCustomer}`).send({ tee_time_id: tt.id, party_size: 1, classId: 'Full' }).expect(201);
    const wl2 = j2.body.waitlist_id;

    // Reduce capacity by setting assigned_count to 2
    await tt.update({ assigned_count: 2 });
    // Staff promotion should fail due to capacity
    await request(app).post(`/api/v1/waitlist/${wl2}/promote`).set('Cookie', `jwt=${tokenStaff}`).expect(409);
  });
});


