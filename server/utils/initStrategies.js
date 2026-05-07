const { ScannerConfig } = require('../models');
const logger = require('./logger');

exports.initializeDefaultStrategies = async () => {
  try {
    logger.info('🔧 Initializing scanner strategies...');
    
    // Check if Freedom Strategy exists (main strategy)
    const freedomStrategy = await ScannerConfig.findOne({
      where: { strategyName: 'freedomStrategyNehemiah' }
    });

    if (!freedomStrategy) {
      logger.info('✨ Creating Freedom Strategy Nehemiah 6:3...');
      
      // Freedom Strategy - The primary strategy (from Market Scanner page)
      await ScannerConfig.create({
        strategyName: 'freedomStrategyNehemiah',
        description: 'Freedom Strategy Nehemiah 6:3 - Multi-indicator analysis combining RSI, MACD, and Moving Averages',
        rules: {
          rsiOverbought: 70,
          rsiOversold: 30,
          minHistogram: 0,
          fastMA: 20,
          slowMA: 50
        },
        timeframes: ['15m', '1h', '4h', '1d'],
        pairs: ['XAUUSD', 'EURUSD', 'GBPUSD', 'GBPJPY', 'XAGUSD', 'US30USD'],
        isEnabled: true,
        scanInterval: 15
      });
      
      logger.info('✅ Freedom Strategy Nehemiah 6:3 created');
    }

    const existingConfigs = await ScannerConfig.count();
    
    if (existingConfigs <= 1) {
      // Only create other strategies if none exist
      logger.info('Creating additional scanner strategies...');

    // Default RSI Strategy - Forex & Commodities
    await ScannerConfig.create({
      strategyName: 'rsiOversold',
      description: 'RSI Oversold/Overbought Strategy - Generates signals when RSI crosses threshold levels',
      rules: {
        rsiOverbought: 70,
        rsiOversold: 30
      },
      timeframes: ['1h', '4h', '1d'],
      pairs: ['EURUSD', 'GBPUSD', 'GBPJPY', 'XAUUSD', 'XAGUSD', 'US30USD'],
      isEnabled: true,
      scanInterval: 60
    });

    // MACD Crossover Strategy - All Assets
    await ScannerConfig.create({
      strategyName: 'macdCrossover',
      description: 'MACD Crossover Strategy - Signals on MACD line crossing signal line',
      rules: {
        minHistogram: 0
      },
      timeframes: ['4h', '1d'],
      pairs: ['EURUSD', 'GBPUSD', 'GBPJPY', 'XAUUSD', 'XAGUSD', 'US30USD', 'BTCUSD', 'ETHUSD'],
      isEnabled: true,
      scanInterval: 120
    });

    // Moving Average Cross Strategy - Forex & Commodities
    await ScannerConfig.create({
      strategyName: 'movingAverageCross',
      description: 'MA Crossover Strategy - Golden/Death cross signals using moving averages',
      rules: {
        fastMA: 20,
        slowMA: 50
      },
      timeframes: ['4h', '1d'],
      pairs: ['EURUSD', 'GBPUSD', 'GBPJPY', 'XAUUSD', 'XAGUSD'],
      isEnabled: true,
      scanInterval: 120
    });

    // Support/Resistance Strategy - All Major Pairs
    await ScannerConfig.create({
      strategyName: 'supportResistance',
      description: 'Support/Resistance Strategy - Breakout signals from key levels',
      rules: {
        breakoutThreshold: 0.02
      },
      timeframes: ['1h', '4h', '1d'],
      pairs: ['EURUSD', 'GBPUSD', 'GBPJPY', 'XAUUSD', 'XAGUSD', 'US30USD'],
      isEnabled: true,
      scanInterval: 60
    });

    // Bollinger Band Breakout Strategy - High Volatility Assets
    await ScannerConfig.create({
      strategyName: 'bollingerBreakout',
      description: 'Bollinger Band Breakout Strategy - Volatility breakout signals using standard deviation bands',
      rules: {
        period: 20,
        stdDev: 2
      },
      timeframes: ['1h', '4h', '1d'],
      pairs: ['EURUSD', 'GBPUSD', 'GBPJPY', 'BTCUSD', 'ETHUSD', 'XAUUSD'],
      isEnabled: true,
      scanInterval: 60
    });

    // Volume Surge Strategy - All Assets with Volume Data
    await ScannerConfig.create({
      strategyName: 'volumeSurge',
      description: 'Volume Surge Strategy - Detects unusual volume spikes with price confirmation',
      rules: {
        volumeThreshold: 2.0,
        priceMove: 0.005
      },
      timeframes: ['1h', '4h'],
      pairs: ['BTCUSD', 'ETHUSD', 'EURUSD', 'GBPUSD', 'XAUUSD', 'US30USD'],
      isEnabled: true,
      scanInterval: 30
    });

    // Price Action Patterns Strategy - Forex & Commodities
    await ScannerConfig.create({
      strategyName: 'priceActionPatterns',
      description: 'Price Action Patterns Strategy - Candlestick patterns like engulfing, hammer, doji',
      rules: {
        minPatternSize: 0.002
      },
      timeframes: ['1h', '4h', '1d'],
      pairs: ['EURUSD', 'GBPUSD', 'GBPJPY', 'XAUUSD', 'XAGUSD'],
      isEnabled: true,
      scanInterval: 60
    });

    // Crypto Strategy - BTC & ETH
    await ScannerConfig.create({
      strategyName: 'cryptoMomentum',
      description: 'Crypto Momentum Strategy - RSI and MACD signals for cryptocurrencies',
      rules: {
        rsiOverbought: 70,
        rsiOversold: 30,
        minHistogram: 0
      },
      timeframes: ['1h', '4h', '1d'],
      pairs: ['BTCUSD', 'ETHUSD'],
      isEnabled: true,
      scanInterval: 30
    });

    // Commodities Strategy - Gold & Silver
    await ScannerConfig.create({
      strategyName: 'commoditiesScanner',
      description: 'Commodities Scanner - Specialized strategy for Gold and Silver',
      rules: {
        rsiOverbought: 70,
        rsiOversold: 30
      },
      timeframes: ['1h', '4h', '1d'],
      pairs: ['XAUUSD', 'XAGUSD'],
      isEnabled: true,
      scanInterval: 60
    });

    // Indices Strategy - US30
    await ScannerConfig.create({
      strategyName: 'indicesScanner',
      description: 'Indices Scanner - Strategy for major indices like US30',
      rules: {
        rsiOverbought: 70,
        rsiOversold: 30
      },
      timeframes: ['1h', '4h', '1d'],
      pairs: ['US30USD'],
      isEnabled: true,
      scanInterval: 60
    });

      logger.info('✅ 9 additional scanner strategies initialized');
    } else {
      logger.info(`📊 Scanner already configured: ${existingConfigs} strategies`);
    }

    logger.info('✅ Scanner strategies initialization complete');
  } catch (error) {
    logger.error('❌ Error initializing scanner strategies:', error.message);
  }
};
