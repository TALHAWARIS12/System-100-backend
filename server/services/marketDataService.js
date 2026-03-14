/**
 * Phase 2: Market Data Service
 * Continuous market data pipeline that:
 *   1. Fetches live prices from configured data sources (priority fallback)
 *   2. Stores tick data in MarketData table
 *   3. Aggregates and stores candles in Candle table
 *   4. Broadcasts updates via WebSocket
 *   5. Caches latest prices in memory (and Redis when available)
 *
 * This service runs continuously via cron. It does NOT use mock/static data.
 */
const axios = require('axios');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { MarketData, Candle, DataSource } = require('../models');
const wsService = require('./websocketService');

class MarketDataService {
  constructor() {
    // In-memory price cache (asset -> latest data)
    this.priceCache = new Map();
    // Tracked assets
    this.assets = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF'];
    this.isRunning = false;
    // Redis client (optional, set via setRedis)
    this.redis = null;
  }

  /**
   * Optionally attach a Redis client for distributed caching
   */
  setRedis(redisClient) {
    this.redis = redisClient;
    logger.info('MarketDataService: Redis cache enabled');
  }

  /**
   * Main fetch cycle — called by cron every 1-5 minutes
   * Fetches prices for all tracked assets, stores, and broadcasts
   */
  async fetchAll() {
    if (this.isRunning) {
      logger.debug('MarketDataService: Skipping — previous cycle still running');
      return;
    }

    this.isRunning = true;
    const results = { fetched: 0, errors: 0 };

    try {
      const sources = await DataSource.findAll({
        where: { isActive: true },
        order: [['priority', 'ASC']]
      });

      if (sources.length === 0) {
        logger.warn('MarketDataService: No active data sources configured');
        this.isRunning = false;
        return results;
      }

      for (const asset of this.assets) {
        try {
          const data = await this.fetchAssetPrice(asset, sources);
          if (data) {
            await this.processPrice(asset, data);
            results.fetched++;
          }
        } catch (err) {
          logger.error(`MarketDataService: Error fetching ${asset}: ${err.message}`);
          results.errors++;
        }
      }

      logger.info(`MarketDataService: Cycle complete — ${results.fetched} fetched, ${results.errors} errors`);
    } catch (error) {
      logger.error('MarketDataService: fetchAll error:', error.message);
    } finally {
      this.isRunning = false;
    }

    return results;
  }

  /**
   * Fetch price for a single asset using priority-ordered sources
   */
  async fetchAssetPrice(asset, sources) {
    for (const source of sources) {
      try {
        if (source.usageCount >= source.rateLimit) continue;

        const data = await this.fetchFromProvider(source, asset);
        if (data) {
          await source.update({
            usageCount: source.usageCount + 1,
            lastUsed: new Date(),
            lastError: null
          });
          return { ...data, source: source.provider };
        }
      } catch (err) {
        logger.debug(`MarketDataService: ${source.provider} failed for ${asset}: ${err.message}`);
        await source.update({ lastError: err.message }).catch(() => {});
        continue;
      }
    }

    // Fallback for gold
    if (asset === 'XAUUSD') {
      return await this.fetchGoldFallback();
    }

    return null;
  }

  /**
   * Route to correct provider
   */
  async fetchFromProvider(source, asset) {
    const { provider, baseUrl, apiKey } = source;
    const fromSymbol = asset.substring(0, 3);
    const toSymbol = asset.substring(3);

    switch (provider) {
      case 'twelvedata': {
        const res = await axios.get(`${baseUrl}/price`, {
          params: { symbol: `${fromSymbol}/${toSymbol}`, apikey: apiKey },
          timeout: 8000
        });
        if (res.data?.price) {
          return {
            price: parseFloat(res.data.price),
            timestamp: Date.now()
          };
        }
        return null;
      }

      case 'alphavantage': {
        const isCommodity = ['XAU', 'XAG'].includes(fromSymbol);
        const func = isCommodity ? 'CURRENCY_EXCHANGE_RATE' : 'CURRENCY_EXCHANGE_RATE';
        const res = await axios.get(`${baseUrl}/query`, {
          params: {
            function: func,
            from_currency: fromSymbol,
            to_currency: toSymbol,
            apikey: apiKey
          },
          timeout: 10000
        });
        const rate = res.data?.['Realtime Currency Exchange Rate'];
        if (rate) {
          return {
            price: parseFloat(rate['5. Exchange Rate']),
            bid: parseFloat(rate['8. Bid Price'] || 0),
            ask: parseFloat(rate['9. Ask Price'] || 0),
            timestamp: Date.now()
          };
        }
        return null;
      }

      case 'polygon': {
        const symbol = `C:${fromSymbol}${toSymbol}`;
        const res = await axios.get(`${baseUrl}/v2/last/nbbo/${symbol}`, {
          params: { apiKey },
          timeout: 8000
        });
        if (res.data?.results) {
          const r = res.data.results;
          return {
            price: (r.P + r.p) / 2,
            bid: r.p,
            ask: r.P,
            timestamp: r.t || Date.now()
          };
        }
        return null;
      }

      case 'finnhub': {
        const res = await axios.get(`${baseUrl}/api/v1/forex/candle`, {
          params: {
            symbol: `OANDA:${fromSymbol}_${toSymbol}`,
            resolution: '1',
            from: Math.floor(Date.now() / 1000) - 60,
            to: Math.floor(Date.now() / 1000),
            token: apiKey
          },
          timeout: 8000
        });
        if (res.data?.c?.length > 0) {
          const last = res.data.c.length - 1;
          return {
            price: res.data.c[last],
            volume: res.data.v?.[last] || 0,
            timestamp: (res.data.t?.[last] || Math.floor(Date.now() / 1000)) * 1000
          };
        }
        return null;
      }

      default:
        return null;
    }
  }

  /**
   * Fallback for XAUUSD via free APIs
   */
  async fetchGoldFallback() {
    try {
      const res = await axios.get('https://api.metals.live/v1/spot/gold', { timeout: 6000 });
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        const latest = res.data[res.data.length - 1];
        return {
          price: latest.price,
          timestamp: Date.now(),
          source: 'metals.live'
        };
      }
    } catch (e) { /* silent fallback */ }
    return null;
  }

  /**
   * Process a fetched price:
   *   1. Store in MarketData table
   *   2. Update in-memory cache
   *   3. Update Redis cache (if available)
   *   4. Broadcast via WebSocket
   *   5. Aggregate into candles
   */
  async processPrice(asset, data) {
    const { price, bid, ask, volume, source, timestamp } = data;

    // 1. Get previous price for change calculation
    const prev = this.priceCache.get(asset);
    const change24h = prev ? ((price - prev.price) / prev.price) * 100 : 0;

    // 2. Store in database
    await MarketData.create({
      asset,
      price,
      bid: bid || null,
      ask: ask || null,
      volume: volume || 0,
      change24h,
      source: source || 'unknown',
      fetchedAt: new Date(timestamp || Date.now())
    });

    // 3. Update in-memory cache
    const cacheEntry = {
      asset,
      price,
      bid,
      ask,
      volume,
      change24h,
      high24h: prev ? Math.max(prev.high24h || price, price) : price,
      low24h: prev ? Math.min(prev.low24h || price, price) : price,
      source,
      updatedAt: Date.now()
    };
    this.priceCache.set(asset, cacheEntry);

    // 4. Redis cache (if available)
    if (this.redis) {
      try {
        await this.redis.setex(`market:${asset}`, 120, JSON.stringify(cacheEntry));
      } catch (e) { /* Redis failure is non-fatal */ }
    }

    // 5. WebSocket broadcast
    wsService.broadcastMarketData(asset, {
      price,
      bid,
      ask,
      volume,
      change24h,
      high24h: cacheEntry.high24h,
      low24h: cacheEntry.low24h,
      timestamp: Date.now()
    });

    // 6. Aggregate into candle (1h timeframe)
    await this.aggregateCandle(asset, '1h', {
      price,
      volume: volume || 0,
      timestamp: timestamp || Date.now()
    });
  }

  /**
   * Aggregate a price tick into the current candle for a given timeframe
   */
  async aggregateCandle(asset, timeframe, tick) {
    const tfMs = this.getTimeframeMs(timeframe);
    const openTime = new Date(Math.floor(tick.timestamp / tfMs) * tfMs);

    try {
      const [candle, created] = await Candle.findOrCreate({
        where: { asset, timeframe, openTime },
        defaults: {
          open: tick.price,
          high: tick.price,
          low: tick.price,
          close: tick.price,
          volume: tick.volume,
          isClosed: false,
          source: 'aggregated'
        }
      });

      if (!created) {
        // Update existing candle
        await candle.update({
          high: Math.max(parseFloat(candle.high), tick.price),
          low: Math.min(parseFloat(candle.low), tick.price),
          close: tick.price,
          volume: parseFloat(candle.volume) + (tick.volume || 0)
        });
      }
    } catch (error) {
      // Unique constraint race condition — acceptable
      logger.debug(`Candle aggregation race for ${asset} ${timeframe}: ${error.message}`);
    }
  }

  /**
   * Store a batch of fetched candles (from provider time_series endpoint)
   */
  async storeCandleBatch(asset, timeframe, candles, source) {
    let stored = 0;
    for (const c of candles) {
      try {
        await Candle.upsert({
          asset,
          timeframe,
          openTime: new Date(c.time),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume || 0,
          isClosed: true,
          source
        });
        stored++;
      } catch (e) {
        // Skip duplicates
      }
    }
    logger.info(`MarketDataService: Stored ${stored}/${candles.length} candles for ${asset} ${timeframe}`);
    return stored;
  }

  /**
   * Get latest price from cache (memory -> Redis -> DB)
   */
  async getLatestPrice(asset) {
    // 1. Memory cache
    const cached = this.priceCache.get(asset);
    if (cached && Date.now() - cached.updatedAt < 120000) {
      return cached;
    }

    // 2. Redis
    if (this.redis) {
      try {
        const redisData = await this.redis.get(`market:${asset}`);
        if (redisData) {
          const parsed = JSON.parse(redisData);
          this.priceCache.set(asset, parsed);
          return parsed;
        }
      } catch (e) { /* fallthrough */ }
    }

    // 3. Database (most recent)
    const dbRecord = await MarketData.findOne({
      where: { asset },
      order: [['fetchedAt', 'DESC']]
    });

    if (dbRecord) {
      const entry = {
        asset: dbRecord.asset,
        price: parseFloat(dbRecord.price),
        bid: dbRecord.bid ? parseFloat(dbRecord.bid) : null,
        ask: dbRecord.ask ? parseFloat(dbRecord.ask) : null,
        volume: dbRecord.volume ? parseFloat(dbRecord.volume) : 0,
        change24h: dbRecord.change24h ? parseFloat(dbRecord.change24h) : 0,
        source: dbRecord.source,
        updatedAt: new Date(dbRecord.fetchedAt).getTime()
      };
      this.priceCache.set(asset, entry);
      return entry;
    }

    return null;
  }

  /**
   * Get recent candles from DB
   */
  async getCandles(asset, timeframe, limit = 200) {
    return await Candle.findAll({
      where: { asset, timeframe },
      order: [['openTime', 'DESC']],
      limit,
      raw: true
    });
  }

  /**
   * Get all cached prices
   */
  getAllCachedPrices() {
    const prices = {};
    for (const [asset, data] of this.priceCache) {
      prices[asset] = data;
    }
    return prices;
  }

  /**
   * Clean old market data (keep 7 days of ticks, 90 days of candles)
   */
  async cleanOldData() {
    try {
      const tickCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const candleCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const deletedTicks = await MarketData.destroy({
        where: { fetchedAt: { [Op.lt]: tickCutoff } }
      });

      const deletedCandles = await Candle.destroy({
        where: { openTime: { [Op.lt]: candleCutoff } }
      });

      logger.info(`MarketDataService cleanup: ${deletedTicks} ticks, ${deletedCandles} candles removed`);
    } catch (error) {
      logger.error('MarketDataService cleanup error:', error.message);
    }
  }

  /**
   * Convert timeframe string to milliseconds
   */
  getTimeframeMs(tf) {
    const map = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
      '1w': 604800000
    };
    return map[tf] || 3600000;
  }
}

// Singleton
module.exports = new MarketDataService();
