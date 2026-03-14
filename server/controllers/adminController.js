/**
 * Phase 2: Enhanced Admin Controller
 * Extended admin capabilities for platform management
 */
const { User, Trade, ScannerResult, TradeJournal, Referral, Notification, Announcement, ChatRoom, ChatMessage } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const wsService = require('../services/websocketService');

// @desc    Get comprehensive admin analytics
// @route   GET /api/admin/analytics
exports.getAnalytics = async (req, res, next) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 86400000);
    const sevenDaysAgo = new Date(now - 7 * 86400000);

    // User stats
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { isActive: true } });
    const newUsersThisMonth = await User.count({ where: { createdAt: { [Op.gte]: thirtyDaysAgo } } });
    const newUsersThisWeek = await User.count({ where: { createdAt: { [Op.gte]: sevenDaysAgo } } });

    // Subscription stats
    const activeSubscriptions = await User.count({ where: { subscriptionStatus: 'active' } });
    const tierBreakdown = await User.findAll({
      attributes: ['subscriptionTier', [fn('COUNT', col('id')), 'count']],
      where: { subscriptionStatus: 'active' },
      group: ['subscriptionTier'],
      raw: true
    });

    // Signal stats
    const totalSignals = await ScannerResult.count();
    const signalsThisMonth = await ScannerResult.count({ where: { createdAt: { [Op.gte]: thirtyDaysAgo } } });
    const activeSignals = await ScannerResult.count({ where: { isActive: true } });

    // Trade stats
    const totalTrades = await Trade.count();
    const journalEntries = await TradeJournal.count();

    // Referral stats
    const totalReferrals = await Referral.count();
    const totalCommissions = await Referral.sum('totalCommission') || 0;

    // Chat stats
    const totalMessages = await ChatMessage.count();
    const messagesThisWeek = await ChatMessage.count({ where: { createdAt: { [Op.gte]: sevenDaysAgo } } });

    // Online users
    const onlineUsers = wsService.getOnlineCount();

    // User growth (last 30 days)
    const userGrowth = await User.findAll({
      attributes: [
        [fn('DATE', col('createdAt')), 'date'],
        [fn('COUNT', col('id')), 'count']
      ],
      where: { createdAt: { [Op.gte]: thirtyDaysAgo } },
      group: [fn('DATE', col('createdAt'))],
      order: [[fn('DATE', col('createdAt')), 'ASC']],
      raw: true
    });

    res.json({
      success: true,
      analytics: {
        users: {
          total: totalUsers,
          active: activeUsers,
          newThisMonth: newUsersThisMonth,
          newThisWeek: newUsersThisWeek,
          onlineNow: onlineUsers,
          growth: userGrowth
        },
        subscriptions: {
          active: activeSubscriptions,
          tierBreakdown
        },
        signals: {
          total: totalSignals,
          thisMonth: signalsThisMonth,
          active: activeSignals
        },
        trades: {
          educatorTrades: totalTrades,
          journalEntries
        },
        referrals: {
          total: totalReferrals,
          totalCommissions: parseFloat(totalCommissions.toFixed(2))
        },
        engagement: {
          totalMessages,
          messagesThisWeek
        }
      }
    });
  } catch (error) {
    logger.error('Admin analytics error:', error);
    next(error);
  }
};

// @desc    Publish manual signal
// @route   POST /api/admin/signals
exports.publishSignal = async (req, res, next) => {
  try {
    const { pair, signalType, entry, stopLoss, takeProfit, confidence, timeframe, notes } = req.body;

    const signal = await ScannerResult.create({
      pair,
      signalType,
      entry,
      stopLoss,
      takeProfit,
      confidence: confidence || 85,
      timeframe: timeframe || '1h',
      strategyName: 'manual_admin',
      indicators: { notes, publishedBy: req.user.email },
      isActive: true,
      expiresAt: new Date(Date.now() + 24 * 3600000)
    });

    // Broadcast signal
    wsService.broadcastSignal({
      id: signal.id,
      pair,
      signalType,
      entry,
      stopLoss,
      takeProfit,
      confidence,
      timeframe,
      timestamp: new Date().toISOString(),
      manual: true
    });

    // Notify users
    const notificationService = require('../services/notificationService');
    await notificationService.notifySignal({
      pair,
      signalType,
      entry,
      stopLoss,
      takeProfit,
      confidence,
      timeframe
    });

    res.status(201).json({ success: true, signal });
  } catch (error) {
    logger.error('Publish signal error:', error);
    next(error);
  }
};

// @desc    Manage announcements
// @route   POST /api/admin/announcements
exports.createAnnouncement = async (req, res, next) => {
  try {
    const { title, content, type = 'info', targetTiers, expiresAt } = req.body;

    const announcement = await Announcement.create({
      title,
      content,
      type,
      targetTiers: targetTiers || ['bronze', 'silver', 'gold', 'platinum'],
      createdBy: req.user.id,
      expiresAt
    });

    // Broadcast announcement
    wsService.broadcastAll('announcement', {
      id: announcement.id,
      title,
      content,
      type,
      createdAt: announcement.createdAt
    });

    res.status(201).json({ success: true, announcement });
  } catch (error) {
    logger.error('Create announcement error:', error);
    next(error);
  }
};

// @desc    Get announcements
// @route   GET /api/admin/announcements
exports.getAnnouncements = async (req, res, next) => {
  try {
    const announcements = await Announcement.findAll({
      where: {
        isActive: true,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } }
        ]
      },
      include: [{ model: User, as: 'author', attributes: ['id', 'firstName', 'lastName'] }],
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    res.json({ success: true, announcements });
  } catch (error) {
    logger.error('Get announcements error:', error);
    next(error);
  }
};

// @desc    Suspend user
// @route   PUT /api/admin/users/:userId/suspend
exports.suspendUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot suspend admin' });
    }

    await user.update({ isActive: !user.isActive });
    res.json({ success: true, isActive: user.isActive });
  } catch (error) {
    logger.error('Suspend user error:', error);
    next(error);
  }
};

// @desc    Upgrade user plan
// @route   PUT /api/admin/users/:userId/tier
exports.updateUserTier = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { tier } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await user.update({
      subscriptionTier: tier,
      subscriptionStatus: tier !== 'none' ? 'active' : 'inactive'
    });

    res.json({ success: true, user });
  } catch (error) {
    logger.error('Update user tier error:', error);
    next(error);
  }
};

// @desc    Get user activity log
// @route   GET /api/admin/users/:userId/activity
exports.getUserActivity = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [trades, journal, messages, referrals] = await Promise.all([
      Trade.count({ where: { educatorId: userId } }),
      TradeJournal.count({ where: { userId } }),
      ChatMessage.count({ where: { userId } }),
      Referral.count({ where: { referrerId: userId } })
    ]);

    res.json({
      success: true,
      user,
      activity: {
        trades,
        journalEntries: journal,
        chatMessages: messages,
        referrals
      }
    });
  } catch (error) {
    logger.error('Get user activity error:', error);
    next(error);
  }
};
