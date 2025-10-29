'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [course] = await queryInterface.sequelize.query(
      'SELECT id FROM "GolfCourseInstances" WHERE subdomain = :sub',
      { replacements: { sub: 'pinevalley' }, type: Sequelize.QueryTypes.SELECT }
    );
    if (!course) return;
    // Salt Lake City: America/Denver, 40.7608° N, -111.8910° W
    await queryInterface.sequelize.query(
      'UPDATE "GolfCourseInstances" SET timezone = :tz, latitude = :lat, longitude = :lon WHERE id = :id',
      { replacements: { tz: 'America/Denver', lat: 40.7608, lon: -111.8910, id: course.id } }
    );
    console.log('✅ Updated demo course to Salt Lake City tz/lat/lon');
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
