'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const SequelizeLib = require('sequelize');
const models = require('../../src/models');

const courseMigration = require('../../migrations/20250612171419-create-golfcourseinstance');
const staffMigration = require('../../migrations/20250612171421-create-staffuser');
const teeSchemaMigration = require('../../migrations/20250625000000-create-tee-sheet-schema');
const customerMigration = require('../../migrations/20250612171422-create-customer');

describe('Admin Tee Sheets API', () => {
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

    const course = await models.GolfCourseInstance.create({
      name: 'Admin Test Course',
      subdomain: `admin-test-${Date.now()}`,
      status: 'Active',
    });
    courseId = course.id;

    const staff = await models.StaffUser.create({
      course_id: courseId,
      email: 'admin@example.com',
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

  test('create sheet → list sheets → update sheet', async () => {
    const created = await request(app)
      .post('/api/v1/tee-sheets')
      .set('Cookie', `jwt=${authToken}`)
      .send({ name: 'Weekday Sheet' })
      .expect(201);
    expect(created.body).toHaveProperty('id');

    const listed = await request(app)
      .get('/api/v1/tee-sheets')
      .set('Cookie', `jwt=${authToken}`)
      .expect(200);
    expect(Array.isArray(listed.body)).toBe(true);
    expect(listed.body.find(s => s.id === created.body.id)).toBeTruthy();

    const updated = await request(app)
      .put(`/api/v1/tee-sheets/${created.body.id}`)
      .set('Cookie', `jwt=${authToken}`)
      .send({ name: 'Weekday Sheet v2' })
      .expect(200);
    expect(updated.body.name).toBe('Weekday Sheet v2');
  });

  test('create side (effective-dated insert only)', async () => {
    const sheet = await models.TeeSheet.create({ course_id: courseId, name: 'Sides Sheet' });

    const sideResp = await request(app)
      .post(`/api/v1/tee-sheets/${sheet.id}/sides`)
      .set('Cookie', `jwt=${authToken}`)
      .send({ name: 'Front', valid_from: '2025-06-01' })
      .expect(201);
    expect(sideResp.body.name).toBe('Front');

    const sides = await request(app)
      .get(`/api/v1/tee-sheets/${sheet.id}/sides`)
      .set('Cookie', `jwt=${authToken}`)
      .expect(200);
    expect(sides.body.length).toBe(1);
  });

  test('templates + non-overlap timeframes', async () => {
    const sheet = await models.TeeSheet.create({ course_id: courseId, name: 'Template Sheet' });
    const side = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Back', valid_from: '2025-06-01' });

    const tmplResp = await request(app)
      .post(`/api/v1/tee-sheets/${sheet.id}/templates`)
      .set('Cookie', `jwt=${authToken}`)
      .send({ name: 'Weekday Template' })
      .expect(201);
    const templateId = tmplResp.body.id;

    // Happy path timeframe
    const tf1 = await request(app)
      .post(`/api/v1/tee-sheets/${sheet.id}/templates/${templateId}/timeframes`)
      .set('Cookie', `jwt=${authToken}`)
      .send({
        side_id: side.id,
        start_time_local: '07:00',
        end_time_local: '09:00',
        interval_mins: 8,
        start_slots_enabled: true,
        access_rules: [{ booking_class_id: 'Full', is_allowed: true }],
        pricing_rules: [{ booking_class_id: 'Full', walk_fee_cents: 1000, ride_fee_cents: 1500, combine_fees: false }],
        min_players: { min_players: 2 },
        mode: { mode: 'Standard' },
        round_options: [
          { name: '9-hole', leg_count: 1, leg_options: [{ leg_index: 0, hole_count: 9, side_id: side.id }] },
        ],
      })
      .expect(201);
    expect(tf1.body.side_id).toBe(side.id);

    // Overlap should 400
    await request(app)
      .post(`/api/v1/tee-sheets/${sheet.id}/templates/${templateId}/timeframes`)
      .set('Cookie', `jwt=${authToken}`)
      .send({ side_id: side.id, start_time_local: '08:30', end_time_local: '10:00' })
      .expect(400);

    // Non-overlap different side should succeed
    const side2 = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'Front', valid_from: '2025-06-01' });
    await request(app)
      .post(`/api/v1/tee-sheets/${sheet.id}/templates/${templateId}/timeframes`)
      .set('Cookie', `jwt=${authToken}`)
      .send({ side_id: side2.id, start_time_local: '08:30', end_time_local: '10:00' })
      .expect(201);
  });
});


