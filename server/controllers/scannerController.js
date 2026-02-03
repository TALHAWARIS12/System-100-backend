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

    const results = await ScannerResult.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      count: results.length,
      results
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
