'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('TeeTimeAssignments', 'customer_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('TeeTimeAssignments', 'customer_id');
  },
};




