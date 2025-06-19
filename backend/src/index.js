require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

// Start server
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log('Press CTRL+C to stop');
  });
}

module.exports = app;
