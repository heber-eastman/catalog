'use strict';

module.exports = (sequelize, DataTypes) => {
  const BookingRoundLeg = sequelize.define(
    'BookingRoundLeg',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      booking_id: { type: DataTypes.UUID, allowNull: false },
      round_option_id: { type: DataTypes.UUID, allowNull: true },
      leg_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      walk_ride: { type: DataTypes.STRING, allowNull: true },
      price_cents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    },
    {
      tableName: 'BookingRoundLegs',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  BookingRoundLeg.associate = models => {
    BookingRoundLeg.belongsTo(models.Booking, { foreignKey: 'booking_id', as: 'booking' });
    BookingRoundLeg.belongsTo(models.TimeframeRoundOption, { foreignKey: 'round_option_id', as: 'round_option' });
    BookingRoundLeg.hasMany(models.TeeTimeAssignment, { foreignKey: 'booking_round_leg_id', as: 'assignments' });
  };

  return BookingRoundLeg;
};


