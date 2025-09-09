'use strict';

const { Event } = require('../models');

async function recordEvent({ courseId, entityType, entityId, action, actorType, actorId, metadata }) {
  if (process.env.DISABLE_EVENT_RECORDING === 'true') {
    return;
  }
  try {
    await Event.create({
      course_id: courseId || null,
      entity_type: entityType,
      entity_id: entityId || null,
      action,
      actor_type: actorType || null,
      actor_id: actorId || null,
      metadata: metadata || null,
    });
  } catch (e) {
    // Best-effort: do not throw
    // eslint-disable-next-line no-console
    console.error('Event recording failed', e);
  }
}

module.exports = { recordEvent };



