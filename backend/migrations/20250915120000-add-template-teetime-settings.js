'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, UUIDV4, STRING, BOOLEAN, INTEGER, DATE, ENUM } = Sequelize;

    // Add template-level settings
    try { await queryInterface.addColumn('TeeSheetTemplates', 'interval_type', { type: ENUM('standard'), allowNull: false, defaultValue: 'standard' }); } catch (e) {}
    try { await queryInterface.addColumn('TeeSheetTemplates', 'max_players_staff', { type: INTEGER, allowNull: false, defaultValue: 4 }); } catch (e) {}
    try { await queryInterface.addColumn('TeeSheetTemplates', 'max_players_online', { type: INTEGER, allowNull: false, defaultValue: 4 }); } catch (e) {}

    // Per-template booking class online access
    try { await queryInterface.createTable('TeeSheetTemplateOnlineAccess', {
      id: { type: UUID, primaryKey: true, defaultValue: UUIDV4 },
      template_id: { type: UUID, allowNull: false },
      booking_class_id: { type: STRING(64), allowNull: false },
      is_online_allowed: { type: BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }); } catch (e) {}
    try { await queryInterface.addConstraint('TeeSheetTemplateOnlineAccess', {
      fields: ['template_id', 'booking_class_id'],
      type: 'unique',
      name: 'uniq_template_online_access_class',
    }); } catch (e) {}
    try { await queryInterface.addConstraint('TeeSheetTemplateOnlineAccess', {
      fields: ['template_id'],
      type: 'foreign key',
      references: { table: 'TeeSheetTemplates', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      name: 'fk_template_online_access_template',
    }); } catch (e) {}
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('TeeSheetTemplateOnlineAccess');
    await queryInterface.removeColumn('TeeSheetTemplates', 'interval_type');
    await queryInterface.removeColumn('TeeSheetTemplates', 'max_players_staff');
    await queryInterface.removeColumn('TeeSheetTemplates', 'max_players_online');
  },
};






