/* eslint-env jest */
// Simple test setup without database synchronization
// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';

// Simple test that doesn't require database setup for most tests
console.log('Test environment variables set up successfully.');

// Ensure critical template schema exists even if globalSetup didn't run (CI safety net)
const { Client } = require('pg');

beforeAll(async () => {
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
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Per-file template schema ensure skipped:', e.message);
  } finally {
    try { await client.end(); } catch (_) {}
  }
});
