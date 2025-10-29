'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add a partial unique index via functional expression that enforces one assignment per booking per tee time
    // We infer booking_id via join is not possible in an index, so we enforce at trigger level
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION prevent_duplicate_legs_same_slot() RETURNS trigger AS $$
      DECLARE
        v_booking_id uuid;
        v_exists integer;
      BEGIN
        -- Resolve booking id for the leg being inserted
        SELECT booking_id INTO v_booking_id FROM "BookingRoundLegs" WHERE id = NEW.booking_round_leg_id;
        IF v_booking_id IS NULL THEN
          RETURN NEW;
        END IF;
        -- Count existing assignments for the same booking at this tee_time_id
        SELECT COUNT(*) INTO v_exists
        FROM "TeeTimeAssignments" a
        JOIN "BookingRoundLegs" l ON l.id = a.booking_round_leg_id
        WHERE l.booking_id = v_booking_id AND a.tee_time_id = NEW.tee_time_id;
        IF v_exists > 0 THEN
          RAISE EXCEPTION 'duplicate leg assignment for booking % on tee time %', v_booking_id, NEW.tee_time_id USING ERRCODE = 'unique_violation';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_prevent_duplicate_legs ON "TeeTimeAssignments";
      CREATE TRIGGER trg_prevent_duplicate_legs BEFORE INSERT ON "TeeTimeAssignments"
      FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_legs_same_slot();
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_prevent_duplicate_legs ON "TeeTimeAssignments";
      DROP FUNCTION IF EXISTS prevent_duplicate_legs_same_slot();
    `);
  }
};


