'use strict';

module.exports = (sequelize, DataTypes) => {
  const TimeframeMinPlayers = sequelize.define(
    'TimeframeMinPlayers',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      timeframe_id: { type: DataTypes.UUID, allowNull: false },
      min_players: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    },
    {
      tableName: 'TimeframeMinPlayers',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TimeframeMinPlayers.associate = models => {
    TimeframeMinPlayers.belongsTo(models.Timeframe, { foreignKey: 'timeframe_id', as: 'timeframe' });
  };

  return TimeframeMinPlayers;
};


