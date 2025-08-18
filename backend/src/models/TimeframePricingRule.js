'use strict';

module.exports = (sequelize, DataTypes) => {
  const TimeframePricingRule = sequelize.define(
    'TimeframePricingRule',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      timeframe_id: { type: DataTypes.UUID, allowNull: false },
      booking_class_id: { type: DataTypes.STRING, allowNull: false },
      walk_fee_cents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ride_fee_cents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      combine_fees: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    },
    {
      tableName: 'TimeframePricingRules',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TimeframePricingRule.associate = models => {
    TimeframePricingRule.belongsTo(models.Timeframe, { foreignKey: 'timeframe_id', as: 'timeframe' });
  };

  return TimeframePricingRule;
};


