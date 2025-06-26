const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
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

if (productionDbConfig) {
  console.log('Using parsed production DB config:', {
    host: productionDbConfig.host,
    port: productionDbConfig.port,
    database: productionDbConfig.database,
    username: productionDbConfig.username,
  });
}

// Create Sequelize instance
const sequelize = productionDbConfig
  ? new Sequelize({
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
    })
  : new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: console.log,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
    });

// Create Umzug instance for migrations
const umzug = new Umzug({
  migrations: {
    glob: path.join(__dirname, '../migrations/*.js'),
    resolve: ({ name, path, context }) => {
      const migration = require(path);
      return {
        name,
        up: async () => migration.up(context.queryInterface, context.Sequelize),
        down: async () =>
          migration.down(context.queryInterface, context.Sequelize),
      };
    },
  },
  context: {
    queryInterface: sequelize.getQueryInterface(),
    Sequelize,
  },
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

async function runMigrations() {
  try {
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('Database connection successful!');

    console.log('Running migrations...');
    const migrations = await umzug.up();

    if (migrations.length === 0) {
      console.log('No migrations to run');
    } else {
      console.log('Migrations completed:', migrations.map(m => m.name));
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