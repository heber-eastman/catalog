'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Ensure required columns and enum types exist with correct defaults/constraints
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        -- Ensure table exists (CI fresh env). If not, create minimal table first.
        IF to_regclass('"TeeSheetTemplates"') IS NULL THEN
          CREATE TABLE "TeeSheetTemplates" (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tee_sheet_id UUID NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            published_version_id UUID NULL,
            interval_mins INTEGER NOT NULL DEFAULT 10,
            archived BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
        END IF;

        -- name column
        BEGIN
          ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "name" VARCHAR(120);
        EXCEPTION WHEN duplicate_column THEN NULL; END;
        UPDATE "TeeSheetTemplates" SET "name"='Untitled Template' WHERE "name" IS NULL;
        ALTER TABLE "TeeSheetTemplates" ALTER COLUMN "name" SET DEFAULT 'Untitled Template';
        ALTER TABLE "TeeSheetTemplates" ALTER COLUMN "name" SET NOT NULL;

        -- interval_type enum type and column (use canonical name with exact casing)
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_TeeSheetTemplates_interval_type') THEN
          CREATE TYPE "enum_TeeSheetTemplates_interval_type" AS ENUM ('standard');
        END IF;
        BEGIN
          ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "interval_type" "enum_TeeSheetTemplates_interval_type";
        EXCEPTION WHEN duplicate_column THEN NULL; END;
        UPDATE "TeeSheetTemplates" SET "interval_type"='standard' WHERE "interval_type" IS NULL;
        ALTER TABLE "TeeSheetTemplates" ALTER COLUMN "interval_type" SET DEFAULT 'standard';
        ALTER TABLE "TeeSheetTemplates" ALTER COLUMN "interval_type" SET NOT NULL;

        -- max players columns
        BEGIN
          ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "max_players_staff" INTEGER;
        EXCEPTION WHEN duplicate_column THEN NULL; END;
        UPDATE "TeeSheetTemplates" SET "max_players_staff"=4 WHERE "max_players_staff" IS NULL;
        ALTER TABLE "TeeSheetTemplates" ALTER COLUMN "max_players_staff" SET DEFAULT 4;
        ALTER TABLE "TeeSheetTemplates" ALTER COLUMN "max_players_staff" SET NOT NULL;

        BEGIN
          ALTER TABLE "TeeSheetTemplates" ADD COLUMN IF NOT EXISTS "max_players_online" INTEGER;
        EXCEPTION WHEN duplicate_column THEN NULL; END;
        UPDATE "TeeSheetTemplates" SET "max_players_online"=4 WHERE "max_players_online" IS NULL;
        ALTER TABLE "TeeSheetTemplates" ALTER COLUMN "max_players_online" SET DEFAULT 4;
        ALTER TABLE "TeeSheetTemplates" ALTER COLUMN "max_players_online" SET NOT NULL;
      END $$;`);
  },

  async down(queryInterface, Sequelize) {
    // No-op hardening rollback to avoid dropping production data/types.
  },
};




