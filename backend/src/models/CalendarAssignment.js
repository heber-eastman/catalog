'use strict';

module.exports = (sequelize, DataTypes) => {
  const CalendarAssignment = sequelize.define(
    'CalendarAssignment',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      tee_sheet_id: { type: DataTypes.UUID, allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      day_template_id: { type: DataTypes.UUID, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    },
    {
      tableName: 'CalendarAssignments',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { unique: true, fields: ['tee_sheet_id', 'date'] },
      ],
    }
  );

  CalendarAssignment.associate = models => {
    CalendarAssignment.belongsTo(models.TeeSheet, { foreignKey: 'tee_sheet_id', as: 'tee_sheet' });
    CalendarAssignment.belongsTo(models.DayTemplate, { foreignKey: 'day_template_id', as: 'day_template' });
  };

  return CalendarAssignment;
};


