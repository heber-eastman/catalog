'use strict';

module.exports = (sequelize, DataTypes) => {
  const TimeframeRoundOption = sequelize.define(
    'TimeframeRoundOption',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      timeframe_id: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      leg_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    },
    {
      tableName: 'TimeframeRoundOptions',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TimeframeRoundOption.associate = models => {
    TimeframeRoundOption.belongsTo(models.Timeframe, { foreignKey: 'timeframe_id', as: 'timeframe' });
    TimeframeRoundOption.hasMany(models.TimeframeRoundLegOption, { foreignKey: 'round_option_id', as: 'leg_options' });
  };

  return TimeframeRoundOption;
};


