'use strict';

module.exports = (sequelize, DataTypes) => {
  const TeeTimeAssignment = sequelize.define(
    'TeeTimeAssignment',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      booking_round_leg_id: { type: DataTypes.UUID, allowNull: false },
      tee_time_id: { type: DataTypes.UUID, allowNull: false },
      customer_id: { type: DataTypes.UUID, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    },
    {
      tableName: 'TeeTimeAssignments',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TeeTimeAssignment.associate = models => {
    TeeTimeAssignment.belongsTo(models.BookingRoundLeg, { foreignKey: 'booking_round_leg_id', as: 'round_leg' });
    TeeTimeAssignment.belongsTo(models.TeeTime, { foreignKey: 'tee_time_id', as: 'tee_time' });
    TeeTimeAssignment.belongsTo(models.Customer, { foreignKey: 'customer_id', as: 'customer' });
  };

  return TeeTimeAssignment;
};


