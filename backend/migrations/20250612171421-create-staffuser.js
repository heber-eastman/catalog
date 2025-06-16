'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('StaffUsers', {
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
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password_hash: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('Admin', 'Manager', 'Staff'),
        allowNull: false,
        defaultValue: 'Staff',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      invitation_token: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      invited_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      token_expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      first_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      last_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true,
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

    // Add indexes for performance with unique names
    await queryInterface.addIndex('StaffUsers', ['course_id'], {
      name: 'staff_users_course_id_idx'
    });
    await queryInterface.addIndex('StaffUsers', ['email'], {
      name: 'staff_users_email_idx',
      unique: true
    });
    await queryInterface.addIndex('StaffUsers', ['invitation_token'], {
      name: 'staff_users_invitation_token_idx'
    });
    await queryInterface.addIndex('StaffUsers', ['is_active'], {
      name: 'staff_users_is_active_idx'
    });
  },

  async down(queryInterface) {
    // Remove indexes first
    try {
      await queryInterface.removeIndex('StaffUsers', 'staff_users_course_id_idx');
      await queryInterface.removeIndex('StaffUsers', 'staff_users_email_idx');
      await queryInterface.removeIndex('StaffUsers', 'staff_users_invitation_token_idx');
      await queryInterface.removeIndex('StaffUsers', 'staff_users_is_active_idx');
    } catch (error) {
      // Ignore error if indexes don't exist
    }

    await queryInterface.dropTable('StaffUsers');
  },
};
