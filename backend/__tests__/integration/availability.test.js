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

describe('Availability API', () => {
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

    const course = await models.GolfCourseInstance.create({ name: 'Avail Course', subdomain: `avail-${Date.now()}`, status: 'Active' });
    courseId = course.id;
    const staff = await models.StaffUser.create({ course_id: courseId, email: 'staff@ex.com', password: 'p', role: 'Staff', is_active: true });
    authToken = jwt.sign({ user_id: staff.id, course_id: courseId, role: 'Staff', email: staff.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    try { await sequelize.close(); } catch (e) {}
  });

  test('staff sees blocked flag, customer hides blocked; reround feasibility enforced', async () => {
    const sheet = await models.TeeSheet.create({ course_id: courseId, name: 'A1' });
    const side = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Front', valid_from: '2025-06-01', minutes_per_hole: 10, hole_count: 9 });
    const side2 = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Back', valid_from: '2025-06-01', minutes_per_hole: 10, hole_count: 9 });
    const tmpl = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: 'Wkdy' });
    await models.Timeframe.create({ tee_sheet_id: sheet.id, side_id: side.id, day_template_id: tmpl.id, start_time_local: '07:00:00', end_time_local: '11:00:00', interval_mins: 60, start_slots_enabled: true });
    await models.Timeframe.create({ tee_sheet_id: sheet.id, side_id: side2.id, day_template_id: tmpl.id, start_time_local: '07:00:00', end_time_local: '11:00:00', interval_mins: 60, start_slots_enabled: true });
    await models.TimeframeAccessRule.create({ timeframe_id: (await models.Timeframe.findOne({ where: { side_id: side.id } })).id, booking_class_id: 'Full', is_allowed: true });
    await models.TimeframeAccessRule.create({ timeframe_id: (await models.Timeframe.findOne({ where: { side_id: side2.id } })).id, booking_class_id: 'Full', is_allowed: true });

    // Round option 18-hole: first leg on side, second leg on side2
    const ro = await models.TimeframeRoundOption.create({ timeframe_id: (await models.Timeframe.findOne({ where: { side_id: side.id } })).id, name: '18h', leg_count: 2 });
    await models.TimeframeRoundLegOption.bulkCreate([
      { round_option_id: ro.id, leg_index: 0, hole_count: 9, side_id: side.id },
      { round_option_id: ro.id, leg_index: 1, hole_count: 9, side_id: side2.id },
    ]);

    // Seed tee times (first leg at 07:00Z; reround at 08:30Z with 90 minutes)
    const first = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side.id, start_time: new Date('2025-07-01T07:00:00Z'), capacity: 4, assigned_count: 0, is_blocked: false });
    const reround = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side2.id, start_time: new Date('2025-07-01T08:30:00Z'), capacity: 4, assigned_count: 3, is_blocked: false });
    await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date: '2025-07-01', day_template_id: tmpl.id });

    // Customer view: group size 2 should be filtered out due to reround capacity 1
    const custRes = await request(app)
      .get('/api/v1/tee-times/available')
      .set('Cookie', `jwt=${authToken}`)
      .query({ date: '2025-07-01', 'teeSheets[]': sheet.id, groupSize: 2, roundOptionId: ro.id, customerView: true, classId: 'Full' })
      .expect(200);
    expect(custRes.body.find(r => r.side_id === side.id)).toBeUndefined();

    // Staff view: sees the slot with blocked flag field present (undefined for customers)
    const staffRes = await request(app)
      .get('/api/v1/tee-times/available')
      .set('Cookie', `jwt=${authToken}`)
      .query({ date: '2025-07-01', 'teeSheets[]': sheet.id, groupSize: 1, roundOptionId: ro.id, customerView: false, classId: 'Full' })
      .expect(200);
    const item = staffRes.body.find(r => r.side_id === side.id);
    expect(item).toBeTruthy();
    expect(item).toHaveProperty('is_blocked');
  });
});


