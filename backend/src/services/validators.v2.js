'use strict';

const { Op } = require('sequelize');
const { TeeSheetSide, TeeSheetTemplateVersion, TeeSheetTemplateSide } = require('../models');

async function detectReroundCycles(templateVersionId) {
  // DFS across rerounds_to_side_id edges in the snapshot
  const sides = await TeeSheetTemplateSide.findAll({ where: { version_id: templateVersionId } });
  const sideById = new Map(sides.map(s => [String(s.side_id), s]));
  const visiting = new Set();
  const visited = new Set();

  function dfs(sideId) {
    const key = String(sideId);
    if (visiting.has(key)) throw new Error('Reround cycle detected');
    if (visited.has(key)) return;
    visiting.add(key);
    const node = sideById.get(key);
    if (node?.rerounds_to_side_id) dfs(node.rerounds_to_side_id);
    visiting.delete(key);
    visited.add(key);
  }

  for (const s of sides) dfs(s.side_id);
}

async function templateCoversSideSet(templateVersionId, effectiveSideIds) {
  const sides = await TeeSheetTemplateSide.findAll({ where: { version_id: templateVersionId } });
  const covered = new Set(sides.map(s => String(s.side_id)));
  for (const id of effectiveSideIds) {
    if (!covered.has(String(id))) return false;
  }
  return true;
}

module.exports = {
  detectReroundCycles,
  templateCoversSideSet,
};


