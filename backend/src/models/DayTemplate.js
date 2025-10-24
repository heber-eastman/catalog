'use strict';

module.exports = (sequelize, DataTypes) => {
  const DayTemplate = sequelize.define(
    'DayTemplate',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      tee_sheet_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
    },
    {
      tableName: 'DayTemplates',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [{ fields: ['tee_sheet_id'] }],
    }
  );

  DayTemplate.associate = models => {
    DayTemplate.belongsTo(models.TeeSheet, {
      foreignKey: 'tee_sheet_id',
      as: 'tee_sheet',
    });
    DayTemplate.hasMany(models.Timeframe, {
      foreignKey: 'day_template_id',
      as: 'timeframes',
    });
    DayTemplate.hasMany(models.CalendarAssignment, {
      foreignKey: 'day_template_id',
      as: 'calendar_assignments',
    });
  };

  return DayTemplate;
};


