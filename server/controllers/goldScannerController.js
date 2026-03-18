/**
 * Phase 2: Gold Scanner Controller
 * Exposes gold scanner state and triggers via REST API
 */
const goldScannerService = require('../services/goldScannerService');
const { ScannerResult } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

// @desc    Get current gold scanner state
// @route   GET /api/gold-scanner/state
exports.getState = async (req, res, next) => {
  try {
    const state = goldScannerService.getState();
    res.json({ success: true, state });
  } catch (error) {
    logger.error('Get gold scanner state error:', error);
    next(error);
  }
};

// @desc    Trigger a manual scan
// @route   POST /api/gold-scanner/scan
exports.triggerScan = async (req, res, next) => {
  try {
    const result = await goldScannerService.scan();
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Trigger scan error:', error);
    next(error);
  }
};

// @desc    Get recent gold signals
// @route   GET /api/gold-scanner/signals
exports.getSignals = async (req, res, next) => {
  try {
    const { limit = 20, active } = req.query;
    
    const where = { pair: 'XAUUSD' };
    if (active === 'true') {
      where.isActive = true;
      where.expiresAt = { [Op.gt]: new Date() };
    }

    // Clean up expired signals first
    await ScannerResult.destroy({
      where: {
        expiresAt: { [Op.lt]: new Date() }
      }
    });

    const signals = await ScannerResult.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit) * 3 // Fetch extra to deduplicate
    });

    // Aggressive deduplication: keep only ONE signal per signalType
    // (one BUY and one SELL max for XAUUSD)
    const deduped = {};
    const signalsArray = Array.isArray(signals) ? signals : [];
    
    for (const signal of signalsArray) {
      const signalType = signal.signalType; // 'buy' or 'sell'
      
      // Only keep the first (most recent) signal for this type
      if (!deduped[signalType]) {
        deduped[signalType] = signal;
      }
    }

    const uniqueSignals = Object.values(deduped).slice(0, parseInt(limit));

    res.json({ success: true, signals: uniqueSignals });
  } catch (error) {
    logger.error('Get gold signals error:', error);
    next(error);
  }
};

// @desc    Get gold price history for charts
// @route   GET /api/gold-scanner/prices
exports.getPrices = async (req, res, next) => {
  try {
    const candles = await goldScannerService.fetchGoldPrice();
    const indicators = candles && candles.length >= 50 
      ? goldScannerService.calculateIndicators(candles) 
      : null;

    res.json({
      success: true,
      data: {
        candles: candles || [],
        indicators,
        pair: 'XAUUSD',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Get gold prices error:', error);
    next(error);
  }
};
