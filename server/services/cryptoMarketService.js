/**
 * Phase 3: Crypto Market Data Service
 * Real-time crypto data pipeline for flagship crypto assets:
 * BTC, ETH, SOL, XRP
 *
 * Primary Source: Binance REST & WebSocket API
 * Fallback Source: CoinGecko Public API
 * Cache: Redis + In-Memory
 * Broadcast: WebSocket Service
 */
const axios = require('axios');
const logger = require('../utils/logger');
const cache = require('./redisCache');
const wsService = require('./websocketService');
const { MarketData, Candle } = require('../models');

class CryptoMarketService {
  constructor() {
    this.assets = [
      { symbol: 'BTCUSD', binancePair: 'BTCUSDT', name: 'Bitcoin' },
      { symbol: 'ETHUSD', binancePair: 'ETHUSDT', name: 'Ethereum' },
      { symbol: 'SOLUSD', binancePair: 'SOLUSDT', name: 'Solana' },
      { symbol: 'XRPUSD', binancePair: 'XRPUSDT', name: 'XRP' }
    ];
    this.priceCache = new Map();
    this.isRunning = false;
    this.cacheTTL = 300; // 5 minutes cache
  }

  /**
   * Main fetch cycle called by background scanning or API requests
   */
  async fetchAllCryptoPrices() {
    if (this.isRunning) return this.getAllCachedPrices();
    this.isRunning = true;

    const results = {};
    try {
      for (const assetObj of this.assets) {
        try {
          const data = await this.fetchSingleCrypto(assetObj);
          if (data) {
            results[assetObj.symbol] = data;
          }
        } catch (err) {
          logger.warn(`CryptoMarketService: Error fetching ${assetObj.symbol}: ${err.message}`);
        }
      }
    } catch (error) {
      logger.error('CryptoMarketService fetchAllCryptoPrices error:', error.message);
    } finally {
      this.isRunning = false;
    }

    return results;
  }

  /**
   * Fetch price for a single crypto symbol using Binance primary + CoinGecko fallback
   */
  async fetchSingleCrypto(assetObj) {
    const { symbol, binancePair } = assetObj;
    const cacheKey = `crypto-price:${symbol}`;

    // 1. Check Redis/memory cache
    const cached = await cache.get(cacheKey);
    if (cached && (Date.now() - cached.updatedAt < 60000)) {
      return cached;
    }

    // 2. Fetch from Binance
    let data = await this.fetchFromBinance(binancePair, symbol);

    // 3. Fallback to CoinGecko if Binance fails
    if (!data) {
      data = await this.fetchFromCoinGecko(symbol);
    }

    if (data) {
      this.priceCache.set(symbol, data);
      await cache.set(cacheKey, data, this.cacheTTL);

      // Store in MarketData table
      await MarketData.create({
        asset: symbol,
        price: data.price,
        bid: data.bid || data.price,
        ask: data.ask || data.price,
        volume: data.volume || 0,
        change24h: data.change24h || 0,
        source: data.source,
        fetchedAt: new Date()
      }).catch(err => logger.debug('MarketData store silent error:', err.message));

      // Broadcast update via WebSocket
      wsService.broadcastMarketData(symbol, {
        price: data.price,
        change24h: data.change24h,
        high24h: data.high24h,
        low24h: data.low24h,
        volume: data.volume,
        timestamp: Date.now()
      });
    }

    return data;
  }

  /**
   * Binance 24hr Ticker Price API
   */
  async fetchFromBinance(binancePair, symbol) {
    try {
      const res = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
        params: { symbol: binancePair },
        timeout: 6000
      });

      if (res.data && res.data.lastPrice) {
        return {
          asset: symbol,
          price: parseFloat(res.data.lastPrice),
          bid: parseFloat(res.data.bidPrice || res.data.lastPrice),
          ask: parseFloat(res.data.askPrice || res.data.lastPrice),
          volume: parseFloat(res.data.volume || 0),
          change24h: parseFloat(res.data.priceChangePercent || 0),
          high24h: parseFloat(res.data.highPrice || res.data.lastPrice),
          low24h: parseFloat(res.data.lowPrice || res.data.lastPrice),
          source: 'binance',
          updatedAt: Date.now()
        };
      }
    } catch (err) {
      logger.debug(`Binance fetch failed for ${binancePair}: ${err.message}`);
    }
    return null;
  }

  /**
   * CoinGecko API Fallback
   */
  async fetchFromCoinGecko(symbol) {
    const cgMap = {
      'BTCUSD': 'bitcoin',
      'ETHUSD': 'ethereum',
      'SOLUSD': 'solana',
      'XRPUSD': 'ripple'
    };

    const cgId = cgMap[symbol];
    if (!cgId) return null;

    try {
      const res = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: cgId,
          vs_currencies: 'usd',
          include_24hr_change: true,
          include_24hr_vol: true
        },
        timeout: 6000
      });

      if (res.data && res.data[cgId]) {
        const item = res.data[cgId];
        return {
          asset: symbol,
          price: parseFloat(item.usd),
          bid: parseFloat(item.usd),
          ask: parseFloat(item.usd),
          volume: parseFloat(item.usd_24h_vol || 0),
          change24h: parseFloat(item.usd_24h_change || 0),
          high24h: parseFloat(item.usd),
          low24h: parseFloat(item.usd),
          source: 'coingecko',
          updatedAt: Date.now()
        };
      }
    } catch (err) {
      logger.debug(`CoinGecko fetch failed for ${symbol}: ${err.message}`);
    }
    return null;
  }

  /**
   * Fetch historical candles for crypto assets (15m, 1h, 4h)
   */
  async fetchCryptoCandles(symbol, timeframe = '1h', limit = 100) {
    const assetObj = this.assets.find(a => a.symbol === symbol);
    const binancePair = assetObj ? assetObj.binancePair : `${symbol}T`;

    const tfMap = {
      '15m': '15m',
      '1h': '1h',
      '4h': '4h'
    };
    const interval = tfMap[timeframe] || '1h';

    try {
      const res = await axios.get('https://api.binance.com/api/v3/klines', {
        params: {
          symbol: binancePair,
          interval: interval,
          limit: limit
        },
        timeout: 8000
      });

      if (res.data && Array.isArray(res.data)) {
        return res.data.map(k => ({
          time: k[0],
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5])
        }));
      }
    } catch (err) {
      logger.warn(`Crypto klines fetch error for ${symbol} ${timeframe}: ${err.message}`);
    }

    return [];
  }

  /**
   * Get all cached prices
   */
  getAllCachedPrices() {
    const result = {};
    for (const [symbol, data] of this.priceCache) {
      result[symbol] = data;
    }
    return result;
  }
}

module.exports = new CryptoMarketService();
