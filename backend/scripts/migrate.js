const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

// Parse DATABASE_URL for production
const parseDatabaseUrl = url => {
  if (!url) return null;

  const match = url.match(
    /^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/
  );
  if (!match) return null;

  const [, username, password, host, port, database] = match;
  return { username, password, host, port: parseInt(port), database };
};

const productionDbConfig = process.env.DATABASE_URL
  ? parseDatabaseUrl(process.env.DATABASE_URL)
  : null;

console.log('Migration script starting...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL is set:', !!process.env.DATABASE_URL);

// Debug ALL environment variables that might affect database connection
const dbEnvVars = Object.keys(process.env).filter(
  key =>
    key.includes('DB') ||
    key.includes('DATABASE') ||
    key.includes('POSTGRES') ||
    key.includes('PG')
);
console.log('Database-related environment variables:');
dbEnvVars.forEach(key => {
  const value = process.env[key];
  if (key.includes('PASSWORD') || key.includes('PASS')) {
    console.log(`${key}: [HIDDEN]`);
  } else {
    console.log(`${key}: ${value}`);
  }
});

if (productionDbConfig) {
  console.log('Using parsed production DB config:', {
    host: productionDbConfig.host,
    port: productionDbConfig.port,
    database: productionDbConfig.database,
    username: productionDbConfig.username,
  });
}

// Create Sequelize instance
let sequelize;

if (productionDbConfig) {
  const sequelizeConfig = {
    username: productionDbConfig.username,
    password: productionDbConfig.password,
    database: productionDbConfig.database,
    host: productionDbConfig.host,
    port: productionDbConfig.port,
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  };
  console.log('Creating Sequelize with config:', {
    ...sequelizeConfig,
    password: '[HIDDEN]',
  });

  sequelize = new Sequelize(sequelizeConfig);
} else {
  console.log(
    'Creating Sequelize with DATABASE_URL:',
    process.env.DATABASE_URL
  );
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  });
}

async function createMigrationsTable() {
  const queryInterface = sequelize.getQueryInterface();

  // Create SequelizeMeta table if it doesn't exist
  await queryInterface.createTable('SequelizeMeta', {
    name: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
      primaryKey: true,
    },
  });
}

async function getExecutedMigrations() {
  try {
    const [results] = await sequelize.query(
      'SELECT name FROM "SequelizeMeta" ORDER BY name'
    );
    return results.map(row => row.name);
  } catch (error) {
    console.log('SequelizeMeta table does not exist, will create it');
    return [];
  }
}

async function markMigrationAsExecuted(migrationName) {
  await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (?)', {
    replacements: [migrationName],
    type: Sequelize.QueryTypes.INSERT,
  });
}

async function runMigrations() {
  try {
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('Database connection successful!');

    console.log('Creating migrations table if needed...');
    await createMigrationsTable();

    console.log('Getting executed migrations...');
    const executedMigrations = await getExecutedMigrations();
    console.log('Already executed migrations:', executedMigrations);

    // Get all migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort();

    console.log('Available migration files:', migrationFiles);

    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    );

    if (pendingMigrations.length === 0) {
      console.log('No migrations to run');
    } else {
      console.log('Running pending migrations:', pendingMigrations);

      for (const migrationFile of pendingMigrations) {
        console.log(`Running migration: ${migrationFile}`);

        const migrationPath = path.join(migrationsDir, migrationFile);
        const migration = require(migrationPath);

        // Run the migration
        await migration.up(sequelize.getQueryInterface(), Sequelize);

        // Mark as executed
        await markMigrationAsExecuted(migrationFile);

        console.log(`Completed migration: ${migrationFile}`);
      }

      console.log('All migrations completed successfully');
    }

    await sequelize.close();
    console.log('Migration script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await sequelize.close();
    process.exit(1);
  }
}

runMigrations();
