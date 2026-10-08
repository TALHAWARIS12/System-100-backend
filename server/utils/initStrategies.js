const { ScannerConfig } = require('../models');
const logger = require('./logger');

exports.initializeDefaultStrategies = async () => {
  try {
    logger.info('🔧 Initializing comprehensive scanner strategies...');

    const strategies = [
      {
        strategyName: 'freedomStrategyNehemiah',
        description: 'Freedom Strategy Nehemiah 6:3 - Multi-indicator analysis combining RSI, MACD, and Moving Averages across all asset classes',
        rules: {
          rsiOverbought: 70,
          rsiOversold: 30,
          minHistogram: 0,
          fastMA: 20,
          slowMA: 50
        },
        timeframes: ['15m', '1h', '4h', '1d'],
        pairs: ['XAUUSD', 'EURUSD', 'GBPUSD', 'GBPJPY', 'USDJPY', 'AUDUSD', 'USDCAD', 'BTCUSD', 'ETHUSD', 'SOLUSD', 'XAGUSD', 'US30USD'],
        isEnabled: true,
        scanInterval: 15
      },
      {
        strategyName: 'cryptoMomentum',
        description: 'Crypto Momentum Strategy - Flagship cryptocurrency technical setups on BTC, ETH, SOL, XRP & altcoins',
        rules: {
          rsiOverbought: 70,
          rsiOversold: 30,
          minHistogram: 0
        },
        timeframes: ['15m', '1h', '4h', '1d'],
        pairs: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'DOGEUSD', 'ADAUSD', 'BNBUSD', 'LTCUSD'],
        isEnabled: true,
        scanInterval: 15
      },
      {
        strategyName: 'rsiOversold',
        description: 'RSI Oversold/Overbought Strategy - Reversal signals on all currencies and crypto',
        rules: {
          rsiOverbought: 70,
          rsiOversold: 30
        },
        timeframes: ['1h', '4h', '1d'],
        pairs: ['EURUSD', 'GBPUSD', 'GBPJPY', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF', 'BTCUSD', 'ETHUSD', 'SOLUSD', 'XAUUSD', 'XAGUSD', 'US30USD'],
        isEnabled: true,
        scanInterval: 30
      },
      {
        strategyName: 'macdCrossover',
        description: 'MACD Crossover Strategy - Trend signals across all assets and timeframes',
        rules: {
          minHistogram: 0
        },
        timeframes: ['1h', '4h', '1d'],
        pairs: ['EURUSD', 'GBPUSD', 'GBPJPY', 'USDJPY', 'AUDUSD', 'USDCAD', 'BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'XAUUSD', 'XAGUSD', 'US30USD'],
        isEnabled: true,
        scanInterval: 60
      },
      {
        strategyName: 'movingAverageCross',
        description: 'MA Crossover Strategy - Golden/Death cross signals for currencies and crypto',
        rules: {
          fastMA: 20,
          slowMA: 50
        },
        timeframes: ['1h', '4h', '1d'],
        pairs: ['EURUSD', 'GBPUSD', 'GBPJPY', 'USDJPY', 'AUDUSD', 'USDCAD', 'BTCUSD', 'ETHUSD', 'XAUUSD', 'XAGUSD'],
        isEnabled: true,
        scanInterval: 60
      },
      {
        strategyName: 'supportResistance',
        description: 'Support/Resistance Strategy - Key price breakout setups',
        rules: {
          breakoutThreshold: 0.02
        },
        timeframes: ['1h', '4h', '1d'],
        pairs: ['EURUSD', 'GBPUSD', 'GBPJPY', 'USDJPY', 'BTCUSD', 'ETHUSD', 'XAUUSD', 'XAGUSD', 'US30USD'],
        isEnabled: true,
        scanInterval: 60
      },
      {
        strategyName: 'bollingerBreakout',
        description: 'Bollinger Band Breakout Strategy - Volatility breakout signals',
        rules: {
          period: 20,
          stdDev: 2
        },
        timeframes: ['15m', '1h', '4h', '1d'],
        pairs: ['EURUSD', 'GBPUSD', 'GBPJPY', 'USDJPY', 'BTCUSD', 'ETHUSD', 'SOLUSD', 'XAUUSD'],
        isEnabled: true,
        scanInterval: 30
      },
      {
        strategyName: 'volumeSurge',
        description: 'Volume Surge Strategy - High volume momentum setups',
        rules: {
          volumeThreshold: 2.0,
          priceMove: 0.005
        },
        timeframes: ['1h', '4h', '1d'],
        pairs: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'US30USD'],
        isEnabled: true,
        scanInterval: 30
      },
      {
        strategyName: 'priceActionPatterns',
        description: 'Price Action Patterns Strategy - Candlestick reversal patterns',
        rules: {
          minPatternSize: 0.002
        },
        timeframes: ['1h', '4h', '1d'],
        pairs: ['EURUSD', 'GBPUSD', 'GBPJPY', 'USDJPY', 'BTCUSD', 'ETHUSD', 'XAUUSD', 'XAGUSD'],
        isEnabled: true,
        scanInterval: 60
      },
      {
        strategyName: 'commoditiesScanner',
        description: 'Commodities Scanner - Specialized strategy for Gold and Silver',
        rules: {
          rsiOverbought: 70,
          rsiOversold: 30
        },
        timeframes: ['15m', '1h', '4h', '1d'],
        pairs: ['XAUUSD', 'XAGUSD'],
        isEnabled: true,
        scanInterval: 15
      },
      {
        strategyName: 'indicesScanner',
        description: 'Indices Scanner - Strategy for major indices like US30 and NAS100',
        rules: {
          rsiOverbought: 70,
          rsiOversold: 30
        },
        timeframes: ['1h', '4h', '1d'],
        pairs: ['US30USD', 'NAS100'],
        isEnabled: true,
        scanInterval: 60
      }
    ];

    for (const item of strategies) {
      const [config, created] = await ScannerConfig.findOrCreate({
        where: { strategyName: item.strategyName },
        defaults: item
      });

      if (!created) {
        await config.update({
          pairs: item.pairs,
          timeframes: item.timeframes,
          rules: item.rules,
          isEnabled: true,
          scanInterval: item.scanInterval,
          description: item.description
        });
      }
    }

    logger.info(`✅ Initialized ${strategies.length} scanner strategies with full crypto, forex & 1h/4h/1d coverage`);
  } catch (error) {
    logger.error('❌ Error initializing scanner strategies:', error.message);
  }
};
