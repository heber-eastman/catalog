/* eslint-env jest */
const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../../src/app');
const { sequelize } = require('../../src/models');
const {
  StaffUser,
  GolfCourseInstance,
  TeeSheet,
  TeeSheetSide,
  TeeSheetTemplate,
  TeeSheetTemplateVersion,
} = require('../../src/models');

describe('V2 Admin Templates API', () => {
  let courseId, token, sheetId;

  beforeAll(async () => {
    await sequelize.authenticate();
    // Ensure V2 tables exist when running in isolation
    try {
      const [rows] = await sequelize.query(`SELECT to_regclass('public."TeeSheets"') AS teesheets, to_regclass('public."TeeSheetTemplates"') AS templates`);
      const hasSheets = !!rows?.[0]?.teesheets;
      const hasV2 = !!rows?.[0]?.templates;
      if (!hasSheets || !hasV2) {
        const path = require('path');
        const { execSync } = require('child_process');
        execSync('npx sequelize-cli db:migrate', { stdio: 'inherit', cwd: path.join(__dirname, '../..') });
      }
    } catch (_) {}
    // Ensure columns used by models exist in this test DB
    try { await sequelize.query('ALTER TABLE "TeeSheetSeasons" ADD COLUMN IF NOT EXISTS name VARCHAR(120) NOT NULL DEFAULT \'Untitled Season\';'); } catch (e) {}
    try { await require('../../migrations/20250918150000-add-allowed-hole-totals').up(sequelize.getQueryInterface(), require('sequelize')); } catch (e) {}
    try { await require('../../migrations/20250625010000-add-course-geo-tz').up(sequelize.getQueryInterface(), require('sequelize')); } catch (e) {}
    // Incremental migrations for overrides/seasons
    const qi = sequelize.getQueryInterface(); const SequelizeLib = require('sequelize');
    try { await require('../../migrations/20251008090500-add-name-to-overrides').up(qi, SequelizeLib); } catch (e) {}
    try { await require('../../migrations/20251010114500-add-draft-version-to-overrides').up(qi, SequelizeLib); } catch (e) {}
    try { await require('../../migrations/20251010090000-add-position-to-override-windows').up(qi, SequelizeLib); } catch (e) {}
    try { await require('../../migrations/20251010101500-remove-side-from-override-windows').up(qi, SequelizeLib); } catch (e) {}
    try { await require('../../migrations/20251017090000-add-color-to-seasons').up(qi, SequelizeLib); } catch (e) {}
    try { await require('../../migrations/20251017090500-add-color-to-overrides').up(qi, SequelizeLib); } catch (e) {}
  });

  beforeEach(async () => {
    await StaffUser.destroy({ where: {} });
    // Truncate v2 tables with cascade to satisfy foreign keys
    try {
      await sequelize.query(
        'TRUNCATE "TeeSheetOverrideWindows", "TeeSheetOverrideVersions", "TeeSheetOverrides", ' +
          '"TeeSheetSeasonWeekdayWindows", "TeeSheetSeasonVersions", "TeeSheetSeasons", ' +
          '"TeeSheetTemplateSidePrices", "TeeSheetTemplateSideAccess", "TeeSheetTemplateSides", ' +
          '"TeeSheetTemplateVersions", "TeeSheetTemplates" RESTART IDENTITY CASCADE'
      );
    } catch (_) {}
    try { await sequelize.query('TRUNCATE "TeeSheetSides", "TeeSheets" RESTART IDENTITY CASCADE'); } catch (_) {}

    const course = await GolfCourseInstance.create({ name: 'Course T', subdomain: `v2t-${Date.now()}`, status: 'Active' });
    courseId = course.id;

    const hashedPassword = await bcrypt.hash('pw', 10);
    await StaffUser.create({ course_id: courseId, email: 'admin@c.com', password: hashedPassword, role: 'Admin', is_active: true, first_name: 'A', last_name: 'B' });
    const resp = await request(app).post('/api/v1/auth/login').send({ email: 'admin@c.com', password: 'pw' });
    token = resp.body.token;

    const sheet = await TeeSheet.create({ name: 'Main', course_id: courseId });
    sheetId = sheet.id;
    await TeeSheetSide.create({ tee_sheet_id: sheetId, name: 'Front', valid_from: '2025-01-01' });
  });

  test('create template, add version, publish fails without coverage/prices', async () => {
    jest.setTimeout(20000);
    const created = await request(app)
      .post(`/api/v1/tee-sheets/${sheetId}/v2/templates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ interval_mins: 10 });
    expect(created.status).toBe(201);
    const templateId = created.body.id;

    const v = await request(app)
      .post(`/api/v1/tee-sheets/${sheetId}/v2/templates/${templateId}/versions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'v1' });
    expect(v.status).toBe(201);

    const pub = await request(app)
      .post(`/api/v1/tee-sheets/${sheetId}/v2/templates/${templateId}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ version_id: v.body.id });
    expect(pub.status).toBe(400);
  });

  test('season create/version/window publish succeeds', async () => {
    jest.setTimeout(20000);
    // Create a template+version to reference in weekday window
    const tResp = await request(app)
      .post(`/api/v1/tee-sheets/${sheetId}/v2/templates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ interval_mins: 10 });
    const tmplId = tResp.body.id;
    const vResp = await request(app)
      .post(`/api/v1/tee-sheets/${sheetId}/v2/templates/${tmplId}/versions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'tv1' });
    const tmplVerId = vResp.body.id;
    // Ensure template version covers sides and has public pricing, then publish template
    const sides = await TeeSheetSide.findAll({ where: { tee_sheet_id: sheetId } });
    const { TeeSheetTemplateSide, TeeSheetTemplateSidePrices } = require('../../src/models');
    for (const s of sides) {
      await TeeSheetTemplateSide.create({ version_id: tmplVerId, side_id: s.id, start_slots_enabled: true });
      await TeeSheetTemplateSidePrices.create({ version_id: tmplVerId, side_id: s.id, booking_class_id: 'public', greens_fee_cents: 1000, cart_fee_cents: 0 });
    }
    const tPub = await request(app)
      .post(`/api/v1/tee-sheets/${sheetId}/v2/templates/${tmplId}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ version_id: tmplVerId });
    expect(tPub.status).toBe(200);

    const s = await request(app)
      .post(`/api/v1/tee-sheets/${sheetId}/v2/seasons`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(s.status).toBe(201);
    const seasonId = s.body.id;
    const sv = await request(app)
      .post(`/api/v1/tee-sheets/${sheetId}/v2/seasons/${seasonId}/versions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ start_date: '2025-07-07', end_date_exclusive: '2025-07-14' });
    expect(sv.status).toBe(201);
    const seasonVerId = sv.body.id;
    const ww = await request(app)
      .post(`/api/v1/tee-sheets/${sheetId}/v2/seasons/${seasonId}/versions/${seasonVerId}/weekday-windows`)
      .set('Authorization', `Bearer ${token}`)
      .send({ weekday: 1, start_mode: 'fixed', end_mode: 'fixed', start_time_local: '07:00', end_time_local: '18:00', template_version_id: tmplVerId });
    expect(ww.status).toBe(201);
    // Create another window on same weekday
    const ww2 = await request(app)
      .post(`/api/v1/tee-sheets/${sheetId}/v2/seasons/${seasonId}/versions/${seasonVerId}/weekday-windows`)
      .set('Authorization', `Bearer ${token}`)
      .send({ weekday: 1, start_mode: 'fixed', end_mode: 'fixed', start_time_local: '10:00', end_time_local: '12:00', template_version_id: tmplVerId });
    expect(ww2.status).toBe(201);
    // Reorder them (swap)
    const ro = await request(app)
      .patch(`/api/v1/tee-sheets/${sheetId}/v2/seasons/${seasonId}/versions/${seasonVerId}/weekday-windows/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ weekday: 1, order: [ww2.body.id, ww.body.id] });
    expect(ro.status).toBe(200);
    expect(Array.isArray(ro.body.windows)).toBe(true);
    expect(ro.body.windows[0].id).toBe(ww2.body.id);
    const pub = await request(app)
      .post(`/api/v1/tee-sheets/${sheetId}/v2/seasons/${seasonId}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ version_id: seasonVerId, start_date: '2025-07-07', end_date: '2025-07-14' });
    expect(pub.status).toBe(200);
    expect(pub.body).toHaveProperty('published_version');
  });

  test('override create/version publish succeeds', async () => {
    const o = await request(app)
      .post(`/api/v1/tee-sheets/${sheetId}/v2/overrides`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2025-08-15' });
    expect(o.status).toBe(201);
    const overrideId = o.body.id;
    const ov = await request(app)
      .post(`/api/v1/tee-sheets/${sheetId}/v2/overrides/${overrideId}/versions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'ov1' });
    expect(ov.status).toBe(201);
    const pub = await request(app)
      .post(`/api/v1/tee-sheets/${sheetId}/v2/overrides/${overrideId}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ version_id: ov.body.id });
    expect(pub.status).toBe(200);
    expect(pub.body).toHaveProperty('published_version');
  });
});


