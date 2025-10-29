'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Replace trigger function: allow multiple assignments for the same leg, but prevent a different leg of the
    // same booking from assigning into the same tee time.
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION prevent_duplicate_legs_same_slot() RETURNS trigger AS $$
      DECLARE
        v_booking_id uuid;
        v_leg_index integer;
        v_conflict integer;
      BEGIN
        SELECT booking_id, leg_index INTO v_booking_id, v_leg_index FROM "BookingRoundLegs" WHERE id = NEW.booking_round_leg_id;
        IF v_booking_id IS NULL THEN
          RETURN NEW;
        END IF;
        -- Conflict if any existing assignment for same booking and tee time belongs to a different leg_index
        SELECT COUNT(*) INTO v_conflict
        FROM "TeeTimeAssignments" a
        JOIN "BookingRoundLegs" l ON l.id = a.booking_round_leg_id
        WHERE l.booking_id = v_booking_id AND a.tee_time_id = NEW.tee_time_id AND l.leg_index <> v_leg_index;
        IF v_conflict > 0 THEN
          RAISE EXCEPTION 'second leg cannot assign to same tee time (booking %, tee time %)', v_booking_id, NEW.tee_time_id USING ERRCODE = 'unique_violation';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
  },

  async down(queryInterface, Sequelize) {
    // No-op: keep safer function; alternatively could restore previous version
  }
};


