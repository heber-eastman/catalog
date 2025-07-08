const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting production database migration...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Database URL set:', !!process.env.DATABASE_URL);

try {
  // Set NODE_ENV to production to ensure we use the right config
  process.env.NODE_ENV = 'production';
  
  console.log('📋 Running database migrations...');
  
  // Run the migrations using npx to ensure we have the right version
  const result = execSync('npx sequelize-cli db:migrate', {
    cwd: __dirname,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
  
  console.log('✅ Database migrations completed successfully!');
  process.exit(0);
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.error('Error details:', error);
  process.exit(1);
}
