'use strict';

module.exports = (sequelize, DataTypes) => {
  const TimeframeAccessRule = sequelize.define(
    'TimeframeAccessRule',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      timeframe_id: { type: DataTypes.UUID, allowNull: false },
      booking_class_id: { type: DataTypes.STRING, allowNull: false },
      is_allowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    },
    {
      tableName: 'TimeframeAccessRules',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TimeframeAccessRule.associate = models => {
    TimeframeAccessRule.belongsTo(models.Timeframe, { foreignKey: 'timeframe_id', as: 'timeframe' });
  };

  return TimeframeAccessRule;
};


