'use strict';

(async () => {
  // Best-effort local schema hardening for V2 tables/columns
  // Safe to run repeatedly; does nothing if already applied
  const { Sequelize } = require('sequelize');
  const cfg = require('../config/database');
  const url = (cfg.development && cfg.development.url) || process.env.DATABASE_URL;
  if (!url) {
    // eslint-disable-next-line no-console
    console.warn('[ensure_v2_schema] DATABASE_URL not found; skipping');
    return;
  }
  const sequelize = new Sequelize(url, { logging: false });
  try {
    await sequelize.authenticate();

    // Enable pgcrypto for gen_random_uuid()
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    // Ensure enum for templates.interval_type
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_TeeSheetTemplates_interval_type') THEN
          CREATE TYPE "enum_TeeSheetTemplates_interval_type" AS ENUM ('standard');
        END IF;
      END $$;
    `);

    // TeeSheetTemplates required columns/defaults
    await sequelize.query(`
      ALTER TABLE "TeeSheetTemplates" ALTER COLUMN id SET DEFAULT gen_random_uuid();
      ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS name VARCHAR(120) NOT NULL DEFAULT 'Untitled Template';
      ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS interval_type "enum_TeeSheetTemplates_interval_type" NOT NULL DEFAULT 'standard';
      ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS max_players_staff INTEGER NOT NULL DEFAULT 4;
      ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS max_players_online INTEGER NOT NULL DEFAULT 4;
      ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
    `);

    // TeeSheetTemplateSides required columns
    await sequelize.query(`
      ALTER TABLE "TeeSheetTemplateSides" ADD COLUMN IF NOT EXISTS allowed_hole_totals JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);

    // TeeSheetSeasons required columns
    await sequelize.query(`
      ALTER TABLE "TeeSheetSeasons" ADD COLUMN IF NOT EXISTS name VARCHAR(120) NOT NULL DEFAULT 'Untitled Season';
    `);

    // TeeTimeAssignments: ensure customer_id exists (nullable)
    await sequelize.query(`
      ALTER TABLE "TeeTimeAssignments" ADD COLUMN IF NOT EXISTS customer_id UUID NULL;
    `);

    // eslint-disable-next-line no-console
    console.log('[ensure_v2_schema] Completed');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[ensure_v2_schema] Failed', e && (e.parent?.message || e.message));
  } finally {
    await sequelize.close().catch(() => {});
  }
})();


