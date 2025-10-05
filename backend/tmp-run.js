(async () => {
  const req = require("supertest");
  const app = require("./src/app");
  const models = require("./src/models");
  const jwt = require("jsonwebtoken");
  const SequelizeLib = require("sequelize");
  const courseMigration = require("./migrations/20250612171419-create-golfcourseinstance");
  const staffMigration = require("./migrations/20250612171421-create-staffuser");
  const customerMigration = require("./migrations/20250612171422-create-customer");
  const teeSchemaMigration = require("./migrations/20250625000000-create-tee-sheet-schema");

  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret-key";
  process.env.REDIS_URL = "mock://redis";

  const sequelize = models.sequelize;
  const qi = sequelize.getQueryInterface();
  await sequelize.authenticate();
  await qi.dropAllTables();
  await courseMigration.up(qi, SequelizeLib);
  await staffMigration.up(qi, SequelizeLib);
  await customerMigration.up(qi, SequelizeLib);
  await teeSchemaMigration.up(qi, SequelizeLib);

  const course = await models.GolfCourseInstance.create({ name: "B Course", subdomain: "b", status: "Active" });
  const staff = await models.StaffUser.create({ course_id: course.id, email: "s@ex.com", password: "p", role: "Staff", is_active: true });
  const token = jwt.sign({ user_id: staff.id, course_id: course.id, role: "Staff", email: staff.email }, process.env.JWT_SECRET, { expiresIn: "1h" });

  const sheet = await models.TeeSheet.create({ course_id: course.id, name: "Sheet" });
  const side1 = await models.TeeSheetSide.create({ tee_sheet_id: sheet.id, name: "Front", valid_from: "2025-01-01", minutes_per_hole: 10, hole_count: 9 });
  const localTmpl = await models.DayTemplate.create({ tee_sheet_id: sheet.id, name: "Any" });
  const tf = await models.Timeframe.create({ tee_sheet_id: sheet.id, side_id: side1.id, day_template_id: localTmpl.id, start_time_local: "07:00:00", end_time_local: "09:00:00", interval_mins: 60, start_slots_enabled: true });
  await models.TimeframeAccessRule.create({ timeframe_id: tf.id, booking_class_id: "Full", is_allowed: true });
  await models.TimeframeMinPlayers.create({ timeframe_id: tf.id, min_players: 1 });
  await models.TimeframePricingRule.create({ timeframe_id: tf.id, booking_class_id: "Full", walk_fee_cents: 1000, ride_fee_cents: 1500, combine_fees: false });
  await models.TimeframeMode.create({ timeframe_id: tf.id, mode: "Both" });
  const tt = await models.TeeTime.create({ tee_sheet_id: sheet.id, side_id: side1.id, start_time: new Date("2025-07-01T07:00:00Z"), capacity: 4, assigned_count: 0, is_blocked: false });
  await models.CalendarAssignment.create({ tee_sheet_id: sheet.id, date: "2025-07-01", day_template_id: localTmpl.id });

  const body = { tee_sheet_id: sheet.id, classId: "Full", players: [{ email: "a@ex.com", walkRide: "ride" }, { email: "b@ex.com", walkRide: "ride" }], legs: [{ tee_time_id: tt.id, round_option_id: null, leg_index: 0 }] };

  const res = await req(app).post("/api/v1/bookings").set("Cookie", `jwt=${token}`).set("Idempotency-Key", "book-9-1").send(body);
  console.log("Status:", res.statusCode);
  console.log("Body:", res.body);
  if (res.statusCode !== 201) {
    console.log("Text:", res.text);
  }
  process.exit(0);
})().catch(err => { console.error("Error:", err); process.exit(1); });
