'use strict';

module.exports = (sequelize, DataTypes) => {
  const TeeSheetSide = sequelize.define(
    'TeeSheetSide',
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
      valid_from: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      valid_to: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      minutes_per_hole: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 12,
      },
      hole_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 9,
      },
      interval_mins: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 8,
      },
      start_slots_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sunrise_offset_mins: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      sunset_offset_mins: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
      tableName: 'TeeSheetSides',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [{ fields: ['tee_sheet_id'] }],
    }
  );

  TeeSheetSide.associate = models => {
    TeeSheetSide.belongsTo(models.TeeSheet, {
      foreignKey: 'tee_sheet_id',
      as: 'tee_sheet',
    });
    TeeSheetSide.hasMany(models.Timeframe, {
      foreignKey: 'side_id',
      as: 'timeframes',
    });
    TeeSheetSide.hasMany(models.ClosureBlock, {
      foreignKey: 'side_id',
      as: 'closures',
    });
    TeeSheetSide.hasMany(models.TeeTime, {
      foreignKey: 'side_id',
      as: 'tee_times',
    });
  };

  return TeeSheetSide;
};


