'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('GolfCourseInstances', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING, // Use STRING for SQLite compatibility, UUID for PostgreSQL
        defaultValue: Sequelize.UUIDV4,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      street: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      postal_code: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'US',
      },
      subdomain: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      primary_admin_id: {
        type: Sequelize.STRING, // Use STRING for SQLite compatibility
        allowNull: true,
        // Remove foreign key constraint for now since Users table doesn't exist yet
        // Will be added in a future migration when Users table is created
      },
      status: {
        type: Sequelize.STRING, // Use STRING instead of ENUM for SQLite compatibility
        allowNull: false,
        defaultValue: 'Pending',
        validate: {
          isIn: [['Pending', 'Active', 'Deactivated']],
        },
      },
      date_created: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add index on status column
    await queryInterface.addIndex('GolfCourseInstances', ['status'], {
      name: 'golf_course_instances_status_idx',
    });
  },

  async down(queryInterface) {
    // Remove index first (ignore if it doesn't exist)
    try {
      await queryInterface.removeIndex(
        'GolfCourseInstances',
        'golf_course_instances_status_idx'
      );
    } catch (error) {
      // Ignore error if index doesn't exist
    }

    // Drop the table
    await queryInterface.dropTable('GolfCourseInstances');
  },
};
