'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop side_id from TeeSheetOverrideWindows to make windows side-agnostic
    try {
      await queryInterface.removeColumn('TeeSheetOverrideWindows', 'side_id');
    } catch (e) {
      // noop if already removed
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Restore side_id with reference back to TeeSheetSides
    try {
      await queryInterface.addColumn('TeeSheetOverrideWindows', 'side_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'TeeSheetSides', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    } catch (e) {
      // noop
    }
  },
};


