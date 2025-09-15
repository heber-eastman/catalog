'use strict';

const { Op } = require('sequelize');
const { TeeTime, TeeTimeAssignment, BookingRoundLeg, Booking, TeeSheet, GolfCourseInstance } = require('../models');
const { sendEmail } = require('./emailService');

// Find bookings whose first leg is within windowHours from now
async function findUpcomingBookings(windowHours = 24) {
  const now = new Date();
  const upper = new Date(now.getTime() + windowHours * 60 * 60 * 1000);

  const legs = await BookingRoundLeg.findAll({
    include: [{ model: TeeTimeAssignment, as: 'assignments', include: [{ model: TeeTime, as: 'tee_time' }] }],
    order: [['created_at', 'ASC']],
  });

  const results = [];
  for (const leg of legs) {
    if (!leg.assignments || leg.assignments.length === 0) continue;
    const tt = leg.assignments[0].tee_time;
    if (!tt) continue;
    if (tt.start_time >= now && tt.start_time <= upper) {
      const booking = await Booking.findByPk(leg.booking_id);
      if (booking && booking.status === 'Active') {
        results.push({ booking, tt });
      }
    }
  }
  return results;
}

async function sendReminders(windowHours = Number(process.env.REMINDER_WINDOW_HOURS || 24)) {
  const upcoming = await findUpcomingBookings(windowHours);
  for (const item of upcoming) {
    try {
      // We do not have customer emails on booking; send to a placeholder or owner if present
      await sendEmail({
        to: 'noreply@example.com',
        subject: 'Tee time reminder',
        text: `Reminder: Your tee time is at ${item.tt.start_time.toISOString()}`,
        html: `<p>Reminder: Your tee time is at ${item.tt.start_time.toISOString()}</p>`,
      });
    } catch (_) {}
  }
  return { sent: upcoming.length };
}

module.exports = { findUpcomingBookings, sendReminders };



