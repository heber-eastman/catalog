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

    // Hardening: ensure required columns/types exist for TeeSheetTemplates in test DB
    try {
      await verifyClient.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_teesheettemplates_interval_type') THEN
            CREATE TYPE enum_teesheettemplates_interval_type AS ENUM ('standard');
          END IF;
        END $$;`);
      await verifyClient.query(`ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "name" VARCHAR(120) NOT NULL DEFAULT 'Untitled Template';`);
      await verifyClient.query(`ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "interval_type" enum_teesheettemplates_interval_type NOT NULL DEFAULT 'standard';`);
      await verifyClient.query(`ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "max_players_staff" INTEGER NOT NULL DEFAULT 4;`);
      await verifyClient.query(`ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "max_players_online" INTEGER NOT NULL DEFAULT 4;`);
    } catch (e) {
      console.warn('Template column/type hardening skipped:', e.message);
    }
    await verifyClient.end();
  } catch (e) {
    console.error('Failed to run test DB migrations:', e.message);
    throw e;
  }
};


