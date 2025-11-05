/* eslint-env jest */
// Simple test setup without database synchronization
// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';
// Ensure smoke tests do not attempt to hit a local server in CI/unit runs
if (!process.env.SMOKE_TEST_URL) {
  process.env.SMOKE_TEST_URL = 'http://127.0.0.1:65535';
}

// Simple test that doesn't require database setup for most tests
console.log('Test environment variables set up successfully.');

// Ensure critical template schema exists even if globalSetup didn't run (CI safety net)
const { Client } = require('pg');
const SequelizeLib = require('sequelize');
const models = require('../src/models');

beforeAll(async () => {
  // Ensure core V2 templates/seasons/overrides schema exists (for tests that don't run migrations)
  try {
    const qi = models.sequelize.getQueryInterface();
    await require('../migrations/20250908090000-create-templates-seasons-overrides').up(qi, SequelizeLib);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Global V2 schema ensure skipped:', e.message);
  }
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.TEST_DB_NAME || 'catalog_test',
  });
  try {
    await client.connect();
    // uuid-ossp extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    // status enum + base table if missing
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_TeeSheetTemplates_status') THEN
          CREATE TYPE "enum_TeeSheetTemplates_status" AS ENUM ('draft','published');
        END IF;
        IF to_regclass('"TeeSheetTemplates"') IS NULL THEN
          CREATE TABLE "TeeSheetTemplates" (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tee_sheet_id UUID NOT NULL,
            status "enum_TeeSheetTemplates_status" NOT NULL DEFAULT 'draft',
            published_version_id UUID NULL,
            interval_mins INTEGER NOT NULL DEFAULT 10,
            archived BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
        END IF;
      END $$;`);
    // interval_type enum and required columns with defaults
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_TeeSheetTemplates_interval_type') THEN
          CREATE TYPE "enum_TeeSheetTemplates_interval_type" AS ENUM ('standard');
        END IF;
      END $$;`);
    await client.query(`ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "name" VARCHAR(120) NOT NULL DEFAULT 'Untitled Template';`);
    await client.query(`ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "interval_type" "enum_TeeSheetTemplates_interval_type" NOT NULL DEFAULT 'standard';`);
    await client.query(`ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "max_players_staff" INTEGER NOT NULL DEFAULT 4;`);
    await client.query(`ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "max_players_online" INTEGER NOT NULL DEFAULT 4;`);

    // Ensure TeeTimes denormalized columns exist for tests that don't run full migrations
    await client.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TABLE "TeeTimes" ADD COLUMN IF NOT EXISTS "can_start_18" BOOLEAN NOT NULL DEFAULT false;
        EXCEPTION WHEN undefined_table THEN NULL; END;
        BEGIN
          ALTER TABLE "TeeTimes" ADD COLUMN IF NOT EXISTS "rerounds_to_side_id" UUID REFERENCES "TeeSheetSides" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
        EXCEPTION WHEN undefined_table THEN NULL; END;
        BEGIN
          ALTER TABLE "TeeTimes" ADD COLUMN IF NOT EXISTS "reround_tee_time_id" UUID REFERENCES "TeeTimes" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
        EXCEPTION WHEN undefined_table THEN NULL; END;
        BEGIN
          ALTER TABLE "TeeTimes" ADD COLUMN IF NOT EXISTS "holes_label" VARCHAR(8) NOT NULL DEFAULT '9';
        EXCEPTION WHEN undefined_table THEN NULL; END;
      END $$;`);
    // Ensure helpful composite index exists (safe if already present)
    await client.query(`CREATE INDEX IF NOT EXISTS tee_times_tee_sheet_id_side_id_start_time ON "TeeTimes" (tee_sheet_id, side_id, start_time);`);

    // Ensure override uniqueness per (tee_sheet_id, date) for tests expecting it
    await client.query(`
      DO $$
      BEGIN
        IF to_regclass('"TeeSheetOverrides"') IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'tee_sheet_overrides_unique_sheet_date'
          ) THEN
            ALTER TABLE "TeeSheetOverrides" ADD CONSTRAINT tee_sheet_overrides_unique_sheet_date UNIQUE (tee_sheet_id, date);
          END IF;
        END IF;
      END $$;`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Per-file template schema ensure skipped:', e.message);
  } finally {
    try { await client.end(); } catch (_) {}
  }

  // As a final safety net, sync models to fill any missing tables/columns in isolated DBs
  try {
    await models.sequelize.sync();
  } catch (_) {}
});
