'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // TeeSheetTemplates (create if missing)
    try { await queryInterface.createTable('TeeSheetTemplates', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      tee_sheet_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheets', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      name: { type: Sequelize.STRING(120), allowNull: false, defaultValue: 'Untitled Template' },
      status: { type: Sequelize.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      published_version_id: { type: Sequelize.UUID, allowNull: true },
      interval_mins: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 10 },
      interval_type: { type: Sequelize.ENUM('standard'), allowNull: false, defaultValue: 'standard' },
      max_players_staff: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 4 },
      max_players_online: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 4 },
      archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }); } catch (e) {}
    await (async () => { try { await queryInterface.addIndex('TeeSheetTemplates', ['tee_sheet_id']); } catch (e) {} })();
    // Ensure required columns exist (handles pre-existing tables in CI/test env)
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        -- name
        BEGIN
          ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "name" VARCHAR(120) NOT NULL DEFAULT 'Untitled Template';
        EXCEPTION WHEN duplicate_column THEN NULL; END;
        -- interval_type enum + column
        PERFORM 1 FROM pg_type WHERE typname = 'enum_TeeSheetTemplates_interval_type';
        IF NOT FOUND THEN
          CREATE TYPE "enum_TeeSheetTemplates_interval_type" AS ENUM ('standard');
        END IF;
        BEGIN
          ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "interval_type" "enum_TeeSheetTemplates_interval_type" NOT NULL DEFAULT 'standard';
        EXCEPTION WHEN duplicate_column THEN NULL; END;
        -- max players columns
        BEGIN
          ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "max_players_staff" INTEGER NOT NULL DEFAULT 4;
        EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN
          ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "max_players_online" INTEGER NOT NULL DEFAULT 4;
        EXCEPTION WHEN duplicate_column THEN NULL; END;
      END $$;
    `);

    // TeeSheetTemplateVersions
    try { await queryInterface.createTable('TeeSheetTemplateVersions', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      template_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetTemplates', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      version_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      notes: { type: Sequelize.TEXT },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }); } catch (e) {}
    await (async () => { try { await queryInterface.addIndex('TeeSheetTemplateVersions', ['template_id']); } catch (e) {} })();
    await (async () => { try { await queryInterface.addConstraint('TeeSheetTemplateVersions', {
      fields: ['template_id', 'version_number'],
      type: 'unique',
      name: 'tmpl_versions_unique_template_version',
    }); } catch (e) {} })();

    // TeeSheetTemplateSides
    try { await queryInterface.createTable('TeeSheetTemplateSides', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      version_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetTemplateVersions', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      side_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetSides', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      start_slots_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      rerounds_to_side_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'TeeSheetSides', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      max_legs_starting: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      min_players: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      walk_ride_mode: { type: Sequelize.ENUM('walk', 'ride', 'either'), allowNull: false, defaultValue: 'either' },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }); } catch (e) {}
    await (async () => { try { await queryInterface.addIndex('TeeSheetTemplateSides', ['version_id']); } catch (e) {} })();
    await (async () => { try { await queryInterface.addIndex('TeeSheetTemplateSides', ['side_id']); } catch (e) {} })();

    // TeeSheetTemplateSideAccess
    try { await queryInterface.createTable('TeeSheetTemplateSideAccess', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      version_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetTemplateVersions', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      side_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetSides', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      booking_class_id: { type: Sequelize.STRING(64), allowNull: false },
      is_allowed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }); } catch (e) {}
    await (async () => { try { await queryInterface.addConstraint('TeeSheetTemplateSideAccess', {
      fields: ['version_id', 'side_id', 'booking_class_id'],
      type: 'unique',
      name: 'tmpl_side_access_unique_version_side_class',
    }); } catch (e) {} })();

    // TeeSheetTemplateSidePrices
    try { await queryInterface.createTable('TeeSheetTemplateSidePrices', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      version_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetTemplateVersions', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      side_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetSides', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      booking_class_id: { type: Sequelize.STRING(64), allowNull: false },
      greens_fee_cents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      cart_fee_cents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }); } catch (e) {}
    await (async () => { try { await queryInterface.addConstraint('TeeSheetTemplateSidePrices', {
      fields: ['version_id', 'side_id', 'booking_class_id'],
      type: 'unique',
      name: 'tmpl_side_prices_unique_version_side_class',
    }); } catch (e) {} })();

    // TeeSheetSeasons
    try { await queryInterface.createTable('TeeSheetSeasons', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      tee_sheet_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheets', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      status: { type: Sequelize.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      published_version_id: { type: Sequelize.UUID, allowNull: true },
      archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }); } catch (e) {}
    await (async () => { try { await queryInterface.addIndex('TeeSheetSeasons', ['tee_sheet_id']); } catch (e) {} })();

    // TeeSheetSeasonVersions
    try { await queryInterface.createTable('TeeSheetSeasonVersions', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      season_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetSeasons', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date_exclusive: { type: Sequelize.DATEONLY, allowNull: false },
      notes: { type: Sequelize.TEXT },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }); } catch (e) {}
    await (async () => { try { await queryInterface.addIndex('TeeSheetSeasonVersions', ['season_id']); } catch (e) {} })();

    // TeeSheetSeasonWeekdayWindows
    try { await queryInterface.createTable('TeeSheetSeasonWeekdayWindows', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      season_version_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetSeasonVersions', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      weekday: { type: Sequelize.INTEGER, allowNull: false },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      start_mode: { type: Sequelize.ENUM('fixed', 'sunrise_offset'), allowNull: false, defaultValue: 'fixed' },
      end_mode: { type: Sequelize.ENUM('fixed', 'sunset_offset'), allowNull: false, defaultValue: 'fixed' },
      start_time_local: { type: Sequelize.STRING(8), allowNull: true },
      end_time_local: { type: Sequelize.STRING(8), allowNull: true },
      start_offset_mins: { type: Sequelize.INTEGER, allowNull: true },
      end_offset_mins: { type: Sequelize.INTEGER, allowNull: true },
      template_version_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetTemplateVersions', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }); } catch (e) {}
    await (async () => { try { await queryInterface.addConstraint('TeeSheetSeasonWeekdayWindows', {
      fields: ['season_version_id', 'weekday', 'position'],
      type: 'unique',
      name: 'season_weekday_windows_unique_version_weekday_position',
    }); } catch (e) {} })();

    // TeeSheetOverrides
    try { await queryInterface.createTable('TeeSheetOverrides', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      tee_sheet_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheets', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      status: { type: Sequelize.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      published_version_id: { type: Sequelize.UUID, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }); } catch (e) {}
    await (async () => { try { await queryInterface.addIndex('TeeSheetOverrides', ['tee_sheet_id']); } catch (e) {} })();

    // TeeSheetOverrideVersions
    try { await queryInterface.createTable('TeeSheetOverrideVersions', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      override_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetOverrides', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      notes: { type: Sequelize.TEXT },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }); } catch (e) {}
    await (async () => { try { await queryInterface.addIndex('TeeSheetOverrideVersions', ['override_id']); } catch (e) {} })();

    // TeeSheetOverrideWindows
    try { await queryInterface.createTable('TeeSheetOverrideWindows', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      override_version_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetOverrideVersions', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      side_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetSides', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      start_mode: { type: Sequelize.ENUM('fixed', 'sunrise_offset'), allowNull: false, defaultValue: 'fixed' },
      end_mode: { type: Sequelize.ENUM('fixed', 'sunset_offset'), allowNull: false, defaultValue: 'fixed' },
      start_time_local: { type: Sequelize.STRING(8), allowNull: true },
      end_time_local: { type: Sequelize.STRING(8), allowNull: true },
      start_offset_mins: { type: Sequelize.INTEGER, allowNull: true },
      end_offset_mins: { type: Sequelize.INTEGER, allowNull: true },
      template_version_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetTemplateVersions', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }); } catch (e) {}
    await (async () => { try { await queryInterface.addIndex('TeeSheetOverrideWindows', ['override_version_id']); } catch (e) {} })();

    // Online Access table
    try { await queryInterface.createTable('TeeSheetTemplateOnlineAccess', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      template_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetTemplates', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      booking_class_id: { type: Sequelize.STRING(64), allowNull: false },
      is_online_allowed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }); } catch (e) {}
    await (async () => { try { await queryInterface.addConstraint('TeeSheetTemplateOnlineAccess', {
      fields: ['template_id', 'booking_class_id'],
      type: 'unique',
      name: 'tmpl_online_access_unique_template_class',
    }); } catch (e) {} })();
  },

  async down(queryInterface, Sequelize) {
    // Drop in reverse order, remove constraints/enums when needed
    const drop = async (table) => { try { await queryInterface.dropTable(table); } catch (e) {} };

    try { await queryInterface.removeConstraint('TeeSheetTemplateOnlineAccess', 'tmpl_online_access_unique_template_class'); } catch (e) {}
    await drop('TeeSheetTemplateOnlineAccess');

    await drop('TeeSheetOverrideWindows');
    await drop('TeeSheetOverrideVersions');
    await drop('TeeSheetOverrides');

    try { await queryInterface.removeConstraint('TeeSheetSeasonWeekdayWindows', 'season_weekday_windows_unique_version_weekday_position'); } catch (e) {}
    await drop('TeeSheetSeasonWeekdayWindows');
    await drop('TeeSheetSeasonVersions');
    await drop('TeeSheetSeasons');

    try { await queryInterface.removeConstraint('TeeSheetTemplateSidePrices', 'tmpl_side_prices_unique_version_side_class'); } catch (e) {}
    await drop('TeeSheetTemplateSidePrices');
    try { await queryInterface.removeConstraint('TeeSheetTemplateSideAccess', 'tmpl_side_access_unique_version_side_class'); } catch (e) {}
    await drop('TeeSheetTemplateSideAccess');
    await drop('TeeSheetTemplateSides');

    try { await queryInterface.removeConstraint('TeeSheetTemplateVersions', 'tmpl_versions_unique_template_version'); } catch (e) {}
    await drop('TeeSheetTemplateVersions');

    await drop('TeeSheetTemplates');

    // Remove ENUMs to avoid leftover type errors in Postgres
    try { await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_TeeSheetTemplates_status\"; "); } catch (e) {}
    try { await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_TeeSheetTemplates_interval_type\"; "); } catch (e) {}
    try { await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_TeeSheetTemplateSides_walk_ride_mode\"; "); } catch (e) {}
    try { await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_TeeSheetSeasonWeekdayWindows_start_mode\"; "); } catch (e) {}
    try { await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_TeeSheetSeasonWeekdayWindows_end_mode\"; "); } catch (e) {}
    try { await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_TeeSheetOverrides_status\"; "); } catch (e) {}
    try { await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_TeeSheetOverrideWindows_start_mode\"; "); } catch (e) {}
    try { await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_TeeSheetOverrideWindows_end_mode\"; "); } catch (e) {}
  },
};
