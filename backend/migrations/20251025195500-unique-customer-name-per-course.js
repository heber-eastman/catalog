'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Pre-dedupe by name within course to avoid index creation failure
    await queryInterface.sequelize.query(`
      WITH dups AS (
        SELECT course_id, lower(first_name) AS fn, lower(last_name) AS ln,
               (ARRAY_AGG(id ORDER BY created_at ASC))[1] AS keep_id,
               ARRAY_AGG(id) AS all_ids
        FROM "Customers"
        GROUP BY course_id, lower(first_name), lower(last_name)
        HAVING COUNT(*) > 1
      ), to_fix AS (
        SELECT unnest(all_ids) AS id, keep_id FROM dups
      )
      UPDATE "Bookings" b SET owner_customer_id = t.keep_id
      FROM to_fix t
      WHERE b.owner_customer_id = t.id AND b.owner_customer_id <> t.keep_id;
    `);
    await queryInterface.sequelize.query(`
      WITH dups AS (
        SELECT course_id, lower(first_name) AS fn, lower(last_name) AS ln,
               (ARRAY_AGG(id ORDER BY created_at ASC))[1] AS keep_id,
               ARRAY_AGG(id) AS all_ids
        FROM "Customers"
        GROUP BY course_id, lower(first_name), lower(last_name)
        HAVING COUNT(*) > 1
      ), to_fix AS (
        SELECT unnest(all_ids) AS id, keep_id FROM dups
      )
      UPDATE "TeeTimeAssignments" a SET customer_id = t.keep_id
      FROM to_fix t
      WHERE a.customer_id = t.id AND a.customer_id <> t.keep_id;
    `);
    await queryInterface.sequelize.query(`
      WITH dups AS (
        SELECT course_id, lower(first_name) AS fn, lower(last_name) AS ln,
               (ARRAY_AGG(id ORDER BY created_at ASC))[1] AS keep_id,
               ARRAY_AGG(id) AS all_ids
        FROM "Customers"
        GROUP BY course_id, lower(first_name), lower(last_name)
        HAVING COUNT(*) > 1
      )
      DELETE FROM "Customers" c
      USING dups d
      WHERE c.course_id = d.course_id AND lower(c.first_name) = d.fn AND lower(c.last_name) = d.ln AND c.id <> d.keep_id;
    `);
    // Add a functional unique index to reduce accidental duplicates when only name is provided
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'customers_unique_name_per_course'
        ) THEN
          CREATE UNIQUE INDEX customers_unique_name_per_course
          ON "Customers" (course_id, lower(first_name), lower(last_name));
        END IF;
      END $$;
    `);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customers_unique_name_per_course;
    `);
  }
};


