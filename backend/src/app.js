const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const signupRouter = require('./routes/signup');
const confirmRouter = require('./routes/confirm');
const customersRouter = require('./routes/customers');
const notesRouter = require('./routes/notes');
const staffRouter = require('./routes/staff');
const superAdminsRouter = require('./routes/super-admins');
const teeSheetsRouter = require('./routes/teeSheets');
const internalRouter = require('./routes/internal');
const availabilityRouter = require('./routes/availability');
const holdsRouter = require('./routes/holds');
const bookingsRouter = require('./routes/bookings');
const authRouter = require('./routes/auth');
const healthRouter = require('./routes/health');
const { rateLimitMiddleware } = require('./middleware/rateLimit');
const { extractSubdomainOptional } = require('./middleware/subdomain');

const app = express();

// Trust proxy for load balancer (fixes rate limiting X-Forwarded-For header warning)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// CORS configuration - Updated for deployed frontend
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'https://app.catalog.golf', // Production frontend domain
  'http://catalog-golf-frontend-simple-1750793998.s3-website-us-east-1.amazonaws.com',
  'https://d2knix92k5b40.cloudfront.net',
];

// Filter out empty origins
const validOrigins = allowedOrigins.filter(
  origin => origin && !origin.includes('PLACEHOLDER')
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check if origin is in the allowed list
      if (validOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Check if origin is a valid catalog.golf subdomain
      if (origin.match(/^https:\/\/[a-zA-Z0-9-]+\.catalog\.golf$/)) {
        return callback(null, true);
      }

      // Reject other origins
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  })
);

app.use(morgan('combined'));
app.use(express.json());
app.use(cookieParser());

// Add rate limiting middleware (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.use(rateLimitMiddleware);
}

// Add subdomain extraction for optional use
app.use(extractSubdomainOptional);

// Health check endpoints (no rate limiting)
app.use('/health', healthRouter);
app.use('/api/v1/health', healthRouter);

// Basic root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Backend API is running!',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/signup', signupRouter);
app.use('/api/v1', confirmRouter);
app.use('/api/v1', customersRouter);
app.use('/api/v1', notesRouter);
app.use('/api/v1/staff', staffRouter);
app.use('/api/v1/super-admin', superAdminsRouter);
app.use('/api/v1', teeSheetsRouter);
app.use('/api/v1', availabilityRouter);
app.use('/api/v1', holdsRouter);
app.use('/api/v1', bookingsRouter);
app.use('/', internalRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
