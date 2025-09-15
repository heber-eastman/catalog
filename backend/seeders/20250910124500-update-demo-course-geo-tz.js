'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [course] = await queryInterface.sequelize.query(
      'SELECT id FROM "GolfCourseInstances" WHERE subdomain = :sub',
      { replacements: { sub: 'pinevalley' }, type: Sequelize.QueryTypes.SELECT }
    );
    if (!course) return;
    await queryInterface.sequelize.query(
      'UPDATE "GolfCourseInstances" SET timezone = :tz, latitude = :lat, longitude = :lon WHERE id = :id',
      { replacements: { tz: 'America/Los_Angeles', lat: 37.4419, lon: -122.1430, id: course.id } }
    );
    console.log('✅ Updated demo course timezone/lat/lon');
  },

  async down(queryInterface, Sequelize) {
    const [course] = await queryInterface.sequelize.query(
      'SELECT id FROM "GolfCourseInstances" WHERE subdomain = :sub',
      { replacements: { sub: 'pinevalley' }, type: Sequelize.QueryTypes.SELECT }
    );
    if (!course) return;
    await queryInterface.sequelize.query(
      'UPDATE "GolfCourseInstances" SET timezone = NULL, latitude = NULL, longitude = NULL WHERE id = :id',
      { replacements: { id: course.id } }
    );
  },
};


