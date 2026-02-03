require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { sequelize } = require('./config/database');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const scannerRoutes = require('./routes/scanner');
const tradeRoutes = require('./routes/trades');
const subscriptionRoutes = require('./routes/subscriptions');
const webhookRoutes = require('./routes/webhooks');
const calculatorRoutes = require('./routes/calculators');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration - support multiple origins
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3000', // Local development
  'https://localhost:3000', // Local development with HTTPS
  'https://trading-system-bx14.onrender.com', // Production frontend
  process.env.FRONTEND_URL, // Dynamic frontend URL from env
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing - raw for webhooks, json for everything else
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

// Database connection and server start
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Sync models (in production, use migrations)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Database models synchronized');
    }
    
    // Initialize master admin
    const { initializeMasterAdmin } = require('./utils/initAdmin');
    await initializeMasterAdmin();
    
    // Initialize default scanner strategies
    const { initializeDefaultStrategies } = require('./utils/initStrategies');
    await initializeDefaultStrategies();
    
    // Start cron jobs
    require('./services/scannerCron');
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
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
