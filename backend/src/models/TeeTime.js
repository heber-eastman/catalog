'use strict';

module.exports = (sequelize, DataTypes) => {
  const TeeTime = sequelize.define(
    'TeeTime',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      tee_sheet_id: { type: DataTypes.UUID, allowNull: false },
      side_id: { type: DataTypes.UUID, allowNull: false },
      start_time: { type: DataTypes.DATE, allowNull: false },
      capacity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 4 },
      assigned_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_blocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      blocked_reason: { type: DataTypes.STRING, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    },
    {
      tableName: 'TeeTimes',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [{ unique: true, fields: ['tee_sheet_id', 'side_id', 'start_time'] }],
    }
  );

  TeeTime.associate = models => {
    TeeTime.belongsTo(models.TeeSheet, { foreignKey: 'tee_sheet_id', as: 'tee_sheet' });
    TeeTime.belongsTo(models.TeeSheetSide, { foreignKey: 'side_id', as: 'side' });
    TeeTime.hasMany(models.TeeTimeAssignment, { foreignKey: 'tee_time_id', as: 'assignments' });
    TeeTime.hasMany(models.TeeTimeWaitlist, { foreignKey: 'tee_time_id', as: 'waitlist' });
  };

  return TeeTime;
};


