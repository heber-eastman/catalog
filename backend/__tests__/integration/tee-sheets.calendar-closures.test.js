'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const SequelizeLib = require('sequelize');
const models = require('../../src/models');

const courseMigration = require('../../migrations/20250612171419-create-golfcourseinstance');
const staffMigration = require('../../migrations/20250612171421-create-staffuser');
const customerMigration = require('../../migrations/20250612171422-create-customer');
const teeSchemaMigration = require('../../migrations/20250625000000-create-tee-sheet-schema');

describe('Calendar assignment and closures', () => {
  const sequelize = models.sequelize;
  const qi = sequelize.getQueryInterface();
  let authToken;
  let courseId;

  beforeAll(async () => {
    await sequelize.authenticate();
    await qi.dropAllTables();
    await courseMigration.up(qi, SequelizeLib);
    await staffMigration.up(qi, SequelizeLib);
    await customerMigration.up(qi, SequelizeLib);
    await teeSchemaMigration.up(qi, SequelizeLib);
    try { await require('../../migrations/20250625010000-add-course-geo-tz').up(qi, SequelizeLib); } catch (_) {}
    // Ensure TeeTimes denormalized columns exist for model compatibility
    try { await require('../../migrations/20251031180000-add-teetime-reround-fields').up(qi, SequelizeLib); } catch (_) {}
    try { await require('../../migrations/20251003090000-add-customer-to-assignment').up(qi, SequelizeLib); } catch (e) {}

    const course = await models.GolfCourseInstance.create({
      name: 'CalClose Course',
      subdomain: `calclose-${Date.now()}`,
      status: 'Active',
    });
    courseId = course.id;

    const staff = await models.StaffUser.create({
      course_id: courseId,
      email: 'admin2@example.com',
      password: 'hashed',
      role: 'Admin',
      is_active: true,
    });
    authToken = jwt.sign(
      { user_id: staff.id, course_id: courseId, role: 'Admin', email: staff.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    try { await sequelize.close(); } catch (e) {}
  });

  test('calendar: recurring with overrides; blocked when bookings exist', async () => {
    const sheet = await models.TeeSheet.create({ course_id: courseId, name: 'Calendar Sheet' });
    const tmplA = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: 'Weekday' });
    const tmplB = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: 'Weekend' });

    // First, assign a recurring Mon-Fri in a date range
    const res1 = await request(app)
      .post(`/api/v1/tee-sheets/${sheet.id}/calendar`)
      .set('Cookie', `jwt=${authToken}`)
      .send({
        day_template_id: tmplA.id,
        recurring: { start_date: '2025-07-01', end_date: '2025-07-05', days: [1,2,3,4,5] },
      })
      .expect(201);
    expect(Array.isArray(res1.body.assignments)).toBe(true);

    // Add an override for a specific date
    const res2 = await request(app)
      .post(`/api/v1/tee-sheets/${sheet.id}/calendar`)
      .set('Cookie', `jwt=${authToken}`)
      .send({ day_template_id: tmplA.id, overrides: [{ date: '2025-07-04', day_template_id: tmplB.id }], date: '2025-07-04' })
      .expect(201);
    expect(res2.body.assignments[0].date).toBe('2025-07-04');

    // Create a booked tee time on 2025-07-06; then try to change calendar for that date
    const side = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Front', valid_from: '2025-06-01' });
    const tt = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side.id, start_time: new Date('2025-07-06T08:00:00Z') });
    const booking = await models.Booking.create({ tee_sheet_id: sheet.id, status: 'Active' });
    const leg = await models.BookingRoundLeg.create({ booking_id: booking.id, leg_index: 0 });
    await models.TeeTimeAssignment.create({ booking_round_leg_id: leg.id, tee_time_id: tt.id });

    await request(app)
      .post(`/api/v1/tee-sheets/${sheet.id}/calendar`)
      .set('Cookie', `jwt=${authToken}`)
      .send({ day_template_id: tmplA.id, date: '2025-07-06' })
      .expect(400);
  });

  test('closures: refuse overlapping booked slots; accept clean window', async () => {
    const sheet = await models.TeeSheet.create({ course_id: courseId, name: 'Closures Sheet' });
    const side = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Back', valid_from: '2025-06-01' });
    const tt = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side.id, start_time: new Date('2025-07-10T09:00:00Z') });
    const booking = await models.Booking.create({ tee_sheet_id: sheet.id, status: 'Active' });
    const leg = await models.BookingRoundLeg.create({ booking_id: booking.id, leg_index: 0 });
    await models.TeeTimeAssignment.create({ booking_round_leg_id: leg.id, tee_time_id: tt.id });

    // Overlapping closure on same side should 400
    await request(app)
      .post(`/api/v1/tee-sheets/${sheet.id}/closures`)
      .set('Cookie', `jwt=${authToken}`)
      .send({ side_id: side.id, starts_at: '2025-07-10T08:00:00Z', ends_at: '2025-07-10T10:00:00Z', reason: 'Maintenance' })
      .expect(400);

    // Full-day closure overlapping booked slot should also 400
    await request(app)
      .post(`/api/v1/tee-sheets/${sheet.id}/closures`)
      .set('Cookie', `jwt=${authToken}`)
      .send({ starts_at: '2025-07-10T00:00:00Z', ends_at: '2025-07-10T23:59:59Z', reason: 'Tournament' })
      .expect(400);

    // Clean non-overlapping window should 201
    await request(app)
      .post(`/api/v1/tee-sheets/${sheet.id}/closures`)
      .set('Cookie', `jwt=${authToken}`)
      .send({ side_id: side.id, starts_at: '2025-07-10T10:01:00Z', ends_at: '2025-07-10T11:00:00Z', reason: 'Post' })
      .expect(201);
  });
});


