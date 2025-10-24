'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addColumn('TeeSheetTemplateSides', 'allowed_hole_totals', {
        type: Sequelize.ARRAY(Sequelize.INTEGER),
        allowNull: false,
        defaultValue: [9, 18],
      });
    } catch (_) {}
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeColumn('TeeSheetTemplateSides', 'allowed_hole_totals');
    } catch (_) {}
  },
};




