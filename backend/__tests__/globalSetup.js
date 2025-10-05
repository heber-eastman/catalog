'use strict';

module.exports = async () => {
  process.env.NODE_ENV = 'test';
  // Ensure jest uses catalog_test configuration by shadowing DATABASE_URL
  process.env.DATABASE_URL = '';
  const { execSync } = require('child_process');
  const { Client } = require('pg');
  try {
    // Ensure test DB exists
    const adminClient = new Client({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: 'postgres',
    });
    await adminClient.connect();
    const dbName = process.env.TEST_DB_NAME || 'catalog_test';
    const existsRes = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );
    if (existsRes.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE ${dbName}`);
    }
    await adminClient.end();

    // Ensure required extensions at DB level
    {
      const extClient = new Client({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.TEST_DB_NAME || 'catalog_test',
      });
      await extClient.connect();
      try {
        await extClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      } catch (e) {
        console.warn('uuid-ossp extension ensure skipped:', e.message);
      }
      await extClient.end();
    }

    // Reset schema in test DB
    const client = new Client({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.TEST_DB_NAME || 'catalog_test',
    });
    await client.connect();
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    await client.end();
    execSync('npx sequelize-cli db:migrate', { stdio: 'inherit', env: process.env });
    // Verify critical tables exist; if not, attempt targeted migrate
    const verifyClient = new (require('pg').Client)({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.TEST_DB_NAME || 'catalog_test',
    });
    await verifyClient.connect();
    const needTemplates = await verifyClient.query(`SELECT to_regclass('"TeeSheetTemplates"') IS NULL AS missing`);
    if (needTemplates.rows[0] && needTemplates.rows[0].missing) {
      execSync('npx sequelize-cli db:migrate --to 20250908090000-create-templates-seasons-overrides.js', { stdio: 'inherit', env: process.env });
    }

    // Hardening: ensure required table/columns/types exist for TeeSheetTemplates in test DB
    try {
      // Create status enum and base table if missing, then enforce required columns with defaults
      await verifyClient.query(`
        DO $$
        BEGIN
          -- status enum
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_TeeSheetTemplates_status') THEN
            CREATE TYPE "enum_TeeSheetTemplates_status" AS ENUM ('draft','published');
          END IF;
          -- create minimal table if missing
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

      await verifyClient.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_TeeSheetTemplates_interval_type') THEN
            CREATE TYPE "enum_TeeSheetTemplates_interval_type" AS ENUM ('standard');
          END IF;
        END $$;`);
      await verifyClient.query(`ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "name" VARCHAR(120) NOT NULL DEFAULT 'Untitled Template';`);
      await verifyClient.query(`ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "interval_type" "enum_TeeSheetTemplates_interval_type" NOT NULL DEFAULT 'standard';`);
      await verifyClient.query(`ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "max_players_staff" INTEGER NOT NULL DEFAULT 4;`);
      await verifyClient.query(`ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "max_players_online" INTEGER NOT NULL DEFAULT 4;`);
      // Coerce allowed_hole_totals to INTEGER[] with default if it exists with wrong type
      try {
        await verifyClient.query(`ALTER TABLE "TeeSheetTemplateSides"
          ALTER COLUMN allowed_hole_totals TYPE INTEGER[] USING (
            CASE
              WHEN allowed_hole_totals IS NULL THEN ARRAY[9,18]::int[]
              WHEN jsonb_typeof(allowed_hole_totals) = 'array' THEN (
                SELECT COALESCE(ARRAY_AGG((elem)::int), ARRAY[9,18]::int[])
                FROM jsonb_array_elements_text(allowed_hole_totals) AS t(elem)
              )
              ELSE ARRAY[9,18]::int[]
            END
          );`);
        await verifyClient.query(`ALTER TABLE "TeeSheetTemplateSides" ALTER COLUMN allowed_hole_totals SET DEFAULT '{9,18}'::int[];`);
      } catch (_) {}
      // Seasons: ensure name exists
      await verifyClient.query(`ALTER TABLE "TeeSheetSeasons" ADD COLUMN IF NOT EXISTS name VARCHAR(120) NOT NULL DEFAULT 'Untitled Season';`);
      // TemplateSides: ensure allowed_hole_totals exists
      await verifyClient.query(`ALTER TABLE "TeeSheetTemplateSides" ADD COLUMN IF NOT EXISTS allowed_hole_totals INTEGER[] NOT NULL DEFAULT '{9,18}';`);
      // TemplateSidePrices: ensure enum and price_type exists
      await verifyClient.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_TeeSheetTemplateSidePrices_price_type') THEN
          CREATE TYPE "enum_TeeSheetTemplateSidePrices_price_type" AS ENUM ('per_player', 'per_slot');
        END IF;
      END $$;`);
      await verifyClient.query(`ALTER TABLE "TeeSheetTemplateSidePrices" ADD COLUMN IF NOT EXISTS price_type "enum_TeeSheetTemplateSidePrices_price_type" NOT NULL DEFAULT 'per_player';`);
      // TemplateSideAccesses: ensure enum and access_type exists
      await verifyClient.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_TeeSheetTemplateSideAccesses_access_type') THEN
          CREATE TYPE "enum_TeeSheetTemplateSideAccesses_access_type" AS ENUM ('public', 'member_only', 'private');
        END IF;
      END $$;`);
      await verifyClient.query(`ALTER TABLE "TeeSheetTemplateSideAccesses" ADD COLUMN IF NOT EXISTS access_type "enum_TeeSheetTemplateSideAccesses_access_type" NOT NULL DEFAULT 'public';`);
      // TeeTimeAssignments: ensure customer_id exists (nullable)
      await verifyClient.query(`ALTER TABLE "TeeTimeAssignments" ADD COLUMN IF NOT EXISTS customer_id UUID NULL;`);
      // Events table for eventBus (use uuid_generate_v4())
      await verifyClient.query(`CREATE TABLE IF NOT EXISTS "Events" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "course_id" UUID,
        "entity_type" VARCHAR(255) NOT NULL,
        "entity_id" UUID,
        "action" VARCHAR(255) NOT NULL,
        "actor_type" VARCHAR(255),
        "actor_id" UUID,
        "metadata" JSONB,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    } catch (e) {
      console.warn('Template column/type hardening skipped:', e.message);
    }
    await verifyClient.end();
  } catch (e) {
    console.error('Failed to run test DB migrations:', e.message);
    throw e;
  }
};


