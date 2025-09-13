'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Ensure demo course exists
    const courseRows = await queryInterface.sequelize.query(
      'SELECT id FROM "GolfCourseInstances" WHERE subdomain = :sub',
      { replacements: { sub: 'pinevalley' }, type: Sequelize.QueryTypes.SELECT }
    );
    if (courseRows.length === 0) {
      console.log('⚠️ Demo course not found; run 20250624-create-demo-data first. Skipping V2 demo.');
      return;
    }
    const courseId = courseRows[0].id;

    // If a demo tee sheet already exists, skip
    const existing = await queryInterface.sequelize.query(
      'SELECT id FROM "TeeSheets" WHERE course_id = :course AND name = :name',
      { replacements: { course: courseId, name: 'Main Course (Demo V2)' }, type: Sequelize.QueryTypes.SELECT }
    );
    if (existing.length > 0) {
      console.log('V2 demo tee sheet already exists, skipping...');
      return;
    }

    const now = new Date();
    const todayISO = new Date().toISOString().slice(0, 10);

    const teeSheetId = uuidv4();
    await queryInterface.bulkInsert('TeeSheets', [{
      id: teeSheetId,
      course_id: courseId,
      name: 'Main Course (Demo V2)',
      description: 'Demo V2 tee sheet with template and season',
      is_active: true,
      created_at: now,
      updated_at: now,
    }]);

    // Create two sides
    const sideAId = uuidv4();
    const sideBId = uuidv4();
    await queryInterface.bulkInsert('TeeSheetSides', [
      {
        id: sideAId,
        tee_sheet_id: teeSheetId,
        name: 'Front 9',
        valid_from: todayISO,
        valid_to: null,
        minutes_per_hole: 12,
        hole_count: 9,
        interval_mins: 8,
        start_slots_enabled: true,
        sunrise_offset_mins: 0,
        sunset_offset_mins: 0,
        created_at: now,
        updated_at: now,
      },
      {
        id: sideBId,
        tee_sheet_id: teeSheetId,
        name: 'Back 9',
        valid_from: todayISO,
        valid_to: null,
        minutes_per_hole: 12,
        hole_count: 9,
        interval_mins: 8,
        start_slots_enabled: true,
        sunrise_offset_mins: 0,
        sunset_offset_mins: 0,
        created_at: now,
        updated_at: now,
      },
    ]);

    // Template + version
    const templateId = uuidv4();
    const templateVersionId = uuidv4();
    await queryInterface.bulkInsert('TeeSheetTemplates', [{
      id: templateId,
      tee_sheet_id: teeSheetId,
      status: 'draft',
      published_version_id: null,
      interval_mins: 8,
      archived: false,
      created_at: now,
      updated_at: now,
    }]);
    await queryInterface.bulkInsert('TeeSheetTemplateVersions', [{
      id: templateVersionId,
      template_id: templateId,
      version_number: 1,
      notes: 'Initial demo template',
      created_at: now,
      updated_at: now,
    }]);

    // Template sides coverage (no rerounds)
    await queryInterface.bulkInsert('TeeSheetTemplateSides', [
      {
        id: uuidv4(),
        version_id: templateVersionId,
        side_id: sideAId,
        start_slots_enabled: true,
        rerounds_to_side_id: null,
        max_legs_starting: 1,
        min_players: 1,
        walk_ride_mode: 'either',
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        version_id: templateVersionId,
        side_id: sideBId,
        start_slots_enabled: true,
        rerounds_to_side_id: null,
        max_legs_starting: 1,
        min_players: 1,
        walk_ride_mode: 'either',
        created_at: now,
        updated_at: now,
      },
    ]);

    // Public prices for each side (publish invariant)
    await queryInterface.bulkInsert('TeeSheetTemplateSidePrices', [
      {
        id: uuidv4(),
        version_id: templateVersionId,
        side_id: sideAId,
        booking_class_id: 'public',
        greens_fee_cents: 4500,
        cart_fee_cents: 2000,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        version_id: templateVersionId,
        side_id: sideBId,
        booking_class_id: 'public',
        greens_fee_cents: 4500,
        cart_fee_cents: 2000,
        created_at: now,
        updated_at: now,
      },
    ]);

    // Publish template (satisfies model hook: coverage + public price)
    await queryInterface.bulkUpdate('TeeSheetTemplates',
      { status: 'published', published_version_id: templateVersionId, updated_at: now },
      { id: templateId }
    );

    // Season + version
    const seasonId = uuidv4();
    const seasonVersionId = uuidv4();
    // 6-month range starting at month start
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const endDateExclusive = new Date(now.getFullYear(), now.getMonth() + 6, 1).toISOString().slice(0, 10);
    await queryInterface.bulkInsert('TeeSheetSeasons', [{
      id: seasonId,
      tee_sheet_id: teeSheetId,
      status: 'draft',
      published_version_id: null,
      archived: false,
      created_at: now,
      updated_at: now,
    }]);
    await queryInterface.bulkInsert('TeeSheetSeasonVersions', [{
      id: seasonVersionId,
      season_id: seasonId,
      start_date: startDate,
      end_date_exclusive: endDateExclusive,
      notes: 'Demo season',
      created_at: now,
      updated_at: now,
    }]);

    // One weekday window per weekday, 06:30 - 18:00 using the template version
    const weekdayRows = [];
    for (let wd = 0; wd < 7; wd += 1) {
      weekdayRows.push({
        id: uuidv4(),
        season_version_id: seasonVersionId,
        weekday: wd,
        position: 0,
        start_mode: 'fixed',
        end_mode: 'fixed',
        start_time_local: '06:30:00',
        end_time_local: '18:00:00',
        start_offset_mins: null,
        end_offset_mins: null,
        template_version_id: templateVersionId,
        created_at: now,
        updated_at: now,
      });
    }
    await queryInterface.bulkInsert('TeeSheetSeasonWeekdayWindows', weekdayRows);

    // Publish season
    await queryInterface.bulkUpdate('TeeSheetSeasons',
      { status: 'published', published_version_id: seasonVersionId, updated_at: now },
      { id: seasonId }
    );

    console.log('✅ V2 demo tee sheet, template, and season created and published.');
  },

  async down(queryInterface, Sequelize) {
    // Delete by tee sheet name
    const rows = await queryInterface.sequelize.query(
      'SELECT id FROM "TeeSheets" WHERE name = :name',
      { replacements: { name: 'Main Course (Demo V2)' }, type: Sequelize.QueryTypes.SELECT }
    );
    if (rows.length === 0) return;
    const teeSheetId = rows[0].id;

    // Unpublish and remove dependent V2 entities
    const seasonIds = await queryInterface.sequelize.query(
      'SELECT id FROM "TeeSheetSeasons" WHERE tee_sheet_id = :sid',
      { replacements: { sid: teeSheetId }, type: Sequelize.QueryTypes.SELECT }
    );
    for (const s of seasonIds) {
      const verIds = await queryInterface.sequelize.query(
        'SELECT id FROM "TeeSheetSeasonVersions" WHERE season_id = :sid',
        { replacements: { sid: s.id }, type: Sequelize.QueryTypes.SELECT }
      );
      for (const v of verIds) {
        await queryInterface.bulkDelete('TeeSheetSeasonWeekdayWindows', { season_version_id: v.id });
      }
      await queryInterface.bulkDelete('TeeSheetSeasonVersions', { season_id: s.id });
    }
    await queryInterface.bulkDelete('TeeSheetSeasons', { tee_sheet_id: teeSheetId });

    const tmplIds = await queryInterface.sequelize.query(
      'SELECT id FROM "TeeSheetTemplates" WHERE tee_sheet_id = :sid',
      { replacements: { sid: teeSheetId }, type: Sequelize.QueryTypes.SELECT }
    );
    for (const t of tmplIds) {
      const verIds = await queryInterface.sequelize.query(
        'SELECT id FROM "TeeSheetTemplateVersions" WHERE template_id = :tid',
        { replacements: { tid: t.id }, type: Sequelize.QueryTypes.SELECT }
      );
      for (const v of verIds) {
        await queryInterface.bulkDelete('TeeSheetTemplateSidePrices', { version_id: v.id });
        await queryInterface.bulkDelete('TeeSheetTemplateSideAccess', { version_id: v.id });
        await queryInterface.bulkDelete('TeeSheetTemplateSides', { version_id: v.id });
      }
      await queryInterface.bulkDelete('TeeSheetTemplateVersions', { template_id: t.id });
    }
    await queryInterface.bulkDelete('TeeSheetTemplates', { tee_sheet_id: teeSheetId });

    await queryInterface.bulkDelete('TeeSheetSides', { tee_sheet_id: teeSheetId });
    await queryInterface.bulkDelete('TeeSheets', { id: teeSheetId });
  },
};


