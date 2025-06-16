'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Customers', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      course_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'GolfCourseInstances',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      first_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      last_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          isEmail: true,
        },
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      handicap: {
        type: Sequelize.DECIMAL(4, 1),
        allowNull: true,
        validate: {
          min: -10,
          max: 54,
        },
      },
      membership_type: {
        type: Sequelize.ENUM('Full', 'Junior', 'Senior', 'Social', 'Trial'),
        allowNull: false,
        defaultValue: 'Trial',
      },
      membership_start_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      membership_end_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      is_archived: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

    // Add indexes with unique names
    await queryInterface.addIndex('Customers', ['course_id'], {
      name: 'customers_course_id_idx'
    });
    
    // Add composite unique index for email within each course
    await queryInterface.addIndex('Customers', ['course_id', 'email'], {
      name: 'customers_course_email_unique_idx',
      unique: true
    });
    
    await queryInterface.addIndex('Customers', ['is_archived'], {
      name: 'customers_is_archived_idx'
    });
    
    await queryInterface.addIndex('Customers', ['membership_type'], {
      name: 'customers_membership_type_idx'
    });
  },

  async down(queryInterface) {
    // Remove indexes first
    try {
      await queryInterface.removeIndex('Customers', 'customers_course_id_idx');
      await queryInterface.removeIndex('Customers', 'customers_course_email_unique_idx');
      await queryInterface.removeIndex('Customers', 'customers_is_archived_idx');
      await queryInterface.removeIndex('Customers', 'customers_membership_type_idx');
    } catch (error) {
      // Ignore error if indexes don't exist
    }

    await queryInterface.dropTable('Customers');
  },
}; 