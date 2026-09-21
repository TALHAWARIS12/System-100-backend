const { Trade, User } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

// @desc    Get all trades (visible only)
// @route   GET /api/trades
// @access  Private (subscription required)
exports.getTrades = async (req, res, next) => {
  try {
    const { status, asset, category, timeframe, limit = 50 } = req.query;

    const where = { isVisible: true };
    if (status) where.status = status;
    if (asset) where.asset = asset;
    if (category) where.category = category;
    if (timeframe) where.timeframe = timeframe;

    const trades = await Trade.findAll({
      where,
      include: [{
        model: User,
        as: 'educator',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      count: trades.length,
      trades
    });
  } catch (error) {
    logger.error('Get trades error:', error);
    next(error);
  }
};

// @desc    Get single trade
// @route   GET /api/trades/:id
// @access  Private (subscription required)
exports.getTrade = async (req, res, next) => {
  try {
    const trade = await Trade.findOne({
      where: {
        id: req.params.id,
        isVisible: true
      },
      include: [{
        model: User,
        as: 'educator',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }]
    });

    if (!trade) {
      return res.status(404).json({ success: false, message: 'Trade not found' });
    }

    res.status(200).json({
      success: true,
      trade
    });
  } catch (error) {
    logger.error('Get trade error:', error);
    next(error);
  }
};

// @desc    Create trade (supports multi-TP setup)
// @route   POST /api/trades
// @access  Private (educator/admin)
exports.createTrade = async (req, res, next) => {
  try {
    const {
      asset,
      direction,
      entry,
      stopLoss,
      takeProfit,
      takeProfit1,
      takeProfit2,
      takeProfit3,
      timeframe = '1h',
      category = 'forex',
      rrRatio,
      pipMovement,
      notes,
      isVisible
    } = req.body;

    const mainTP = takeProfit || takeProfit1 || entry;

    // Calculate R:R ratio if not supplied
    let calculatedRR = rrRatio;
    if (!calculatedRR && entry && stopLoss && mainTP) {
      const risk = Math.abs(parseFloat(entry) - parseFloat(stopLoss));
      const reward = Math.abs(parseFloat(mainTP) - parseFloat(entry));
      if (risk > 0) {
        calculatedRR = parseFloat((reward / risk).toFixed(2));
      }
    }

    const trade = await Trade.create({
      educatorId: req.user.id,
      asset,
      direction,
      entry,
      stopLoss,
      takeProfit: mainTP,
      takeProfit1: takeProfit1 || mainTP,
      takeProfit2: takeProfit2 || null,
      takeProfit3: takeProfit3 || null,
      timeframe,
      category,
      rrRatio: calculatedRR || null,
      pipMovement: pipMovement || null,
      notes,
      isVisible: isVisible !== undefined ? isVisible : true,
      status: 'active'
    });

    res.status(201).json({
      success: true,
      trade
    });
  } catch (error) {
    logger.error('Create trade error:', error);
    next(error);
  }
};

// @desc    Update trade
// @route   PUT /api/trades/:id
// @access  Private (educator/admin - own trades only)
exports.updateTrade = async (req, res, next) => {
  try {
    const trade = await Trade.findByPk(req.params.id);

    if (!trade) {
      return res.status(404).json({ success: false, message: 'Trade not found' });
    }

    // Check ownership (unless admin)
    if (req.user.role !== 'admin' && trade.educatorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this trade'
      });
    }

    await trade.update(req.body);

    res.status(200).json({
      success: true,
      trade
    });
  } catch (error) {
    logger.error('Update trade error:', error);
    next(error);
  }
};

// @desc    Delete trade
// @route   DELETE /api/trades/:id
// @access  Private (educator/admin - own trades only)
exports.deleteTrade = async (req, res, next) => {
  try {
    const trade = await Trade.findByPk(req.params.id);

    if (!trade) {
      return res.status(404).json({ success: false, message: 'Trade not found' });
    }

    // Check ownership (unless admin)
    if (req.user.role !== 'admin' && trade.educatorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this trade'
      });
    }

    await trade.destroy();

    res.status(200).json({
      success: true,
      message: 'Trade deleted'
    });
  } catch (error) {
    logger.error('Delete trade error:', error);
    next(error);
  }
};

// @desc    Close trade
// @route   POST /api/trades/:id/close
// @access  Private (educator/admin - own trades only)
exports.closeTrade = async (req, res, next) => {
  try {
    const { closePrice, result, pips } = req.body;
    const trade = await Trade.findByPk(req.params.id);

    if (!trade) {
      return res.status(404).json({ success: false, message: 'Trade not found' });
    }

    // Check ownership (unless admin)
    if (req.user.role !== 'admin' && trade.educatorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to close this trade'
      });
    }

    await trade.update({
      status: 'closed',
      closePrice,
      result,
      pips,
      closedAt: new Date()
    });

    res.status(200).json({
      success: true,
      trade
    });
  } catch (error) {
    logger.error('Close trade error:', error);
    next(error);
  }
};

// @desc    Get educator's trades
// @route   GET /api/trades/educator/mine
// @access  Private (educator/admin)
exports.getMyTrades = async (req, res, next) => {
  try {
    const { status, limit = 50 } = req.query;

    const where = { educatorId: req.user.id };
    if (status) where.status = status;

    const trades = await Trade.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      count: trades.length,
      trades
    });
  } catch (error) {
    logger.error('Get my trades error:', error);
    next(error);
  }
};

// @desc    Get trade statistics
// @route   GET /api/trades/stats
// @access  Private
exports.getTradeStats = async (req, res, next) => {
  try {
    const totalTrades = await Trade.count({
      where: { isVisible: true }
    });

    const activeTrades = await Trade.count({
      where: { status: 'active', isVisible: true }
    });

    const closedTrades = await Trade.count({
      where: { status: 'closed', isVisible: true }
    });

    const winRate = await Trade.count({
      where: { result: 'win', isVisible: true }
    });

    res.status(200).json({
      success: true,
      stats: {
        totalTrades,
        activeTrades,
        closedTrades,
        winRate: closedTrades > 0 ? ((winRate / closedTrades) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    logger.error('Get trade stats error:', error);
    next(error);
  }
};
