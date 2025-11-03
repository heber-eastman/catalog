'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('TeeTimes', 'can_start_18', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('TeeTimes', 'rerounds_to_side_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'TeeSheetSides', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addColumn('TeeTimes', 'reround_tee_time_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'TeeTimes', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addColumn('TeeTimes', 'holes_label', {
      type: Sequelize.STRING(8),
      allowNull: false,
      defaultValue: '9',
    });
    await queryInterface.addIndex('TeeTimes', ['tee_sheet_id', 'side_id', 'start_time']);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('TeeTimes', 'holes_label');
    await queryInterface.removeColumn('TeeTimes', 'reround_tee_time_id');
    await queryInterface.removeColumn('TeeTimes', 'rerounds_to_side_id');
    await queryInterface.removeColumn('TeeTimes', 'can_start_18');
  },
};


