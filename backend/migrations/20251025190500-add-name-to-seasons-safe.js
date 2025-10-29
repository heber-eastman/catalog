'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add missing columns for local DBs that don't have season name yet
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        BEGIN
          ALTER TABLE "TeeSheetSeasons" ADD COLUMN IF NOT EXISTS "name" VARCHAR(120) NOT NULL DEFAULT 'Untitled Season';
        EXCEPTION WHEN duplicate_column THEN NULL; END;
      END $$;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Non-destructive: keep the column
  },
};
