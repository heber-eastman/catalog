'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const models = require('../../src/models');
const SequelizeLib = require('sequelize');

describe('Availability API V2 windows', () => {
  let token; let courseId; let sheetId; let sideId;
  let futureDate;

  beforeAll(async () => {
    await models.sequelize.authenticate();
    // Ensure required tables are present (run migrations programmatically for CI)
    const qi = models.sequelize.getQueryInterface();
    try { await require('../../migrations/20250612171419-create-golfcourseinstance').up(qi, SequelizeLib); } catch (_) {}
    try { await require('../../migrations/20250612171421-create-staffuser').up(qi, SequelizeLib); } catch (_) {}
    try { await require('../../migrations/20250625000000-create-tee-sheet-schema').up(qi, SequelizeLib); } catch (_) {}
    try { await require('../../migrations/20250908090000-create-templates-seasons-overrides').up(qi, SequelizeLib); } catch (_) {}
    try { await require('../../migrations/20250918150000-add-allowed-hole-totals').up(qi, SequelizeLib); } catch (_) {}
    try { await require('../../migrations/20251031180000-add-teetime-reround-fields').up(qi, SequelizeLib); } catch (_) {}
    // Ensure overrides incremental migrations exist
    try { await require('../../migrations/20251008090500-add-name-to-overrides').up(qi, SequelizeLib); } catch (_) {}
    try { await require('../../migrations/20251010114500-add-draft-version-to-overrides').up(qi, SequelizeLib); } catch (_) {}
    try { await require('../../migrations/20251010090000-add-position-to-override-windows').up(qi, SequelizeLib); } catch (_) {}
    try { await require('../../migrations/20251010101500-remove-side-from-override-windows').up(qi, SequelizeLib); } catch (_) {}
    try { await require('../../migrations/20251017090000-add-color-to-seasons').up(qi, SequelizeLib); } catch (_) {}
    try { await require('../../migrations/20251017090500-add-color-to-overrides').up(qi, SequelizeLib); } catch (_) {}
    // Choose a future date to avoid past-time filtering for customer view
    const tomorrow = new Date(Date.now() + 24*60*60*1000);
    futureDate = tomorrow.toISOString().slice(0,10);
    const course = await models.GolfCourseInstance.create({ name: 'Avail V2', subdomain: `a-${Date.now()}`, status: 'Active', timezone: 'UTC' });
    courseId = course.id;
    const staff = await models.StaffUser.create({ course_id: courseId, email: `s-${Date.now()}@ex.com`, password: 'p', role: 'Staff', is_active: true });
    token = jwt.sign({ user_id: staff.id, course_id: courseId, role: 'Staff', email: staff.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const sheet = await models.TeeSheet.create({ course_id: courseId, name: 'V2' });
    sheetId = sheet.id;
    const side = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: 'A', valid_from: '2025-01-01', interval_mins: 60 });
    sideId = side.id;

    const tmpl = await models.TeeSheetTemplate.create({ tee_sheet_id: sheet.id, status: 'draft', interval_mins: 60 });
    const tv = await models.TeeSheetTemplateVersion.create({ template_id: tmpl.id, version_number: 1 });
    await models.TeeSheetTemplateSide.create({ version_id: tv.id, side_id: side.id, start_slots_enabled: true });

    // Public access and price
    await models.TeeSheetTemplateSideAccess.create({ version_id: tv.id, side_id: side.id, booking_class_id: 'public', is_allowed: true });
    await models.TeeSheetTemplateSidePrices.create({ version_id: tv.id, side_id: side.id, booking_class_id: 'public', greens_fee_cents: 1000, cart_fee_cents: 500 });
    // Publish after access and prices exist
    tmpl.published_version_id = tv.id; tmpl.status = 'published'; await tmpl.save();

    const ov = await models.TeeSheetOverride.create({ tee_sheet_id: sheet.id, status: 'draft', date: futureDate });
    const ovv = await models.TeeSheetOverrideVersion.create({ override_id: ov.id });
    await models.TeeSheetOverrideWindow.create({ override_version_id: ovv.id, start_mode: 'fixed', end_mode: 'fixed', start_time_local: '07:00:00', end_time_local: '10:00:00', template_version_id: tv.id });
    ov.published_version_id = ovv.id; ov.status = 'published'; await ov.save();

    // Configure booking window for public to ensure visibility
    try {
      await models.sequelize.getQueryInterface().bulkInsert('TemplateVersionBookingWindows', [{
        id: models.sequelize.literal('uuid_generate_v4()'),
        template_version_id: tv.id,
        booking_class_id: 'public',
        max_days_in_advance: 365,
        created_at: new Date(),
        updated_at: new Date(),
      }]);
    } catch (_) {}
    // Seed a slot at 07:00Z on the chosen future date
    await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side.id, start_time: new Date(`${futureDate}T07:00:00Z`), capacity: 4, assigned_count: 0, is_blocked: false });
  });

  test('returns V2-priced availability and respects public access', async () => {
    const res = await request(app)
      .get('/api/v1/tee-times/available')
      .set('Cookie', `jwt=${token}`)
      .query({ date: futureDate, 'teeSheets[]': sheetId, customerView: true, classId: 'public' })
      .expect(200);
    const item = res.body.find(r => r.side_id === sideId);
    expect(item).toBeTruthy();
    expect(item.price_total_cents).toBe(1000);
    expect(item.price_breakdown).toMatchObject({ greens_fee_cents: 1000 });
  });

  test('filters by specific side via sides[] and includes breakdown', async () => {
    const res = await request(app)
      .get('/api/v1/tee-times/available')
      .set('Cookie', `jwt=${token}`)
      .query({ date: futureDate, 'teeSheets[]': sheetId, 'sides[]': sideId, customerView: true, classId: 'public' })
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every(r => r.side_id === sideId)).toBe(true);
    const item = res.body[0];
    expect(item).toHaveProperty('price_breakdown');
    expect(item.price_breakdown.greens_fee_cents).toBeGreaterThanOrEqual(0);
  });
});


