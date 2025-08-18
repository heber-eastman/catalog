'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('GolfCourseInstances', 'timezone', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('GolfCourseInstances', 'latitude', {
      type: Sequelize.DECIMAL(9,6),
      allowNull: true,
    });
    await queryInterface.addColumn('GolfCourseInstances', 'longitude', {
      type: Sequelize.DECIMAL(9,6),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    try { await queryInterface.removeColumn('GolfCourseInstances', 'timezone'); } catch (e) {}
    try { await queryInterface.removeColumn('GolfCourseInstances', 'latitude'); } catch (e) {}
    try { await queryInterface.removeColumn('GolfCourseInstances', 'longitude'); } catch (e) {}
  },
};


