const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Determine if we're in production based on DATABASE_URL format
const isProduction =
  process.env.DATABASE_URL &&
  process.env.DATABASE_URL.includes('amazonaws.com');

// Database configuration
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: isProduction
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : {},
});

async function runMigrations() {
  try {
    console.log('🔄 Starting production migrations...');

    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Get all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort();

    console.log(`📁 Found ${migrationFiles.length} migration files`);

    // Create migrations table if it doesn't exist
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
        "name" VARCHAR(255) NOT NULL PRIMARY KEY
      )
    `);

    // Get already run migrations
    const [completedMigrations] = await sequelize.query(
      'SELECT name FROM "SequelizeMeta" ORDER BY name'
    );
    const completedNames = completedMigrations.map(m => m.name);

    console.log(`📋 Already completed: ${completedNames.length} migrations`);

    // Run pending migrations
    for (const file of migrationFiles) {
      if (completedNames.includes(file)) {
        console.log(`⏭️  Skipping ${file} (already completed)`);
        continue;
      }

      console.log(`🚀 Running migration: ${file}`);

      try {
        const migration = require(path.join(migrationsDir, file));
        await migration.up(sequelize.getQueryInterface(), Sequelize);

        // Mark as completed
        await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (?)', {
          replacements: [file],
        });

        console.log(`✅ Completed: ${file}`);
      } catch (error) {
        console.error(`❌ Failed migration ${file}:`, error.message);
        throw error;
      }
    }

    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
