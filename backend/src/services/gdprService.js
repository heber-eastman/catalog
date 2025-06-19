const cron = require('node-cron');
const { Customer, CustomerNote } = require('../models');
const { Op } = require('sequelize');

/**
 * GDPR Data Purge Service
 * Handles automated deletion of customer data after retention period
 */
class GDPRService {
  constructor() {
    this.isSchedulerRunning = false;
    this.purgeJob = null;
    this.retentionDays = parseInt(process.env.GDPR_RETENTION_DAYS) || 2555; // ~7 years default
  }

  /**
   * Start the GDPR purge scheduler
   * Runs daily at 2 AM to check for data that needs purging
   */
  startScheduler() {
    if (this.isSchedulerRunning) {
      console.log('GDPR scheduler is already running');
      return;
    }

    // Schedule to run daily at 2 AM
    this.purgeJob = cron.schedule(
      '0 2 * * *', 
      async () => {
        console.log('Starting GDPR data purge job...');
        try {
          const result = await this.purgeExpiredData();
          console.log('GDPR purge completed:', result);
        } catch (error) {
          console.error('GDPR purge failed:', error);
        }
      },
      {
        scheduled: false, // Don't start immediately
        timezone: 'UTC'
      }
    );

    this.purgeJob.start();
    this.isSchedulerRunning = true;
    console.log(`GDPR scheduler started. Data retention period: ${this.retentionDays} days`);
  }

  /**
   * Stop the GDPR purge scheduler
   */
  stopScheduler() {
    if (this.purgeJob) {
      this.purgeJob.stop();
      this.purgeJob = null;
      this.isSchedulerRunning = false;
      console.log('GDPR scheduler stopped');
    }
  }

  /**
   * Manually trigger data purge
   * @param {boolean} dryRun - If true, only count records without deleting
   * @returns {Object} Purge results
   */
  async purgeExpiredData(dryRun = false) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    
    console.log(`Looking for data older than ${cutoffDate.toISOString()}`);
    
    try {
      // Find archived customers that exceed retention period (based on created_at)
      const expiredCustomers = await Customer.findAll({
        where: {
          is_archived: true,
          created_at: {
            [Op.lt]: cutoffDate
          }
        },
        attributes: ['id', 'course_id', 'first_name', 'last_name', 'created_at']
      });

      // Find customer notes for expired customers
      const customerIds = expiredCustomers.map(c => c.id);
      let expiredNotes = [];
      
      if (customerIds.length > 0) {
        expiredNotes = await CustomerNote.findAll({
          where: {
            customer_id: {
              [Op.in]: customerIds
            }
          },
          attributes: ['id', 'customer_id']
        });
      }

      const result = {
        cutoffDate: cutoffDate.toISOString(),
        customersFound: expiredCustomers.length,
        notesFound: expiredNotes.length,
        dryRun,
        deletedCustomers: 0,
        deletedNotes: 0,
        errors: []
      };

      if (dryRun) {
        result.message = 'Dry run completed - no data was deleted';
        return result;
      }

      // Delete customer notes first (foreign key constraint)
      if (expiredNotes.length > 0) {
        const deletedNotesCount = await CustomerNote.destroy({
          where: {
            id: {
              [Op.in]: expiredNotes.map(n => n.id)
            }
          }
        });
        result.deletedNotes = deletedNotesCount;
      }

      // Delete expired customers
      if (expiredCustomers.length > 0) {
        const deletedCustomersCount = await Customer.destroy({
          where: {
            id: {
              [Op.in]: customerIds
            }
          }
        });
        result.deletedCustomers = deletedCustomersCount;
      }

      result.message = `Successfully purged ${result.deletedCustomers} customers and ${result.deletedNotes} notes`;
      
      return result;
    } catch (error) {
      console.error('Error during GDPR data purge:', error);
      throw error;
    }
  }

  /**
   * Get GDPR compliance status for a course
   * @param {string} courseId - Course ID to check
   * @returns {Object} Compliance status
   */
  async getComplianceStatus(courseId) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    
    try {
      // Count total archived customers
      const totalArchived = await Customer.count({
        where: {
          course_id: courseId,
          is_archived: true
        }
      });

      // Count customers eligible for purging (based on created_at)
      const eligibleForPurge = await Customer.count({
        where: {
          course_id: courseId,
          is_archived: true,
          created_at: {
            [Op.lt]: cutoffDate
          }
        }
      });

      return {
        courseId,
        retentionDays: this.retentionDays,
        cutoffDate: cutoffDate.toISOString(),
        totalArchivedCustomers: totalArchived,
        customersEligibleForPurge: eligibleForPurge,
        schedulerRunning: this.isSchedulerRunning,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting GDPR compliance status:', error);
      throw error;
    }
  }

  /**
   * Archive a customer (mark for future purging)
   * @param {string} customerId - Customer ID to archive
   * @param {string} courseId - Course ID for security
   * @returns {Object} Archive result
   */
  async archiveCustomer(customerId, courseId) {
    try {
      const customer = await Customer.findOne({
        where: {
          id: customerId,
          course_id: courseId
        }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      if (customer.is_archived) {
        return { 
          message: 'Customer already archived',
          customer: customer
        };
      }

      await customer.update({
        is_archived: true,
        updated_at: new Date()
      });

      return {
        message: 'Customer archived successfully',
        customer: customer,
        purgeEligibleDate: new Date(Date.now() + (this.retentionDays * 24 * 60 * 60 * 1000)).toISOString()
      };
    } catch (error) {
      console.error('Error archiving customer:', error);
      throw error;
    }
  }
}

// Export singleton instance
const gdprService = new GDPRService();

module.exports = {
  gdprService,
  GDPRService
}; 