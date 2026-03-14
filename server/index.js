require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { sequelize } = require('./config/database');
const logger = require('./utils/logger');
const wsService = require('./services/websocketService');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const scannerRoutes = require('./routes/scanner');
const tradeRoutes = require('./routes/trades');
const subscriptionRoutes = require('./routes/subscriptions');
const webhookRoutes = require('./routes/webhooks');
const calculatorRoutes = require('./routes/calculators');

// Phase 2 routes
const chatRoutes = require('./routes/chat');
const journalRoutes = require('./routes/journal');
const referralRoutes = require('./routes/referrals');
const notificationRoutes = require('./routes/notifications');
const calendarRoutes = require('./routes/calendar');
const goldScannerRoutes = require('./routes/goldScanner');
const adminRoutes = require('./routes/admin');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration - Production-grade multi-origin support
const buildAllowedOrigins = () => {
  const origins = [
    // Development
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'https://localhost:3000',
    'https://localhost:5173',
    // Production
    'https://trading-system-bx14.onrender.com',
    'https://system-100-frontend.onrender.com',
  ];

  // Add environment-specific origins
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  if (process.env.CLIENT_URL) {
    origins.push(process.env.CLIENT_URL);
  }

  return [...new Set(origins)].filter(Boolean);
};

const allowedOrigins = buildAllowedOrigins();

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV === 'development') {
      // Allow all in development
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
}));

// Log allowed origins for debugging
if (process.env.NODE_ENV === 'development') {
  logger.info(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
}

// Rate limiting - separate limits for auth vs general API
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 login/register attempts per 15 min
  message: { success: false, message: 'Too many login attempts, please try again later' }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 300 // generous in dev
});

app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

// Body parsing - raw for webhooks, json for everything else
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/scanner', scannerRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/calculators', calculatorRoutes);
app.use('/api/data-sources', require('./routes/dataSources'));
app.use('/api/market-data', require('./routes/marketData'));
app.use('/api/signals', require('./routes/signals'));
app.use('/api/analytics', require('./routes/analytics'));

// Phase 2 API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/gold-scanner', goldScannerRoutes);
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  
  // Never forward external-service status codes (e.g. Stripe 401) as our own
  // Only use err.statusCode if it was explicitly set by OUR code (4xx range)
  // External SDK errors (Stripe, etc.) set statusCode from THEIR API responses
  const isOurError = err.statusCode && !err.type; // Stripe errors have .type
  const statusCode = isOurError ? err.statusCode : (err.status || 500);
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Internal Server Error' : message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

// Create HTTP server for WebSocket support
const server = http.createServer(app);

// Database connection and server start
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Pre-sync ENUM migrations (PostgreSQL ENUMs can't be altered via sync)
    // ALTER TYPE ADD VALUE cannot run inside a transaction block
    try {
      const [enumExists] = await sequelize.query(
        `SELECT 1 FROM pg_type WHERE typname = 'enum_TradeJournals_direction'`,
        { type: sequelize.QueryTypes.SELECT }
      );
      if (enumExists) {
        const pg = await sequelize.connectionManager.getConnection({ type: 'write' });
        try {
          await pg.query(`ALTER TYPE "enum_TradeJournals_direction" ADD VALUE IF NOT EXISTS 'long'`);
          await pg.query(`ALTER TYPE "enum_TradeJournals_direction" ADD VALUE IF NOT EXISTS 'short'`);
          logger.info('ENUM migration: added long/short to TradeJournals direction');
        } finally {
          sequelize.connectionManager.releaseConnection(pg);
        }
      }
    } catch (enumErr) {
      logger.warn('ENUM migration skipped:', enumErr.message);
    }

    // Sync models (in production, use migrations)
    if (process.env.NODE_ENV === 'development') {
      try {
        await sequelize.sync({ alter: true });
        logger.info('Database models synchronized');
      } catch (syncErr) {
        // Constraint/column-already-exists errors are non-fatal during alter sync
        logger.warn('Database sync warning (non-fatal):', syncErr.message);
        // Fall back to basic sync (create missing tables only)
        await sequelize.sync();
        logger.info('Database models synchronized (basic)');
      }
    }
    
    // Initialize master admin
    const { initializeMasterAdmin } = require('./utils/initAdmin');
    await initializeMasterAdmin();
    
    // Initialize default scanner strategies
    const { initializeDefaultStrategies } = require('./utils/initStrategies');
    await initializeDefaultStrategies();
    
    // Phase 2: Initialize WebSocket
    wsService.initialize(server);
    logger.info('WebSocket service started');

    // Phase 2: Initialize default chat rooms
    const { initializeDefaultChatRooms } = require('./utils/initChatRooms');
    await initializeDefaultChatRooms();

    // Phase 2: Start gold scanner cron
    const { startGoldScannerCron } = require('./services/goldScannerCron');
    startGoldScannerCron();

    // Start cron jobs
    require('./services/scannerCron');
    
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
      logger.info(`WebSocket ready on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Unable to start server:', error);
    
    // Provide helpful error messages
    if (error.name === 'SequelizeConnectionError') {
      console.error('\n❌ DATABASE CONNECTION ERROR\n');
      console.error('Please ensure:');
      console.error('1. PostgreSQL is installed and running');
      console.error('2. Database credentials in .env are correct:');
      console.error('   - DB_HOST=' + (process.env.DB_HOST || 'localhost'));
      console.error('   - DB_PORT=' + (process.env.DB_PORT || '5432'));
      console.error('   - DB_NAME=' + (process.env.DB_NAME || 'trading_platform'));
      console.error('   - DB_USER=' + (process.env.DB_USER || 'postgres'));
      console.error('   - DB_PASSWORD=<your-password>');
      console.error('\n3. Create database first: createdb trading_platform\n');
      console.error('See SETUP.md for database setup instructions.\n');
    }
    
    process.exit(1);
  }
};

startServer();

module.exports = app;
