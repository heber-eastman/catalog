'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn('TeeSheetOverrides', 'color', {
        type: Sequelize.STRING(16),
        allowNull: true,
      });
    } catch (_) {}
  },

  down: async (queryInterface, Sequelize) => {
    try { await queryInterface.removeColumn('TeeSheetOverrides', 'color'); } catch (_) {}
  },
};


