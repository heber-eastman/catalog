const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const signupRouter = require('./routes/signup');
const confirmRouter = require('./routes/confirm');
const customersRouter = require('./routes/customers');
const authRouter = require('./routes/auth');

const app = express();

app.use(morgan('combined'));
app.use(express.json());
app.use(cookieParser());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Basic root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Catalog API' });
});

// Mount routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1', signupRouter);
app.use('/api/v1', confirmRouter);
app.use('/api/v1', customersRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
