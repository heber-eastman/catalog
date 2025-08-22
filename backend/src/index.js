// Only load .env file in development - production uses ECS environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

console.log('🚀 APPLICATION STARTING...');
console.log('🌐 NODE_ENV:', process.env.NODE_ENV);
console.log('💾 DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('📨 EMAIL_QUEUE_URL exists:', !!process.env.EMAIL_QUEUE_URL);
console.log('🔑 JWT_SECRET exists:', !!process.env.JWT_SECRET);

const app = require('./app');
const { startTeeSheetCron } = require('./services/teeSheetCron');

const PORT = process.env.PORT || 3000;

// Start server
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log('Press CTRL+C to stop');
    // Start tee sheet cron if enabled
    try {
      const cronTask = startTeeSheetCron();
      if (cronTask && cronTask.start) cronTask.start();
    } catch (e) {
      console.error('Failed to start tee sheet cron', e);
    }
  });
}

module.exports = app;
