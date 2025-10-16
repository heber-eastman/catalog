'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add draft_version_id to TeeSheetOverrides if not exists
    try {
      await queryInterface.addColumn('TeeSheetOverrides', 'draft_version_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'TeeSheetOverrideVersions', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    } catch (_) {}
  },

  down: async (queryInterface, Sequelize) => {
    try { await queryInterface.removeColumn('TeeSheetOverrides', 'draft_version_id'); } catch (_) {}
  },
};


