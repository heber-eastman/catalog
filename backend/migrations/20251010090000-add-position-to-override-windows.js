'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add column if not exists
    try {
      await queryInterface.addColumn('TeeSheetOverrideWindows', 'position', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    } catch (e) {
      // noop if exists
    }

    // Backfill contiguous positions per override_version_id
    try {
      await queryInterface.sequelize.query(`
        WITH ranked AS (
          SELECT id,
                 override_version_id,
                 ROW_NUMBER() OVER (PARTITION BY override_version_id ORDER BY created_at ASC) - 1 AS rn
          FROM "TeeSheetOverrideWindows"
        )
        UPDATE "TeeSheetOverrideWindows" w
        SET position = r.rn
        FROM ranked r
        WHERE w.id = r.id;
      `);
    } catch (e) {
      // best-effort
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('TeeSheetOverrideWindows', 'position');
    } catch (e) {
      // noop
    }
  },
};


