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
const {
  rateLimitMiddleware,
  strictRateLimitMiddleware,
} = require('./middleware/rateLimit');
const { extractSubdomainOptional } = require('./middleware/subdomain');

const app = express();

// CORS configuration
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
  });
});

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
