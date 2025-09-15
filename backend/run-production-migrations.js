const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Production database connection
const sequelize = new Sequelize(
  'postgresql://catalogadmin:CatalogDB2025!@catalog-golf-db.ckl6kk2cysrq.us-east-1.rds.amazonaws.com:5432/postgres',
  {
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  }
);

async function runMigrations() {
  try {
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful');

    // Check if SequelizeMeta table exists
    const [results] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'SequelizeMeta'
      );
    `);

    if (!results[0].exists) {
      console.log('Creating SequelizeMeta table...');
      await sequelize.query(`
        CREATE TABLE "SequelizeMeta" (
          "name" VARCHAR(255) NOT NULL PRIMARY KEY
        );
      `);
    }

    // List migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort();

    console.log('Found migration files:', migrationFiles);

    // Check which migrations have been run
    const [executedMigrations] = await sequelize.query(
      'SELECT name FROM "SequelizeMeta"'
    );
    const executedNames = executedMigrations.map(m => m.name);

    console.log('Already executed migrations:', executedNames);

    // Run pending migrations
    for (const file of migrationFiles) {
      if (!executedNames.includes(file)) {
        console.log(`\n🔄 Running migration: ${file}`);

        const migration = require(path.join(migrationsDir, file));
        await migration.up(sequelize.getQueryInterface(), Sequelize);

        // Record the migration as executed
        await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (?)', {
          replacements: [file],
        });

        console.log(`✅ Migration ${file} completed`);
      } else {
        console.log(`⏭️  Skipping already executed migration: ${file}`);
      }
    }

    console.log('\n🎉 All migrations completed successfully!');

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

runMigrations();
