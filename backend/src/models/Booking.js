'use strict';

module.exports = (sequelize, DataTypes) => {
  const Booking = sequelize.define(
    'Booking',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      tee_sheet_id: { type: DataTypes.UUID, allowNull: false },
      owner_customer_id: { type: DataTypes.UUID, allowNull: true },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Active' },
      total_price_cents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      notes: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    },
    {
      tableName: 'Bookings',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  Booking.associate = models => {
    Booking.belongsTo(models.TeeSheet, { foreignKey: 'tee_sheet_id', as: 'tee_sheet' });
    Booking.belongsTo(models.Customer, { foreignKey: 'owner_customer_id', as: 'owner' });
    Booking.hasMany(models.BookingRoundLeg, { foreignKey: 'booking_id', as: 'legs' });
  };

  return Booking;
};


