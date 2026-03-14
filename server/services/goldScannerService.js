/**
 * Phase 2: Gold Trade Scanner Service
 * Dedicated XAUUSD scanning with System-100 strategy logic
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

class GoldScannerService {
  constructor() {
    this.pair = 'XAUUSD';
    this.timeframes = ['15m', '1h'];
    this.lastPrices = [];
    this.indicators = {};
    this.isRunning = false;
  }

  /**
   * Fetch live gold price from available data sources
   */
  async fetchGoldPrice() {
    try {
      const sources = await DataSource.findAll({
        where: { isActive: true },
        order: [['priority', 'ASC']]
      });

      for (const source of sources) {
        try {
          const data = await this.fetchFromProvider(source);
          if (data) return data;
        } catch (err) {
          logger.warn(`Gold price source ${source.name} failed: ${err.message}`);
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
        const res = await axios.get(`${baseUrl}/time_series`, {
          params: { symbol: 'XAU/USD', interval: '5min', outputsize: 100, apikey: apiKey },
          timeout: 10000
        });
        if (res.data?.values) {
          return res.data.values.map(v => ({
            time: new Date(v.datetime).getTime(),
            open: parseFloat(v.open),
            high: parseFloat(v.high),
            low: parseFloat(v.low),
            close: parseFloat(v.close),
            volume: parseFloat(v.volume || 0)
          })).reverse();
        }
        return null;
      }
      case 'alphavantage': {
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
      }
      case 'polygon': {
        const to = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        const res = await axios.get(`${baseUrl}/v2/aggs/ticker/C:XAUUSD/range/5/minute/${from}/${to}`, {
          params: { apiKey, limit: 100, sort: 'asc' },
          timeout: 10000
        });
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
      }
      default:
        return null;
    }
  }

  async fetchFromFallback() {
    try {
      // Try metals.live free API
      const res = await axios.get('https://api.metals.live/v1/spot/gold', { timeout: 8000 });
      if (res.data && Array.isArray(res.data)) {
        const price = res.data[res.data.length - 1];
        // Return a single-point data set for current price
        return [{
          time: Date.now(),
          open: price.price,
          high: price.price,
          low: price.price,
          close: price.price,
          volume: 0
        }];
      }
    } catch (e) { /* silent */ }
    return null;
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
   * System-100 Strategy Signal Detection
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

    // RSI oversold bounce
    if (lastRSI < 30) {
      buyScore += 25;
      reasons.push('RSI oversold (<30)');
    } else if (lastRSI < 40) {
      buyScore += 10;
      reasons.push('RSI approaching oversold');
    }

    // Price near lower Bollinger Band
    if (currentPrice <= lastBBLower * 1.005) {
      buyScore += 20;
      reasons.push('Price near lower Bollinger Band');
    }

    // Price above MA20 (momentum)
    if (currentPrice > lastMA20) {
      buyScore += 10;
      reasons.push('Price above MA20');
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

    // RSI overbought
    if (lastRSI > 70) {
      sellScore += 25;
      sellReasons.push('RSI overbought (>70)');
    } else if (lastRSI > 60) {
      sellScore += 10;
      sellReasons.push('RSI approaching overbought');
    }

    // Price near upper Bollinger Band
    if (currentPrice >= lastBBUpper * 0.995) {
      sellScore += 20;
      sellReasons.push('Price near upper Bollinger Band');
    }

    // Price below MA20
    if (currentPrice < lastMA20) {
      sellScore += 10;
      sellReasons.push('Price below MA20');
    }

    // Determine signal
    if (buyScore >= 40 && buyScore > sellScore) {
      signalType = 'buy';
      confidence = Math.min(buyScore, 98);
    } else if (sellScore >= 40 && sellScore > buyScore) {
      signalType = 'sell';
      confidence = Math.min(sellScore, 98);
      reasons = sellReasons;
    }

    if (!signalType) return null;

    // Calculate SL/TP using ATR
    const slDistance = currentATR * 2;
    const tpDistance = currentATR * 3;

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
        // Save to legacy ScannerResult (Phase 1 compat)
        for (const tf of this.timeframes) {
          const saved = await ScannerResult.create({
            pair: signal.pair,
            timeframe: tf,
            signalType: signal.signalType,
            entry: signal.entry,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
            confidence: signal.confidence,
            strategyName: 'system100_gold',
            indicators: signal.indicators,
            isActive: true,
            expiresAt: new Date(Date.now() + 4 * 3600000)
          });

          // Also persist to dedicated Signal model
          await Signal.create({
            asset: signal.pair,
            timeframe: tf,
            direction: signal.signalType,
            entry: signal.entry,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
            confidence: signal.confidence,
            strategy: 'system100_gold',
            indicators: signal.indicators,
            status: 'active',
            source: 'gold-scanner',
            publishedAt: new Date(),
            expiresAt: new Date(Date.now() + 4 * 3600000)
          });

          // Broadcast via WebSocket
          wsService.broadcastSignal({
            id: saved.id,
            ...signal,
            timeframe: tf,
            timestamp: new Date().toISOString()
          });
        }

        logger.info(`Gold signal detected: ${signal.signalType.toUpperCase()} @ ${signal.entry} (confidence: ${signal.confidence}%)`);
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
