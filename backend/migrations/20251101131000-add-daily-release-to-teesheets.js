'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addColumn('TeeSheets', 'daily_release_local', {
        type: Sequelize.STRING(8),
        allowNull: true,
      });
    } catch (e) {
      // best-effort; ignore if exists
    }
  },
  async down(queryInterface) {
    try { await queryInterface.removeColumn('TeeSheets', 'daily_release_local'); } catch (_) {}
  },
};


