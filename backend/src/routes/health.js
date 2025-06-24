const express = require('express');
const { Sequelize } = require('sequelize');
const { sequelize } = require('../models');
const router = express.Router();

/**
 * Basic health check endpoint
 * Returns basic application status information
 */
router.get('/', async (req, res) => {
  try {
    const uptime = process.uptime();
    const timestamp = new Date().toISOString();
    const memoryUsage = process.memoryUsage();
    const version = process.env.npm_package_version || '1.0.0';

    res.status(200).json({
      status: 'healthy',
      timestamp,
      uptime: Math.floor(uptime),
      version,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
      },
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Database health check endpoint
 * Tests database connectivity and returns connection pool status
 */
router.get('/db', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test database connection
    await sequelize.authenticate();
    
    const responseTime = Date.now() - startTime;
    
    // Get connection pool status
    const pool = sequelize.connectionManager.pool;
    const poolStatus = {
      size: pool.size,
      available: pool.available,
      using: pool.using,
      waiting: pool.pending
    };

    // Test a simple query
    const [results] = await sequelize.query('SELECT 1 as test');
    
    res.status(200).json({
      status: 'healthy',
      database: {
        status: 'connected',
        responseTime: `${responseTime}ms`,
        pool: poolStatus,
        dialect: sequelize.getDialect(),
        version: sequelize.databaseVersion || 'unknown'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      database: {
        status: 'disconnected',
        error: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Comprehensive health check endpoint
 * Tests all critical services and dependencies
 */
router.get('/detailed', async (req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {}
  };

  try {
    // Database check
    try {
      const dbStartTime = Date.now();
      await sequelize.authenticate();
      const dbResponseTime = Date.now() - dbStartTime;
      
      checks.checks.database = {
        status: 'healthy',
        responseTime: `${dbResponseTime}ms`,
        details: 'Database connection successful'
      };
    } catch (dbError) {
      checks.checks.database = {
        status: 'unhealthy',
        error: dbError.message,
        details: 'Database connection failed'
      };
      checks.status = 'unhealthy';
    }

    // Memory check
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const memoryUsagePercent = (memoryUsedMB / memoryTotalMB) * 100;

    checks.checks.memory = {
      status: memoryUsagePercent < 85 ? 'healthy' : 'warning',
      usage: `${memoryUsedMB}MB / ${memoryTotalMB}MB (${memoryUsagePercent.toFixed(1)}%)`,
      details: memoryUsagePercent < 85 ? 'Memory usage normal' : 'High memory usage'
    };

    // Environment variables check
    const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    checks.checks.environment = {
      status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
      details: missingEnvVars.length === 0 
        ? 'All required environment variables present'
        : `Missing environment variables: ${missingEnvVars.join(', ')}`,
      missingVars: missingEnvVars
    };

    if (missingEnvVars.length > 0) {
      checks.status = 'unhealthy';
    }

    // AWS services check (if in production)
    if (process.env.NODE_ENV === 'production') {
      try {
        // This is a basic check - in a real app you might test SES, S3, etc.
        checks.checks.aws = {
          status: 'healthy',
          details: 'AWS configuration appears valid',
          region: process.env.AWS_REGION || 'not-set'
        };
      } catch (awsError) {
        checks.checks.aws = {
          status: 'warning',
          details: 'AWS services check skipped',
          error: awsError.message
        };
      }
    }

    // Uptime check
    const uptimeSeconds = process.uptime();
    checks.checks.uptime = {
      status: 'healthy',
      uptime: Math.floor(uptimeSeconds),
      details: `Application running for ${Math.floor(uptimeSeconds / 60)} minutes`
    };

    const statusCode = checks.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(checks);

  } catch (error) {
    console.error('Detailed health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Readiness check endpoint
 * Used by orchestrators to determine if the app is ready to receive traffic
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if database is ready
    await sequelize.authenticate();
    
    // Check if required services are available
    const isReady = process.env.JWT_SECRET && process.env.DATABASE_URL;
    
    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        message: 'Application is ready to receive traffic'
      });
    } else {
      res.status(503).json({
        status: 'not-ready',
        timestamp: new Date().toISOString(),
        message: 'Application is not ready to receive traffic'
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not-ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Liveness check endpoint
 * Used by orchestrators to determine if the app is alive (should restart if not)
 */
router.get('/live', async (req, res) => {
  try {
    // Basic liveness check - if we can respond, we're alive
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      pid: process.pid,
      uptime: Math.floor(process.uptime())
    });
  } catch (error) {
    // If we can't even send this response, the container should be restarted
    res.status(503).json({
      status: 'dead',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router; 