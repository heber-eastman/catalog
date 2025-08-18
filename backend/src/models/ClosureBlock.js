'use strict';

module.exports = (sequelize, DataTypes) => {
  const ClosureBlock = sequelize.define(
    'ClosureBlock',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      tee_sheet_id: { type: DataTypes.UUID, allowNull: false },
      side_id: { type: DataTypes.UUID, allowNull: true },
      starts_at: { type: DataTypes.DATE, allowNull: false },
      ends_at: { type: DataTypes.DATE, allowNull: false },
      reason: { type: DataTypes.STRING, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    },
    {
      tableName: 'ClosureBlocks',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  ClosureBlock.associate = models => {
    ClosureBlock.belongsTo(models.TeeSheet, { foreignKey: 'tee_sheet_id', as: 'tee_sheet' });
    ClosureBlock.belongsTo(models.TeeSheetSide, { foreignKey: 'side_id', as: 'side' });
  };

  return ClosureBlock;
};


