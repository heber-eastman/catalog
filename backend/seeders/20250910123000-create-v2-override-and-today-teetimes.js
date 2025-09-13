'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const todayISO = new Date().toISOString().slice(0, 10);

    // Find demo V2 tee sheet
    const teeSheetRows = await queryInterface.sequelize.query(
      'SELECT id, course_id FROM "TeeSheets" WHERE name = :name',
      { replacements: { name: 'Main Course (Demo V2)' }, type: Sequelize.QueryTypes.SELECT }
    );
    if (teeSheetRows.length === 0) {
      console.log('⚠️ Demo V2 tee sheet not found; skipping override/tee times seeding');
      return;
    }
    const teeSheetId = teeSheetRows[0].id;

    // Load sides
    const sides = await queryInterface.sequelize.query(
      'SELECT id FROM "TeeSheetSides" WHERE tee_sheet_id = :sid ORDER BY name',
      { replacements: { sid: teeSheetId }, type: Sequelize.QueryTypes.SELECT }
    );
    if (sides.length < 1) return;

    // Create an override for today with a narrow window on first side
    const overrideId = uuidv4();
    const overrideVerId = uuidv4();
    // Ensure template version exists
    const tmplVerRows = await queryInterface.sequelize.query(
      'SELECT id FROM "TeeSheetTemplateVersions" tv JOIN "TeeSheetTemplates" t ON t.id = tv.template_id WHERE t.tee_sheet_id = :sid ORDER BY version_number DESC LIMIT 1',
      { replacements: { sid: teeSheetId }, type: Sequelize.QueryTypes.SELECT }
    );
    if (tmplVerRows.length === 0) return;
    const tmplVerId = tmplVerRows[0].id;

    await queryInterface.bulkInsert('TeeSheetOverrides', [{
      id: overrideId,
      tee_sheet_id: teeSheetId,
      status: 'published',
      date: todayISO,
      published_version_id: overrideVerId,
      created_at: now,
      updated_at: now,
    }]);
    await queryInterface.bulkInsert('TeeSheetOverrideVersions', [{
      id: overrideVerId,
      override_id: overrideId,
      notes: 'Demo override for today',
      created_at: now,
      updated_at: now,
    }]);
    await queryInterface.bulkInsert('TeeSheetOverrideWindows', [{
      id: uuidv4(),
      override_version_id: overrideVerId,
      side_id: sides[0].id,
      start_mode: 'fixed',
      end_mode: 'fixed',
      start_time_local: '08:00:00',
      end_time_local: '10:00:00',
      start_offset_mins: null,
      end_offset_mins: null,
      template_version_id: tmplVerId,
      created_at: now,
      updated_at: now,
    }]);

    // Seed a few tee times for today for both sides (08:00, 08:08)
    const teeTimes = [];
    const slots = ['08:00:00', '08:08:00'];
    for (const side of sides) {
      for (const t of slots) {
        const dt = new Date(`${todayISO}T${t}Z`); // store UTC; app handles tz
        teeTimes.push({
          id: uuidv4(),
          tee_sheet_id: teeSheetId,
          side_id: side.id,
          start_time: dt,
          capacity: 4,
          assigned_count: 0,
          is_blocked: false,
          blocked_reason: null,
          created_at: now,
          updated_at: now,
        });
      }
    }
    await queryInterface.bulkInsert('TeeTimes', teeTimes);

    console.log('✅ Demo override and today tee times created.');
  },

  async down(queryInterface, Sequelize) {
    const name = 'Main Course (Demo V2)';
    const todayISO = new Date().toISOString().slice(0, 10);
    const rows = await queryInterface.sequelize.query(
      'SELECT id FROM "TeeSheets" WHERE name = :name',
      { replacements: { name }, type: Sequelize.QueryTypes.SELECT }
    );
    if (rows.length === 0) return;
    const teeSheetId = rows[0].id;

    // Remove today tee times we added
    await queryInterface.sequelize.query(
      'DELETE FROM "TeeTimes" WHERE tee_sheet_id = :sid AND start_time::date = :d::date',
      { replacements: { sid: teeSheetId, d: todayISO } }
    );

    // Remove override for today
    const ovRows = await queryInterface.sequelize.query(
      'SELECT id FROM "TeeSheetOverrides" WHERE tee_sheet_id = :sid AND date = :d',
      { replacements: { sid: teeSheetId, d: todayISO }, type: Sequelize.QueryTypes.SELECT }
    );
    for (const o of ovRows) {
      const verRows = await queryInterface.sequelize.query(
        'SELECT id FROM "TeeSheetOverrideVersions" WHERE override_id = :oid',
        { replacements: { oid: o.id }, type: Sequelize.QueryTypes.SELECT }
      );
      for (const v of verRows) {
        await queryInterface.bulkDelete('TeeSheetOverrideWindows', { override_version_id: v.id });
      }
      await queryInterface.bulkDelete('TeeSheetOverrideVersions', { override_id: o.id });
    }
    await queryInterface.bulkDelete('TeeSheetOverrides', { tee_sheet_id: teeSheetId, date: todayISO });
  },
};


