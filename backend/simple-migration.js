const { Sequelize } = require('sequelize');

// Use environment variables that will be available in the container
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});

async function createTables() {
  try {
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful');

    // Create SequelizeMeta table if it doesn't exist
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
        "name" VARCHAR(255) NOT NULL PRIMARY KEY
      );
    `);

    // Create GolfCourseInstances table
    console.log('Creating GolfCourseInstances table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "GolfCourseInstances" (
        "id" UUID PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "street" VARCHAR(255) NOT NULL,
        "city" VARCHAR(255) NOT NULL,
        "state" VARCHAR(255) NOT NULL,
        "postal_code" VARCHAR(255) NOT NULL,
        "country" VARCHAR(255) NOT NULL,
        "subdomain" VARCHAR(255) UNIQUE NOT NULL,
        "status" VARCHAR(255) NOT NULL DEFAULT 'Pending',
        "date_created" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Create StaffUsers table
    console.log('Creating StaffUsers table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "StaffUsers" (
        "id" SERIAL PRIMARY KEY,
        "course_id" UUID NOT NULL REFERENCES "GolfCourseInstances"("id") ON DELETE CASCADE,
        "email" VARCHAR(255) UNIQUE NOT NULL,
        "password" VARCHAR(255) NOT NULL,
        "first_name" VARCHAR(255) NOT NULL,
        "last_name" VARCHAR(255) NOT NULL,
        "role" VARCHAR(255) NOT NULL DEFAULT 'Staff',
        "is_active" BOOLEAN NOT NULL DEFAULT false,
        "invitation_token" VARCHAR(255),
        "invited_at" TIMESTAMP WITH TIME ZONE,
        "token_expires_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Create Customers table
    console.log('Creating Customers table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "Customers" (
        "id" SERIAL PRIMARY KEY,
        "course_id" UUID NOT NULL REFERENCES "GolfCourseInstances"("id") ON DELETE CASCADE,
        "email" VARCHAR(255) NOT NULL,
        "first_name" VARCHAR(255) NOT NULL,
        "last_name" VARCHAR(255) NOT NULL,
        "phone" VARCHAR(255),
        "date_of_birth" DATE,
        "gender" VARCHAR(255),
        "address" VARCHAR(255),
        "city" VARCHAR(255),
        "state" VARCHAR(255),
        "postal_code" VARCHAR(255),
        "country" VARCHAR(255),
        "member_since" TIMESTAMP WITH TIME ZONE,
        "membership_type" VARCHAR(255),
        "notes" TEXT,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE("course_id", "email")
      );
    `);

    // Create CustomerNotes table
    console.log('Creating CustomerNotes table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "CustomerNotes" (
        "id" SERIAL PRIMARY KEY,
        "customer_id" INTEGER NOT NULL REFERENCES "Customers"("id") ON DELETE CASCADE,
        "staff_user_id" INTEGER NOT NULL REFERENCES "StaffUsers"("id") ON DELETE CASCADE,
        "note" TEXT NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Create SuperAdminUsers table
    console.log('Creating SuperAdminUsers table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "SuperAdminUsers" (
        "id" SERIAL PRIMARY KEY,
        "email" VARCHAR(255) UNIQUE NOT NULL,
        "password_hash" VARCHAR(255) NOT NULL,
        "first_name" VARCHAR(255) NOT NULL,
        "last_name" VARCHAR(255) NOT NULL,
        "phone" VARCHAR(255),
        "is_active" BOOLEAN NOT NULL DEFAULT false,
        "invitation_token" VARCHAR(255),
        "invited_at" TIMESTAMP WITH TIME ZONE,
        "token_expires_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Record migrations as executed
    const migrations = [
      '20250612171419-create-golfcourseinstance.js',
      '20250612171421-create-staffuser.js',
      '20250612171422-create-customer.js',
      '20250612171423-add-primary-admin-foreign-key.js',
      '20250612171424-create-customer-notes.js',
      '20250617200000-create-super-admin-user.js',
    ];

    for (const migration of migrations) {
      await sequelize.query(
        `
        INSERT INTO "SequelizeMeta" (name) VALUES (?)
        ON CONFLICT (name) DO NOTHING
      `,
        {
          replacements: [migration],
        }
      );
    }

    console.log('✅ All tables created successfully!');

    // List all tables
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('\n📊 Tables in database:');
    tables.forEach(table => console.log(`  - ${table.table_name}`));
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

createTables();
