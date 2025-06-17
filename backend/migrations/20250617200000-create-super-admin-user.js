'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SuperAdminUsers', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
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

    // Add indexes for performance
    await queryInterface.addIndex('SuperAdminUsers', ['email'], {
      name: 'super_admin_users_email_idx',
      unique: true,
    });
    await queryInterface.addIndex('SuperAdminUsers', ['invitation_token'], {
      name: 'super_admin_users_invitation_token_idx',
    });
    await queryInterface.addIndex('SuperAdminUsers', ['is_active'], {
      name: 'super_admin_users_is_active_idx',
    });
  },

  async down(queryInterface) {
    // Remove indexes first
    try {
      await queryInterface.removeIndex(
        'SuperAdminUsers',
        'super_admin_users_email_idx'
      );
      await queryInterface.removeIndex(
        'SuperAdminUsers',
        'super_admin_users_invitation_token_idx'
      );
      await queryInterface.removeIndex(
        'SuperAdminUsers',
        'super_admin_users_is_active_idx'
      );
    } catch (error) {
      // Ignore error if indexes don't exist
    }

    await queryInterface.dropTable('SuperAdminUsers');
  },
};
