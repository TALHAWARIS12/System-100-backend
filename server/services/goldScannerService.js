/**
 * Phase 2: Gold Trade Scanner Service
 * Dedicated XAUUSD scanning with GOLD CIRCLE CAPITAL strategy logic
 *
 * Uses shared IndicatorEngine for calculations.
 * Persists signals to the dedicated Signal model.
 * Stores fetched candles via marketDataService.
 */
const axios = require('axios');
const logger = require('../utils/logger');
const { ScannerResult, DataSource, Signal, Candle } = require('../models');
const wsService = require('./websocketService');
const IndicatorEngine = require('./indicatorEngine');
const rateLimiter = require('./rateLimiter');
const cache = require('./redisCache');

class GoldScannerService {
  constructor() {
    this.pair = 'XAUUSD';
    this.timeframes = ['15m', '1h'];
    this.lastPrices = [];
    this.indicators = {};
    this.isRunning = false;

    // Initialize rate limiters for free APIs
    rateLimiter.registerProvider('paxg-gold', 1200, 60 * 1000, 3);
  }

  /**
   * Fetch live gold price from available data sources with caching
   */
  async fetchGoldPrice() {
    try {
      // Check cache first (5 minute cache for gold prices)
      const cached = await cache.get('gold-price:latest');
      if (cached && cached.timestamp && (Date.now() - cached.timestamp) < 5 * 60 * 1000) {
        logger.debug('Using cached gold price data');
        return cached.data;
      }

      const sources = await DataSource.findAll({
        where: { isActive: true }, // Only use ACTIVE sources
        order: [['priority', 'ASC']]
      });

      if (sources.length === 0) {
        logger.warn('No active data sources configured, using free fallback API');
      }

      for (const source of sources) {
        try {
          const data = await this.fetchFromProvider(source);
          if (data) {
            // Cache the result
            await cache.set('gold-price:latest', { data, timestamp: Date.now() }, 300);
            return data;
          }
        } catch (err) {
          logger.warn(`Gold price source ${source.name} (${source.provider}) failed: ${err.message}`);
          continue;
        }
      }

      // Fallback: try free APIs
      return await this.fetchFromFallback();
    } catch (error) {
      logger.error('fetchGoldPrice error:', error.message);
      return null;
    }
  }

  async fetchFromProvider(source) {
    const { provider, baseUrl, apiKey } = source;

    switch (provider) {
      case 'twelvedata': {
        try {
          let key = apiKey;
          if (!key || key.includes('ledd') || key === '49b9ee3cb4314401aa9d074eb381bb75') {
            key = process.env.TWELVE_DATA_API_KEY || '442090d21edd439e8600b1f0dcfbab9a';
          }
          const res = await axios.get(`${baseUrl}/time_series`, {
            params: { symbol: 'XAU/USD', interval: '5min', outputsize: 100, apikey: key },
            timeout: 10000
          });
          if (res.data?.values && Array.isArray(res.data.values) && res.data.values.length > 0) {
            return res.data.values.map(v => ({
              time: new Date(v.datetime).getTime(),
              open: parseFloat(v.open),
              high: parseFloat(v.high),
              low: parseFloat(v.low),
              close: parseFloat(v.close),
              volume: parseFloat(v.volume || 0)
            })).reverse();
          }
          if (res.data?.code) {
            logger.warn(`TwelveData notice (${res.data.code}): ${res.data.message}`);
          }
          return null;
        } catch (error) {
          logger.warn(`TwelveData API error: ${error.message}`);
          return null;
        }
      }
      case 'alphavantage': {
        try {
          const res = await axios.get(`${baseUrl}/query`, {
            params: {
              function: 'FX_INTRADAY',
              from_symbol: 'XAU',
              to_symbol: 'USD',
              interval: '5min',
              outputsize: 'compact',
              apikey: apiKey
            },
            timeout: 10000
          });
          
          // Check for API errors in response body
          if (res.data?.Error || res.data?.Note) {
            const errorMsg = res.data.Error || res.data.Note;
            logger.warn(`Alpha Vantage API error: ${errorMsg}`);
            return null;
          }
          
          const tsKey = Object.keys(res.data).find(k => k.includes('Time Series'));
          if (tsKey && res.data[tsKey]) {
            return Object.entries(res.data[tsKey]).map(([time, vals]) => ({
              time: new Date(time).getTime(),
              open: parseFloat(vals['1. open']),
              high: parseFloat(vals['2. high']),
              low: parseFloat(vals['3. low']),
              close: parseFloat(vals['4. close']),
              volume: 0
            })).reverse();
          }
          return null;
        } catch (error) {
          logger.warn(`Alpha Vantage HTTP error: ${error.message}`);
          return null;
        }
      }
      case 'polygon': {
        try {
          const to = new Date().toISOString().split('T')[0];
          const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
          const res = await axios.get(`${baseUrl}/v2/aggs/ticker/C:XAUUSD/range/5/minute/${from}/${to}`, {
            params: { apiKey, limit: 100, sort: 'asc' },
            timeout: 10000
          });
          
          // Check for API errors
          if (res.data?.status === 'error' || !res.data?.results) {
            logger.warn(`Polygon API error: ${res.data?.message || 'No data'}`);
            return null;
          }
          
          if (res.data?.results) {
            return res.data.results.map(r => ({
              time: r.t,
              open: r.o,
              high: r.h,
              low: r.l,
              close: r.c,
              volume: r.v || 0
            }));
          }
          return null;
        } catch (error) {
          logger.warn(`Polygon HTTP error: ${error.message}`);
          return null;
        }
      }
      default:
        return null;
    }
  }

  async fetchFromFallback() {
    try {
      logger.info('📍 Using FREE API fallback for gold candles (Binance PAXG / DB)');
      
      // 1. Try Binance PAXG/USDT (tracks gold spot price 1:1, 100 historical 5m candles, free & unauthenticated)
      try {
        const res = await axios.get('https://api.binance.com/api/v3/klines', { 
          params: { symbol: 'PAXGUSDT', interval: '5m', limit: 100 },
          timeout: 8000
        });
        
        if (Array.isArray(res.data) && res.data.length >= 30) {
          const candles = res.data.map(k => ({
            time: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5] || 0)
          }));
          await cache.set('gold-price:latest', { data: candles, timestamp: Date.now() }, 300);
          logger.info(`✅ Fetched ${candles.length} gold candles via PAXGUSDT fallback`);
          return candles;
        }
      } catch (binanceErr) {
        logger.warn(`Binance PAXG fallback warning: ${binanceErr.message}`);
      }

      // 2. Fallback to cached candles in Candle model
      const dbCandles = await Candle.findAll({
        where: { asset: this.pair },
        order: [['openTime', 'DESC']],
        limit: 100,
        raw: true
      });

      if (dbCandles && dbCandles.length >= 30) {
        logger.info(`Using ${dbCandles.length} database candles for gold scanning`);
        const candles = dbCandles.reverse().map(c => ({
          time: new Date(c.openTime).getTime(),
          open: parseFloat(c.open),
          high: parseFloat(c.high),
          low: parseFloat(c.low),
          close: parseFloat(c.close),
          volume: parseFloat(c.volume || 0)
        }));
        return candles;
      }

      return null;
    } catch (error) {
      logger.error(`Free API fallback failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate technical indicators using shared IndicatorEngine
   */
  calculateIndicators(candles) {
    if (!candles || candles.length < 50) return null;
    return IndicatorEngine.calculateAll(candles);
  }

  // Indicator calculations now delegated to IndicatorEngine
  // See: server/services/indicatorEngine.js

  /**
   * GOLD CIRCLE CAPITAL Strategy Signal Detection
   * Adapted to work with IndicatorEngine.calculateAll() output
   */
  detectSignal(indicators) {
    if (!indicators) return null;

    const { currentPrice, ma20, ma50, rsi, bollingerBands, atr } = indicators;

    const lastMA20 = ma20.current;
    const lastMA50 = ma50.current;
    const prevMA20 = ma20.values.length > 1 ? ma20.values[ma20.values.length - 2] : lastMA20;
    const prevMA50 = ma50.values.length > 1 ? ma50.values[ma50.values.length - 2] : lastMA50;
    const lastRSI = rsi.current;
    const lastBBUpper = bollingerBands.upper[bollingerBands.upper.length - 1];
    const lastBBLower = bollingerBands.lower[bollingerBands.lower.length - 1];
    const lastBBMiddle = bollingerBands.middle[bollingerBands.middle.length - 1];
    const currentATR = atr.current;

    let signalType = null;
    let confidence = 0;
    let reasons = [];

    // ─── BUY Signal Detection ───
    let buyScore = 0;

    // MA CrossOver (MA20 crosses above MA50)
    if (prevMA20 <= prevMA50 && lastMA20 > lastMA50) {
      buyScore += 30;
      reasons.push('MA20 crossed above MA50');
    } else if (lastMA20 > lastMA50) {
      buyScore += 15;
      reasons.push('Price above MA50 (bullish trend)');
    }

    // Price above MA20 (momentum)
    if (currentPrice > lastMA20) {
      buyScore += 15;
      reasons.push('Price above MA20 (bullish momentum)');
    }

    // RSI oversold bounce or bullish momentum
    if (lastRSI < 35) {
      buyScore += 25;
      reasons.push('RSI oversold bounce (<35)');
    } else if (lastRSI >= 50 && lastRSI <= 65) {
      buyScore += 15;
      reasons.push('RSI healthy bullish momentum (50-65)');
    } else if (lastRSI < 45) {
      buyScore += 10;
      reasons.push('RSI approaching oversold');
    }

    // Price near lower Bollinger Band
    if (currentPrice <= lastBBLower * 1.005) {
      buyScore += 20;
      reasons.push('Price near lower Bollinger Band');
    }

    // MACD bullish confirmation
    if (indicators.macd?.histogram && indicators.macd.histogram.length > 0) {
      const hist = indicators.macd.histogram[indicators.macd.histogram.length - 1];
      if (hist > 0) {
        buyScore += 10;
        reasons.push('MACD positive histogram');
      }
    }

    // ─── SELL Signal Detection ───
    let sellScore = 0;
    let sellReasons = [];

    // MA CrossUnder (MA20 crosses below MA50)
    if (prevMA20 >= prevMA50 && lastMA20 < lastMA50) {
      sellScore += 30;
      sellReasons.push('MA20 crossed below MA50');
    } else if (lastMA20 < lastMA50) {
      sellScore += 15;
      sellReasons.push('Price below MA50 (bearish trend)');
    }

    // Price below MA20 (momentum)
    if (currentPrice < lastMA20) {
      sellScore += 15;
      sellReasons.push('Price below MA20 (bearish momentum)');
    }

    // RSI overbought or bearish momentum
    if (lastRSI > 65) {
      sellScore += 25;
      sellReasons.push('RSI overbought rejection (>65)');
    } else if (lastRSI >= 35 && lastRSI <= 50) {
      sellScore += 15;
      sellReasons.push('RSI bearish momentum (35-50)');
    } else if (lastRSI > 55) {
      sellScore += 10;
      sellReasons.push('RSI approaching overbought');
    }

    // Price near upper Bollinger Band
    if (currentPrice >= lastBBUpper * 0.995) {
      sellScore += 20;
      sellReasons.push('Price near upper Bollinger Band');
    }

    // MACD bearish confirmation
    if (indicators.macd?.histogram && indicators.macd.histogram.length > 0) {
      const hist = indicators.macd.histogram[indicators.macd.histogram.length - 1];
      if (hist < 0) {
        sellScore += 10;
        sellReasons.push('MACD negative histogram');
      }
    }

    // Determine signal (threshold score >= 30)
    if (buyScore >= 30 && buyScore > sellScore) {
      signalType = 'buy';
      confidence = Math.min(Math.max(buyScore + 40, 75), 98);
    } else if (sellScore >= 30 && sellScore > buyScore) {
      signalType = 'sell';
      confidence = Math.min(Math.max(sellScore + 40, 75), 98);
      reasons = sellReasons;
    }

    if (!signalType) return null;

    // Pattern classification
    let pattern = 'Gold Circle Capital Strategy';
    if (reasons.some(r => r.includes('crossed'))) {
      pattern = 'MA Crossover Confluence';
    } else if (reasons.some(r => r.includes('oversold') || r.includes('overbought'))) {
      pattern = 'RSI Dynamic Reversal';
    } else if (reasons.some(r => r.includes('momentum'))) {
      pattern = 'Trend Continuation Setup';
    } else if (reasons.some(r => r.includes('Bollinger'))) {
      pattern = 'Bollinger Volatility Breakout';
    }

    // Calculate SL/TP using ATR
    const slDistance = Math.max(currentATR * 2, currentPrice * 0.003);
    const tpDistance = Math.max(currentATR * 3, currentPrice * 0.005);
    const tp2Distance = Math.max(currentATR * 5, currentPrice * 0.008);
    const tp3Distance = Math.max(currentATR * 7, currentPrice * 0.012);

    return {
      pair: this.pair,
      signalType,
      entry: currentPrice,
      stopLoss: signalType === 'buy' 
        ? parseFloat((currentPrice - slDistance).toFixed(2))
        : parseFloat((currentPrice + slDistance).toFixed(2)),
      takeProfit: signalType === 'buy'
        ? parseFloat((currentPrice + tpDistance).toFixed(2))
        : parseFloat((currentPrice - tpDistance).toFixed(2)),
      takeProfit2: signalType === 'buy'
        ? parseFloat((currentPrice + tp2Distance).toFixed(2))
        : parseFloat((currentPrice - tp2Distance).toFixed(2)),
      takeProfit3: signalType === 'buy'
        ? parseFloat((currentPrice + tp3Distance).toFixed(2))
        : parseFloat((currentPrice - tp3Distance).toFixed(2)),
      pattern,
      confidence,
      reasons,
      indicators: {
        ma20: lastMA20,
        ma50: lastMA50,
        rsi: lastRSI,
        bbUpper: lastBBUpper,
        bbLower: lastBBLower,
        bbMiddle: lastBBMiddle,
        atr: currentATR
      }
    };
  }

  /**
   * Store fetched candles in the Candle model for persistence
   */
  async storeCandlesBatch(candles, timeframe = '5m') {
    try {
      const records = candles.map(c => ({
        asset: this.pair,
        timeframe,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 0,
        openTime: new Date(c.time),
        closeTime: new Date(c.time + (timeframe === '5m' ? 5 * 60000 : 60 * 60000)),
        source: 'gold_scanner',
        isClosed: true
      }));

      await Candle.bulkCreate(records, { ignoreDuplicates: true });
    } catch (err) {
      logger.warn('Gold candle storage warning:', err.message);
    }
  }

  /**
   * Run a full scan cycle
   */
  async scan() {
    try {
      const candles = await this.fetchGoldPrice();
      if (!candles || candles.length < 50) {
        logger.warn('Not enough gold price data for scanning');
        return null;
      }

      this.lastPrices = candles;

      // Store candles in persistent Candle model
      await this.storeCandlesBatch(candles);

      const indicators = this.calculateIndicators(candles);
      this.indicators = indicators;

      const signal = this.detectSignal(indicators);

      if (signal) {
        // Primary timeframe for the signal (15m is preferred)
        const primaryTimeframe = '15m';
        
        // Check if this exact signal already exists within the last 30 minutes
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60000);
        const existingSignal = await ScannerResult.findOne({
          where: {
            pair: signal.pair,
            timeframe: primaryTimeframe,
            signalType: signal.signalType,
            entry: signal.entry,
            createdAt: { [require('sequelize').Op.gt]: thirtyMinsAgo }
          }
        });

        if (existingSignal) {
          logger.info(`Duplicate signal detected for ${signal.pair} ${signal.signalType} @ ${signal.entry} - skipping`);
          return { signal: null, duplicate: true, reason: 'Recent duplicate signal' };
        }

        // Save to legacy ScannerResult (Phase 1 compat) - single record only
        const saved = await ScannerResult.create({
          pair: signal.pair,
          timeframe: primaryTimeframe,
          signalType: signal.signalType,
          entry: signal.entry,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          takeProfit2: signal.takeProfit2,
          takeProfit3: signal.takeProfit3,
          pattern: signal.pattern,
          confidence: signal.confidence,
          strategyName: 'GOLD_CIRCLE_CAPITAL',
          indicators: signal.indicators,
          isActive: true,
          expiresAt: new Date(Date.now() + 24 * 3600000)
        });

        // Also persist to dedicated Signal model (single record)
        await Signal.create({
          asset: signal.pair,
          timeframe: primaryTimeframe,
          direction: signal.signalType,
          entry: signal.entry,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          takeProfit2: signal.takeProfit2,
          takeProfit3: signal.takeProfit3,
          pattern: signal.pattern,
          confidence: signal.confidence,
          strategy: 'GOLD_CIRCLE_CAPITAL',
          indicators: signal.indicators,
          status: 'active',
          source: 'gold-scanner',
          publishedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 3600000)
        });

        // Broadcast via WebSocket - single signal
        wsService.broadcastSignal({
          id: saved.id,
          ...signal,
          timeframe: primaryTimeframe,
          timestamp: new Date().toISOString()
        });

        logger.info(`Gold signal detected: ${signal.signalType.toUpperCase()} @ ${signal.entry} (confidence: ${signal.confidence}%) on ${primaryTimeframe}`);
      }

      // Broadcast market data update regardless
      wsService.broadcastMarketData('XAUUSD', {
        price: candles[candles.length - 1].close,
        indicators,
        timestamp: new Date().toISOString()
      });

      return { signal, indicators, candles: candles.slice(-50) };
    } catch (error) {
      logger.error('Gold scanner error:', error);
      return null;
    }
  }

  /**
   * Get current scanner state for API response
   */
  getState() {
    return {
      pair: this.pair,
      timeframes: this.timeframes,
      isRunning: this.isRunning,
      lastPriceCount: this.lastPrices.length,
      indicators: this.indicators,
      lastPrice: this.lastPrices.length > 0 ? this.lastPrices[this.lastPrices.length - 1] : null
    };
  }
}

module.exports = new GoldScannerService();
