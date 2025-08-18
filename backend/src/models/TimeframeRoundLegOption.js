'use strict';

module.exports = (sequelize, DataTypes) => {
  const TimeframeRoundLegOption = sequelize.define(
    'TimeframeRoundLegOption',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      round_option_id: { type: DataTypes.UUID, allowNull: false },
      leg_index: { type: DataTypes.INTEGER, allowNull: false },
      hole_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 9 },
      side_id: { type: DataTypes.UUID, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    },
    {
      tableName: 'TimeframeRoundLegOptions',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TimeframeRoundLegOption.associate = models => {
    TimeframeRoundLegOption.belongsTo(models.TimeframeRoundOption, { foreignKey: 'round_option_id', as: 'round_option' });
    TimeframeRoundLegOption.belongsTo(models.TeeSheetSide, { foreignKey: 'side_id', as: 'side' });
  };

  return TimeframeRoundLegOption;
};


