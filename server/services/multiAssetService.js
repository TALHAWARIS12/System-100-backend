/**
 * Phase 3: Multi-Asset Trades Hub Service
 * Completely separate strategy & signal management for non-Gold assets:
 *   - FOREX CURRENCIES: EURUSD, GBPUSD, GBPJPY, AUDUSD, USDCAD, NZDUSD, USDCHF
 *   - CRYPTO: BTCUSD, ETHUSD, SOLUSD, XRPUSD
 *   - INDICES & COMMODITIES: US30, NAS100
 *
 * Supports mandatory timeframes: 15m, 1h, 4h
 * Enforces 75%+ confidence score filtering and deduplication
 */
const logger = require('../utils/logger');
const { Signal, Trade, Candle } = require('../models');
const cryptoMarketService = require('./cryptoMarketService');
const marketDataService = require('./marketDataService');
const IndicatorEngine = require('./indicatorEngine');
const cache = require('./redisCache');
const wsService = require('./websocketService');

class MultiAssetService {
  constructor() {
    this.categories = {
      forex: ['EURUSD', 'GBPUSD', 'GBPJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF'],
      crypto: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD'],
      indices: ['US30', 'NAS100']
    };
    this.timeframes = ['15m', '1h', '4h'];
    this.confidenceThreshold = 75; // Mandatory 75%+ confidence filter
    this.dedupWindowMinutes = 30;   // 30-minute deduplication window
  }

  /**
   * Run scanner cycle across all multi-asset categories & timeframes
   */
  async scanAllAssets() {
    logger.info('🌐 MultiAssetService: Starting multi-asset scan cycle...');
    const summary = { generated: 0, skippedLowConfidence: 0, duplicates: 0 };

    for (const [category, assets] of Object.entries(this.categories)) {
      for (const asset of assets) {
        for (const timeframe of this.timeframes) {
          try {
            const res = await this.scanAssetTimeframe(asset, category, timeframe);
            if (res) {
              if (res.signal) summary.generated++;
              if (res.lowConfidence) summary.skippedLowConfidence++;
              if (res.duplicate) summary.duplicates++;
            }
          } catch (err) {
            logger.warn(`MultiAssetService error scanning ${asset} ${timeframe}: ${err.message}`);
          }
        }
      }
    }

    logger.info(`🌐 MultiAssetService: Scan complete — ${summary.generated} signals generated, ${summary.skippedLowConfidence} filtered (<75%), ${summary.duplicates} duplicates suppressed.`);
    return summary;
  }

  /**
   * Scan single asset and timeframe
   */
  async scanAssetTimeframe(asset, category, timeframe) {
    let candles = [];

    // Fetch candles depending on asset category
    if (category === 'crypto') {
      candles = await cryptoMarketService.fetchCryptoCandles(asset, timeframe, 100);
    } else {
      candles = await marketDataService.getCandles(asset, timeframe, 100);
    }

    if (!candles || candles.length < 30) {
      return null;
    }

    // Calculate technical indicators
    const indicators = IndicatorEngine.calculateAll(candles);
    if (!indicators) return null;

    // Detect technical pattern & signal
    const signalData = this.evaluateTechnicalSetup(asset, category, timeframe, indicators);
    if (!signalData) return null;

    // 1. Confidence Score Filter (Must be >= 75%)
    if (signalData.confidence < this.confidenceThreshold) {
      logger.debug(`MultiAssetService: Signal for ${asset} ${timeframe} confidence (${signalData.confidence}%) below ${this.confidenceThreshold}% threshold — filtered out.`);
      return { lowConfidence: true };
    }

    // 2. Deduplication Check (30-minute window)
    const isDup = await this.isDuplicateSignal(asset, signalData.direction, timeframe, signalData.entry);
    if (isDup) {
      logger.debug(`MultiAssetService: Duplicate signal for ${asset} ${timeframe} ${signalData.direction} — suppressed.`);
      return { duplicate: true };
    }

    // Save Signal record
    const savedSignal = await Signal.create({
      asset,
      timeframe,
      direction: signalData.direction,
      entry: signalData.entry,
      stopLoss: signalData.stopLoss,
      takeProfit: signalData.takeProfit1,
      takeProfit2: signalData.takeProfit2,
      takeProfit3: signalData.takeProfit3,
      pattern: signalData.pattern,
      confidence: signalData.confidence,
      strategy: 'MULTI_ASSET_HUB',
      indicators: signalData.indicators,
      status: 'active',
      source: 'scanner',
      publishedAt: new Date(),
      expiresAt: new Date(Date.now() + 4 * 3600000)
    });

    // Broadcast via WebSocket
    wsService.broadcastSignal({
      id: savedSignal.id,
      asset,
      category,
      timeframe,
      direction: signalData.direction,
      entry: signalData.entry,
      stopLoss: signalData.stopLoss,
      takeProfit1: signalData.takeProfit1,
      takeProfit2: signalData.takeProfit2,
      takeProfit3: signalData.takeProfit3,
      confidence: signalData.confidence,
      pattern: signalData.pattern,
      timestamp: new Date().toISOString()
    });

    logger.info(`✨ MultiAssetService SIGNAL: ${asset} ${timeframe} ${signalData.direction.toUpperCase()} @ ${signalData.entry} (Score: ${signalData.confidence}%)`);
    return { signal: savedSignal };
  }

  /**
   * Technical Setup Evaluator for Multi-Asset Hub
   */
  evaluateTechnicalSetup(asset, category, timeframe, indicators) {
    const { currentPrice, ma20, ma50, rsi, bollingerBands, atr } = indicators;
    const currentRSI = rsi.current;
    const ma20Val = ma20.current;
    const ma50Val = ma50.current;
    const bbUpper = bollingerBands.upper[bollingerBands.upper.length - 1];
    const bbLower = bollingerBands.lower[bollingerBands.lower.length - 1];
    const atrVal = atr.current || (currentPrice * 0.005);

    let direction = null;
    let confidence = 0;
    let pattern = 'Confluence Breakout';

    // Bullish Confluence
    if (ma20Val > ma50Val && currentRSI > 45 && currentRSI < 68 && currentPrice > ma20Val) {
      direction = 'buy';
      confidence = 75;

      if (currentRSI > 50 && currentRSI < 60) confidence += 10;
      if (currentPrice > bbUpper * 0.998) {
        confidence += 8;
        pattern = 'Bollinger Upper Breakout';
      }
    }
    // Bearish Confluence
    else if (ma20Val < ma50Val && currentRSI < 55 && currentRSI > 32 && currentPrice < ma20Val) {
      direction = 'sell';
      confidence = 75;

      if (currentRSI < 50 && currentRSI > 40) confidence += 10;
      if (currentPrice < bbLower * 1.002) {
        confidence += 8;
        pattern = 'Bollinger Lower Breakout';
      }
    }

    if (!direction) return null;

    // Calculate Multi-TP targets
    const slDist = atrVal * 1.8;
    const tp1Dist = atrVal * 2.5;
    const tp2Dist = atrVal * 4.5;
    const tp3Dist = atrVal * 7.0;

    const stopLoss = direction === 'buy' ? currentPrice - slDist : currentPrice + slDist;
    const takeProfit1 = direction === 'buy' ? currentPrice + tp1Dist : currentPrice - tp1Dist;
    const takeProfit2 = direction === 'buy' ? currentPrice + tp2Dist : currentPrice - tp2Dist;
    const takeProfit3 = direction === 'buy' ? currentPrice + tp3Dist : currentPrice - tp3Dist;

    const decimals = ['BTCUSD', 'US30', 'NAS100'].includes(asset) ? 2 : (asset.includes('JPY') ? 3 : 5);

    return {
      direction,
      entry: parseFloat(currentPrice.toFixed(decimals)),
      stopLoss: parseFloat(stopLoss.toFixed(decimals)),
      takeProfit1: parseFloat(takeProfit1.toFixed(decimals)),
      takeProfit2: parseFloat(takeProfit2.toFixed(decimals)),
      takeProfit3: parseFloat(takeProfit3.toFixed(decimals)),
      confidence: Math.min(confidence, 98),
      pattern,
      indicators: { rsi: currentRSI, ma20: ma20Val, ma50: ma50Val, atr: atrVal }
    };
  }

  /**
   * Check for duplicate signals within 30 minutes
   */
  async isDuplicateSignal(asset, direction, timeframe, entry) {
    const windowStart = new Date(Date.now() - this.dedupWindowMinutes * 60 * 1000);
    const existing = await Signal.findOne({
      where: {
        asset,
        direction,
        timeframe,
        publishedAt: { [require('sequelize').Op.gt]: windowStart }
      }
    });

    return !!existing;
  }
}

module.exports = new MultiAssetService();
