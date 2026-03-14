/**
 * Phase 2: Trade Journal Controller
 * Personal trade logging and analytics
 */
const { TradeJournal, Trade, User } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const logger = require('../utils/logger');

// @desc    Get all journal entries for user
// @route   GET /api/journal
exports.getEntries = async (req, res, next) => {
  try {
    const { status, result, asset, strategy, limit = 50, offset = 0 } = req.query;
    
    const where = { userId: req.user.id };
    if (status) where.status = status;
    if (result) where.result = result;
    if (asset) where.asset = { [Op.iLike]: `%${asset}%` };
    if (strategy) where.strategy = strategy;

    const { rows: entries, count } = await TradeJournal.findAndCountAll({
      where,
      order: [['enteredAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({ success: true, entries, total: count });
  } catch (error) {
    logger.error('Get journal entries error:', error);
    next(error);
  }
};

// @desc    Create journal entry
// @route   POST /api/journal
exports.createEntry = async (req, res, next) => {
  try {
    const {
      asset, direction, entry, exit, stopLoss, takeProfit, lotSize,
      strategy, timeframe, notes, emotionTag, screenshotUrl, linkedSignalId
    } = req.body;

    const journalEntry = await TradeJournal.create({
      userId: req.user.id,
      asset,
      direction,
      entry,
      exit: exit || null,
      stopLoss,
      takeProfit,
      lotSize: lotSize || 0.01,
      strategy,
      timeframe,
      notes,
      emotionTag,
      screenshotUrl,
      linkedSignalId,
      status: exit ? 'closed' : 'open',
      enteredAt: new Date()
    });

    // Auto-calculate if exit is provided
    if (exit) {
      const pips = direction === 'long' ? (exit - entry) : (entry - exit);
      const pnl = pips * (lotSize || 0.01) * 100000; // Forex standard lot
      const riskRewardActual = Math.abs(pips) / Math.abs(entry - stopLoss);
      
      await journalEntry.update({
        pips: parseFloat(pips.toFixed(2)),
        pnl: parseFloat(pnl.toFixed(2)),
        riskRewardActual: parseFloat(riskRewardActual.toFixed(2)),
        result: pips > 0 ? 'win' : pips < 0 ? 'loss' : 'breakeven',
        exitedAt: new Date()
      });
    }

    res.status(201).json({ success: true, entry: journalEntry });
  } catch (error) {
    logger.error('Create journal entry error:', error);
    next(error);
  }
};

// @desc    Update journal entry (close trade)
// @route   PUT /api/journal/:id
exports.updateEntry = async (req, res, next) => {
  try {
    const entry = await TradeJournal.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    const updates = req.body;

    // Auto-calculate on close
    if (updates.exit && updates.status === 'closed') {
      const pips = entry.direction === 'long' 
        ? (updates.exit - entry.entry) 
        : (entry.entry - updates.exit);
      updates.pips = parseFloat(pips.toFixed(2));
      updates.pnl = parseFloat((pips * (entry.lotSize || 0.01) * 100000).toFixed(2));
      updates.riskRewardActual = parseFloat((Math.abs(pips) / Math.abs(entry.entry - entry.stopLoss)).toFixed(2));
      updates.result = pips > 0 ? 'win' : pips < 0 ? 'loss' : 'breakeven';
      updates.exitedAt = new Date();
    }

    await entry.update(updates);
    res.json({ success: true, entry });
  } catch (error) {
    logger.error('Update journal entry error:', error);
    next(error);
  }
};

// @desc    Delete journal entry
// @route   DELETE /api/journal/:id
exports.deleteEntry = async (req, res, next) => {
  try {
    const entry = await TradeJournal.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    await entry.destroy();
    res.json({ success: true, message: 'Entry deleted' });
  } catch (error) {
    logger.error('Delete journal entry error:', error);
    next(error);
  }
};

// @desc    Get journal analytics
// @route   GET /api/journal/analytics
exports.getAnalytics = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
      case '7d': startDate = new Date(now - 7 * 86400000); break;
      case '30d': startDate = new Date(now - 30 * 86400000); break;
      case '90d': startDate = new Date(now - 90 * 86400000); break;
      case '1y': startDate = new Date(now - 365 * 86400000); break;
      default: startDate = new Date(now - 30 * 86400000);
    }

    const closedTrades = await TradeJournal.findAll({
      where: {
        userId,
        status: 'closed',
        exitedAt: { [Op.gte]: startDate }
      },
      order: [['exitedAt', 'ASC']]
    });

    // Calculate metrics
    const totalTrades = closedTrades.length;
    const wins = closedTrades.filter(t => t.result === 'win').length;
    const losses = closedTrades.filter(t => t.result === 'loss').length;
    const breakeven = closedTrades.filter(t => t.result === 'breakeven').length;
    
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0;
    const totalPnl = closedTrades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0);
    const averagePnl = totalTrades > 0 ? (totalPnl / totalTrades).toFixed(2) : 0;
    const totalPips = closedTrades.reduce((sum, t) => sum + (parseFloat(t.pips) || 0), 0);
    
    const avgRR = closedTrades
      .filter(t => t.riskRewardActual)
      .reduce((sum, t) => sum + parseFloat(t.riskRewardActual), 0);
    const averageRiskReward = closedTrades.filter(t => t.riskRewardActual).length > 0
      ? (avgRR / closedTrades.filter(t => t.riskRewardActual).length).toFixed(2)
      : 0;

    // Equity curve
    let equity = 0;
    const equityCurve = closedTrades.map(t => {
      equity += parseFloat(t.pnl) || 0;
      return {
        date: t.exitedAt,
        equity: parseFloat(equity.toFixed(2)),
        pnl: parseFloat(t.pnl) || 0
      };
    });

    // Max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    equityCurve.forEach(p => {
      if (p.equity > peak) peak = p.equity;
      const dd = peak - p.equity;
      if (dd > maxDrawdown) maxDrawdown = dd;
    });

    // Monthly breakdown
    const monthlyData = {};
    closedTrades.forEach(t => {
      const month = new Date(t.exitedAt).toISOString().substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { month, pnl: 0, trades: 0, wins: 0 };
      }
      monthlyData[month].pnl += parseFloat(t.pnl) || 0;
      monthlyData[month].trades++;
      if (t.result === 'win') monthlyData[month].wins++;
    });

    // Strategy breakdown
    const strategyData = {};
    closedTrades.forEach(t => {
      const strat = t.strategy || 'Unknown';
      if (!strategyData[strat]) {
        strategyData[strat] = { strategy: strat, pnl: 0, trades: 0, wins: 0 };
      }
      strategyData[strat].pnl += parseFloat(t.pnl) || 0;
      strategyData[strat].trades++;
      if (t.result === 'win') strategyData[strat].wins++;
    });

    // Emotion breakdown
    const emotionData = {};
    closedTrades.forEach(t => {
      const emotion = t.emotionTag || 'untagged';
      if (!emotionData[emotion]) {
        emotionData[emotion] = { emotion, pnl: 0, trades: 0, wins: 0 };
      }
      emotionData[emotion].pnl += parseFloat(t.pnl) || 0;
      emotionData[emotion].trades++;
      if (t.result === 'win') emotionData[emotion].wins++;
    });

    res.json({
      success: true,
      analytics: {
        overview: {
          totalTrades,
          wins,
          losses,
          breakeven,
          winRate: parseFloat(winRate),
          totalPnl: parseFloat(totalPnl.toFixed(2)),
          averagePnl: parseFloat(averagePnl),
          totalPips: parseFloat(totalPips.toFixed(2)),
          averageRiskReward: parseFloat(averageRiskReward),
          maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
          profitFactor: losses > 0
            ? parseFloat((closedTrades.filter(t => t.result === 'win').reduce((s, t) => s + Math.abs(parseFloat(t.pnl) || 0), 0) /
              closedTrades.filter(t => t.result === 'loss').reduce((s, t) => s + Math.abs(parseFloat(t.pnl) || 0), 0)).toFixed(2))
            : wins > 0 ? 999 : 0
        },
        equityCurve,
        monthlyBreakdown: Object.values(monthlyData),
        strategyBreakdown: Object.values(strategyData),
        emotionBreakdown: Object.values(emotionData)
      }
    });
  } catch (error) {
    logger.error('Get analytics error:', error);
    next(error);
  }
};

// @desc    Compare user trades with educator signals
// @route   GET /api/journal/compare
exports.compareWithSignals = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get user's closed journal entries that are linked to signals
    const userTrades = await TradeJournal.findAll({
      where: {
        userId,
        status: 'closed',
        linkedSignalId: { [Op.ne]: null }
      },
      order: [['exitedAt', 'DESC']],
      limit: 50
    });

    // Get corresponding educator signals
    const signalIds = userTrades.map(t => t.linkedSignalId).filter(Boolean);
    const signals = await Trade.findAll({
      where: { id: signalIds },
      include: [{ model: User, as: 'educator', attributes: ['id', 'firstName', 'lastName'] }]
    });

    const comparisons = userTrades.map(trade => {
      const signal = signals.find(s => s.id === trade.linkedSignalId);
      return {
        trade: trade.toJSON(),
        signal: signal ? signal.toJSON() : null,
        timingDifference: signal ? (new Date(trade.enteredAt) - new Date(signal.createdAt)) / 60000 : null,
        profitDelta: signal && trade.pnl && signal.pips
          ? parseFloat(trade.pnl) - parseFloat(signal.pips)
          : null
      };
    });

    // Aggregate comparison metrics
    const userWinRate = userTrades.length > 0
      ? ((userTrades.filter(t => t.result === 'win').length / userTrades.length) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      comparison: {
        comparisons,
        userMetrics: {
          totalTrades: userTrades.length,
          winRate: parseFloat(userWinRate),
          totalPnl: userTrades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0)
        }
      }
    });
  } catch (error) {
    logger.error('Compare with signals error:', error);
    next(error);
  }
};
