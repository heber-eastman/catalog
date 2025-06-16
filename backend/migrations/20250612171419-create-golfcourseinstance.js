'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('GolfCourseInstances', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
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
        type: Sequelize.UUID,
        allowNull: true,
        // This will be updated in a separate migration after StaffUsers table is created
        // to add the foreign key constraint: references: { model: 'StaffUsers', key: 'id' }
      },
      status: {
        type: Sequelize.ENUM('Pending', 'Active', 'Deactivated'),
        allowNull: false,
        defaultValue: 'Pending',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add index on status column
    await queryInterface.addIndex('GolfCourseInstances', ['status'], {
      name: 'golf_course_instances_status_idx',
    });

    // Add index on subdomain for quick lookups
    await queryInterface.addIndex('GolfCourseInstances', ['subdomain'], {
      name: 'golf_course_instances_subdomain_idx',
      unique: true,
    });
  },

  async down(queryInterface) {
    // Remove indexes first
    try {
      await queryInterface.removeIndex('GolfCourseInstances', 'golf_course_instances_status_idx');
      await queryInterface.removeIndex('GolfCourseInstances', 'golf_course_instances_subdomain_idx');
    } catch (error) {
      // Ignore error if indexes don't exist
    }

    // Drop the table
    await queryInterface.dropTable('GolfCourseInstances');
  },
};
