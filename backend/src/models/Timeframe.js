'use strict';

module.exports = (sequelize, DataTypes) => {
  const Timeframe = sequelize.define(
    'Timeframe',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      tee_sheet_id: { type: DataTypes.UUID, allowNull: false },
      side_id: { type: DataTypes.UUID, allowNull: false },
      day_template_id: { type: DataTypes.UUID, allowNull: false },
      start_time_local: { type: DataTypes.TIME, allowNull: false },
      end_time_local: { type: DataTypes.TIME, allowNull: false },
      interval_mins: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 8 },
      start_slots_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    },
    {
      tableName: 'Timeframes',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  Timeframe.associate = models => {
    Timeframe.belongsTo(models.TeeSheet, { foreignKey: 'tee_sheet_id', as: 'tee_sheet' });
    Timeframe.belongsTo(models.TeeSheetSide, { foreignKey: 'side_id', as: 'side' });
    Timeframe.belongsTo(models.DayTemplate, { foreignKey: 'day_template_id', as: 'day_template' });

    Timeframe.hasMany(models.TimeframeAccessRule, { foreignKey: 'timeframe_id', as: 'access_rules' });
    Timeframe.hasMany(models.TimeframePricingRule, { foreignKey: 'timeframe_id', as: 'pricing_rules' });
    Timeframe.hasMany(models.TimeframeRoundOption, { foreignKey: 'timeframe_id', as: 'round_options' });
    Timeframe.hasOne(models.TimeframeMinPlayers, { foreignKey: 'timeframe_id', as: 'min_players' });
    Timeframe.hasOne(models.TimeframeMode, { foreignKey: 'timeframe_id', as: 'mode' });
  };

  return Timeframe;
};


