'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Add 'Suspended' to enum if it exists; for fresh DBs this is a no-op
    try {
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_GolfCourseInstances_status" ADD VALUE IF NOT EXISTS \"Suspended\";'
      );
    } catch (_) {}
  },

  async down(queryInterface) {
    // Cannot easily remove enum value in Postgres; down is a no-op
    return;
  },
};


