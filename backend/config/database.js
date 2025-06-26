require('dotenv').config();

console.log('Database config loading...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL is set:', !!process.env.DATABASE_URL);
console.log(
  'DATABASE_URL length:',
  process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0
);

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

if (productionDbConfig) {
  console.log('Parsed production DB config:', {
    host: productionDbConfig.host,
    port: productionDbConfig.port,
    database: productionDbConfig.database,
    username: productionDbConfig.username,
  });
}

const config = {
  development: {
    url: process.env.DATABASE_URL,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'catalog_dev',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
    },
  },
  test: {
    url: process.env.DATABASE_URL,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.TEST_DB_NAME || 'catalog_test',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
  production: productionDbConfig
    ? {
        username: productionDbConfig.username,
        password: productionDbConfig.password,
        database: productionDbConfig.database,
        host: productionDbConfig.host,
        port: productionDbConfig.port,
        dialect: 'postgres',
        logging: false,
        define: {
          underscored: true,
          timestamps: true,
        },
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        },
      }
    : {
        use_env_variable: 'DATABASE_URL',
        dialect: 'postgres',
        logging: false,
        define: {
          underscored: true,
          timestamps: true,
        },
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        },
      },
};

console.log('Final config for production:', JSON.stringify(config.production, null, 2));

module.exports = config;
