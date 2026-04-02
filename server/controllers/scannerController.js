const { ScannerResult, ScannerConfig } = require('../models');
const scannerEngine = require('../services/scannerEngine');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

// @desc    Get all active scanner results
// @route   GET /api/scanner/results
// @access  Private (subscription required)
exports.getResults = async (req, res, next) => {
  try {
    const { pair, timeframe, limit = 50 } = req.query;

    const where = { isActive: true };
    if (pair) where.pair = pair;
    if (timeframe) where.timeframe = timeframe;

    // First, clean up expired signals
    await ScannerResult.destroy({
      where: {
        expiresAt: { [require('sequelize').Op.lt]: new Date() }
      }
    });

    // Fetch signals with normal limit
    const results = await ScannerResult.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    // Smart deduplication: prevent exact duplicates within 30 minutes, allow multiple signals per pair
    const deduped = new Map();
    const resultsArray = Array.isArray(results) ? results : [];
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    for (const result of resultsArray) {
      // Key: pair + signalType + entry price (rounded to 2 decimals) to prevent exact duplicates
      const entryRounded = Math.round(parseFloat(result.entry) * 100) / 100;
      const key = `${result.pair}-${result.signalType}-${entryRounded}`;
      
      if (!deduped.has(key)) {
        // Only skip if we have an identical signal from the last 30 minutes
        const existingSignals = resultsArray.filter(r => {
          const rEntryRounded = Math.round(parseFloat(r.entry) * 100) / 100;
          const rKey = `${r.pair}-${r.signalType}-${rEntryRounded}`;
          return rKey === key && r.createdAt > thirtyMinutesAgo;
        });
        
        if (existingSignals.length <= 1) {
          deduped.set(key, result);
        }
      }
    }

    const uniqueResults = Array.from(deduped.values()).slice(0, parseInt(limit));

    res.status(200).json({
      success: true,
      count: uniqueResults.length,
      results: uniqueResults
    });
  } catch (error) {
    logger.error('Get scanner results error:', error);
    next(error);
  }
};

// @desc    Get scanner configurations
// @route   GET /api/scanner/configs
// @access  Private (admin/educator)
exports.getConfigs = async (req, res, next) => {
  try {
    const configs = await ScannerConfig.findAll({
      order: [['strategyName', 'ASC']]
    });

    res.status(200).json({
      success: true,
      count: configs.length,
      configs
    });
  } catch (error) {
    logger.error('Get scanner configs error:', error);
    next(error);
  }
};

// @desc    Create scanner configuration
// @route   POST /api/scanner/configs
// @access  Private (admin only)
exports.createConfig = async (req, res, next) => {
  try {
    const { strategyName, description, rules, timeframes, pairs, isEnabled, scanInterval } = req.body;

    const config = await ScannerConfig.create({
      strategyName,
      description,
      rules,
      timeframes,
      pairs,
      isEnabled,
      scanInterval
    });

    res.status(201).json({
      success: true,
      config
    });
  } catch (error) {
    logger.error('Create scanner config error:', error);
    next(error);
  }
};

// @desc    Update scanner configuration
// @route   PUT /api/scanner/configs/:id
// @access  Private (admin only)
exports.updateConfig = async (req, res, next) => {
  try {
    const config = await ScannerConfig.findByPk(req.params.id);

    if (!config) {
      return res.status(404).json({ success: false, message: 'Config not found' });
    }

    await config.update(req.body);

    res.status(200).json({
      success: true,
      config
    });
  } catch (error) {
    logger.error('Update scanner config error:', error);
    next(error);
  }
};

// @desc    Delete scanner configuration
// @route   DELETE /api/scanner/configs/:id
// @access  Private (admin only)
exports.deleteConfig = async (req, res, next) => {
  try {
    const config = await ScannerConfig.findByPk(req.params.id);

    if (!config) {
      return res.status(404).json({ success: false, message: 'Config not found' });
    }

    await config.destroy();

    res.status(200).json({
      success: true,
      message: 'Config deleted'
    });
  } catch (error) {
    logger.error('Delete scanner config error:', error);
    next(error);
  }
};

// @desc    Manually trigger scanner run
// @route   POST /api/scanner/run
// @access  Private (admin only)
exports.runScanner = async (req, res, next) => {
  try {
    // Run scanner asynchronously
    scannerEngine.runScanner().catch(err => {
      logger.error('Manual scanner run error:', err);
    });

    res.status(200).json({
      success: true,
      message: 'Scanner started'
    });
  } catch (error) {
    logger.error('Run scanner error:', error);
    next(error);
  }
};

// @desc    Get scanner statistics
// @route   GET /api/scanner/stats
// @access  Private
exports.getStats = async (req, res, next) => {
  try {
    const totalSignals = await ScannerResult.count({
      where: { isActive: true }
    });

    const signalsByType = await ScannerResult.findAll({
      attributes: [
        'signalType',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      where: { isActive: true },
      group: ['signalType']
    });

    const signalsByPair = await ScannerResult.findAll({
      attributes: [
        'pair',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      where: { isActive: true },
      group: ['pair'],
      limit: 10
    });

    res.status(200).json({
      success: true,
      stats: {
        totalSignals,
        signalsByType,
        signalsByPair
      }
    });
  } catch (error) {
    logger.error('Get scanner stats error:', error);
    next(error);
  }
};

// @desc    Clean up all old duplicate signals
// @route   DELETE /api/scanner/cleanup-duplicates
// @access  Private (admin only)
exports.cleanupDuplicates = async (req, res, next) => {
  try {
    // Strategy 1: For each (pair, signalType), keep only the most recent signal
    // and delete all others
    const allSignals = await ScannerResult.findAll({
      order: [['pair', 'ASC'], ['signalType', 'ASC'], ['createdAt', 'DESC']],
      raw: true
    });

    const toDelete = [];
    const seenKeys = new Set();

    for (const signal of allSignals) {
      const key = `${signal.pair}-${signal.signalType}`;
      
      if (!seenKeys.has(key)) {
        // Keep this one (first/most recent)
        seenKeys.add(key);
      } else {
        // Mark for deletion (duplicate)
        toDelete.push(signal.id);
      }
    }

    // Delete all duplicates
    if (toDelete.length > 0) {
      const result = await ScannerResult.destroy({
        where: { id: toDelete }
      });
      logger.info(`Cleaned up ${result} duplicate signal records from database`);
    }

    // Strategy 2: Also delete any signals older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oldDeleted = await ScannerResult.destroy({
      where: {
        createdAt: { [require('sequelize').Op.lt]: sevenDaysAgo }
      }
    });
    logger.info(`Deleted ${oldDeleted} old signals older than 7 days`);

    res.status(200).json({
      success: true,
      message: `Database cleaned successfully`,
      duplicatesRemoved: toDelete.length,
      oldSignalsRemoved: oldDeleted,
      totalRemoved: toDelete.length + oldDeleted
    });
  } catch (error) {
    logger.error('Cleanup duplicates error:', error);
    next(error);
  }
};
