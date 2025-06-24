'use strict';

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if super admin already exists
    const existingSuperAdmin = await queryInterface.sequelize.query(
      'SELECT id FROM "SuperAdminUsers" WHERE email = :email',
      {
        replacements: { email: 'super@catalog.golf' },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    if (existingSuperAdmin.length > 0) {
      console.log('Super admin already exists, skipping...');
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('super123', 12);

    // Create the initial super admin
    await queryInterface.bulkInsert('SuperAdminUsers', [
      {
        id: uuidv4(),
        email: 'super@catalog.golf',
        password_hash: hashedPassword,
        first_name: 'Super',
        last_name: 'Admin',
        phone: '+1-555-0100',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    console.log('✅ Initial super admin created:');
    console.log('   Email: super@catalog.golf');
    console.log('   Password: super123');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('SuperAdminUsers', {
      email: 'super@catalog.golf',
    });
  },
}; 