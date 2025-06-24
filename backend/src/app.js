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
const authRouter = require('./routes/auth');
const healthRouter = require('./routes/health');
const {
  rateLimitMiddleware,
  strictRateLimitMiddleware,
} = require('./middleware/rateLimit');
const { extractSubdomainOptional } = require('./middleware/subdomain');

const app = express();

// CORS configuration - Updated for deployed frontend
const allowedOrigins = [
  'http://localhost:5173', 
  'http://localhost:3000',
  'http://catalog-golf-frontend-simple-1750793998.s3-website-us-east-1.amazonaws.com',
  'https://d2knix92k5b40.cloudfront.net'
];

// Filter out empty origins
const validOrigins = allowedOrigins.filter(origin => origin && !origin.includes('PLACEHOLDER'));

app.use(
  cors({
    origin: validOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  })
);

app.use(morgan('combined'));
app.use(express.json());
app.use(cookieParser());

// Add rate limiting middleware
app.use(rateLimitMiddleware);

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
app.use('/api/v1', strictRateLimitMiddleware, signupRouter); // Stricter rate limiting for signup
app.use('/api/v1', confirmRouter);
app.use('/api/v1', customersRouter);
app.use('/api/v1', notesRouter);
app.use('/api/v1/staff', staffRouter);
app.use('/api/v1/super-admin', superAdminsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
