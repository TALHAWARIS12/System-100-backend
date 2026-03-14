const { User, ScannerResult } = require('../models');
const { sendSignalNotification } = require('../utils/emailService');
const logger = require('../utils/logger');

/**
 * Signal Notification Service
 * Manages sending trading signals to subscribed users via email, push, etc.
 */
class SignalNotificationService {
  constructor() {
    this.notificationQueue = [];
    this.isProcessing = false;
  }

  /**
   * Send signal to all eligible users
   */
  async broadcastSignal(signal) {
    try {
      logger.info(`Broadcasting signal: ${signal.pair} ${signal.signalType}`);

      // Get all users with active subscriptions who want signal notifications
      const users = await User.findAll({
        where: {
          isActive: true,
          subscriptionStatus: 'active'
        }
      });

      // Filter by notification preferences
      const signalRecipients = users.filter(u => {
        const prefs = u.notificationPreferences || {};
        return prefs.signals !== false; // Default to true if not set
      });

      // Include admins and educators
      const adminsEducators = await User.findAll({
        where: {
          isActive: true,
          role: ['admin', 'educator']
        }
      });

      const allRecipients = [...new Map([...signalRecipients, ...adminsEducators].map(u => [u.id, u])).values()];

      logger.info(`Sending signal to ${allRecipients.length} users`);

      // Queue notifications
      for (const user of allRecipients) {
        this.queueNotification(user, signal);
      }

      // Process queue
      await this.processQueue();

      return { sent: allRecipients.length, signal };
    } catch (error) {
      logger.error('Broadcast signal error:', error);
      throw error;
    }
  }

  /**
   * Queue a notification for processing
   */
  queueNotification(user, signal) {
    this.notificationQueue.push({ user, signal, attempts: 0 });
  }

  /**
   * Process notification queue
   */
  async processQueue() {
    if (this.isProcessing || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.notificationQueue.length > 0) {
      const notification = this.notificationQueue.shift();
      
      try {
        await this.sendNotification(notification.user, notification.signal);
      } catch (error) {
        logger.error(`Failed to send notification to ${notification.user.email}:`, error.message);
        
        // Retry logic (max 3 attempts)
        if (notification.attempts < 2) {
          notification.attempts++;
          this.notificationQueue.push(notification);
        }
      }

      // Rate limiting - small delay between sends
      await this.delay(100);
    }

    this.isProcessing = false;
  }

  /**
   * Send notification to a single user
   */
  async sendNotification(user, signal) {
    const prefs = user.notificationPreferences || {};

    // Send email notification if user wants emails
    if (prefs.email !== false) {
      await sendSignalNotification(user, signal);
    }

    // Send push notification if user has a subscription
    if (prefs.push !== false && user.pushSubscription) {
      try {
        const notificationService = require('./notificationService');
        await notificationService.sendPush(user, {
          title: `🚨 ${signal.pair} ${signal.signalType.toUpperCase()} Signal`,
          message: `Entry: ${signal.entryPrice || 'Market'} | SL: ${signal.stopLoss || 'N/A'} | TP: ${signal.takeProfit || 'N/A'}`,
          type: 'signal',
          data: { url: '/dashboard', signal }
        });
      } catch (pushErr) {
        logger.warn(`Push notification failed for ${user.email}:`, pushErr.message);
      }
    }

    logger.info(`Signal notification sent to ${user.email}`);
  }

  /**
   * Send custom alert to specific users
   */
  async sendCustomAlert(userIds, alert) {
    try {
      const users = await User.findAll({
        where: {
          id: userIds,
          isActive: true
        }
      });

      for (const user of users) {
        await this.sendAlertEmail(user, alert);
      }

      return { sent: users.length, alert };
    } catch (error) {
      logger.error('Send custom alert error:', error);
      throw error;
    }
  }

  /**
   * Send alert email
   */
  async sendAlertEmail(user, alert) {
    const { sendEmail } = require('../utils/emailService');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #161b22; border-radius: 8px; padding: 30px; }
          .header { color: #58a6ff; font-size: 24px; margin-bottom: 20px; }
          .alert-card { background: #21262d; border-left: 4px solid #f0883e; padding: 20px; margin: 20px 0; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">📢 Trading Alert</div>
          <p>Hi ${user.firstName},</p>
          <div class="alert-card">
            <h3 style="margin: 0 0 10px; color: #fff;">${alert.title}</h3>
            <p style="margin: 0; color: #8b949e;">${alert.message}</p>
          </div>
          <p style="color: #8b949e; margin-top: 20px;">
            ${alert.actionUrl ? `<a href="${alert.actionUrl}" style="color: #58a6ff;">View Details</a>` : ''}
          </p>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: user.email,
      subject: `Trading Alert: ${alert.title}`,
      html
    });
  }

  /**
   * Get pending signals for a user (signals they haven't seen)
   */
  async getPendingSignals(userId) {
    try {
      // Get recent signals from the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const signals = await ScannerResult.findAll({
        where: {
          createdAt: { $gte: oneDayAgo },
          isActive: true
        },
        order: [['createdAt', 'DESC']],
        limit: 50
      });

      return signals;
    } catch (error) {
      logger.error('Get pending signals error:', error);
      return [];
    }
  }

  /**
   * Subscribe user to notifications
   */
  async subscribeUser(userId, preferences = {}) {
    try {
      const user = await User.findByPk(userId);
      if (!user) throw new Error('User not found');

      // Store notification preferences (would need to add field to User model)
      // For now, all active subscription users get notifications
      
      return { success: true, userId, preferences };
    } catch (error) {
      logger.error('Subscribe user error:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe user from specific notification types
   */
  async unsubscribeUser(userId, types = []) {
    try {
      const user = await User.findByPk(userId);
      if (!user) throw new Error('User not found');

      // Update notification preferences
      
      return { success: true, userId, unsubscribed: types };
    } catch (error) {
      logger.error('Unsubscribe user error:', error);
      throw error;
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new SignalNotificationService();
