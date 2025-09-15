'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // TeeSheets
    await queryInterface.createTable('TeeSheets', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      course_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'GolfCourseInstances', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TeeSheets', ['course_id']);
    await queryInterface.addIndex('TeeSheets', ['is_active']);

    // TeeSheetSides (effective-dated)
    await queryInterface.createTable('TeeSheetSides', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      tee_sheet_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheets', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      name: { type: Sequelize.STRING, allowNull: false },
      valid_from: { type: Sequelize.DATEONLY, allowNull: false },
      valid_to: { type: Sequelize.DATEONLY, allowNull: true },
      minutes_per_hole: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 12 },
      hole_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 9 },
      interval_mins: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 8 },
      start_slots_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      sunrise_offset_mins: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      sunset_offset_mins: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TeeSheetSides', ['tee_sheet_id']);
    await queryInterface.addIndex('TeeSheetSides', ['valid_from']);

    // DayTemplates
    await queryInterface.createTable('DayTemplates', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      tee_sheet_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheets', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('DayTemplates', ['tee_sheet_id']);

    // Timeframes
    await queryInterface.createTable('Timeframes', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      tee_sheet_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheets', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      side_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetSides', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      day_template_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'DayTemplates', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      start_time_local: { type: Sequelize.TIME, allowNull: false },
      end_time_local: { type: Sequelize.TIME, allowNull: false },
      interval_mins: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 8 },
      start_slots_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('Timeframes', ['tee_sheet_id']);
    await queryInterface.addIndex('Timeframes', ['side_id']);
    await queryInterface.addIndex('Timeframes', ['day_template_id']);

    // TimeframeAccessRules
    await queryInterface.createTable('TimeframeAccessRules', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      timeframe_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'Timeframes', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      booking_class_id: { type: Sequelize.STRING, allowNull: false },
      is_allowed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TimeframeAccessRules', ['timeframe_id']);

    // TimeframePricingRules
    await queryInterface.createTable('TimeframePricingRules', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      timeframe_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'Timeframes', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      booking_class_id: { type: Sequelize.STRING, allowNull: false },
      walk_fee_cents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ride_fee_cents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      combine_fees: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TimeframePricingRules', ['timeframe_id']);

    // TimeframeRoundOptions
    await queryInterface.createTable('TimeframeRoundOptions', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      timeframe_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'Timeframes', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      name: { type: Sequelize.STRING, allowNull: false },
      leg_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TimeframeRoundOptions', ['timeframe_id']);

    // TimeframeRoundLegOptions
    await queryInterface.createTable('TimeframeRoundLegOptions', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      round_option_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TimeframeRoundOptions', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      leg_index: { type: Sequelize.INTEGER, allowNull: false },
      hole_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 9 },
      side_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'TeeSheetSides', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TimeframeRoundLegOptions', ['round_option_id']);

    // TimeframeMinPlayers
    await queryInterface.createTable('TimeframeMinPlayers', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      timeframe_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'Timeframes', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      min_players: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TimeframeMinPlayers', ['timeframe_id']);

    // TimeframeModes
    await queryInterface.createTable('TimeframeModes', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      timeframe_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'Timeframes', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      mode: { type: Sequelize.STRING, allowNull: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TimeframeModes', ['timeframe_id']);

    // CalendarAssignments (unique per tee_sheet/date)
    await queryInterface.createTable('CalendarAssignments', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      tee_sheet_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheets', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      day_template_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'DayTemplates', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('CalendarAssignments', ['tee_sheet_id']);
    await queryInterface.addIndex('CalendarAssignments', ['date']);
    await queryInterface.addConstraint('CalendarAssignments', {
      fields: ['tee_sheet_id', 'date'],
      type: 'unique',
      name: 'calendar_assignments_tee_sheet_date_unique',
    });

    // ClosureBlocks
    await queryInterface.createTable('ClosureBlocks', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      tee_sheet_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheets', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      side_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'TeeSheetSides', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      starts_at: { type: Sequelize.DATE, allowNull: false },
      ends_at: { type: Sequelize.DATE, allowNull: false },
      reason: { type: Sequelize.STRING, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('ClosureBlocks', ['tee_sheet_id']);
    await queryInterface.addIndex('ClosureBlocks', ['side_id']);
    await queryInterface.addIndex('ClosureBlocks', ['starts_at']);

    // TeeTimes (generated slots)
    await queryInterface.createTable('TeeTimes', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      tee_sheet_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheets', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      side_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetSides', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      start_time: { type: Sequelize.DATE, allowNull: false },
      capacity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 4 },
      assigned_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_blocked: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      blocked_reason: { type: Sequelize.STRING },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TeeTimes', ['tee_sheet_id']);
    await queryInterface.addIndex('TeeTimes', ['side_id']);
    await queryInterface.addIndex('TeeTimes', ['start_time']);
    await queryInterface.addConstraint('TeeTimes', {
      fields: ['tee_sheet_id', 'side_id', 'start_time'],
      type: 'unique',
      name: 'tee_times_unique_sheet_side_time',
    });

    // Bookings
    await queryInterface.createTable('Bookings', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      tee_sheet_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheets', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
      owner_customer_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'Customers', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'Active' },
      total_price_cents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      notes: { type: Sequelize.TEXT },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('Bookings', ['tee_sheet_id']);

    // BookingRoundLegs
    await queryInterface.createTable('BookingRoundLegs', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      booking_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'Bookings', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      round_option_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'TimeframeRoundOptions', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      leg_index: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      walk_ride: { type: Sequelize.STRING, allowNull: true },
      price_cents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('BookingRoundLegs', ['booking_id']);

    // TeeTimeAssignments
    await queryInterface.createTable('TeeTimeAssignments', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      booking_round_leg_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'BookingRoundLegs', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      tee_time_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeTimes', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TeeTimeAssignments', ['booking_round_leg_id']);
    await queryInterface.addIndex('TeeTimeAssignments', ['tee_time_id']);

    // TeeTimeWaitlists
    await queryInterface.createTable('TeeTimeWaitlists', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      tee_time_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'TeeTimes', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      party_size: { type: Sequelize.INTEGER, allowNull: false },
      round_option_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'TimeframeRoundOptions', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      booking_class_id: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'Waiting' },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TeeTimeWaitlists', ['tee_time_id']);
  },

  async down(queryInterface) {
    // Drop in reverse order
    const tables = [
      'TeeTimeWaitlists',
      'TeeTimeAssignments',
      'BookingRoundLegs',
      'Bookings',
      'TeeTimes',
      'ClosureBlocks',
      'CalendarAssignments',
      'TimeframeModes',
      'TimeframeMinPlayers',
      'TimeframeRoundLegOptions',
      'TimeframeRoundOptions',
      'TimeframePricingRules',
      'TimeframeAccessRules',
      'Timeframes',
      'DayTemplates',
      'TeeSheetSides',
      'TeeSheets',
    ];
    for (const table of tables) {
      try {
        // remove unique constraints explicitly if needed
        if (table === 'TeeTimes') {
          await queryInterface.removeConstraint('TeeTimes', 'tee_times_unique_sheet_side_time');
        }
        if (table === 'CalendarAssignments') {
          await queryInterface.removeConstraint('CalendarAssignments', 'calendar_assignments_tee_sheet_date_unique');
        }
      } catch (e) {
        // ignore if not exists
      }
      try {
        await queryInterface.dropTable(table);
      } catch (e) {
        // ignore missing tables
      }
    }
  },
};


