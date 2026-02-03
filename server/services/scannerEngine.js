const axios = require('axios');
const { ScannerResult, ScannerConfig, DataSource, User, Subscription } = require('../models');
const logger = require('../utils/logger');
const { sendSignalNotification } = require('../utils/emailService');

class ScannerEngine {
  constructor() {
    this.strategies = {
      rsiOversold: this.rsiOversoldStrategy.bind(this),
      macdCrossover: this.macdCrossoverStrategy.bind(this),
      movingAverageCross: this.movingAverageCrossStrategy.bind(this),
      supportResistance: this.supportResistanceStrategy.bind(this)
    };
  }

  /**
   * Run scanner for all enabled configurations
   */
  async runScanner() {
    try {
      logger.info('Starting scanner run...');
      
      const configs = await ScannerConfig.findAll({
        where: { isEnabled: true }
      });

      for (const config of configs) {
        await this.scanStrategy(config);
      }

      logger.info('Scanner run completed');
    } catch (error) {
      logger.error('Scanner run error:', error);
    }
  }

  /**
   * Scan a specific strategy configuration
   */
  async scanStrategy(config) {
    try {
      const strategy = this.strategies[config.strategyName];
      
      if (!strategy) {
        logger.warn(`Strategy ${config.strategyName} not found`);
        return;
      }

      for (const pair of config.pairs) {
        for (const timeframe of config.timeframes) {
          try {
            // Get market data from configured data source
            const marketData = await this.getMarketData(pair, timeframe);
            
            if (!marketData) {
              logger.warn(`No market data available for ${pair} ${timeframe}`);
              continue;
            }
            
            // Apply strategy
            const signal = await strategy(marketData, config.rules);
            
            if (signal) {
              // Save signal to database
              await this.saveSignal({
                pair,
                timeframe,
                signal,
                strategyName: config.strategyName
              });
            }
          } catch (error) {
            logger.error(`Error scanning ${pair} ${timeframe}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error(`Strategy scan error for ${config.strategyName}:`, error);
    }
  }

  /**
   * Get market data from configured data sources
   * Tries sources in priority order until one succeeds
   */
  async getMarketData(pair, timeframe) {
    try {
      // Get active data sources ordered by priority
      const sources = await DataSource.findAll({
        where: { isActive: true },
        order: [['priority', 'ASC']]
      });

      if (sources.length === 0) {
        throw new Error('No active data sources configured');
      }

      // Try each source until one works
      for (const source of sources) {
        try {
          // Check rate limit
          if (source.usageCount >= source.rateLimit) {
            logger.warn(`Rate limit exceeded for ${source.name}`);
            continue;
          }

          const data = await this.fetchDataFromSource(source, pair, timeframe);
          
          if (data) {
            // Update usage counter
            await source.update({
              usageCount: source.usageCount + 1,
              lastUsed: new Date(),
              lastError: null
            });
            
            return data;
          }
        } catch (error) {
          logger.error(`Data source ${source.name} failed:`, error.message);
          
          // Log error to data source
          await source.update({
            lastError: error.message
          });
          
          // Try next source
          continue;
        }
      }

      throw new Error('All data sources failed');
      
    } catch (error) {
      logger.error('Get market data error:', error);
      return null;
    }
  }

  /**
   * Fetch data from specific data source based on provider type
   * Add rate limiting to respect API limits
   */
  async fetchDataFromSource(source, pair, timeframe) {
    const { provider, baseUrl, apiKey, configuration } = source;

    // Rate limiting per provider
    if (provider === 'alphavantage') {
      // Alpha Vantage free tier: 1 request per second limit
      await this.sleep(1200); // 1.2 second delay to be safe
    } else if (provider === 'polygon' || provider === 'finnhub') {
      // Smaller delay for other providers
      await this.sleep(100);
    }

    switch (provider) {
      case 'alphavantage':
        return await this.fetchAlphaVantage(baseUrl, apiKey, pair, timeframe, configuration);
      
      case 'twelvedata':
        return await this.fetchTwelveData(baseUrl, apiKey, pair, timeframe, configuration);
      
      case 'polygon':
        return await this.fetchPolygon(baseUrl, apiKey, pair, timeframe, configuration);
      
      case 'finnhub':
        return await this.fetchFinnhub(baseUrl, apiKey, pair, timeframe, configuration);
      
      case 'custom':
        return await this.fetchCustom(baseUrl, apiKey, pair, timeframe, configuration);
      
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Alpha Vantage API integration
   */
  async fetchAlphaVantage(baseUrl, apiKey, pair, timeframe, config) {
    // Ensure correct Alpha Vantage domain
    const apiUrl = baseUrl.includes('alphavantage.co') 
      ? baseUrl 
      : 'https://www.alphavantage.co';

    const interval = this.convertTimeframe(timeframe);
    const fromSymbol = pair.substring(0, 3);
    const toSymbol = pair.substring(3, 6);

    // Detect if this is a crypto pair (BTC, ETH, BNB, SOL, ADA, etc.)
    const cryptoSymbols = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOT', 'LTC', 'DOGE', 'MATIC'];
    const isCrypto = cryptoSymbols.includes(fromSymbol);
    
    // Use CRYPTO_INTRADAY for crypto, FX_INTRADAY for forex
    const apiFunction = isCrypto ? 'CRYPTO_INTRADAY' : 'FX_INTRADAY';
    const paramKey = isCrypto ? 'symbol' : 'from_symbol';

    const params = {
      function: apiFunction,
      apikey: apiKey,
      interval: interval,
      outputsize: 'compact'
    };

    if (isCrypto) {
      params.symbol = fromSymbol;
      params.market = toSymbol;
    } else {
      params.from_symbol = fromSymbol;
      params.to_symbol = toSymbol;
    }

    const response = await axios.get(`${apiUrl}/query`, {
      params,
      timeout: 10000
    });

    // Check for API errors
    if (response.data['Error Message']) {
      throw new Error(response.data['Error Message']);
    }

    if (response.data['Note']) {
      throw new Error('API rate limit reached: ' + response.data['Note']);
    }

    if (response.data['Information']) {
      throw new Error('API error: ' + response.data['Information']);
    }

    const timeSeriesKey = isCrypto 
      ? `Time Series Crypto (${interval})`
      : `Time Series FX (${interval})`;
    const timeSeries = response.data[timeSeriesKey];

    if (!timeSeries) {
      throw new Error(`No data in response. API returned: ${JSON.stringify(response.data).substring(0, 200)}`);
    }

    // Get latest candles
    const candles = Object.entries(timeSeries)
      .slice(0, 200) // Get 200 candles for indicator calculation
      .map(([timestamp, data]) => ({
        timestamp,
        open: parseFloat(data['1. open']),
        high: parseFloat(data['2. high']),
        low: parseFloat(data['3. low']),
        close: parseFloat(data['4. close'])
      }));

    return this.calculateIndicators(candles, pair, timeframe);
  }

  /**
   * Twelve Data API integration
   */
  async fetchTwelveData(baseUrl, apiKey, pair, timeframe, config) {
    // Twelve Data interval format: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 1day, 1week, 1month
    const intervalMap = {
      '1min': '1min',
      '5min': '5min',
      '15min': '15min',
      '30min': '30min',
      '1h': '1h',
      '4h': '4h',
      '1d': '1day',
      '60min': '1h',
      '240min': '4h',
      'daily': '1day'
    };
    const interval = intervalMap[timeframe] || '1h';
    const symbol = `${pair.substring(0, 3)}/${pair.substring(3, 6)}`;

    const response = await axios.get(`${baseUrl}/time_series`, {
      params: {
        symbol: symbol,
        interval: interval,
        apikey: apiKey,
        outputsize: 200
      },
      timeout: 10000
    });

    if (response.data.status === 'error') {
      throw new Error(response.data.message);
    }

    const candles = response.data.values.map(item => ({
      timestamp: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close)
    }));

    return this.calculateIndicators(candles, pair, timeframe);
  }

  /**
   * Polygon.io API integration
   */
  async fetchPolygon(baseUrl, apiKey, pair, timeframe, config) {
    const multiplier = this.getTimeframeMultiplier(timeframe);
    const timespan = 'hour'; // or 'minute', 'day'
    const ticker = `C:${pair}`;

    const to = new Date();
    const from = new Date(to.getTime() - (200 * 60 * 60 * 1000 * multiplier));

    const response = await axios.get(
      `${baseUrl}/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from.toISOString().split('T')[0]}/${to.toISOString().split('T')[0]}`,
      {
        params: { apiKey: apiKey },
        timeout: 10000
      }
    );

    if (response.data.status !== 'OK') {
      throw new Error('API returned error status');
    }

    const candles = response.data.results.map(item => ({
      timestamp: new Date(item.t),
      open: item.o,
      high: item.h,
      low: item.l,
      close: item.c,
      volume: item.v
    }));

    return this.calculateIndicators(candles, pair, timeframe);
  }

  /**
   * Finnhub API integration
   */
  async fetchFinnhub(baseUrl, apiKey, pair, timeframe, config) {
    const resolution = this.convertTimeframeToMinutes(timeframe);
    const symbol = `OANDA:${pair.substring(0, 3)}_${pair.substring(3, 6)}`;
    
    const to = Math.floor(Date.now() / 1000);
    const from = to - (200 * resolution * 60);

    const response = await axios.get(`${baseUrl}/forex/candle`, {
      params: {
        symbol: symbol,
        resolution: resolution,
        from: from,
        to: to,
        token: apiKey
      },
      timeout: 10000
    });

    if (response.data.s !== 'ok') {
      throw new Error('API returned error status');
    }

    const candles = response.data.t.map((timestamp, i) => ({
      timestamp: new Date(timestamp * 1000),
      open: response.data.o[i],
      high: response.data.h[i],
      low: response.data.l[i],
      close: response.data.c[i],
      volume: response.data.v[i]
    }));

    return this.calculateIndicators(candles, pair, timeframe);
  }

  /**
   * Custom API integration (user-defined endpoint)
   */
  async fetchCustom(baseUrl, apiKey, pair, timeframe, config) {
    const response = await axios.get(baseUrl, {
      params: {
        pair: pair,
        timeframe: timeframe,
        apiKey: apiKey,
        ...config // Spread any custom configuration
      },
      timeout: 10000
    });

    // Assume custom API returns candles in standard format
    const candles = response.data.candles || response.data.data || response.data;

    return this.calculateIndicators(candles, pair, timeframe);
  }

  /**
   * Calculate technical indicators from candle data
   */
  calculateIndicators(candles, pair, timeframe) {
    if (!candles || candles.length < 50) {
      throw new Error('Insufficient candle data');
    }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    // Calculate RSI
    const rsi = this.calculateRSI(closes, 14);

    // Calculate MACD
    const macd = this.calculateMACD(closes);

    // Calculate Moving Averages
    const ma20 = this.calculateSMA(closes, 20);
    const ma50 = this.calculateSMA(closes, 50);
    const ma200 = this.calculateSMA(closes, 200);

    // Calculate Support/Resistance levels
    const support = Math.min(...lows.slice(0, 50));
    const resistance = Math.max(...highs.slice(0, 50));

    return {
      pair,
      timeframe,
      close: closes[0],
      high: highs[0],
      low: lows[0],
      volume: candles[0].volume || 0,
      rsi: rsi,
      macd: macd,
      ma: {
        ma20: ma20,
        ma50: ma50,
        ma200: ma200
      },
      support: support,
      resistance: resistance,
      candles: candles.slice(0, 200) // Store candles for further analysis
    };
  }

  /**
   * Calculate RSI indicator
   */
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain/loss
    for (let i = 1; i <= period; i++) {
      const change = prices[i - 1] - prices[i];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Calculate smoothed RS
    for (let i = period + 1; i < Math.min(prices.length, period * 3); i++) {
      const change = prices[i - 1] - prices[i];
      if (change > 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
      }
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
  }

  /**
   * Calculate MACD indicator
   */
  calculateMACD(prices) {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macdLine = ema12 - ema26;
    
    // Signal line would require more calculation
    const signalLine = macdLine * 0.9; // Simplified
    const histogram = macdLine - signalLine;

    return {
      value: macdLine,
      signal: signalLine,
      histogram: histogram
    };
  }

  /**
   * Calculate Simple Moving Average
   */
  calculateSMA(prices, period) {
    if (prices.length < period) return prices[0];
    
    const sum = prices.slice(0, period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  /**
   * Calculate Exponential Moving Average
   */
  calculateEMA(prices, period) {
    if (prices.length < period) return prices[0];

    const multiplier = 2 / (period + 1);
    let ema = this.calculateSMA(prices.slice(0, period), period);

    for (let i = period; i < Math.min(prices.length, period * 2); i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * Convert timeframe to interval format for different APIs
   */
  convertTimeframe(timeframe) {
    const map = {
      '1min': '1min',
      '5min': '5min',
      '15min': '15min',
      '30min': '30min',
      '60min': '60min',
      '1h': '60min',
      '4h': '240min',
      '1d': 'daily'
    };
    return map[timeframe] || '60min';
  }

  /**
   * Get multiplier for timeframe
   */
  getTimeframeMultiplier(timeframe) {
    const map = {
      '1min': 1,
      '5min': 5,
      '15min': 15,
      '30min': 30,
      '60min': 1,
      '1h': 1,
      '4h': 4,
      '1d': 1
    };
    return map[timeframe] || 1;
  }

  /**
   * Convert timeframe to minutes
   */
  convertTimeframeToMinutes(timeframe) {
    const map = {
      '1min': 1,
      '5min': 5,
      '15min': 15,
      '30min': 30,
      '60min': 60,
      '1h': 60,
      '4h': 240,
      '1d': 'D'
    };
    return map[timeframe] || 60;
  }

  /**
   * RSI Oversold Strategy
   */
  async rsiOversoldStrategy(data, rules) {
    const { rsiOverbought = 70, rsiOversold = 30 } = rules;
    
    if (data.rsi < rsiOversold) {
      // Buy signal
      return {
        type: 'buy',
        entry: data.close,
        stopLoss: data.close * 0.98,
        takeProfit: data.close * 1.04,
        confidence: 75 + (30 - data.rsi), // Higher confidence for more oversold
        indicators: {
          rsi: data.rsi
        }
      };
    } else if (data.rsi > rsiOverbought) {
      // Sell signal
      return {
        type: 'sell',
        entry: data.close,
        stopLoss: data.close * 1.02,
        takeProfit: data.close * 0.96,
        confidence: 75 + (data.rsi - 70), // Higher confidence for more overbought
        indicators: {
          rsi: data.rsi
        }
      };
    }
    
    return null;
  }

  /**
   * MACD Crossover Strategy
   */
  async macdCrossoverStrategy(data, rules) {
    const { macd } = data;
    
    if (macd.histogram > 0 && macd.value > macd.signal) {
      // Bullish crossover
      return {
        type: 'buy',
        entry: data.close,
        stopLoss: data.close * 0.98,
        takeProfit: data.close * 1.04,
        confidence: 70 + Math.min(Math.abs(macd.histogram) * 10000, 15),
        indicators: {
          macd: macd.value,
          signal: macd.signal,
          histogram: macd.histogram
        }
      };
    } else if (macd.histogram < 0 && macd.value < macd.signal) {
      // Bearish crossover
      return {
        type: 'sell',
        entry: data.close,
        stopLoss: data.close * 1.02,
        takeProfit: data.close * 0.96,
        confidence: 70 + Math.min(Math.abs(macd.histogram) * 10000, 15),
        indicators: {
          macd: macd.value,
          signal: macd.signal,
          histogram: macd.histogram
        }
      };
    }
    
    return null;
  }

  /**
   * Moving Average Cross Strategy
   */
  async movingAverageCrossStrategy(data, rules) {
    const { ma } = data;
    
    if (ma.ma20 > ma.ma50 && data.close > ma.ma20) {
      // Golden cross
      return {
        type: 'buy',
        entry: data.close,
        stopLoss: ma.ma50,
        takeProfit: data.close * 1.05,
        confidence: 75,
        indicators: {
          ma20: ma.ma20,
          ma50: ma.ma50,
          price: data.close
        }
      };
    } else if (ma.ma20 < ma.ma50 && data.close < ma.ma20) {
      // Death cross
      return {
        type: 'sell',
        entry: data.close,
        stopLoss: ma.ma50,
        takeProfit: data.close * 0.95,
        confidence: 75,
        indicators: {
          ma20: ma.ma20,
          ma50: ma.ma50,
          price: data.close
        }
      };
    }
    
    return null;
  }

  /**
   * Support/Resistance Strategy
   */
  async supportResistanceStrategy(data, rules) {
    const { support, resistance, close } = data;
    const threshold = (resistance - support) * 0.05; // 5% threshold
    
    if (Math.abs(close - support) < threshold) {
      // Price near support
      return {
        type: 'buy',
        entry: close,
        stopLoss: support * 0.995,
        takeProfit: resistance,
        confidence: 70,
        indicators: {
          support: support,
          resistance: resistance,
          price: close
        }
      };
    } else if (Math.abs(close - resistance) < threshold) {
      // Price near resistance
      return {
        type: 'sell',
        entry: close,
        stopLoss: resistance * 1.005,
        takeProfit: support,
        confidence: 70,
        indicators: {
          support: support,
          resistance: resistance,
          price: close
        }
      };
    }
    
    return null;
  }

  /**
   * Save signal to database and send notifications
   */
  async saveSignal({ pair, timeframe, signal, strategyName }) {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const savedSignal = await ScannerResult.create({
        pair,
        timeframe,
        signalType: signal.type,
        entry: signal.entry,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        confidence: signal.confidence,
        strategyName,
        indicators: signal.indicators,
        isActive: true,
        expiresAt
      });

      logger.info(`Signal saved: ${signal.type} ${pair} @ ${signal.entry}`);

      // Send email notifications to subscribed users (async, don't block)
      this.notifyUsers(savedSignal).catch(err => {
        logger.error('Notification error:', err);
      });

    } catch (error) {
      logger.error('Save signal error:', error);
    }
  }

  /**
   * Notify subscribed users about new signal
   */
  async notifyUsers(signal) {
    try {
      // Get users with active subscriptions
      const users = await User.findAll({
        include: [{
          model: Subscription,
          as: 'subscription',
          where: {
            status: 'active',
            endDate: { [require('sequelize').Op.gt]: new Date() }
          }
        }]
      });

      // Send email to each user
      for (const user of users) {
        try {
          await sendSignalNotification(user, signal);
        } catch (err) {
          logger.error(`Failed to notify user ${user.email}:`, err);
        }
      }

      logger.info(`Notified ${users.length} users about new signal`);
    } catch (error) {
      logger.error('Notify users error:', error);
    }
  }

  /**
   * Cleanup expired signals
   */
  async cleanupExpiredSignals() {
    try {
      const result = await ScannerResult.update(
        { isActive: false },
        {
          where: {
            expiresAt: { [require('sequelize').Op.lt]: new Date() },
            isActive: true
          }
        }
      );

      logger.info(`Cleaned up ${result[0]} expired signals`);
    } catch (error) {
      logger.error('Cleanup signals error:', error);
    }
  }

  /**
   * Sleep utility for rate limiting between API calls
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new ScannerEngine();
