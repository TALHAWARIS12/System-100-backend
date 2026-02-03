const { ScannerConfig } = require('../models');
const logger = require('./logger');

exports.initializeDefaultStrategies = async () => {
  try {
    const existingConfigs = await ScannerConfig.count();
    
    if (existingConfigs > 0) {
      logger.info('Scanner configurations already exist');
      return;
    }

    // Default RSI Strategy
    await ScannerConfig.create({
      strategyName: 'rsiOversold',
      description: 'RSI Oversold/Overbought Strategy - Generates signals when RSI crosses threshold levels',
      rules: {
        rsiOverbought: 70,
        rsiOversold: 30
      },
      timeframes: ['1h', '4h', '1d'],
      pairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'],
      isEnabled: true,
      scanInterval: 60
    });

    // MACD Crossover Strategy
    await ScannerConfig.create({
      strategyName: 'macdCrossover',
      description: 'MACD Crossover Strategy - Signals on MACD line crossing signal line',
      rules: {
        minHistogram: 0
      },
      timeframes: ['4h', '1d'],
      pairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'ETHUSD'],
      isEnabled: true,
      scanInterval: 120
    });

    // Moving Average Cross Strategy
    await ScannerConfig.create({
      strategyName: 'movingAverageCross',
      description: 'MA Crossover Strategy - Golden/Death cross signals using moving averages',
      rules: {
        fastMA: 20,
        slowMA: 50
      },
      timeframes: ['4h', '1d'],
      pairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD'],
      isEnabled: false,
      scanInterval: 120
    });

    logger.info('Default scanner strategies initialized successfully');
  } catch (error) {
    logger.error('Error initializing default strategies:', error);
  }
};
