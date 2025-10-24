'use strict';

module.exports = (sequelize, DataTypes) => {
  const TimeframeMode = sequelize.define(
    'TimeframeMode',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      timeframe_id: { type: DataTypes.UUID, allowNull: false },
      mode: { type: DataTypes.STRING, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    },
    {
      tableName: 'TimeframeModes',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TimeframeMode.associate = models => {
    TimeframeMode.belongsTo(models.Timeframe, { foreignKey: 'timeframe_id', as: 'timeframe' });
  };

  return TimeframeMode;
};


