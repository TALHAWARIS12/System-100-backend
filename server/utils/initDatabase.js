/**
 * Database Initialization & Fix Script
 * Ensures all scanner configurations are properly set up
 * Syncs database schema with updated models
 */

const { ScannerConfig, ScannerResult, Signal, Candle,Notification } = require('../models');
const logger = require('./logger');

async function initDatabase() {
  try {
    logger.info('🔧 Starting database initialization...');

    // Sync all models with database (add missing columns)
    logger.info('📊 Syncing database schema...');
    await ScannerConfig.sync({ alter: true });
    await ScannerResult.sync({ alter: true });
    await Signal.sync({ alter: true });
    await Candle.sync({ alter: true });
    logger.info('✅ Database schema synced');

    // Initialize default scanner configurations
    await initializeScannerConfigs();

    // Clean up old expired signals
    await cleanupExpiredSignals();

    logger.info('✅ Database initialization complete');
    return true;
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    throw error;
  }
}

async function initializeScannerConfigs() {
  try {
    logger.info('⚙️  Initializing scanner configurations...');

    const configs = [
      {
        strategyName: 'rsiOversold',
        description: 'RSI Oversold/Overbought Strategy - Forex & Commodities',
        pairs: ['EURUSD', 'GBPUSD', 'GBPJPY', 'XAUUSD', 'XAGUSD', 'US30USD'],
        timeframes: ['1h', '4h', '1d'],
        isEnabled: true,
        scanInterval: 60,
        rules: { rsiOverbought: 70, rsiOversold: 30 }
      },
      {
        strategyName: 'macdCrossover',
        description: 'MACD Crossover Strategy - All Assets',
        pairs: ['EURUSD', 'GBPUSD', 'GBPJPY', 'XAUUSD', 'XAGUSD', 'US30USD', 'BTCUSD', 'ETHUSD'],
        timeframes: ['4h', '1d'],
        isEnabled: true,
        scanInterval: 120,
        rules: { minHistogram: 0 }
      },
      {
        strategyName: 'movingAverageCross',
        description: 'MA Crossover - Forex & Commodities',
        pairs: ['EURUSD', 'GBPUSD', 'GBPJPY', 'XAUUSD', 'XAGUSD'],
        timeframes: ['4h', '1d'],
        isEnabled: true,
        scanInterval: 120,
        rules: { fastMA: 20, slowMA: 50 }
      },
      {
        strategyName: 'cryptoMomentum',
        description: 'Crypto Momentum Strategy - BTC & ETH',
        pairs: ['BTCUSD', 'ETHUSD'],
        timeframes: ['1h', '4h', '1d'],
        isEnabled: true,
        scanInterval: 30,
        rules: { rsiOverbought: 70, rsiOversold: 30, minHistogram: 0 }
      },
      {
        strategyName: 'commoditiesScanner',
        description: 'Commodities Scanner - Gold & Silver',
        pairs: ['XAUUSD', 'XAGUSD'],
        timeframes: ['1h', '4h', '1d'],
        isEnabled: true,
        scanInterval: 60,
        rules: { rsiOverbought: 70, rsiOversold: 30 }
      },
      {
        strategyName: 'indicesScanner',
        description: 'Indices Scanner - US30',
        pairs: ['US30USD'],
        timeframes: ['1h', '4h', '1d'],
        isEnabled: true,
        scanInterval: 60,
        rules: { rsiOverbought: 70, rsiOversold: 30 }
      },
      {
        strategyName: 'supportResistance',
        description: 'Support/Resistance Strategy',
        pairs: ['EURUSD', 'GBPUSD', 'XAUUSD'],
        timeframes: ['4h', '1d'],
        isEnabled: true,
        scanInterval: 120,
        rules: { lookback: 20, threshold: 2 }
      },
      {
        strategyName: 'bollingerBreakout',
        description: 'Bollinger Band Breakout Strategy',
        pairs: ['EURUSD', 'GBPUSD', 'BTCUSD'],
        timeframes: ['1h', '4h'],
        isEnabled: true,
        scanInterval: 60,
        rules: { period: 20, stdDev: 2 }
      }
    ];

    for (const config of configs) {
      const [scannerConfig, created] = await ScannerConfig.findOrCreate({
        where: { strategyName: config.strategyName },
        defaults: config
      });

      if (!created) {
        // Update existing config
        await scannerConfig.update(config);
      }

      logger.info(`✅ Scanner config: ${config.strategyName} (enabled: ${config.isEnabled})`);
    }

    logger.info('✅ All scanner configurations initialized');
  } catch (error) {
    logger.error('❌ Failed to initialize scanner configs:', error);
    throw error;
  }
}

async function cleanupExpiredSignals() {
  try {
    logger.info('🧹 Cleaning up expired signals...');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Clean up old signals
    const deletedCount = await ScannerResult.destroy({
      where: {
        createdAt: { [require('sequelize').Op.lt]: sevenDaysAgo }
      }
    });

    if (deletedCount > 0) {
      logger.info(`✅ Cleaned up ${deletedCount} old scanner results`);
    }

    // Invalidate expired signals
    const expiredCount = await ScannerResult.update(
      { isActive: false },
      {
        where: {
          expiresAt: { [require('sequelize').Op.lt]: new Date() }
        }
      }
    );

    if (expiredCount > 0) {
      logger.info(`✅ Marked ${expiredCount} signals as expired`);
    }
  } catch (error) {
    logger.warn('⚠️  Cleanup warning:', error.message);
  }
}

module.exports = { initDatabase, initializeScannerConfigs, cleanupExpiredSignals };
