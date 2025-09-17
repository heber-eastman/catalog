'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { STRING } = Sequelize;
    await queryInterface.addColumn('TeeSheetTemplates', 'name', {
      type: STRING(120),
      allowNull: false,
      defaultValue: 'Untitled Template',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('TeeSheetTemplates', 'name');
  },
};



