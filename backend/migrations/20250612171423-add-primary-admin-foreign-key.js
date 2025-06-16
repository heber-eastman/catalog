'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint('GolfCourseInstances', {
      fields: ['primary_admin_id'],
      type: 'foreign key',
      name: 'fk_golf_course_primary_admin',
      references: {
        table: 'StaffUsers',
        field: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(
      'GolfCourseInstances',
      'fk_golf_course_primary_admin'
    );
  },
};
