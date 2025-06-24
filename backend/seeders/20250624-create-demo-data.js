'use strict';

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if demo course already exists
    const existingCourse = await queryInterface.sequelize.query(
      'SELECT id FROM "GolfCourseInstances" WHERE subdomain = :subdomain',
      {
        replacements: { subdomain: 'pinevalley' },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    if (existingCourse.length > 0) {
      console.log('Demo course already exists, skipping...');
      return;
    }

    // Create demo golf course
    const courseId = uuidv4();
    await queryInterface.bulkInsert('GolfCourseInstances', [
      {
        id: courseId,
        name: 'Pine Valley Golf Club',
        subdomain: 'pinevalley',
        street: '123 Golf Course Drive',
        city: 'Pine Valley',
        state: 'CA',
        postal_code: '90210',
        country: 'US',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Hash the password for staff user
    const hashedPassword = await bcrypt.hash('admin123', 12);

    // Create demo staff user
    await queryInterface.bulkInsert('StaffUsers', [
      {
        id: uuidv4(),
        course_id: courseId,
        email: 'admin@pinevalley.golf',
        password: hashedPassword,
        first_name: 'Course',
        last_name: 'Admin',
        phone: '+1-555-0124',
        role: 'Admin',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    console.log('✅ Demo data created:');
    console.log(
      '   Golf Course: Pine Valley Golf Club (pinevalley.catalog.golf)'
    );
    console.log('   Staff Login: admin@pinevalley.golf / admin123');
  },

  async down(queryInterface, Sequelize) {
    // Remove staff users for the demo course
    const course = await queryInterface.sequelize.query(
      'SELECT id FROM "GolfCourseInstances" WHERE subdomain = :subdomain',
      {
        replacements: { subdomain: 'pinevalley' },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    if (course.length > 0) {
      await queryInterface.bulkDelete('StaffUsers', {
        course_id: course[0].id,
      });
    }

    // Remove demo course
    await queryInterface.bulkDelete('GolfCourseInstances', {
      subdomain: 'pinevalley',
    });
  },
};
