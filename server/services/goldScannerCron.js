/**
 * Phase 2: Gold Scanner Cron
 * Runs gold scanner, market data pipeline, calendar sync at regular intervals
 */
const cron = require('node-cron');
const goldScannerService = require('./goldScannerService');
const economicCalendarService = require('./economicCalendarService');
const marketDataService = require('./marketDataService');
const logger = require('../utils/logger');

const startGoldScannerCron = () => {
  // ── Market data pipeline every 2 minutes ─────────────────────
  cron.schedule('*/2 * * * *', async () => {
    try {
      await marketDataService.fetchAll();
    } catch (error) {
      logger.error('Market data cron error:', error);
    }
  });

  // ── Gold scanner every 5 minutes ─────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      logger.info('Gold scanner cron triggered');
      await goldScannerService.scan();
    } catch (error) {
      logger.error('Gold scanner cron error:', error);
    }
  });

  // ── Refresh economic calendar every 10 minutes ───────────────
  cron.schedule('*/10 * * * *', async () => {
    try {
      await economicCalendarService.fetchEvents();
      logger.debug('Economic calendar refreshed');
    } catch (error) {
      logger.error('Calendar cron error:', error);
    }
  });

  // ── Check for upcoming high-impact events every minute ───────
  cron.schedule('* * * * *', async () => {
    try {
      if (economicCalendarService.events.length > 0) {
        economicCalendarService.checkUpcomingAlerts(economicCalendarService.events);
      }
    } catch (error) {
      logger.error('Calendar alert check error:', error);
    }
  });

  // ── Cleanup old market data daily at 02:00 UTC ───────────────
  cron.schedule('0 2 * * *', async () => {
    try {
      await marketDataService.cleanOldData();
      logger.info('Old market data cleaned up');
    } catch (error) {
      logger.error('Market data cleanup error:', error);
    }
  });

  logger.info('Phase 2 cron jobs started (market data, gold scanner, calendar)');
};

module.exports = { startGoldScannerCron };
