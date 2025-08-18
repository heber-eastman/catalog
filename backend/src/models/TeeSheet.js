'use strict';

module.exports = (sequelize, DataTypes) => {
  const TeeSheet = sequelize.define(
    'TeeSheet',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      course_id: {
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
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
      tableName: 'TeeSheets',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['course_id'] },
        { fields: ['is_active'] },
      ],
    }
  );

  TeeSheet.associate = models => {
    TeeSheet.belongsTo(models.GolfCourseInstance, {
      foreignKey: 'course_id',
      as: 'course',
    });

    TeeSheet.hasMany(models.TeeSheetSide, {
      foreignKey: 'tee_sheet_id',
      as: 'sides',
    });

    TeeSheet.hasMany(models.DayTemplate, {
      foreignKey: 'tee_sheet_id',
      as: 'day_templates',
    });

    TeeSheet.hasMany(models.CalendarAssignment, {
      foreignKey: 'tee_sheet_id',
      as: 'calendar_assignments',
    });

    TeeSheet.hasMany(models.ClosureBlock, {
      foreignKey: 'tee_sheet_id',
      as: 'closures',
    });

    TeeSheet.hasMany(models.TeeTime, {
      foreignKey: 'tee_sheet_id',
      as: 'tee_times',
    });

    TeeSheet.hasMany(models.Booking, {
      foreignKey: 'tee_sheet_id',
      as: 'bookings',
    });
  };

  return TeeSheet;
};


