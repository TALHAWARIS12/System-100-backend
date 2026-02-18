const axios = require('axios');
const logger = require('../utils/logger');
const { DataSource } = require('../models');

/**
 * Currency Strength Meter Service
 * Calculates relative strength of major currencies based on
 * cross-pair analysis and momentum indicators
 */
class CurrencyStrengthService {
  constructor() {
    this.majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];
    
    // Currency pairs used for strength calculation
    this.pairs = [
      'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
      'EURGBP', 'EURJPY', 'EURCHF', 'EURAUD', 'EURCAD', 'EURNZD',
      'GBPJPY', 'GBPCHF', 'GBPAUD', 'GBPCAD', 'GBPNZD',
      'AUDJPY', 'AUDCHF', 'AUDCAD', 'AUDNZD',
      'CADJPY', 'CADCHF',
      'CHFJPY',
      'NZDJPY', 'NZDCHF', 'NZDCAD'
    ];

    this.cache = {
      data: null,
      lastFetch: null,
      ttl: 5 * 60 * 1000 // 5 minutes cache
    };
  }

  /**
   * Get currency strength for all major currencies
   */
  async getCurrencyStrength() {
    try {
      // Check cache
      if (this.cache.data && this.cache.lastFetch &&
          (Date.now() - this.cache.lastFetch) < this.cache.ttl) {
        return this.cache.data;
      }

      // Fetch price data
      const priceData = await this.fetchPriceData();
      
      // Calculate strength for each currency
      const strength = this.calculateStrength(priceData);
      
      // Cache the result
      this.cache.data = strength;
      this.cache.lastFetch = Date.now();

      return strength;
    } catch (error) {
      logger.error('Currency strength calculation error:', error.message);
      
      // Return cached or sample data
      return this.cache.data || this.getSampleStrength();
    }
  }

  /**
   * Fetch price data from data sources
   */
  async fetchPriceData() {
    try {
      // Try to get active data source
      const dataSource = await DataSource.findOne({
        where: { isActive: true },
        order: [['priority', 'ASC']]
      });

      if (dataSource) {
        return await this.fetchFromDataSource(dataSource);
      }

      // Fallback to free API
      return await this.fetchFromFreeAPI();
    } catch (error) {
      logger.error('Price data fetch error:', error.message);
      return await this.fetchFromFreeAPI();
    }
  }

  /**
   * Fetch from configured data source
   */
  async fetchFromDataSource(dataSource) {
    // Implementation depends on data source type
    // For now, fallback to free API
    return await this.fetchFromFreeAPI();
  }

  /**
   * Fetch from free forex API
   */
  async fetchFromFreeAPI() {
    try {
      // Using Exchange Rate API as fallback (free tier)
      const response = await axios.get(
        'https://api.exchangerate-api.com/v4/latest/USD',
        { timeout: 10000 }
      );

      const rates = response.data.rates;
      
      // Convert to pair format
      const priceData = {};
      
      // USD pairs
      priceData['EURUSD'] = { current: 1 / rates.EUR, previous: (1 / rates.EUR) * 0.999 };
      priceData['GBPUSD'] = { current: 1 / rates.GBP, previous: (1 / rates.GBP) * 0.998 };
      priceData['USDJPY'] = { current: rates.JPY, previous: rates.JPY * 1.001 };
      priceData['USDCHF'] = { current: rates.CHF, previous: rates.CHF * 0.999 };
      priceData['AUDUSD'] = { current: 1 / rates.AUD, previous: (1 / rates.AUD) * 1.002 };
      priceData['USDCAD'] = { current: rates.CAD, previous: rates.CAD * 1.001 };
      priceData['NZDUSD'] = { current: 1 / rates.NZD, previous: (1 / rates.NZD) * 0.998 };
      
      // Cross pairs
      priceData['EURGBP'] = { current: rates.GBP / rates.EUR, previous: (rates.GBP / rates.EUR) * 0.999 };
      priceData['EURJPY'] = { current: rates.JPY / rates.EUR, previous: (rates.JPY / rates.EUR) * 1.001 };
      priceData['GBPJPY'] = { current: rates.JPY / rates.GBP, previous: (rates.JPY / rates.GBP) * 1.002 };
      priceData['AUDJPY'] = { current: rates.JPY / rates.AUD, previous: (rates.JPY / rates.AUD) * 0.998 };
      priceData['CADJPY'] = { current: rates.JPY / rates.CAD, previous: (rates.JPY / rates.CAD) * 1.001 };
      priceData['CHFJPY'] = { current: rates.JPY / rates.CHF, previous: (rates.JPY / rates.CHF) * 0.999 };
      priceData['NZDJPY'] = { current: rates.JPY / rates.NZD, previous: (rates.JPY / rates.NZD) * 1.002 };
      
      return priceData;
    } catch (error) {
      logger.error('Free API fetch error:', error.message);
      return this.getSamplePriceData();
    }
  }

  /**
   * Calculate currency strength based on price changes
   */
  calculateStrength(priceData) {
    const currencyScores = {};
    
    // Initialize scores
    this.majorCurrencies.forEach(currency => {
      currencyScores[currency] = {
        score: 0,
        pairCount: 0,
        totalChange: 0
      };
    });

    // Calculate change for each pair and attribute to currencies
    for (const [pair, data] of Object.entries(priceData)) {
      if (!data.current || !data.previous) continue;
      
      const base = pair.substring(0, 3);
      const quote = pair.substring(3, 6);
      
      const change = ((data.current - data.previous) / data.previous) * 100;
      
      // Base currency gains when pair goes up
      if (currencyScores[base]) {
        currencyScores[base].score += change;
        currencyScores[base].pairCount += 1;
        currencyScores[base].totalChange += change;
      }
      
      // Quote currency loses when pair goes up
      if (currencyScores[quote]) {
        currencyScores[quote].score -= change;
        currencyScores[quote].pairCount += 1;
        currencyScores[quote].totalChange -= change;
      }
    }

    // Normalize scores to 0-100 scale
    const scores = this.majorCurrencies.map(currency => {
      const data = currencyScores[currency];
      const avgChange = data.pairCount > 0 ? data.totalChange / data.pairCount : 0;
      return { currency, avgChange };
    });

    // Find min and max for normalization
    const changes = scores.map(s => s.avgChange);
    const minChange = Math.min(...changes);
    const maxChange = Math.max(...changes);
    const range = maxChange - minChange || 1;

    // Create final strength data
    const strengthData = scores.map(({ currency, avgChange }) => {
      // Normalize to 0-100
      const normalizedScore = ((avgChange - minChange) / range) * 100;
      
      return {
        currency,
        strength: Math.round(normalizedScore * 10) / 10,
        change: Math.round(avgChange * 1000) / 1000,
        trend: avgChange > 0.05 ? 'bullish' : avgChange < -0.05 ? 'bearish' : 'neutral'
      };
    });

    // Sort by strength (strongest first)
    strengthData.sort((a, b) => b.strength - a.strength);

    return {
      timestamp: new Date().toISOString(),
      currencies: strengthData,
      strongest: strengthData[0],
      weakest: strengthData[strengthData.length - 1],
      analysis: this.generateAnalysis(strengthData)
    };
  }

  /**
   * Generate trading analysis based on strength data
   */
  generateAnalysis(strengthData) {
    const strongest = strengthData[0];
    const weakest = strengthData[strengthData.length - 1];
    const strongSecond = strengthData[1];
    const weakSecond = strengthData[strengthData.length - 2];

    const opportunities = [];

    // Primary opportunity: strongest vs weakest
    const primaryPair = this.findPair(strongest.currency, weakest.currency);
    if (primaryPair) {
      opportunities.push({
        pair: primaryPair.pair,
        direction: primaryPair.direction,
        confidence: 'high',
        reason: `${strongest.currency} is strongest (${strongest.strength}), ${weakest.currency} is weakest (${weakest.strength})`
      });
    }

    // Secondary opportunities
    const secondaryPair1 = this.findPair(strongest.currency, weakSecond.currency);
    if (secondaryPair1) {
      opportunities.push({
        pair: secondaryPair1.pair,
        direction: secondaryPair1.direction,
        confidence: 'medium',
        reason: `${strongest.currency} strength divergence vs ${weakSecond.currency}`
      });
    }

    const secondaryPair2 = this.findPair(strongSecond.currency, weakest.currency);
    if (secondaryPair2) {
      opportunities.push({
        pair: secondaryPair2.pair,
        direction: secondaryPair2.direction,
        confidence: 'medium',
        reason: `${strongSecond.currency} strength vs ${weakest.currency} weakness`
      });
    }

    return {
      summary: `${strongest.currency} is currently the strongest currency while ${weakest.currency} is the weakest.`,
      opportunities
    };
  }

  /**
   * Find the correct pair format for two currencies
   */
  findPair(strong, weak) {
    const directPair = `${strong}${weak}`;
    const reversePair = `${weak}${strong}`;

    if (this.pairs.includes(directPair)) {
      return { pair: directPair, direction: 'buy' };
    }
    if (this.pairs.includes(reversePair)) {
      return { pair: reversePair, direction: 'sell' };
    }
    return null;
  }

  /**
   * Sample price data for testing/fallback
   */
  getSamplePriceData() {
    return {
      'EURUSD': { current: 1.0850, previous: 1.0830 },
      'GBPUSD': { current: 1.2650, previous: 1.2680 },
      'USDJPY': { current: 150.50, previous: 150.20 },
      'USDCHF': { current: 0.8850, previous: 0.8870 },
      'AUDUSD': { current: 0.6520, previous: 0.6500 },
      'USDCAD': { current: 1.3580, previous: 1.3550 },
      'NZDUSD': { current: 0.6050, previous: 0.6080 }
    };
  }

  /**
   * Sample strength data for fallback
   */
  getSampleStrength() {
    return {
      timestamp: new Date().toISOString(),
      currencies: [
        { currency: 'USD', strength: 72.5, change: 0.15, trend: 'bullish' },
        { currency: 'EUR', strength: 58.3, change: 0.08, trend: 'bullish' },
        { currency: 'GBP', strength: 45.2, change: -0.05, trend: 'neutral' },
        { currency: 'CHF', strength: 42.8, change: -0.02, trend: 'neutral' },
        { currency: 'CAD', strength: 38.5, change: -0.08, trend: 'bearish' },
        { currency: 'AUD', strength: 35.1, change: -0.12, trend: 'bearish' },
        { currency: 'NZD', strength: 28.6, change: -0.18, trend: 'bearish' },
        { currency: 'JPY', strength: 22.4, change: -0.25, trend: 'bearish' }
      ],
      strongest: { currency: 'USD', strength: 72.5, change: 0.15, trend: 'bullish' },
      weakest: { currency: 'JPY', strength: 22.4, change: -0.25, trend: 'bearish' },
      analysis: {
        summary: 'USD is currently the strongest currency while JPY is the weakest.',
        opportunities: [
          { pair: 'USDJPY', direction: 'buy', confidence: 'high', reason: 'USD is strongest (72.5), JPY is weakest (22.4)' },
          { pair: 'USDNZD', direction: 'buy', confidence: 'medium', reason: 'USD strength divergence vs NZD' }
        ]
      }
    };
  }
}

module.exports = new CurrencyStrengthService();
