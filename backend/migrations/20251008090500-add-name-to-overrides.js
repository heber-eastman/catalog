'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add a name column for overrides to support UI-friendly labeling
    await queryInterface.addColumn('TeeSheetOverrides', 'name', {
      type: Sequelize.STRING(120),
      allowNull: false,
      defaultValue: 'Untitled Override',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('TeeSheetOverrides', 'name');
  },
};


