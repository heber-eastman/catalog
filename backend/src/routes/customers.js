const express = require('express');
const { Op } = require('sequelize');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const router = express.Router();
const { Customer, sequelize } = require('../models');
const { requireAuth, ALL_ROLES } = require('../middleware/auth');
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

// Note: Auth middleware applied to individual routes to avoid interfering with other /api/v1/* routes

// GET /customers/export - Export customers to CSV
router.get('/customers/export', requireAuth(ALL_ROLES), async (req, res) => {
  try {
    const { search, membership_type, is_archived } = req.query;

    // Build where clause (same as list endpoint)
    const where = {
      course_id: req.courseId,
    };

    // Add search condition
    if (search) {
      where[Op.or] = [
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
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
router.post(
  '/customers/import',
  requireAuth(ALL_ROLES),
  upload.single('file'),
  async (req, res) => {
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
  }
);

// GET /customers - List customers with search/filter/sort/paginate
router.get('/customers', requireAuth(ALL_ROLES), async (req, res) => {
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
    const where = {};

    // For non-SuperAdmin users, filter by course_id
    if (req.userRole !== 'SuperAdmin') {
      where.course_id = req.courseId;
    }

    // Add search condition
    if (search) {
      where[Op.or] = [
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
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

    // Pagination: allow "All" or non-numeric to mean no limit
    const limitNum = Number(limit);
    const pageNum = Number(page);
    const usePaging = Number.isFinite(limitNum) && limitNum > 0;
    const findOpts = {
      where,
      order: [[sort, order]],
      attributes: { include: ['created_at', 'updated_at'] },
    };
    if (usePaging) {
      findOpts.limit = limitNum;
      findOpts.offset = Number.isFinite(pageNum) && pageNum > 0 ? (pageNum - 1) * limitNum : 0;
    }

    // Get customers
    const { rows } = await Customer.findAndCountAll(findOpts);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// POST /customers - Create new customer
router.post('/customers', requireAuth(ALL_ROLES), async (req, res) => {
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

// GET /customers/status-counts - Get customer statistics for dashboard
router.get(
  '/customers/status-counts',
  requireAuth(ALL_ROLES),
  async (req, res) => {
    try {
      const courseId = req.courseId;

      // Build base where clause for all queries
      const baseWhere = {};
      if (req.userRole !== 'SuperAdmin') {
        baseWhere.course_id = courseId;
      }

      // Get total customer count
      const totalCustomers = await Customer.count({
        where: {
          ...baseWhere,
          is_archived: false,
        },
      });

      // Get customers by membership type
      const membershipTypeCounts = await Customer.findAll({
        where: {
          ...baseWhere,
          is_archived: false,
        },
        attributes: [
          'membership_type',
          [sequelize.fn('COUNT', sequelize.col('membership_type')), 'count'],
        ],
        group: ['membership_type'],
        raw: true,
      });

      // Get archived customer count
      const archivedCustomers = await Customer.count({
        where: {
          ...baseWhere,
          is_archived: true,
        },
      });

      // Get new customers this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const newCustomersThisMonth = await Customer.count({
        where: {
          ...baseWhere,
          is_archived: false,
          created_at: {
            [Op.gte]: startOfMonth,
          },
        },
      });

      // Get customers with active memberships (non-expired)
      const now = new Date();
      const activeMemberships = await Customer.count({
        where: {
          ...baseWhere,
          is_archived: false,
          [Op.or]: [
            { membership_end_date: null }, // No expiry date
            { membership_end_date: { [Op.gte]: now } }, // Future expiry
          ],
        },
      });

      // Format membership type counts for easier consumption
      const membershipStats = {};
      membershipTypeCounts.forEach(item => {
        membershipStats[item.membership_type || 'none'] = parseInt(item.count);
      });

      const stats = {
        totalCustomers,
        archivedCustomers,
        activeMembers: activeMemberships,
        newThisMonth: newCustomersThisMonth,
        membershipTypes: membershipStats,
        calculatedAt: new Date().toISOString(),
      };

      res.json(stats);
    } catch (error) {
      console.error('Error fetching customer status counts:', error);
      res.status(500).json({ error: 'Failed to fetch customer statistics' });
    }
  }
);

// GET /customers/:id - Get single customer
router.get('/customers/:id', requireAuth(ALL_ROLES), async (req, res) => {
  try {
    const where = { id: req.params.id };

    // For non-SuperAdmin users, filter by course_id
    if (req.userRole !== 'SuperAdmin') {
      where.course_id = req.courseId;
    }

    const customer = await Customer.findOne({
      where,
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
router.put('/customers/:id', requireAuth(ALL_ROLES), async (req, res) => {
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
router.delete('/customers/:id', requireAuth(ALL_ROLES), async (req, res) => {
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
