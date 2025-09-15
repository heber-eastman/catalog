// Only load .env file in development - production uses ECS environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

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
  development: process.env.DATABASE_URL
    ? {
        url: process.env.DATABASE_URL,
        dialect: 'postgres',
        logging: false,
        define: {
          underscored: true,
          timestamps: true,
        },
        dialectOptions: {
          // No SSL for local development
        },
      }
    : {
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
  test: process.env.DATABASE_URL
    ? {
        url: process.env.DATABASE_URL,
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
      }
    : {
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
        pool: {
          max: 5, // Reduced from 10 to prevent pool exhaustion on small instance
          min: 1, // Keep minimum connections alive
          acquire: 10000, // Reduced from 30000 to fail faster
          idle: 30000, // Increased from 10000 to keep connections longer
          evict: 5000, // Add connection validation interval
        },
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
          // Removed statement_timeout and query_timeout as they may interfere
          // Let application handle timeouts instead
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
        pool: {
          max: 5, // Reduced from 10
          min: 1, // Keep minimum connections alive
          acquire: 10000, // Reduced from 30000
          idle: 30000, // Increased from 10000
          evict: 5000, // Add connection validation
        },
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        },
      },
};

console.log('NODE_ENV being used:', process.env.NODE_ENV || 'development');
const envToShow = process.env.NODE_ENV || 'development';
console.log(
  `Final config for ${envToShow}:`,
  JSON.stringify(config[envToShow], null, 2)
);

module.exports = config;
