const {
  sequelize,
  GolfCourseInstance,
  Customer,
  CustomerNote,
  StaffUser,
} = require('../../src/models');
const { gdprService, GDPRService } = require('../../src/services/gdprService');
const { Op } = require('sequelize');

describe('GDPR Service Tests', () => {
  let testCourseId;
  let testCustomerIds = [];

  beforeAll(async () => {
    console.log('Database connection established for GDPR tests');
    await sequelize.authenticate();

    // Create tables if they don't exist
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await sequelize.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_GolfCourseInstances_status') THEN
        CREATE TYPE "enum_GolfCourseInstances_status" AS ENUM ('Pending','Active','Deactivated');
      END IF;
    END $$;`);
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "GolfCourseInstances" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" VARCHAR(255) NOT NULL,
        "subdomain" VARCHAR(255) UNIQUE NOT NULL,
        "primary_admin_id" UUID,
        "status" "enum_GolfCourseInstances_status" NOT NULL DEFAULT 'Pending',
        "street" VARCHAR(255),
        "city" VARCHAR(255),
        "state" VARCHAR(255),
        "postal_code" VARCHAR(255),
        "country" VARCHAR(255),
        "timezone" VARCHAR(255),
        "latitude" DECIMAL(9,6),
        "longitude" DECIMAL(9,6),
        "date_created" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "StaffUsers" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "course_id" UUID NOT NULL,
        "email" VARCHAR(255) UNIQUE NOT NULL,
        "password" VARCHAR(255) NOT NULL,
        "role" VARCHAR(255) NOT NULL DEFAULT 'Staff',
        "is_active" BOOLEAN NOT NULL DEFAULT false,
        "invitation_token" VARCHAR(255),
        "invited_at" TIMESTAMP WITH TIME ZONE,
        "token_expires_at" TIMESTAMP WITH TIME ZONE,
        "first_name" VARCHAR(255),
        "last_name" VARCHAR(255),
        "phone" VARCHAR(255),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await sequelize.query(`
              CREATE TABLE IF NOT EXISTS "Customers" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "course_id" UUID NOT NULL,
        "first_name" VARCHAR(255) NOT NULL,
        "last_name" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255) NOT NULL,
        "phone" VARCHAR(20),
        "handicap" DECIMAL(4,1),
        "membership_type" VARCHAR(255) NOT NULL DEFAULT 'Trial',
        "membership_start_date" TIMESTAMP WITH TIME ZONE,
        "membership_end_date" TIMESTAMP WITH TIME ZONE,
        "is_archived" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("email")
      );
    `);

    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "customer_notes" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "customer_id" UUID NOT NULL,
          "author_id" UUID NOT NULL,
          "content" TEXT NOT NULL,
          "is_private" BOOLEAN NOT NULL DEFAULT false,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

    console.log('Tables created for GDPR tests');

    // Create test course with unique subdomain to avoid conflicts
    const timestamp = Date.now();
    const testCourse = await GolfCourseInstance.create({
      name: 'Test GDPR Course',
      subdomain: `test-gdpr-course-${timestamp}`,
      status: 'Active',
      street: '456 Privacy St',
      city: 'GDPR City',
      state: 'CA',
      postal_code: '90211',
      country: 'US',
    });
    testCourseId = testCourse.id;

    // Ensure a staff author exists for notes foreign key
    await StaffUser.create({
      id: '00000000-0000-4000-8000-000000000001',
      course_id: testCourseId,
      email: `gdpr-staff-${timestamp}@example.com`,
      password: 'hashedpassword123',
      role: 'Staff',
      is_active: true,
      first_name: 'GDPR',
      last_name: 'Staff',
    });
  });

  afterAll(async () => {
    // Stop scheduler if running
    if (gdprService && typeof gdprService.stopScheduler === 'function') {
      gdprService.stopScheduler();
    }

    try {
      // Clean up test data
      if (testCustomerIds.length > 0) {
        await CustomerNote.destroy({
          where: { customer_id: { [Op.in]: testCustomerIds } },
        });
        await Customer.destroy({ where: { id: { [Op.in]: testCustomerIds } } });
      }
      if (testCourseId) {
        await Customer.destroy({ where: { course_id: testCourseId } });
        await GolfCourseInstance.destroy({ where: { id: testCourseId } });
      }
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Cleanup warning:', error.message);
    }

    try {
      await sequelize.close();
    } catch (error) {
      // Ignore close errors
    }
  });

  beforeEach(async () => {
    try {
      // Clean up customers and notes before each test
      if (testCustomerIds.length > 0) {
        await CustomerNote.destroy({
          where: { customer_id: { [Op.in]: testCustomerIds } },
        });
        await Customer.destroy({ where: { id: { [Op.in]: testCustomerIds } } });
      }
      if (testCourseId) {
        await Customer.destroy({ where: { course_id: testCourseId } });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    testCustomerIds = [];

    // Stop scheduler before each test
    if (gdprService && typeof gdprService.stopScheduler === 'function') {
      gdprService.stopScheduler();
    }

    // Set a shorter retention period for tests (7 days instead of 7 years)
    gdprService.retentionDays = 7;
  });

  describe('GDPR Scheduler Management', () => {
    test('should start and stop scheduler correctly', () => {
      expect(gdprService.isSchedulerRunning).toBe(false);

      gdprService.startScheduler();
      expect(gdprService.isSchedulerRunning).toBe(true);

      gdprService.stopScheduler();
      expect(gdprService.isSchedulerRunning).toBe(false);
    });

    test('should not start scheduler if already running', () => {
      gdprService.startScheduler();
      expect(gdprService.isSchedulerRunning).toBe(true);

      // Try to start again - should not change state
      gdprService.startScheduler();
      expect(gdprService.isSchedulerRunning).toBe(true);

      gdprService.stopScheduler();
    });

    test('should handle stopping scheduler when not running', () => {
      expect(gdprService.isSchedulerRunning).toBe(false);

      // Should not throw error
      gdprService.stopScheduler();
      expect(gdprService.isSchedulerRunning).toBe(false);
    });
  });

  describe('Data Purge Functionality', () => {
    test('should identify expired archived customers correctly', async () => {
      // Create old archived customer (older than retention period)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - (gdprService.retentionDays + 1));

      const oldCustomer = await Customer.create({
        course_id: testCourseId,
        first_name: 'Old',
        last_name: 'Customer',
        email: 'old@example.com',
        membership_type: 'Full',
        is_archived: true,
      });

      // Use raw SQL to update created_at since Sequelize protects it
      await sequelize.query(
        `UPDATE "Customers" SET created_at = :oldDate, updated_at = :oldDate WHERE id = :customerId`,
        {
          replacements: {
            oldDate: oldDate.toISOString(),
            customerId: oldCustomer.id,
          },
        }
      );

      testCustomerIds.push(oldCustomer.id);

      // Create recent archived customer (within retention period)
      const recentCustomer = await Customer.create({
        course_id: testCourseId,
        first_name: 'Recent',
        last_name: 'Customer',
        email: 'recent@example.com',
        membership_type: 'Full',
        is_archived: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      testCustomerIds.push(recentCustomer.id);

      // Run dry run purge
      const result = await gdprService.purgeExpiredData(true);

      expect(result.dryRun).toBe(true);
      expect(result.customersFound).toBe(1); // Only old customer
      expect(result.deletedCustomers).toBe(0); // Dry run, nothing deleted
      expect(result.message).toBe('Dry run completed - no data was deleted');
    });

    test('should purge expired data correctly', async () => {
      // Create old archived customer
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - (gdprService.retentionDays + 1));

      const oldCustomer = await Customer.create({
        course_id: testCourseId,
        first_name: 'Old',
        last_name: 'Customer',
        email: 'old@example.com',
        membership_type: 'Full',
        is_archived: true,
      });

      // Use raw SQL to update created_at since Sequelize protects it
      await sequelize.query(
        `UPDATE "Customers" SET created_at = :oldDate, updated_at = :oldDate WHERE id = :customerId`,
        {
          replacements: {
            oldDate: oldDate.toISOString(),
            customerId: oldCustomer.id,
          },
        }
      );

      testCustomerIds.push(oldCustomer.id);

      // Create notes for old archived customer
      await CustomerNote.create({
        customer_id: oldCustomer.id,
        content: 'Old note 1',
        is_private: false,
        author_id: '00000000-0000-4000-8000-000000000001',
      });

      await CustomerNote.create({
        customer_id: oldCustomer.id,
        content: 'Old note 2',
        is_private: true,
        author_id: '00000000-0000-4000-8000-000000000001',
      });

      // Create recent customer (should not be purged)
      const recentCustomer = await Customer.create({
        course_id: testCourseId,
        first_name: 'Recent',
        last_name: 'Customer',
        email: 'recent@example.com',
        membership_type: 'Full',
        is_archived: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      testCustomerIds.push(recentCustomer.id);

      // Run actual purge
      const result = await gdprService.purgeExpiredData(false);

      expect(result.dryRun).toBe(false);
      expect(result.customersFound).toBe(1);
      expect(result.notesFound).toBe(2);
      expect(result.deletedCustomers).toBe(1);
      expect(result.deletedNotes).toBe(2);
      expect(result.message).toBe(
        'Successfully purged 1 customers and 2 notes'
      );

      // Verify old customer and notes were deleted
      const oldCustomerExists = await Customer.findByPk(oldCustomer.id);
      expect(oldCustomerExists).toBe(null);

      const notesExist = await CustomerNote.findAll({
        where: { customer_id: oldCustomer.id },
      });
      expect(notesExist).toHaveLength(0);

      // Verify recent customer still exists
      const recentCustomerExists = await Customer.findByPk(recentCustomer.id);
      expect(recentCustomerExists).toBeTruthy();
    });

    test('should handle no expired data gracefully', async () => {
      // Create only recent customers
      const recentCustomer = await Customer.create({
        course_id: testCourseId,
        first_name: 'Recent',
        last_name: 'Customer',
        email: 'recent@example.com',
        membership_type: 'Full',
        is_archived: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      testCustomerIds.push(recentCustomer.id);

      const result = await gdprService.purgeExpiredData(false);

      expect(result.customersFound).toBe(0);
      expect(result.notesFound).toBe(0);
      expect(result.deletedCustomers).toBe(0);
      expect(result.deletedNotes).toBe(0);
      expect(result.message).toBe(
        'Successfully purged 0 customers and 0 notes'
      );
    });

    test('should only purge archived customers', async () => {
      // Create old but active customer (should not be purged)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - (gdprService.retentionDays + 1));

      const oldActiveCustomer = await Customer.create({
        course_id: testCourseId,
        first_name: 'Old',
        last_name: 'Active',
        email: 'oldactive@example.com',
        membership_type: 'Full',
        is_archived: false, // Not archived
      });

      // Use raw SQL to update created_at since Sequelize protects it
      await sequelize.query(
        `UPDATE "Customers" SET created_at = :oldDate, updated_at = :oldDate WHERE id = :customerId`,
        {
          replacements: {
            oldDate: oldDate.toISOString(),
            customerId: oldActiveCustomer.id,
          },
        }
      );

      testCustomerIds.push(oldActiveCustomer.id);

      const result = await gdprService.purgeExpiredData(false);

      expect(result.customersFound).toBe(0); // Should not find non-archived customers
      expect(result.deletedCustomers).toBe(0);

      // Verify customer still exists
      const customerExists = await Customer.findByPk(oldActiveCustomer.id);
      expect(customerExists).toBeTruthy();
    });
  });

  describe('Compliance Status', () => {
    test('should return correct compliance status', async () => {
      // Create mix of customers
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - (gdprService.retentionDays + 1));

      const oldCustomer = await Customer.create({
        course_id: testCourseId,
        first_name: 'Old',
        last_name: 'Archived',
        email: 'old1@example.com',
        is_archived: true,
      });

      // Use raw SQL to update created_at since Sequelize protects it
      await sequelize.query(
        `UPDATE "Customers" SET created_at = :oldDate, updated_at = :oldDate WHERE id = :customerId`,
        {
          replacements: {
            oldDate: oldDate.toISOString(),
            customerId: oldCustomer.id,
          },
        }
      );

      const recentCustomer = await Customer.create({
        course_id: testCourseId,
        first_name: 'Recent',
        last_name: 'Archived',
        email: 'recent1@example.com',
        is_archived: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const activeCustomer = await Customer.create({
        course_id: testCourseId,
        first_name: 'Active',
        last_name: 'Customer',
        email: 'active1@example.com',
        is_archived: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const customers = [oldCustomer, recentCustomer, activeCustomer];

      customers.forEach(c => testCustomerIds.push(c.id));

      const status = await gdprService.getComplianceStatus(testCourseId);

      expect(status).toMatchObject({
        courseId: testCourseId,
        retentionDays: gdprService.retentionDays,
        totalArchivedCustomers: 2,
        customersEligibleForPurge: 1,
        schedulerRunning: false,
      });

      expect(status.cutoffDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(status.lastCheck).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('should reflect scheduler status correctly', async () => {
      gdprService.startScheduler();

      const status = await gdprService.getComplianceStatus(testCourseId);
      expect(status.schedulerRunning).toBe(true);

      gdprService.stopScheduler();

      const status2 = await gdprService.getComplianceStatus(testCourseId);
      expect(status2.schedulerRunning).toBe(false);
    });
  });

  describe('Customer Archiving', () => {
    test('should archive customer successfully', async () => {
      const customer = await Customer.create({
        course_id: testCourseId,
        first_name: 'Test',
        last_name: 'Customer',
        email: 'test@example.com',
        membership_type: 'Full',
        is_archived: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
      testCustomerIds.push(customer.id);

      const result = await gdprService.archiveCustomer(
        customer.id,
        testCourseId
      );

      expect(result.message).toBe('Customer archived successfully');
      expect(result.customer.is_archived).toBe(true);
      expect(result.purgeEligibleDate).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );

      // Verify customer is archived
      await customer.reload();
      expect(customer.is_archived).toBe(true);
    });

    test('should handle already archived customer', async () => {
      const customer = await Customer.create({
        course_id: testCourseId,
        first_name: 'Already',
        last_name: 'Archived',
        email: 'archived@example.com',
        membership_type: 'Full',
        is_archived: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      testCustomerIds.push(customer.id);

      const result = await gdprService.archiveCustomer(
        customer.id,
        testCourseId
      );

      expect(result.message).toBe('Customer already archived');
      expect(result.customer.is_archived).toBe(true);
    });

    test('should throw error for non-existent customer', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        gdprService.archiveCustomer(fakeId, testCourseId)
      ).rejects.toThrow('Customer not found');
    });

    test('should throw error for customer from different course', async () => {
      // Create another course
      const otherCourse = await GolfCourseInstance.create({
        name: 'Other Course',
        subdomain: 'other-course-gdpr',
        status: 'Active',
        street: '456 Other St',
        city: 'Other City',
        state: 'NY',
        postal_code: '10001',
        country: 'US',
      });

      const customer = await Customer.create({
        course_id: otherCourse.id,
        first_name: 'Other',
        last_name: 'Customer',
        email: 'other@example.com',
        membership_type: 'Full',
        is_archived: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await expect(
        gdprService.archiveCustomer(customer.id, testCourseId)
      ).rejects.toThrow('Customer not found');

      // Clean up
      await Customer.destroy({ where: { id: customer.id } });
      await GolfCourseInstance.destroy({ where: { id: otherCourse.id } });
    });
  });

  describe('Service Instance', () => {
    test('should have correct default configuration', () => {
      // Note: retention days may be modified by test setup
      expect(gdprService.retentionDays).toBeGreaterThan(0);
      expect(gdprService.isSchedulerRunning).toBe(false);
    });

    test('should respect environment variable for retention days', () => {
      const originalValue = process.env.GDPR_RETENTION_DAYS;
      process.env.GDPR_RETENTION_DAYS = '365';

      const testService = new GDPRService();
      expect(testService.retentionDays).toBe(365);

      // Restore original value
      if (originalValue) {
        process.env.GDPR_RETENTION_DAYS = originalValue;
      } else {
        delete process.env.GDPR_RETENTION_DAYS;
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid customer ID gracefully', async () => {
      const invalidId = '00000000-0000-0000-0000-000000000000';

      await expect(
        gdprService.archiveCustomer(invalidId, testCourseId)
      ).rejects.toThrow('Customer not found');
    });

    test('should handle non-existent course ID in compliance status', async () => {
      const invalidCourseId = '00000000-0000-0000-0000-000000000000';

      const status = await gdprService.getComplianceStatus(invalidCourseId);
      expect(status.totalArchivedCustomers).toBe(0);
      expect(status.customersEligibleForPurge).toBe(0);
    });
  });
});
