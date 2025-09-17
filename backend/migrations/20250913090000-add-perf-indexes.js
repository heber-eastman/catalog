'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Availability hot paths
    try { await queryInterface.addIndex('TeeTimes', ['tee_sheet_id', 'start_time'], { name: 'idx_teetimes_sheet_start' }); } catch (_) {}
    try { await queryInterface.addIndex('TeeTimes', ['start_time'], { name: 'idx_teetimes_start' }); } catch (_) {}
    try { await queryInterface.addIndex('ClosureBlocks', ['tee_sheet_id', 'side_id', 'starts_at', 'ends_at'], { name: 'idx_closureblocks_sheet_side_window' }); } catch (_) {}
    // Template-side access/prices lookup by version
    try { await queryInterface.addIndex('TeeSheetTemplateSideAccess', ['version_id'], { name: 'idx_tmpl_access_version' }); } catch (_) {}
    try { await queryInterface.addIndex('TeeSheetTemplateSidePrices', ['version_id'], { name: 'idx_tmpl_price_version' }); } catch (_) {}
  },

  async down(queryInterface) {
    try { await queryInterface.removeIndex('TeeTimes', 'idx_teetimes_sheet_start'); } catch (_) {}
    try { await queryInterface.removeIndex('TeeTimes', 'idx_teetimes_start'); } catch (_) {}
    try { await queryInterface.removeIndex('ClosureBlocks', 'idx_closureblocks_sheet_side_window'); } catch (_) {}
    try { await queryInterface.removeIndex('TeeSheetTemplateSideAccess', 'idx_tmpl_access_version'); } catch (_) {}
    try { await queryInterface.removeIndex('TeeSheetTemplateSidePrices', 'idx_tmpl_price_version'); } catch (_) {}
  },
};




