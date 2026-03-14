/**
 * Phase 2: Enhanced Notification Service
 * Handles in-app, email, and push notifications
 */
const { Notification, User } = require('../models');
const logger = require('../utils/logger');
const wsService = require('./websocketService');
const nodemailer = require('nodemailer');
const webpush = require('web-push');

class NotificationService {
  constructor() {
    this.emailTransporter = null;
    this.pushEnabled = false;
    this.initEmail();
    this.initWebPush();
  }

  initEmail() {
    try {
      if (process.env.SMTP_HOST) {
        this.emailTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      } else if (process.env.SENDGRID_API_KEY) {
        this.emailTransporter = nodemailer.createTransport({
          host: 'smtp.sendgrid.net',
          port: 587,
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
          }
        });
      }
    } catch (error) {
      logger.warn('Email transporter not configured:', error.message);
    }
  }

  initWebPush() {
    try {
      const vapidPublic = process.env.VAPID_PUBLIC_KEY;
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
      const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@system100.com';

      if (vapidPublic && vapidPrivate) {
        webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
        this.pushEnabled = true;
        logger.info('Web Push notifications enabled');
      } else {
        logger.info('VAPID keys not set — web push disabled. Generate keys with: npx web-push generate-vapid-keys');
      }
    } catch (error) {
      logger.warn('Web Push init error:', error.message);
    }
  }

  /**
   * Create and send notification
   */
  async notify(userId, { type, title, message, data = null, channel = 'all' }) {
    try {
      // Save to database
      const notification = await Notification.create({
        userId,
        type,
        title,
        message,
        data,
        channel
      });

      // Get user preferences
      const user = await User.findByPk(userId);
      if (!user) return notification;

      const prefs = user.notificationPreferences || {};

      // In-app notification via WebSocket
      if (prefs.inApp !== false) {
        wsService.sendNotification(userId, {
          id: notification.id,
          type,
          title,
          message,
          data,
          createdAt: notification.createdAt
        });
      }

      // Email notification
      if ((channel === 'email' || channel === 'all') && prefs.email !== false) {
        await this.sendEmail(user.email, title, message, data);
        await notification.update({ sentViaEmail: true });
      }

      // Push notification
      if ((channel === 'push' || channel === 'all') && prefs.push !== false) {
        await this.sendPush(user, { title, message, data, type });
        await notification.update({ sentViaPush: true });
      }

      return notification;
    } catch (error) {
      logger.error('Notification error:', error);
      return null;
    }
  }

  /**
   * Notify all users with specific criteria
   */
  async notifyAll({ type, title, message, data = null, filter = {} }) {
    try {
      const where = { isActive: true, ...filter };
      const users = await User.findAll({ where });

      const results = [];
      for (const user of users) {
        const notif = await this.notify(user.id, { type, title, message, data });
        if (notif) results.push(notif);
      }

      return results;
    } catch (error) {
      logger.error('Notify all error:', error);
      return [];
    }
  }

  /**
   * Send trade signal notification
   */
  async notifySignal(signal) {
    const title = `🚨 GOLD ${signal.signalType.toUpperCase()} SIGNAL`;
    const message = `Entry: ${signal.entry}\nSL: ${signal.stopLoss}\nTP: ${signal.takeProfit}\nConfidence: ${signal.confidence}%\nTimeframe: ${signal.timeframe || '15M'}`;

    return this.notifyAll({
      type: 'signal',
      title,
      message,
      data: signal
    });
  }

  /**
   * Send economic calendar alert
   */
  async notifyCalendarEvent(event) {
    const title = `⏳ High Impact Event: ${event.title}`;
    const message = `${event.country} - ${event.title}\nImpact: ${event.impact}\nIn ${event.minutesUntil} minutes`;

    return this.notifyAll({
      type: 'news',
      title,
      message,
      data: event
    });
  }

  /**
   * Send email
   */
  async sendEmail(to, subject, text, data = null) {
    if (!this.emailTransporter) {
      logger.debug('Email transporter not configured, skipping email');
      return;
    }

    try {
      const htmlContent = this.buildEmailTemplate(subject, text, data);
      
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SENDGRID_FROM || 'signals@system100.com',
        to,
        subject: `[System-100] ${subject}`,
        text,
        html: htmlContent
      });

      logger.debug(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      logger.error(`Email send error to ${to}:`, error.message);
    }
  }

  /**
   * Send Web Push notification
   */
  async sendPush(user, { title, message, data, type }) {
    if (!this.pushEnabled) return;

    try {
      const pushSubscription = user.pushSubscription;
      if (!pushSubscription || !pushSubscription.endpoint) return;

      const payload = JSON.stringify({
        title: title || 'System-100',
        body: message,
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        tag: type || 'notification',
        data: {
          url: data?.url || '/',
          type,
          ...data
        }
      });

      await webpush.sendNotification(pushSubscription, payload);
      logger.debug(`Push sent to user ${user.id}: ${title}`);
    } catch (error) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        // Subscription expired or no longer valid — remove it
        logger.info(`Removing expired push subscription for user ${user.id}`);
        await user.update({ pushSubscription: null });
      } else {
        logger.error(`Push send error to user ${user.id}:`, error.message);
      }
    }
  }

  /**
   * Save push subscription for a user
   */
  async savePushSubscription(userId, subscription) {
    try {
      const user = await User.findByPk(userId);
      if (!user) throw new Error('User not found');
      
      await user.update({ pushSubscription: subscription });
      logger.info(`Push subscription saved for user ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error('Save push subscription error:', error);
      throw error;
    }
  }

  /**
   * Get VAPID public key for frontend
   */
  getVapidPublicKey() {
    return process.env.VAPID_PUBLIC_KEY || null;
  }

  buildEmailTemplate(title, message, data) {
    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="background:#0f172a;color:#e2e8f0;font-family:monospace;padding:20px;">
      <div style="max-width:600px;margin:0 auto;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;">
        <div style="text-align:center;margin-bottom:20px;">
          <h1 style="color:#38bdf8;font-size:24px;margin:0;">SYSTEM-100</h1>
          <p style="color:#64748b;font-size:12px;letter-spacing:2px;margin:4px 0;">TRADING INTELLIGENCE</p>
        </div>
        <h2 style="color:#fbbf24;font-size:18px;">${title}</h2>
        <pre style="color:#e2e8f0;font-size:14px;white-space:pre-wrap;line-height:1.6;">${message}</pre>
        ${data ? `<div style="margin-top:16px;padding:12px;background:#0f172a;border-radius:8px;border:1px solid #334155;"><pre style="color:#94a3b8;font-size:12px;">${JSON.stringify(data, null, 2)}</pre></div>` : ''}
        <hr style="border-color:#334155;margin:20px 0;">
        <p style="color:#64748b;font-size:11px;text-align:center;">System-100 Trading Platform</p>
      </div>
    </body>
    </html>`;
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId, { limit = 50, offset = 0, unreadOnly = false } = {}) {
    const where = { userId };
    if (unreadOnly) where.isRead = false;

    return Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(userId, notificationIds = null) {
    const where = { userId };
    if (notificationIds) {
      where.id = notificationIds;
    }
    return Notification.update({ isRead: true }, { where });
  }
}

module.exports = new NotificationService();
