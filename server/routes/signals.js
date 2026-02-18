const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const signalNotificationService = require('../services/signalNotificationService');
const logger = require('../utils/logger');

/**
 * @route POST /api/signals/broadcast
 * @desc Broadcast a signal to all subscribed users
 * @access Admin/Educator only
 */
router.post('/broadcast', protect, authorize(['admin', 'educator']), async (req, res) => {
  try {
    const { pair, signalType, timeframe, entryPrice, stopLoss, takeProfit, confidence, notes } = req.body;

    if (!pair || !signalType) {
      return res.status(400).json({
        success: false,
        message: 'Pair and signal type are required'
      });
    }

    const signal = {
      pair,
      signalType,
      timeframe: timeframe || 'H1',
      entryPrice: entryPrice || null,
      stopLoss: stopLoss || null,
      takeProfit: takeProfit || null,
      confidence: confidence || 'medium',
      notes: notes || '',
      sentBy: req.user.id,
      sentAt: new Date().toISOString()
    };

    const result = await signalNotificationService.broadcastSignal(signal);

    res.json({
      success: true,
      message: `Signal broadcast to ${result.sent} users`,
      data: result
    });
  } catch (error) {
    logger.error('Signal broadcast error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to broadcast signal'
    });
  }
});

/**
 * @route POST /api/signals/alert
 * @desc Send custom alert to specific users
 * @access Admin/Educator only
 */
router.post('/alert', protect, authorize(['admin', 'educator']), async (req, res) => {
  try {
    const { userIds, title, message, actionUrl } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    // If no userIds specified, send to all subscribed users
    let targetUsers = userIds;
    if (!targetUsers || targetUsers.length === 0) {
      const { User } = require('../models');
      const users = await User.findAll({
        where: { isActive: true, subscriptionStatus: 'active' },
        attributes: ['id']
      });
      targetUsers = users.map(u => u.id);
    }

    const alert = { title, message, actionUrl };
    const result = await signalNotificationService.sendCustomAlert(targetUsers, alert);

    res.json({
      success: true,
      message: `Alert sent to ${result.sent} users`,
      data: result
    });
  } catch (error) {
    logger.error('Custom alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send alert'
    });
  }
});

/**
 * @route GET /api/signals/pending
 * @desc Get pending signals for the current user
 * @access Private
 */
router.get('/pending', protect, async (req, res) => {
  try {
    const signals = await signalNotificationService.getPendingSignals(req.user.id);

    res.json({
      success: true,
      count: signals.length,
      signals
    });
  } catch (error) {
    logger.error('Pending signals fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending signals'
    });
  }
});

/**
 * @route POST /api/signals/subscribe
 * @desc Subscribe to signal notifications
 * @access Private
 */
router.post('/subscribe', protect, async (req, res) => {
  try {
    const { preferences } = req.body;
    const result = await signalNotificationService.subscribeUser(req.user.id, preferences);

    res.json({
      success: true,
      message: 'Successfully subscribed to notifications',
      data: result
    });
  } catch (error) {
    logger.error('Subscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe'
    });
  }
});

/**
 * @route POST /api/signals/unsubscribe
 * @desc Unsubscribe from specific notification types
 * @access Private
 */
router.post('/unsubscribe', protect, async (req, res) => {
  try {
    const { types } = req.body;
    const result = await signalNotificationService.unsubscribeUser(req.user.id, types);

    res.json({
      success: true,
      message: 'Successfully updated notification preferences',
      data: result
    });
  } catch (error) {
    logger.error('Unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe'
    });
  }
});

module.exports = router;
