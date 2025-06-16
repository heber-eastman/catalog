const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Customer } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { createCustomerSchema, updateCustomerSchema } = require('../validation/customerSchema');

// Apply auth middleware to all routes
router.use(requireAuth());

// GET /customers - List customers with search/filter/sort/paginate
router.get('/customers', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = 'last_name',
      order = 'ASC',
      search,
      membership_type,
      is_archived,
    } = req.query;

    // Build where clause
    const where = {
      course_id: req.courseId,
    };

    // Add search condition
    if (search) {
      where[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    // Add membership type filter
    if (membership_type) {
      where.membership_type = membership_type;
    }

    // Add archived filter
    if (typeof is_archived === 'boolean') {
      where.is_archived = is_archived;
    }

    // Calculate offset
    const offset = (page - 1) * limit;

    // Get customers
    const { count, rows } = await Customer.findAndCountAll({
      where,
      order: [[sort, order]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json(rows);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// POST /customers - Create new customer
router.post('/customers', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = createCustomerSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path[0],
          message: detail.message,
        })),
      });
    }

    // Create customer
    const customer = await Customer.create({
      ...value,
      course_id: req.courseId,
    });

    res.status(201).json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(409).json({ error: 'A customer with this email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create customer' });
    }
  }
});

// GET /customers/:id - Get single customer
router.get('/customers/:id', async (req, res) => {
  try {
    const customer = await Customer.findOne({
      where: {
        id: req.params.id,
        course_id: req.courseId,
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// PUT /customers/:id - Update customer
router.put('/customers/:id', async (req, res) => {
  try {
    // Get existing customer
    const customer = await Customer.findOne({
      where: {
        id: req.params.id,
        course_id: req.courseId,
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Validate request body
    const { error, value } = updateCustomerSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path[0],
          message: detail.message,
        })),
      });
    }

    // Update customer
    await customer.update(value);

    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(409).json({ error: 'A customer with this email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update customer' });
    }
  }
});

// DELETE /customers/:id - Delete customer
router.delete('/customers/:id', async (req, res) => {
  try {
    const customer = await Customer.findOne({
      where: {
        id: req.params.id,
        course_id: req.courseId,
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await customer.destroy();

    res.status(200).json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

module.exports = router; 