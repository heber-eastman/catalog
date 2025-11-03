'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('TemplateVersionBookingWindows', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      template_version_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'TeeSheetTemplateVersions', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      booking_class_id: { type: Sequelize.STRING(64), allowNull: false },
      max_days_in_advance: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('TemplateVersionBookingWindows', ['template_version_id']);
  },
  async down(queryInterface) {
    try { await queryInterface.dropTable('TemplateVersionBookingWindows'); } catch (_) {}
  },
};


