'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(
        'ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "color" VARCHAR(16) NULL;'
      );
    } catch (e) {
      // no-op if table missing; many tests create it later in their own setup
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(
        'ALTER TABLE "TeeSheetTemplates" DROP COLUMN IF EXISTS "color";'
      );
    } catch (e) {
      // ignore
    }
  },
};


