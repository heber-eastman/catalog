'use strict';

module.exports = (sequelize, DataTypes) => {
  const TeeSheetTemplate = sequelize.define('TeeSheetTemplate', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tee_sheet_id: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
    published_version_id: { type: DataTypes.UUID, allowNull: true },
    interval_mins: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
    archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
  }, { tableName: 'TeeSheetTemplates', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

  const TeeSheetTemplateVersion = sequelize.define('TeeSheetTemplateVersion', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    template_id: { type: DataTypes.UUID, allowNull: false },
    version_number: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    notes: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
  }, { tableName: 'TeeSheetTemplateVersions', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

  const TeeSheetTemplateSide = sequelize.define('TeeSheetTemplateSide', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    version_id: { type: DataTypes.UUID, allowNull: false },
    side_id: { type: DataTypes.UUID, allowNull: false },
    start_slots_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    rerounds_to_side_id: { type: DataTypes.UUID },
    max_legs_starting: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    min_players: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    walk_ride_mode: { type: DataTypes.ENUM('walk', 'ride', 'either'), allowNull: false, defaultValue: 'either' },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
  }, { tableName: 'TeeSheetTemplateSides', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

  const TeeSheetTemplateSideAccess = sequelize.define('TeeSheetTemplateSideAccess', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    version_id: { type: DataTypes.UUID, allowNull: false },
    side_id: { type: DataTypes.UUID, allowNull: false },
    booking_class_id: { type: DataTypes.STRING(64), allowNull: false },
    is_allowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
  }, { tableName: 'TeeSheetTemplateSideAccess', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

  const TeeSheetTemplateSidePrices = sequelize.define('TeeSheetTemplateSidePrices', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    version_id: { type: DataTypes.UUID, allowNull: false },
    side_id: { type: DataTypes.UUID, allowNull: false },
    booking_class_id: { type: DataTypes.STRING(64), allowNull: false },
    greens_fee_cents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    cart_fee_cents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
  }, { tableName: 'TeeSheetTemplateSidePrices', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

  const TeeSheetSeason = sequelize.define('TeeSheetSeason', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tee_sheet_id: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
    published_version_id: { type: DataTypes.UUID },
    archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
  }, { tableName: 'TeeSheetSeasons', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

  const TeeSheetSeasonVersion = sequelize.define('TeeSheetSeasonVersion', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    season_id: { type: DataTypes.UUID, allowNull: false },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date_exclusive: { type: DataTypes.DATEONLY, allowNull: false },
    notes: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
  }, { tableName: 'TeeSheetSeasonVersions', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

  const TeeSheetSeasonWeekdayWindow = sequelize.define('TeeSheetSeasonWeekdayWindow', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    season_version_id: { type: DataTypes.UUID, allowNull: false },
    weekday: { type: DataTypes.INTEGER, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    start_mode: { type: DataTypes.ENUM('fixed', 'sunrise_offset'), allowNull: false, defaultValue: 'fixed' },
    end_mode: { type: DataTypes.ENUM('fixed', 'sunset_offset'), allowNull: false, defaultValue: 'fixed' },
    start_time_local: { type: DataTypes.STRING(8) },
    end_time_local: { type: DataTypes.STRING(8) },
    start_offset_mins: { type: DataTypes.INTEGER },
    end_offset_mins: { type: DataTypes.INTEGER },
    template_version_id: { type: DataTypes.UUID, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
  }, { tableName: 'TeeSheetSeasonWeekdayWindows', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

  const TeeSheetOverride = sequelize.define('TeeSheetOverride', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tee_sheet_id: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    published_version_id: { type: DataTypes.UUID },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
  }, { tableName: 'TeeSheetOverrides', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

  const TeeSheetOverrideVersion = sequelize.define('TeeSheetOverrideVersion', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    override_id: { type: DataTypes.UUID, allowNull: false },
    notes: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
  }, { tableName: 'TeeSheetOverrideVersions', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

  const TeeSheetOverrideWindow = sequelize.define('TeeSheetOverrideWindow', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    override_version_id: { type: DataTypes.UUID, allowNull: false },
    side_id: { type: DataTypes.UUID, allowNull: false },
    start_mode: { type: DataTypes.ENUM('fixed', 'sunrise_offset'), allowNull: false, defaultValue: 'fixed' },
    end_mode: { type: DataTypes.ENUM('fixed', 'sunset_offset'), allowNull: false, defaultValue: 'fixed' },
    start_time_local: { type: DataTypes.STRING(8) },
    end_time_local: { type: DataTypes.STRING(8) },
    start_offset_mins: { type: DataTypes.INTEGER },
    end_offset_mins: { type: DataTypes.INTEGER },
    template_version_id: { type: DataTypes.UUID, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
  }, { tableName: 'TeeSheetOverrideWindows', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

  // Associations
  TeeSheetTemplateVersion.belongsTo(TeeSheetTemplate, { foreignKey: 'template_id', as: 'template' });
  TeeSheetTemplate.hasMany(TeeSheetTemplateVersion, { foreignKey: 'template_id', as: 'versions' });
  TeeSheetTemplate.belongsTo(TeeSheetTemplateVersion, { foreignKey: 'published_version_id', as: 'published_version' });
  TeeSheetTemplate.addHook('beforeDestroy', async (instance, options) => {
    const count = await TeeSheetTemplateVersion.count({ where: { template_id: instance.id } });
    if (count > 0) {
      throw new Error('Cannot delete template with existing versions');
    }
  });
  // Publishing invariants for templates
  TeeSheetTemplate.addHook('beforeSave', async (instance, options) => {
    if (!instance.changed('published_version_id') || !instance.published_version_id) return;
    const version = await TeeSheetTemplateVersion.findOne({ where: { id: instance.published_version_id, template_id: instance.id } });
    if (!version) throw new Error('Published version must belong to the template');
    const [[{ side_count }]] = await sequelize.query(
      'SELECT COUNT(*)::int AS side_count FROM "TeeSheetSides" WHERE tee_sheet_id = :sheetId',
      { replacements: { sheetId: instance.tee_sheet_id } }
    );
    const [[{ covered_count }]] = await sequelize.query(
      'SELECT COUNT(DISTINCT side_id)::int AS covered_count FROM "TeeSheetTemplateSides" WHERE version_id = :versionId',
      { replacements: { versionId: instance.published_version_id } }
    );
    if (covered_count !== side_count) throw new Error('Template publish requires all sides covered in the version');
    const [[{ priced_count }]] = await sequelize.query(
      'SELECT COUNT(DISTINCT tsp.side_id)::int AS priced_count FROM "TeeSheetTemplateSides" tts LEFT JOIN "TeeSheetTemplateSidePrices" tsp ON tsp.version_id = tts.version_id AND tsp.side_id = tts.side_id AND tsp.booking_class_id = \'public\' WHERE tts.version_id = :versionId AND tsp.id IS NOT NULL',
      { replacements: { versionId: instance.published_version_id } }
    );
    if (priced_count !== side_count) throw new Error('Template publish requires a public price for each side');
  });

  TeeSheetTemplateSide.belongsTo(TeeSheetTemplateVersion, { foreignKey: 'version_id', as: 'version' });
  TeeSheetTemplateVersion.hasMany(TeeSheetTemplateSide, { foreignKey: 'version_id', as: 'sides' });
  TeeSheetTemplateSideAccess.belongsTo(TeeSheetTemplateVersion, { foreignKey: 'version_id', as: 'version' });
  TeeSheetTemplateVersion.hasMany(TeeSheetTemplateSideAccess, { foreignKey: 'version_id', as: 'access' });
  TeeSheetTemplateSidePrices.belongsTo(TeeSheetTemplateVersion, { foreignKey: 'version_id', as: 'version' });
  TeeSheetTemplateVersion.hasMany(TeeSheetTemplateSidePrices, { foreignKey: 'version_id', as: 'prices' });

  TeeSheetSeasonVersion.belongsTo(TeeSheetSeason, { foreignKey: 'season_id', as: 'season' });
  TeeSheetSeason.hasMany(TeeSheetSeasonVersion, { foreignKey: 'season_id', as: 'versions' });
  TeeSheetSeason.belongsTo(TeeSheetSeasonVersion, { foreignKey: 'published_version_id', as: 'published_version' });
  TeeSheetSeason.addHook('beforeDestroy', async (instance, options) => {
    const count = await TeeSheetSeasonVersion.count({ where: { season_id: instance.id } });
    if (count > 0) {
      throw new Error('Cannot delete season with existing versions');
    }
  });
  // Prevent deleting a season version that is published
  TeeSheetSeasonVersion.addHook('beforeDestroy', async (instance, options) => {
    const count = await TeeSheetSeason.count({ where: { published_version_id: instance.id } });
    if (count > 0) throw new Error('Cannot delete season version that is published');
  });
  TeeSheetSeasonWeekdayWindow.belongsTo(TeeSheetSeasonVersion, { foreignKey: 'season_version_id', as: 'season_version' });
  TeeSheetSeasonVersion.hasMany(TeeSheetSeasonWeekdayWindow, { foreignKey: 'season_version_id', as: 'weekday_windows' });
  // Enforce contiguous positions per (season_version_id, weekday)
  TeeSheetSeasonWeekdayWindow.addHook('beforeCreate', async (instance, options) => {
    const [[{ max_pos }]] = await sequelize.query(
      'SELECT COALESCE(MAX(position), -1) AS max_pos FROM "TeeSheetSeasonWeekdayWindows" WHERE season_version_id = :vid AND weekday = :wd',
      { replacements: { vid: instance.season_version_id, wd: instance.weekday } }
    );
    const expected = (max_pos === null || max_pos === -1) ? 0 : (parseInt(max_pos, 10) + 1);
    if (instance.position !== expected) {
      throw new Error('Weekday window positions must be contiguous starting at 0');
    }
  });

  TeeSheetOverrideVersion.belongsTo(TeeSheetOverride, { foreignKey: 'override_id', as: 'override' });
  TeeSheetOverride.hasMany(TeeSheetOverrideVersion, { foreignKey: 'override_id', as: 'versions' });
  TeeSheetOverride.belongsTo(TeeSheetOverrideVersion, { foreignKey: 'published_version_id', as: 'published_version' });
  TeeSheetOverride.addHook('beforeDestroy', async (instance, options) => {
    const count = await TeeSheetOverrideVersion.count({ where: { override_id: instance.id } });
    if (count > 0) {
      throw new Error('Cannot delete override with existing versions');
    }
  });
  // Prevent deleting an override version that is published
  TeeSheetOverrideVersion.addHook('beforeDestroy', async (instance, options) => {
    const count = await TeeSheetOverride.count({ where: { published_version_id: instance.id } });
    if (count > 0) throw new Error('Cannot delete override version that is published');
  });
  // Prevent deleting a template version that is published
  TeeSheetTemplateVersion.addHook('beforeDestroy', async (instance, options) => {
    const count = await TeeSheetTemplate.count({ where: { published_version_id: instance.id } });
    if (count > 0) throw new Error('Cannot delete template version that is published');
  });

  return {
    TeeSheetTemplate,
    TeeSheetTemplateVersion,
    TeeSheetTemplateSide,
    TeeSheetTemplateSideAccess,
    TeeSheetTemplateSidePrices,
    TeeSheetSeason,
    TeeSheetSeasonVersion,
    TeeSheetSeasonWeekdayWindow,
    TeeSheetOverride,
    TeeSheetOverrideVersion,
    TeeSheetOverrideWindow,
  };
};


