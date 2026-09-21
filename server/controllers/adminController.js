/**
 * Phase 2: Enhanced Admin Controller
 * Extended admin capabilities for platform management
 */
const { User, Trade, ScannerResult, TradeJournal, Referral, Notification, Announcement, ChatRoom, ChatMessage, AuditLog } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const crypto = require('crypto');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const wsService = require('../services/websocketService');
const { sendPasswordResetEmail } = require('../utils/emailService');

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

// @desc    Update Member Authorization Status ("List Authorization")
// @route   PUT /api/admin/users/:userId/member-status
// @access  Private/Admin
exports.updateMemberStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { memberStatus, reason } = req.body;

    const validStatuses = ['pending', 'approved', 'active', 'suspended', 'revoked'];
    if (!validStatuses.includes(memberStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid memberStatus. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const targetUser = await User.findByPk(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (targetUser.role === 'admin' && req.user.id !== targetUser.id) {
      return res.status(403).json({ success: false, message: 'Cannot modify member status of another admin' });
    }

    const previousStatus = targetUser.memberStatus;
    await targetUser.update({ memberStatus });

    // Record administrative action in AuditLog
    await AuditLog.create({
      action: 'MEMBER_STATUS_CHANGE',
      performedBy: req.user.id,
      targetUserId: targetUser.id,
      details: {
        previousStatus,
        newStatus: memberStatus,
        targetEmail: targetUser.email,
        reason: reason || 'Admin panel update'
      },
      ipAddress: req.ip
    });

    logger.info(`Admin ${req.user.email} updated member status of ${targetUser.email} from ${previousStatus} to ${memberStatus}`);

    res.json({
      success: true,
      message: `Member status updated to ${memberStatus}`,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        memberStatus: targetUser.memberStatus
      }
    });
  } catch (error) {
    logger.error('Update member status error:', error);
    next(error);
  }
};

// @desc    Admin Concierge Password Reset Trigger
// @route   POST /api/admin/users/:userId/reset-password
// @access  Private/Admin
exports.adminResetPassword = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const targetUser = await User.findByPk(userId);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Generate unhashed reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token & 30 minute expiration on user record
    targetUser.resetPasswordToken = hashedToken;
    targetUser.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await targetUser.save();

    // Construct reset URL
    const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    // Send branded email to member
    await sendPasswordResetEmail(targetUser, resetUrl);

    // Record administrative action in AuditLog (never log passwords or tokens!)
    await AuditLog.create({
      action: 'CONCIERGE_PASSWORD_RESET',
      performedBy: req.user.id,
      targetUserId: targetUser.id,
      details: {
        targetEmail: targetUser.email,
        triggeredAt: new Date()
      },
      ipAddress: req.ip
    });

    logger.info(`Admin concierge password reset triggered by ${req.user.email} for member ${targetUser.email}`);

    res.json({
      success: true,
      message: `Concierge password reset initiated. Recovery email sent to ${targetUser.email}.`
    });
  } catch (error) {
    logger.error('Admin reset password error:', error);
    next(error);
  }
};

// @desc    Get Administrative Audit Logs
// @route   GET /api/admin/audit-logs
// @access  Private/Admin
exports.getAuditLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.findAll({
      include: [
        { model: User, as: 'performer', attributes: ['id', 'email', 'firstName', 'lastName'] },
        { model: User, as: 'target', attributes: ['id', 'email', 'firstName', 'lastName'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    res.json({ success: true, auditLogs: logs });
  } catch (error) {
    logger.error('Get audit logs error:', error);
    next(error);
  }
};

