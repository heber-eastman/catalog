const express = require('express');
const router = express.Router();
const { Customer, CustomerNote, StaffUser } = require('../models');
const { requireAuth } = require('../middleware/auth');
const {
  createNoteSchema,
  updateNoteSchema,
} = require('../validation/noteSchema');

// Note: Auth middleware applied to individual routes to avoid interfering with other /api/v1/* routes

// GET /customers/:cid/notes - Get all notes for a customer
router.get('/customers/:cid/notes', requireAuth(), async (req, res) => {
  try {
    const { cid } = req.params;

    // Verify customer exists and belongs to the course
    const customer = await Customer.findOne({
      where: {
        id: cid,
        course_id: req.courseId,
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get all notes for the customer
    const notes = await CustomerNote.findAll({
      where: {
        customer_id: cid,
      },
      include: [
        {
          model: StaffUser,
          as: 'author',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// POST /customers/:cid/notes - Create a new note
router.post('/customers/:cid/notes', requireAuth(), async (req, res) => {
  try {
    const { cid } = req.params;

    // Verify customer exists and belongs to the course
    const customer = await Customer.findOne({
      where: {
        id: cid,
        course_id: req.courseId,
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Validate request body
    const { error, value } = createNoteSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path[0],
          message: detail.message,
        })),
      });
    }

    // Create note
    const note = await CustomerNote.create({
      ...value,
      customer_id: cid,
      author_id: req.userId,
    });

    // Fetch the created note with author information
    const noteWithAuthor = await CustomerNote.findByPk(note.id, {
      include: [
        {
          model: StaffUser,
          as: 'author',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
      ],
    });

    res.status(201).json(noteWithAuthor);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// PUT /customers/:cid/notes/:id - Update a note
router.put('/customers/:cid/notes/:id', requireAuth(), async (req, res) => {
  try {
    const { cid, id } = req.params;

    // Verify customer exists and belongs to the course
    const customer = await Customer.findOne({
      where: {
        id: cid,
        course_id: req.courseId,
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Find the note
    const note = await CustomerNote.findOne({
      where: {
        id,
        customer_id: cid,
      },
      include: [
        {
          model: StaffUser,
          as: 'author',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
      ],
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Check if user is the author or has admin role
    if (note.author_id !== req.userId && req.userRole !== 'Admin') {
      return res
        .status(403)
        .json({ error: 'You can only edit your own notes' });
    }

    // Validate request body
    const { error, value } = updateNoteSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path[0],
          message: detail.message,
        })),
      });
    }

    // Update note
    await note.update(value);

    res.json(note);
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /customers/:cid/notes/:id - Delete a note
router.delete('/customers/:cid/notes/:id', requireAuth(), async (req, res) => {
  try {
    const { cid, id } = req.params;

    // Verify customer exists and belongs to the course
    const customer = await Customer.findOne({
      where: {
        id: cid,
        course_id: req.courseId,
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Find the note
    const note = await CustomerNote.findOne({
      where: {
        id,
        customer_id: cid,
      },
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Check if user is the author or has admin role
    if (note.author_id !== req.userId && req.userRole !== 'Admin') {
      return res
        .status(403)
        .json({ error: 'You can only delete your own notes' });
    }

    // Delete note
    await note.destroy();

    res.status(200).json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router;
