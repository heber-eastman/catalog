const express = require('express');
const { Op } = require('sequelize');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const router = express.Router();
const { Customer } = require('../models');
const { requireAuth } = require('../middleware/auth');
const {
  createCustomerSchema,
  updateCustomerSchema,
} = require('../validation/customerSchema');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
});

// Apply auth middleware to all routes
router.use(requireAuth());

// GET /customers/export - Export customers to CSV
router.get('/customers/export', async (req, res) => {
  try {
    const { search, membership_type, is_archived } = req.query;

    // Build where clause (same as list endpoint)
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

    // Get all customers matching criteria
    const customers = await Customer.findAll({
      where,
      order: [
        ['last_name', 'ASC'],
        ['first_name', 'ASC'],
      ],
      attributes: [
        'first_name',
        'last_name',
        'email',
        'phone',
        'membership_type',
      ],
    });

    // Format data for CSV
    const csvData = customers.map(customer => ({
      name: `${customer.first_name} ${customer.last_name}`,
      email: customer.email,
      phone: customer.phone || '',
    }));

    // Create CSV string
    const csvHeader = 'name,email,phone\n';
    const csvRows = csvData
      .map(row => `"${row.name}","${row.email}","${row.phone}"`)
      .join('\n');
    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="customers.csv"'
    );

    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting customers:', error);
    res.status(500).json({ error: 'Failed to export customers' });
  }
});

// POST /customers/import - Import customers from CSV
router.post('/customers/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvData = [];
    const failedRows = [];
    let importedCount = 0;

    // Parse CSV from buffer
    const stream = Readable.from(req.file.buffer.toString());

    stream
      .pipe(csv())
      .on('data', data => csvData.push(data))
      .on('end', async () => {
        try {
          // Process each row
          for (let i = 0; i < csvData.length; i++) {
            const row = csvData[i];
            const rowNumber = i + 2; // Account for header row

            try {
              // Validate required fields
              if (!row.first_name || !row.last_name || !row.email) {
                failedRows.push({
                  row: rowNumber,
                  data: row,
                  error:
                    'Missing required fields: first_name, last_name, email',
                });
                continue;
              }

              // Validate email format
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(row.email)) {
                failedRows.push({
                  row: rowNumber,
                  data: row,
                  error: 'Invalid email format',
                });
                continue;
              }

              // Prepare customer data
              const customerData = {
                first_name: row.first_name?.trim(),
                last_name: row.last_name?.trim(),
                email: row.email?.trim().toLowerCase(),
                phone: row.phone?.trim() || null,
                membership_type: row.membership_type?.trim() || 'Trial',
                course_id: req.courseId,
              };

              // Validate membership type
              const validMembershipTypes = ['Trial', 'Full', 'Junior'];
              if (
                !validMembershipTypes.includes(customerData.membership_type)
              ) {
                customerData.membership_type = 'Trial';
              }

              // Try to find existing customer by email
              const existingCustomer = await Customer.findOne({
                where: {
                  email: customerData.email,
                  course_id: req.courseId,
                },
              });

              if (existingCustomer) {
                // Update existing customer
                await existingCustomer.update(customerData);
                importedCount++;
              } else {
                // Create new customer
                await Customer.create(customerData);
                importedCount++;
              }
            } catch (error) {
              failedRows.push({
                row: rowNumber,
                data: row,
                error: error.message,
              });
            }
          }

          res.json({
            message: 'Import completed',
            imported_count: importedCount,
            failed_count: failedRows.length,
            failed_rows: failedRows,
          });
        } catch (error) {
          console.error('Error processing CSV:', error);
          res.status(500).json({ error: 'Failed to process CSV file' });
        }
      })
      .on('error', error => {
        console.error('Error parsing CSV:', error);
        res.status(400).json({ error: 'Invalid CSV format' });
      });
  } catch (error) {
    console.error('Error importing customers:', error);
    res.status(500).json({ error: 'Failed to import customers' });
  }
});

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
    const { rows } = await Customer.findAndCountAll({
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
    const { error, value } = createCustomerSchema.validate(req.body, {
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

    // Create customer
    const customer = await Customer.create({
      ...value,
      course_id: req.courseId,
    });

    res.status(201).json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      res
        .status(409)
        .json({ error: 'A customer with this email already exists' });
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
    const { error, value } = updateCustomerSchema.validate(req.body, {
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

    // Update customer
    await customer.update(value);

    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      res
        .status(409)
        .json({ error: 'A customer with this email already exists' });
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
