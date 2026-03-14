/**
 * Phase 2: Indicator Engine
 * Shared technical indicator calculations used by:
 *   - Gold Scanner Service
 *   - Phase 1 Scanner Engine (can be adopted later)
 *   - Signal Generator
 *
 * All calculations are pure functions — no API calls, no side effects.
 * Input: arrays of numbers (closes, highs, lows, volumes)
 * Output: indicator values
 */

class IndicatorEngine {
  /**
   * Simple Moving Average
   * @param {number[]} data - Price array (oldest first)
   * @param {number} period
   * @returns {number[]}
   */
  static SMA(data, period) {
    if (data.length < period) return [];
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(parseFloat((sum / period).toFixed(5)));
    }
    return result;
  }

  /**
   * Exponential Moving Average
   * @param {number[]} data
   * @param {number} period
   * @returns {number[]}
   */
  static EMA(data, period) {
    if (data.length < period) return [];
    const k = 2 / (period + 1);
    const result = [];

    // Seed with SMA for first value
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    result.push(parseFloat(ema.toFixed(5)));

    for (let i = period; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
      result.push(parseFloat(ema.toFixed(5)));
    }
    return result;
  }

  /**
   * Relative Strength Index
   * @param {number[]} closes
   * @param {number} period - Default 14
   * @returns {number[]}
   */
  static RSI(closes, period = 14) {
    if (closes.length < period + 1) return [];

    const changes = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }

    let avgGain = 0, avgLoss = 0;
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) avgGain += changes[i];
      else avgLoss += Math.abs(changes[i]);
    }
    avgGain /= period;
    avgLoss /= period;

    const rsiValues = [];
    for (let i = period; i < changes.length; i++) {
      const gain = changes[i] > 0 ? changes[i] : 0;
      const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsiValues.push(parseFloat((100 - 100 / (1 + rs)).toFixed(2)));
    }
    return rsiValues;
  }

  /**
   * Bollinger Bands
   * @param {number[]} closes
   * @param {number} period - Default 20
   * @param {number} stdDevMultiplier - Default 2
   * @returns {{ upper: number[], middle: number[], lower: number[] }}
   */
  static BollingerBands(closes, period = 20, stdDevMultiplier = 2) {
    if (closes.length < period) return { upper: [], middle: [], lower: [] };

    const bands = { upper: [], middle: [], lower: [] };
    for (let i = period - 1; i < closes.length; i++) {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
      const std = Math.sqrt(variance);

      bands.middle.push(parseFloat(mean.toFixed(5)));
      bands.upper.push(parseFloat((mean + stdDevMultiplier * std).toFixed(5)));
      bands.lower.push(parseFloat((mean - stdDevMultiplier * std).toFixed(5)));
    }
    return bands;
  }

  /**
   * Average True Range
   * @param {number[]} highs
   * @param {number[]} lows
   * @param {number[]} closes
   * @param {number} period - Default 14
   * @returns {number[]}
   */
  static ATR(highs, lows, closes, period = 14) {
    if (highs.length < period + 1) return [];

    const trueRanges = [];
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }

    const atrValues = [];
    let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
    atrValues.push(parseFloat(atr.toFixed(5)));

    for (let i = period; i < trueRanges.length; i++) {
      atr = (atr * (period - 1) + trueRanges[i]) / period;
      atrValues.push(parseFloat(atr.toFixed(5)));
    }
    return atrValues;
  }

  /**
   * MACD (Moving Average Convergence Divergence)
   * @param {number[]} closes
   * @param {number} fastPeriod - Default 12
   * @param {number} slowPeriod - Default 26
   * @param {number} signalPeriod - Default 9
   * @returns {{ macd: number[], signal: number[], histogram: number[] }}
   */
  static MACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEMA = IndicatorEngine.EMA(closes, fastPeriod);
    const slowEMA = IndicatorEngine.EMA(closes, slowPeriod);

    // Align arrays — slow EMA starts later
    const offset = slowPeriod - fastPeriod;
    const macdLine = [];
    for (let i = 0; i < slowEMA.length; i++) {
      macdLine.push(parseFloat((fastEMA[i + offset] - slowEMA[i]).toFixed(5)));
    }

    const signalLine = IndicatorEngine.EMA(macdLine, signalPeriod);
    const histOffset = macdLine.length - signalLine.length;
    const histogram = [];
    for (let i = 0; i < signalLine.length; i++) {
      histogram.push(parseFloat((macdLine[i + histOffset] - signalLine[i]).toFixed(5)));
    }

    return { macd: macdLine, signal: signalLine, histogram };
  }

  /**
   * Volume Spike Detection
   * Returns true if latest volume is > multiplier * average volume
   * @param {number[]} volumes
   * @param {number} period - Lookback for average (default 20)
   * @param {number} multiplier - Spike threshold (default 2.0)
   * @returns {{ isSpike: boolean, ratio: number, avgVolume: number }}
   */
  static volumeSpike(volumes, period = 20, multiplier = 2.0) {
    if (volumes.length < period + 1) return { isSpike: false, ratio: 0, avgVolume: 0 };

    const avgVolume = volumes.slice(-period - 1, -1).reduce((a, b) => a + b, 0) / period;
    const currentVolume = volumes[volumes.length - 1];
    const ratio = avgVolume > 0 ? currentVolume / avgVolume : 0;

    return {
      isSpike: ratio >= multiplier,
      ratio: parseFloat(ratio.toFixed(2)),
      avgVolume: parseFloat(avgVolume.toFixed(2))
    };
  }

  /**
   * Support & Resistance detection via local minima/maxima
   * @param {number[]} highs
   * @param {number[]} lows
   * @param {number} lookback - Default 5
   * @returns {{ support: number[], resistance: number[] }}
   */
  static supportResistance(highs, lows, lookback = 5) {
    const support = [];
    const resistance = [];

    for (let i = lookback; i < lows.length - lookback; i++) {
      const leftLows = lows.slice(i - lookback, i);
      const rightLows = lows.slice(i + 1, i + lookback + 1);
      if (leftLows.every(l => l >= lows[i]) && rightLows.every(l => l >= lows[i])) {
        support.push(lows[i]);
      }
    }

    for (let i = lookback; i < highs.length - lookback; i++) {
      const leftHighs = highs.slice(i - lookback, i);
      const rightHighs = highs.slice(i + 1, i + lookback + 1);
      if (leftHighs.every(h => h <= highs[i]) && rightHighs.every(h => h <= highs[i])) {
        resistance.push(highs[i]);
      }
    }

    return { support, resistance };
  }

  /**
   * Full indicator suite for a candle set
   * @param {{ open: number, high: number, low: number, close: number, volume: number }[]} candles
   * @returns {Object} All calculated indicators
   */
  static calculateAll(candles) {
    if (!candles || candles.length < 50) return null;

    const closes = candles.map(c => parseFloat(c.close));
    const highs = candles.map(c => parseFloat(c.high));
    const lows = candles.map(c => parseFloat(c.low));
    const volumes = candles.map(c => parseFloat(c.volume || 0));

    const ma20 = IndicatorEngine.SMA(closes, 20);
    const ma50 = IndicatorEngine.SMA(closes, 50);
    const rsi = IndicatorEngine.RSI(closes, 14);
    const bb = IndicatorEngine.BollingerBands(closes, 20, 2);
    const atr = IndicatorEngine.ATR(highs, lows, closes, 14);
    const macd = IndicatorEngine.MACD(closes);
    const volSpike = IndicatorEngine.volumeSpike(volumes);

    const currentPrice = closes[closes.length - 1];
    const currentMA20 = ma20.length > 0 ? ma20[ma20.length - 1] : null;
    const currentMA50 = ma50.length > 0 ? ma50[ma50.length - 1] : null;
    const currentRSI = rsi.length > 0 ? rsi[rsi.length - 1] : null;
    const currentATR = atr.length > 0 ? atr[atr.length - 1] : null;

    return {
      currentPrice,
      ma20: { values: ma20, current: currentMA20 },
      ma50: { values: ma50, current: currentMA50 },
      rsi: { values: rsi, current: currentRSI },
      bollingerBands: bb,
      atr: { values: atr, current: currentATR },
      macd,
      volumeSpike: volSpike,
      trend: IndicatorEngine.detectTrend(currentPrice, currentMA20, currentMA50),
      momentum: IndicatorEngine.detectMomentum(currentRSI, macd),
      raw: { closes, highs, lows, volumes }
    };
  }

  /**
   * Trend detection based on MA alignment
   */
  static detectTrend(price, ma20, ma50) {
    if (!ma20 || !ma50) return 'neutral';
    if (price > ma20 && ma20 > ma50) return 'bullish';
    if (price < ma20 && ma20 < ma50) return 'bearish';
    return 'neutral';
  }

  /**
   * Momentum detection based on RSI + MACD
   */
  static detectMomentum(rsi, macd) {
    if (!rsi) return 'neutral';

    let score = 0;
    if (rsi > 60) score += 1;
    else if (rsi < 40) score -= 1;

    if (macd && macd.histogram.length > 0) {
      const lastHist = macd.histogram[macd.histogram.length - 1];
      if (lastHist > 0) score += 1;
      else if (lastHist < 0) score -= 1;
    }

    if (score >= 2) return 'strong_bullish';
    if (score === 1) return 'bullish';
    if (score <= -2) return 'strong_bearish';
    if (score === -1) return 'bearish';
    return 'neutral';
  }
}

module.exports = IndicatorEngine;
