'use strict';

/**
 * Phase 1 – Chunk 1: Data layer for Templates, Seasons, Overrides (versioned)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, STRING, INTEGER, DATE, DATEONLY, BOOLEAN, ENUM, TEXT } = Sequelize;

    // --- Templates ---
    await queryInterface.createTable('TeeSheetTemplates', {
      id: { type: UUID, primaryKey: true, defaultValue: UUIDV4 },
      tee_sheet_id: { type: UUID, allowNull: false },
      status: { type: ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      published_version_id: { type: UUID, allowNull: true },
      interval_mins: { type: INTEGER, allowNull: false, defaultValue: 10 },
      archived: { type: BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TeeSheetTemplates', ['tee_sheet_id']);

    await queryInterface.createTable('TeeSheetTemplateVersions', {
      id: { type: UUID, primaryKey: true, defaultValue: UUIDV4 },
      template_id: { type: UUID, allowNull: false },
      version_number: { type: INTEGER, allowNull: false, defaultValue: 1 },
      notes: { type: TEXT },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TeeSheetTemplateVersions', ['template_id']);
    await queryInterface.addConstraint('TeeSheetTemplateVersions', {
      fields: ['template_id', 'version_number'],
      type: 'unique',
      name: 'uniq_template_version_number',
    });

    await queryInterface.createTable('TeeSheetTemplateSides', {
      id: { type: UUID, primaryKey: true, defaultValue: UUIDV4 },
      version_id: { type: UUID, allowNull: false },
      side_id: { type: UUID, allowNull: false },
      start_slots_enabled: { type: BOOLEAN, allowNull: false, defaultValue: true },
      rerounds_to_side_id: { type: UUID, allowNull: true },
      max_legs_starting: { type: INTEGER, allowNull: false, defaultValue: 1 },
      min_players: { type: INTEGER, allowNull: false, defaultValue: 1 },
      walk_ride_mode: { type: ENUM('walk', 'ride', 'either'), allowNull: false, defaultValue: 'either' },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TeeSheetTemplateSides', ['version_id']);
    await queryInterface.addIndex('TeeSheetTemplateSides', ['side_id']);

    await queryInterface.createTable('TeeSheetTemplateSideAccess', {
      id: { type: UUID, primaryKey: true, defaultValue: UUIDV4 },
      version_id: { type: UUID, allowNull: false },
      side_id: { type: UUID, allowNull: false },
      booking_class_id: { type: STRING(64), allowNull: false },
      is_allowed: { type: BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('TeeSheetTemplateSideAccess', {
      fields: ['version_id', 'side_id', 'booking_class_id'],
      type: 'unique',
      name: 'uniq_tmpl_access_vsid_class',
    });

    await queryInterface.createTable('TeeSheetTemplateSidePrices', {
      id: { type: UUID, primaryKey: true, defaultValue: UUIDV4 },
      version_id: { type: UUID, allowNull: false },
      side_id: { type: UUID, allowNull: false },
      booking_class_id: { type: STRING(64), allowNull: false },
      greens_fee_cents: { type: INTEGER, allowNull: false, defaultValue: 0 },
      cart_fee_cents: { type: INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('TeeSheetTemplateSidePrices', {
      fields: ['version_id', 'side_id', 'booking_class_id'],
      type: 'unique',
      name: 'uniq_tmpl_price_vsid_class',
    });

    // --- Seasons ---
    await queryInterface.createTable('TeeSheetSeasons', {
      id: { type: UUID, primaryKey: true, defaultValue: UUIDV4 },
      tee_sheet_id: { type: UUID, allowNull: false },
      status: { type: ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      published_version_id: { type: UUID, allowNull: true },
      archived: { type: BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TeeSheetSeasons', ['tee_sheet_id']);

    await queryInterface.createTable('TeeSheetSeasonVersions', {
      id: { type: UUID, primaryKey: true, defaultValue: UUIDV4 },
      season_id: { type: UUID, allowNull: false },
      start_date: { type: DATEONLY, allowNull: false },
      end_date_exclusive: { type: DATEONLY, allowNull: false },
      notes: { type: TEXT },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TeeSheetSeasonVersions', ['season_id']);

    await queryInterface.createTable('TeeSheetSeasonWeekdayWindows', {
      id: { type: UUID, primaryKey: true, defaultValue: UUIDV4 },
      season_version_id: { type: UUID, allowNull: false },
      weekday: { type: INTEGER, allowNull: false }, // 0-6 Su..Sa
      position: { type: INTEGER, allowNull: false, defaultValue: 0 },
      start_mode: { type: ENUM('fixed', 'sunrise_offset'), allowNull: false, defaultValue: 'fixed' },
      end_mode: { type: ENUM('fixed', 'sunset_offset'), allowNull: false, defaultValue: 'fixed' },
      start_time_local: { type: STRING(8), allowNull: true }, // HH:MM:SS when fixed
      end_time_local: { type: STRING(8), allowNull: true },
      start_offset_mins: { type: INTEGER, allowNull: true },
      end_offset_mins: { type: INTEGER, allowNull: true },
      template_version_id: { type: UUID, allowNull: false },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('TeeSheetSeasonWeekdayWindows', {
      fields: ['season_version_id', 'weekday', 'position'],
      type: 'unique',
      name: 'uniq_season_weekday_position',
    });

    // --- Overrides ---
    await queryInterface.createTable('TeeSheetOverrides', {
      id: { type: UUID, primaryKey: true, defaultValue: UUIDV4 },
      tee_sheet_id: { type: UUID, allowNull: false },
      status: { type: ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      date: { type: DATEONLY, allowNull: false },
      published_version_id: { type: UUID, allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('TeeSheetOverrides', {
      fields: ['tee_sheet_id', 'date'],
      type: 'unique',
      name: 'uniq_override_date_per_sheet',
    });

    await queryInterface.createTable('TeeSheetOverrideVersions', {
      id: { type: UUID, primaryKey: true, defaultValue: UUIDV4 },
      override_id: { type: UUID, allowNull: false },
      notes: { type: TEXT },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TeeSheetOverrideVersions', ['override_id']);

    await queryInterface.createTable('TeeSheetOverrideWindows', {
      id: { type: UUID, primaryKey: true, defaultValue: UUIDV4 },
      override_version_id: { type: UUID, allowNull: false },
      side_id: { type: UUID, allowNull: false },
      start_mode: { type: ENUM('fixed', 'sunrise_offset'), allowNull: false, defaultValue: 'fixed' },
      end_mode: { type: ENUM('fixed', 'sunset_offset'), allowNull: false, defaultValue: 'fixed' },
      start_time_local: { type: STRING(8), allowNull: true },
      end_time_local: { type: STRING(8), allowNull: true },
      start_offset_mins: { type: INTEGER, allowNull: true },
      end_offset_mins: { type: INTEGER, allowNull: true },
      template_version_id: { type: UUID, allowNull: false },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    // Foreign keys (use raw constraints to keep RESTRICT behavior explicit)
    await queryInterface.addConstraint('TeeSheetTemplates', {
      fields: ['tee_sheet_id'],
      type: 'foreign key',
      references: { table: 'TeeSheets', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_templates_sheet',
    });
    await queryInterface.addConstraint('TeeSheetTemplates', {
      fields: ['published_version_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetTemplateVersions', field: 'id' },
      onDelete: 'SET NULL', onUpdate: 'CASCADE',
      name: 'fk_templates_published_version',
    });
    await queryInterface.addConstraint('TeeSheetTemplateVersions', {
      fields: ['template_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetTemplates', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_template_version_template',
    });
    await queryInterface.addConstraint('TeeSheetTemplateSides', {
      fields: ['version_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetTemplateVersions', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_template_side_version',
    });
    await queryInterface.addConstraint('TeeSheetTemplateSides', {
      fields: ['side_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetSides', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_template_side_side',
    });
    await queryInterface.addConstraint('TeeSheetTemplateSideAccess', {
      fields: ['version_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetTemplateVersions', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_template_access_version',
    });
    await queryInterface.addConstraint('TeeSheetTemplateSideAccess', {
      fields: ['side_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetSides', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_template_access_side',
    });
    await queryInterface.addConstraint('TeeSheetTemplateSidePrices', {
      fields: ['version_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetTemplateVersions', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_template_price_version',
    });
    await queryInterface.addConstraint('TeeSheetTemplateSidePrices', {
      fields: ['side_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetSides', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_template_price_side',
    });

    await queryInterface.addConstraint('TeeSheetSeasons', {
      fields: ['tee_sheet_id'],
      type: 'foreign key',
      references: { table: 'TeeSheets', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_season_sheet',
    });
    await queryInterface.addConstraint('TeeSheetSeasons', {
      fields: ['published_version_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetSeasonVersions', field: 'id' },
      onDelete: 'SET NULL', onUpdate: 'CASCADE',
      name: 'fk_season_published_version',
    });
    await queryInterface.addConstraint('TeeSheetSeasonVersions', {
      fields: ['season_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetSeasons', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_season_version_season',
    });
    await queryInterface.addConstraint('TeeSheetSeasonWeekdayWindows', {
      fields: ['season_version_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetSeasonVersions', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_season_weekday_window_version',
    });
    await queryInterface.addConstraint('TeeSheetSeasonWeekdayWindows', {
      fields: ['template_version_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetTemplateVersions', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_weekday_window_template_version',
    });

    await queryInterface.addConstraint('TeeSheetOverrides', {
      fields: ['tee_sheet_id'],
      type: 'foreign key',
      references: { table: 'TeeSheets', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_override_sheet',
    });
    await queryInterface.addConstraint('TeeSheetOverrides', {
      fields: ['published_version_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetOverrideVersions', field: 'id' },
      onDelete: 'SET NULL', onUpdate: 'CASCADE',
      name: 'fk_override_published_version',
    });
    await queryInterface.addConstraint('TeeSheetOverrideVersions', {
      fields: ['override_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetOverrides', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_override_version_override',
    });
    await queryInterface.addConstraint('TeeSheetOverrideWindows', {
      fields: ['override_version_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetOverrideVersions', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_override_window_version',
    });
    await queryInterface.addConstraint('TeeSheetOverrideWindows', {
      fields: ['side_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetSides', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_override_window_side',
    });
    await queryInterface.addConstraint('TeeSheetOverrideWindows', {
      fields: ['template_version_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetTemplateVersions', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_override_window_template_version',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('TeeSheetOverrideWindows');
    await queryInterface.dropTable('TeeSheetOverrideVersions');
    await queryInterface.dropTable('TeeSheetOverrides');
    await queryInterface.dropTable('TeeSheetSeasonWeekdayWindows');
    await queryInterface.dropTable('TeeSheetSeasonVersions');
    await queryInterface.dropTable('TeeSheetSeasons');
    await queryInterface.dropTable('TeeSheetTemplateSidePrices');
    await queryInterface.dropTable('TeeSheetTemplateSideAccess');
    await queryInterface.dropTable('TeeSheetTemplateSides');
    await queryInterface.dropTable('TeeSheetTemplateVersions');
    await queryInterface.dropTable('TeeSheetTemplates');
  },
};


