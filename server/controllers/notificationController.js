/**
 * Phase 2: Notification Controller
 */
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

// @desc    Get user notifications
// @route   GET /api/notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, unreadOnly } = req.query;
    
    const result = await notificationService.getUserNotifications(req.user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      unreadOnly: unreadOnly === 'true'
    });

    res.json({
      success: true,
      notifications: result.rows,
      total: result.count,
      unreadCount: result.rows.filter(n => !n.isRead).length
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    next(error);
  }
};

// @desc    Mark notifications as read
// @route   PUT /api/notifications/read
exports.markAsRead = async (req, res, next) => {
  try {
    const { ids } = req.body; // array of notification ids, or null for all
    
    await notificationService.markAsRead(req.user.id, ids || null);

    res.json({ success: true, message: 'Notifications marked as read' });
  } catch (error) {
    logger.error('Mark as read error:', error);
    next(error);
  }
};

// @desc    Update notification preferences
// @route   PUT /api/notifications/preferences
exports.updatePreferences = async (req, res, next) => {
  try {
    const { email, push, inApp, signals, news, chat } = req.body;
    const { User } = require('../models');

    await User.update(
      { notificationPreferences: { email, push, inApp, signals, news, chat } },
      { where: { id: req.user.id } }
    );

    res.json({ success: true, message: 'Preferences updated' });
  } catch (error) {
    logger.error('Update preferences error:', error);
    next(error);
  }
};

// @desc    Update FCM token
// @route   PUT /api/notifications/fcm-token
exports.updateFcmToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    const { User } = require('../models');

    await User.update({ fcmToken: token }, { where: { id: req.user.id } });

    res.json({ success: true, message: 'FCM token updated' });
  } catch (error) {
    logger.error('Update FCM token error:', error);
    next(error);
  }
};

// @desc    Subscribe to push notifications (Web Push)
// @route   POST /api/notifications/push/subscribe
exports.subscribePush = async (req, res, next) => {
  try {
    const { subscription } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, message: 'Valid push subscription required' });
    }

    await notificationService.savePushSubscription(req.user.id, subscription);
    res.json({ success: true, message: 'Push subscription saved' });
  } catch (error) {
    logger.error('Subscribe push error:', error);
    next(error);
  }
};

// @desc    Get VAPID public key for Web Push
// @route   GET /api/notifications/push/vapid-key
exports.getVapidKey = async (req, res) => {
  const key = notificationService.getVapidPublicKey();
  res.json({ success: true, vapidPublicKey: key });
};
