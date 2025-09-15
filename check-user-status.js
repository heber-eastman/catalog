const { Pool } = require('pg');

const pool = new Pool({
  connectionString:
    'postgresql://catalogadmin:CatalogDB2025!@catalog-golf-db.ckl6kk2cysrq.us-east-1.rds.amazonaws.com:5432/postgres',
  ssl: {
    rejectUnauthorized: false,
  },
});

async function checkUserStatus() {
  try {
    console.log('Connecting to production database...');

    // First, check what tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('Available tables:');
    tablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });

    // Check in StaffUsers table
    const staffUserResult = await pool.query(
      `
      SELECT id, course_id, email, role, is_active, created_at, updated_at, first_name, last_name
      FROM "StaffUsers" 
      WHERE email = $1;
    `,
      ['heber+hvr_11@catalog.golf']
    );

    console.log('\n--- StaffUsers Results ---');
    if (staffUserResult.rows.length > 0) {
      console.log('User found in StaffUsers:');
      staffUserResult.rows.forEach(user => {
        console.log(`ID: ${user.id}`);
        console.log(`Email: ${user.email}`);
        console.log(`Role: ${user.role}`);
        console.log(`Course ID: ${user.course_id}`);
        console.log(`Is Active: ${user.is_active}`);
        console.log(`Name: ${user.first_name} ${user.last_name}`);
        console.log(`Created: ${user.created_at}`);
        console.log(`Updated: ${user.updated_at}`);
      });
    } else {
      console.log('User not found in StaffUsers table');
    }

    // Also check in SuperAdminUsers table
    const superAdminResult = await pool.query(
      `
      SELECT id, email, is_active, created_at, updated_at, first_name, last_name
      FROM "SuperAdminUsers" 
      WHERE email = $1;
    `,
      ['heber+hvr_11@catalog.golf']
    );

    console.log('\n--- SuperAdminUsers Results ---');
    if (superAdminResult.rows.length > 0) {
      console.log('User found in SuperAdminUsers:');
      superAdminResult.rows.forEach(user => {
        console.log(`ID: ${user.id}`);
        console.log(`Email: ${user.email}`);
        console.log(`Is Active: ${user.is_active}`);
        console.log(`Name: ${user.first_name} ${user.last_name}`);
        console.log(`Created: ${user.created_at}`);
        console.log(`Updated: ${user.updated_at}`);
      });
    } else {
      console.log('User not found in SuperAdminUsers table');
    }

    // If found in StaffUsers, get course info
    if (staffUserResult.rows.length > 0) {
      const courseResult = await pool.query(
        `
        SELECT id, name, subdomain, status
        FROM "GolfCourseInstances" 
        WHERE id = $1;
      `,
        [staffUserResult.rows[0].course_id]
      );

      console.log('\n--- Associated Golf Course ---');
      if (courseResult.rows.length > 0) {
        const course = courseResult.rows[0];
        console.log(`Course ID: ${course.id}`);
        console.log(`Course Name: ${course.name}`);
        console.log(`Subdomain: ${course.subdomain}`);
        console.log(`Status: ${course.status}`);
        console.log(`Expected URL: https://${course.subdomain}.catalog.golf`);
      }
    }
  } catch (error) {
    console.error('Error checking user status:', error.message);
  } finally {
    await pool.end();
  }
}

checkUserStatus();
