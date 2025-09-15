'use strict';

module.exports = (sequelize, DataTypes) => {
  const TeeTimeWaitlist = sequelize.define(
    'TeeTimeWaitlist',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      tee_time_id: { type: DataTypes.UUID, allowNull: true },
      party_size: { type: DataTypes.INTEGER, allowNull: false },
      round_option_id: { type: DataTypes.UUID, allowNull: true },
      booking_class_id: { type: DataTypes.STRING, allowNull: true },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Waiting' },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    },
    {
      tableName: 'TeeTimeWaitlists',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TeeTimeWaitlist.associate = models => {
    TeeTimeWaitlist.belongsTo(models.TeeTime, { foreignKey: 'tee_time_id', as: 'tee_time' });
    TeeTimeWaitlist.belongsTo(models.TimeframeRoundOption, { foreignKey: 'round_option_id', as: 'round_option' });
  };

  return TeeTimeWaitlist;
};


