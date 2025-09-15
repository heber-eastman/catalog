'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Events', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      course_id: { type: Sequelize.UUID, allowNull: true },
      entity_type: { type: Sequelize.STRING, allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: true },
      action: { type: Sequelize.STRING, allowNull: false },
      actor_type: { type: Sequelize.STRING, allowNull: true },
      actor_id: { type: Sequelize.STRING, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('Events', ['course_id']);
    await queryInterface.addIndex('Events', ['entity_type', 'entity_id']);
    await queryInterface.addIndex('Events', ['action']);
    await queryInterface.addIndex('Events', ['created_at']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('Events');
  },
};


