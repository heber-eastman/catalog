'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addColumn('TeeSheetSeasons', 'color', {
        type: Sequelize.STRING(16),
        allowNull: true,
      });
    } catch (e) {
      // ignore if column already exists locally
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeColumn('TeeSheetSeasons', 'color');
    } catch (e) {
      // ignore
    }
  }
};



