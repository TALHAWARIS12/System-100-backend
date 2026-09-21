/**
 * Phase 3: Staggered Background Scanning Engine
 * Coordinates background scans for:
 *   1. Gold Scanner (XAU/USD)
 *   2. Multi-Asset Trades Hub (Forex, Crypto, Indices)
 * Across mandatory timeframes: 15m, 1h, 4h
 *
 * Implements staggered execution to prevent simultaneous API overload,
 * job locks to prevent overlapping runs, and graceful error logging.
 */
const cron = require('node-cron');
const logger = require('../utils/logger');
const goldScannerService = require('./goldScannerService');
const multiAssetService = require('./multiAssetService');
const cryptoMarketService = require('./cryptoMarketService');
const marketDataService = require('./marketDataService');

class BackgroundScannerJob {
  constructor() {
    this.isGoldScanning = false;
    this.isMultiAssetScanning = false;
    this.isMarketDataFetching = false;
    this.cronTasks = [];
  }

  /**
   * Start staggered background schedules
   */
  startSchedules() {
    logger.info('⏰ BackgroundScannerJob: Initializing staggered background scan schedules...');

    // 1. Market Data Fetcher — Runs every 5 minutes (offset at :00, :05, :10...)
    const marketTask = cron.schedule('*/5 * * * *', async () => {
      if (this.isMarketDataFetching) return;
      this.isMarketDataFetching = true;
      try {
        await marketDataService.fetchAll();
        await cryptoMarketService.fetchAllCryptoPrices();
      } catch (err) {
        logger.error('Background market data fetch error:', err.message);
      } finally {
        this.isMarketDataFetching = false;
      }
    });
    this.cronTasks.push(marketTask);

    // 2. Gold Scanner Cycle — Runs every 10 minutes (offset at :02, :12, :22...)
    const goldTask = cron.schedule('2-59/10 * * * *', async () => {
      if (this.isGoldScanning) {
        logger.debug('BackgroundScannerJob: Skipping Gold Scan — previous run active');
        return;
      }
      this.isGoldScanning = true;
      try {
        await goldScannerService.scan();
      } catch (err) {
        logger.error('Background Gold Scan error:', err.message);
      } finally {
        this.isGoldScanning = false;
      }
    });
    this.cronTasks.push(goldTask);

    // 3. Multi-Asset Hub Cycle — Runs every 15 minutes (offset at :04, :19, :34, :49...)
    const multiAssetTask = cron.schedule('4,19,34,49 * * * *', async () => {
      if (this.isMultiAssetScanning) {
        logger.debug('BackgroundScannerJob: Skipping Multi-Asset Scan — previous run active');
        return;
      }
      this.isMultiAssetScanning = true;
      try {
        await multiAssetService.scanAllAssets();
      } catch (err) {
        logger.error('Background Multi-Asset Scan error:', err.message);
      } finally {
        this.isMultiAssetScanning = false;
      }
    });
    this.cronTasks.push(multiAssetTask);

    logger.info('🚀 BackgroundScannerJob: All background jobs scheduled successfully.');
  }

  /**
   * Stop all scheduled cron tasks
   */
  stopSchedules() {
    this.cronTasks.forEach(task => task.stop());
    this.cronTasks = [];
    logger.info('BackgroundScannerJob: All tasks stopped.');
  }
}

const instance = new BackgroundScannerJob();
module.exports = instance;
