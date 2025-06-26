const { Client } = require('pg');

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

console.log('Connection test starting...');
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

// Check system networking
console.log('Checking system networking...');
console.log('hostname:', require('os').hostname());
console.log('network interfaces:', Object.keys(require('os').networkInterfaces()));

if (productionDbConfig) {
  console.log('Using parsed production DB config:', {
    host: productionDbConfig.host,
    port: productionDbConfig.port,
    database: productionDbConfig.database,
    username: productionDbConfig.username,
  });
}

// Test with raw pg client
async function testConnection() {
  let client;

  try {
    if (productionDbConfig) {
      console.log('Creating pg client with explicit config...');
      client = new Client({
        user: productionDbConfig.username,
        password: productionDbConfig.password,
        host: productionDbConfig.host,
        port: productionDbConfig.port,
        database: productionDbConfig.database,
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      });
    } else {
      console.log('Creating pg client with DATABASE_URL...');
      client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      });
    }

    console.log('Attempting to connect...');
    await client.connect();
    console.log('✅ Database connection successful!');

    // Test a simple query
    const result = await client.query('SELECT version()');
    console.log('✅ Database query successful:', result.rows[0].version);

    await client.end();
    console.log('✅ Connection test completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    if (client) {
      try {
        await client.end();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    process.exit(1);
  }
}

testConnection();
