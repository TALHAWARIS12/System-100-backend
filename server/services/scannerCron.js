const cron = require('node-cron');
const scannerEngine = require('./scannerEngine');
const logger = require('../utils/logger');

// Run scanner every hour
cron.schedule('0 * * * *', async () => {
  logger.info('Cron: Starting scheduled scanner run');
  await scannerEngine.runScanner();
});

// Clean up expired signals every 6 hours
cron.schedule('0 */6 * * *', async () => {
  logger.info('Cron: Cleaning up expired signals');
  await scannerEngine.cleanupExpiredSignals();
});

logger.info('Scanner cron jobs initialized');

module.exports = { scannerEngine };
