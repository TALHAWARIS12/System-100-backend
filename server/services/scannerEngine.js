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
      supportResistance: this.supportResistanceStrategy.bind(this),
      bollingerBreakout: this.bollingerBreakoutStrategy.bind(this),
      volumeSurge: this.volumeSurgeStrategy.bind(this),
      priceActionPatterns: this.priceActionPatternsStrategy.bind(this),
      cryptoMomentum: this.cryptoMomentumStrategy.bind(this),
      commoditiesScanner: this.commoditiesScannerStrategy.bind(this),
      indicesScanner: this.indicesScannerStrategy.bind(this)
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
    } else if (provider === 'twelvedata') {
      // Twelve Data free tier: 8 requests per minute
      // Wait 8 seconds between calls to stay within limit
      await this.sleep(8000);
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
    const toSymbol = pair.substring(3);

    // Detect asset type
    const cryptoSymbols = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOT', 'LTC', 'DOGE', 'MATIC'];
    const commoditySymbols = ['XAU', 'XAG', 'XPT', 'XPD']; // Gold, Silver, Platinum, Palladium
    const indicesSymbols = ['US3', 'SPX', 'NAS', 'DJI', 'NDX']; // US30, S&P500, NASDAQ, etc.
    
    const isCrypto = cryptoSymbols.includes(fromSymbol);
    const isCommodity = commoditySymbols.includes(fromSymbol);
    const isIndex = indicesSymbols.includes(fromSymbol) || pair.startsWith('US30');
    
    let apiFunction, params;
    
    if (isCrypto) {
      // Use CRYPTO_INTRADAY for crypto
      apiFunction = 'CRYPTO_INTRADAY';
      params = {
        function: apiFunction,
        symbol: fromSymbol,
        market: toSymbol || 'USD',
        interval: interval,
        outputsize: 'compact',
        apikey: apiKey
      };
    } else if (isCommodity) {
      // Commodities like Gold (XAU), Silver (XAG) - treat as forex pair
      apiFunction = 'FX_INTRADAY';
      params = {
        function: apiFunction,
        from_symbol: fromSymbol,
        to_symbol: toSymbol || 'USD',
        interval: interval,
        outputsize: 'compact',
        apikey: apiKey
      };
    } else if (isIndex) {
      // For indices, use TIME_SERIES_INTRADAY with appropriate symbol
      // Map common index pairs to Alpha Vantage symbols
      const indexSymbolMap = {
        'US30USD': 'DIA',    // SPDR Dow Jones ETF
        'US30': 'DIA',
        'SPX500': 'SPY',     // S&P 500 ETF
        'NAS100': 'QQQ'      // NASDAQ 100 ETF
      };
      const indexSymbol = indexSymbolMap[pair] || 'DIA';
      
      apiFunction = 'TIME_SERIES_INTRADAY';
      params = {
        function: apiFunction,
        symbol: indexSymbol,
        interval: interval,
        outputsize: 'compact',
        apikey: apiKey
      };
    } else {
      // Standard forex pair
      apiFunction = 'FX_INTRADAY';
      params = {
        function: apiFunction,
        from_symbol: fromSymbol,
        to_symbol: toSymbol,
        interval: interval,
        outputsize: 'compact',
        apikey: apiKey
      };
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

    // Determine the correct time series key based on asset type
    let timeSeriesKey;
    if (isCrypto) {
      timeSeriesKey = `Time Series Crypto (${interval})`;
    } else if (isIndex) {
      timeSeriesKey = `Time Series (${interval})`;
    } else {
      // Forex and commodities use the same FX time series
      timeSeriesKey = `Time Series FX (${interval})`;
    }
    
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
    
    // Determine symbol format based on asset type
    const fromSymbol = pair.substring(0, 3);
    const cryptoSymbols = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOT', 'LTC', 'DOGE', 'MATIC'];
    const commoditySymbols = ['XAU', 'XAG', 'XPT', 'XPD'];
    
    let symbol;
    if (pair.startsWith('US30') || pair === 'US30USD') {
      // Indices - Twelve Data uses DJI for Dow Jones
      symbol = 'DJI';
    } else if (cryptoSymbols.includes(fromSymbol)) {
      // Crypto pairs
      symbol = `${fromSymbol}/USD`;
    } else if (commoditySymbols.includes(fromSymbol)) {
      // Commodities (Gold, Silver)
      symbol = `${fromSymbol}/USD`;
    } else {
      // Forex pairs
      symbol = `${pair.substring(0, 3)}/${pair.substring(3)}`;
    }

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
   * Crypto Momentum Strategy - Combined RSI and MACD for BTC/ETH
   */
  async cryptoMomentumStrategy(data, rules) {
    const { rsiOverbought = 70, rsiOversold = 30 } = rules;
    const { rsi, macd, close } = data;
    
    // Strong buy: RSI oversold AND MACD bullish
    if (rsi < rsiOversold && macd.histogram > 0) {
      return {
        type: 'buy',
        entry: close,
        stopLoss: close * 0.95, // 5% stop loss for crypto volatility
        takeProfit: close * 1.10, // 10% take profit
        confidence: 80 + (30 - rsi) / 2,
        indicators: {
          rsi: rsi,
          macd: macd.value,
          histogram: macd.histogram
        }
      };
    }
    
    // Strong sell: RSI overbought AND MACD bearish
    if (rsi > rsiOverbought && macd.histogram < 0) {
      return {
        type: 'sell',
        entry: close,
        stopLoss: close * 1.05,
        takeProfit: close * 0.90,
        confidence: 80 + (rsi - 70) / 2,
        indicators: {
          rsi: rsi,
          macd: macd.value,
          histogram: macd.histogram
        }
      };
    }
    
    // Moderate buy: RSI oversold only
    if (rsi < rsiOversold) {
      return {
        type: 'buy',
        entry: close,
        stopLoss: close * 0.97,
        takeProfit: close * 1.06,
        confidence: 65 + (30 - rsi) / 2,
        indicators: { rsi: rsi }
      };
    }
    
    // Moderate sell: RSI overbought only
    if (rsi > rsiOverbought) {
      return {
        type: 'sell',
        entry: close,
        stopLoss: close * 1.03,
        takeProfit: close * 0.94,
        confidence: 65 + (rsi - 70) / 2,
        indicators: { rsi: rsi }
      };
    }
    
    return null;
  }

  /**
   * Commodities Scanner Strategy - For Gold (XAU) and Silver (XAG)
   */
  async commoditiesScannerStrategy(data, rules) {
    const { rsiOverbought = 70, rsiOversold = 30 } = rules;
    const { rsi, macd, ma, close, support, resistance } = data;
    
    // Buy signal: RSI oversold or price near support with MACD confirmation
    if (rsi < rsiOversold || (Math.abs(close - support) < (resistance - support) * 0.03 && macd.histogram > 0)) {
      return {
        type: 'buy',
        entry: close,
        stopLoss: close * 0.985, // 1.5% stop for commodities
        takeProfit: close * 1.03, // 3% take profit
        confidence: 70 + Math.min((35 - rsi), 20),
        indicators: {
          rsi: rsi,
          macd: macd.value,
          support: support,
          resistance: resistance
        }
      };
    }
    
    // Sell signal: RSI overbought or price near resistance with MACD confirmation
    if (rsi > rsiOverbought || (Math.abs(close - resistance) < (resistance - support) * 0.03 && macd.histogram < 0)) {
      return {
        type: 'sell',
        entry: close,
        stopLoss: close * 1.015,
        takeProfit: close * 0.97,
        confidence: 70 + Math.min((rsi - 65), 20),
        indicators: {
          rsi: rsi,
          macd: macd.value,
          support: support,
          resistance: resistance
        }
      };
    }
    
    return null;
  }

  /**
   * Indices Scanner Strategy - For US30 and other indices
   */
  async indicesScannerStrategy(data, rules) {
    const { rsiOverbought = 70, rsiOversold = 30 } = rules;
    const { rsi, macd, ma, close } = data;
    
    // Buy signal: RSI oversold with MA support
    if (rsi < rsiOversold && close > ma.ma50) {
      return {
        type: 'buy',
        entry: close,
        stopLoss: ma.ma50 * 0.99,
        takeProfit: close * 1.025, // 2.5% target for indices
        confidence: 72 + (30 - rsi) / 2,
        indicators: {
          rsi: rsi,
          ma50: ma.ma50,
          macd: macd.value
        }
      };
    }
    
    // Sell signal: RSI overbought with MA resistance
    if (rsi > rsiOverbought && close < ma.ma20) {
      return {
        type: 'sell',
        entry: close,
        stopLoss: ma.ma20 * 1.01,
        takeProfit: close * 0.975,
        confidence: 72 + (rsi - 70) / 2,
        indicators: {
          rsi: rsi,
          ma20: ma.ma20,
          macd: macd.value
        }
      };
    }
    
    // MA crossover signals for indices
    if (ma.ma20 > ma.ma50 && close > ma.ma20 && macd.histogram > 0) {
      return {
        type: 'buy',
        entry: close,
        stopLoss: ma.ma50,
        takeProfit: close * 1.03,
        confidence: 68,
        indicators: {
          ma20: ma.ma20,
          ma50: ma.ma50,
          macd: macd.value
        }
      };
    }
    
    return null;
  }

  /**
   * Bollinger Band Breakout Strategy
   */
  async bollingerBreakoutStrategy(data, rules) {
    const { period = 20, stdDev = 2 } = rules;
    const { close, candles } = data;
    
    if (!candles || candles.length < period) {
      return null;
    }

    // Calculate Bollinger Bands
    const closes = candles.slice(0, period).map(c => c.close);
    const sma = this.calculateSMA(closes, period);
    const standardDev = this.calculateStandardDeviation(closes, sma);
    
    const upperBand = sma + (standardDev * stdDev);
    const lowerBand = sma - (standardDev * stdDev);
    const currentClose = candles[0].close;
    const previousClose = candles[1].close;
    
    // Buy signal: Price breaks above upper band
    if (currentClose > upperBand && previousClose <= upperBand) {
      return {
        type: 'buy',
        entry: currentClose,
        stopLoss: sma,
        takeProfit: currentClose + (upperBand - sma),
        confidence: 75,
        indicators: {
          upperBand,
          lowerBand,
          sma,
          breakout: 'upper'
        }
      };
    }
    
    // Sell signal: Price breaks below lower band
    if (currentClose < lowerBand && previousClose >= lowerBand) {
      return {
        type: 'sell',
        entry: currentClose,
        stopLoss: sma,
        takeProfit: currentClose - (sma - lowerBand),
        confidence: 75,
        indicators: {
          upperBand,
          lowerBand,
          sma,
          breakout: 'lower'
        }
      };
    }
    
    return null;
  }

  /**
   * Volume Surge Strategy
   */
  async volumeSurgeStrategy(data, rules) {
    const { volumeThreshold = 2.0, priceMove = 0.005 } = rules;
    const { volume, close, candles } = data;
    
    if (!candles || candles.length < 20 || !volume) {
      return null;
    }

    // Calculate average volume over last 20 periods
    const recentVolumes = candles.slice(0, 20).map(c => c.volume || 0).filter(v => v > 0);
    if (recentVolumes.length < 10) return null;
    
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const volumeRatio = volume / avgVolume;
    
    // Price movement from previous candle
    const previousClose = candles[1]?.close;
    if (!previousClose) return null;
    
    const priceChange = Math.abs(close - previousClose) / previousClose;
    
    // Volume surge with significant price movement
    if (volumeRatio >= volumeThreshold && priceChange >= priceMove) {
      const direction = close > previousClose ? 'buy' : 'sell';
      
      return {
        type: direction,
        entry: close,
        stopLoss: direction === 'buy' ? close * 0.98 : close * 1.02,
        takeProfit: direction === 'buy' ? close * 1.04 : close * 0.96,
        confidence: Math.min(80, 60 + (volumeRatio * 10)),
        indicators: {
          volume,
          avgVolume,
          volumeRatio,
          priceChange: priceChange * 100
        }
      };
    }
    
    return null;
  }

  /**
   * Price Action Patterns Strategy
   */
  async priceActionPatternsStrategy(data, rules) {
    const { minPatternSize = 0.002 } = rules;
    const { candles, close } = data;
    
    if (!candles || candles.length < 5) {
      return null;
    }

    const recent = candles.slice(0, 5);
    
    // Detect Bullish Engulfing Pattern
    const bullishEngulfing = this.detectBullishEngulfing(recent);
    if (bullishEngulfing) {
      return {
        type: 'buy',
        entry: close,
        stopLoss: recent[1].low * 0.995,
        takeProfit: close + (close - recent[1].low),
        confidence: 70,
        indicators: {
          pattern: 'Bullish Engulfing',
          bodySize: bullishEngulfing.bodySize
        }
      };
    }
    
    // Detect Bearish Engulfing Pattern
    const bearishEngulfing = this.detectBearishEngulfing(recent);
    if (bearishEngulfing) {
      return {
        type: 'sell',
        entry: close,
        stopLoss: recent[1].high * 1.005,
        takeProfit: close - (recent[1].high - close),
        confidence: 70,
        indicators: {
          pattern: 'Bearish Engulfing',
          bodySize: bearishEngulfing.bodySize
        }
      };
    }
    
    // Detect Hammer/Doji patterns
    const hammer = this.detectHammer(recent[0]);
    if (hammer && recent[1].close < recent[1].open) { // Hammer after bearish candle
      return {
        type: 'buy',
        entry: close,
        stopLoss: recent[0].low * 0.995,
        takeProfit: close * 1.02,
        confidence: 65,
        indicators: {
          pattern: 'Hammer',
          shadowRatio: hammer.shadowRatio
        }
      };
    }
    
    return null;
  }

  /**
   * Calculate Standard Deviation
   */
  calculateStandardDeviation(values, mean) {
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Detect Bullish Engulfing Pattern
   */
  detectBullishEngulfing(candles) {
    if (candles.length < 2) return null;
    
    const [current, previous] = candles;
    
    // Previous candle is bearish
    const prevBearish = previous.close < previous.open;
    // Current candle is bullish
    const currBullish = current.close > current.open;
    // Current body engulfs previous body
    const engulfs = current.close > previous.open && current.open < previous.close;
    
    if (prevBearish && currBullish && engulfs) {
      const bodySize = Math.abs(current.close - current.open) / current.open;
      return { bodySize };
    }
    
    return null;
  }

  /**
   * Detect Bearish Engulfing Pattern
   */
  detectBearishEngulfing(candles) {
    if (candles.length < 2) return null;
    
    const [current, previous] = candles;
    
    // Previous candle is bullish
    const prevBullish = previous.close > previous.open;
    // Current candle is bearish
    const currBearish = current.close < current.open;
    // Current body engulfs previous body
    const engulfs = current.close < previous.open && current.open > previous.close;
    
    if (prevBullish && currBearish && engulfs) {
      const bodySize = Math.abs(current.close - current.open) / current.open;
      return { bodySize };
    }
    
    return null;
  }

  /**
   * Detect Hammer Pattern
   */
  detectHammer(candle) {
    const bodySize = Math.abs(candle.close - candle.open);
    const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
    const upperShadow = candle.high - Math.max(candle.open, candle.close);
    
    // Hammer criteria: long lower shadow (2x body), small upper shadow
    const shadowRatio = lowerShadow / bodySize;
    
    if (shadowRatio >= 2 && upperShadow <= bodySize * 0.3) {
      return { shadowRatio };
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
