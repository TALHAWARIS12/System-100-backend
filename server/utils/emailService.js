const nodemailer = require('nodemailer');
const logger = require('./logger');

// Check if email is configured
const isEmailConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

// Email transporter configuration
let transporter = null;

if (isEmailConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  // Verify transporter configuration
  transporter.verify((error, success) => {
    if (error) {
      logger.warn('Email configuration invalid (emails disabled):', error.message);
    } else {
      logger.info('Email server ready to send messages');
    }
  });
} else {
  logger.info('Email not configured - email notifications disabled (this is optional)');
}

/**
 * Send email
 */
const sendEmail = async (options) => {
  // Skip if email not configured
  if (!isEmailConfigured || !transporter) {
    logger.info('Email skipped (not configured):', options.subject);
    return { skipped: true };
  }

  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'Trading Platform <noreply@tradingplatform.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('Email sent:', info.messageId);
    return info;
  } catch (error) {
    logger.error('Send email error:', error);
    throw error;
  }
};

/**
 * Send signal notification email
 */
const sendSignalNotification = async (user, signal) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #161b22; border-radius: 8px; padding: 30px; }
        .header { color: #58a6ff; font-size: 24px; margin-bottom: 20px; }
        .signal-card { background: #21262d; border-left: 4px solid ${signal.signalType === 'buy' ? '#3fb950' : '#f85149'}; padding: 20px; margin: 20px 0; border-radius: 6px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .badge-buy { background: #1a4d2e; color: #3fb950; }
        .badge-sell { background: #4d1a1a; color: #f85149; }
        .price { font-size: 18px; font-weight: bold; margin: 10px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #30363d; color: #8b949e; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">🚨 New Trading Signal</div>
        
        <p>Hi ${user.firstName},</p>
        <p>A new trading signal has been generated:</p>
        
        <div class="signal-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h2 style="margin: 0; color: #fff;">${signal.pair}</h2>
            <span class="badge ${signal.signalType === 'buy' ? 'badge-buy' : 'badge-sell'}">${signal.signalType}</span>
          </div>
          
          <div style="margin: 15px 0;">
            <div style="color: #8b949e;">Timeframe</div>
            <div class="price">${signal.timeframe}</div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin: 20px 0;">
            <div>
              <div style="color: #8b949e; font-size: 12px;">Entry Price</div>
              <div style="color: #fff; font-weight: bold;">${parseFloat(signal.entry).toFixed(2)}</div>
            </div>
            <div>
              <div style="color: #8b949e; font-size: 12px;">Stop Loss</div>
              <div style="color: #f85149; font-weight: bold;">${parseFloat(signal.stopLoss).toFixed(2)}</div>
            </div>
            <div>
              <div style="color: #8b949e; font-size: 12px;">Take Profit</div>
              <div style="color: #3fb950; font-weight: bold;">${parseFloat(signal.takeProfit).toFixed(2)}</div>
            </div>
          </div>
          
          <div style="margin-top: 15px;">
            <div style="color: #8b949e; font-size: 12px;">Strategy</div>
            <div style="color: #58a6ff;">${signal.strategyName}</div>
          </div>
          
          ${signal.confidence ? `
          <div style="margin-top: 15px;">
            <div style="color: #8b949e; font-size: 12px;">Confidence</div>
            <div style="color: #58a6ff; font-weight: bold;">${signal.confidence}%</div>
          </div>
          ` : ''}
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL}/scanner" style="display: inline-block; background: #238636; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">View in Dashboard</a>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from Trading Platform.</p>
          <p>Login to your account to view all signals and manage your trades.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: user.email,
    subject: `🚨 New ${signal.signalType.toUpperCase()} Signal: ${signal.pair}`,
    html,
    text: `New ${signal.signalType} signal for ${signal.pair} at ${signal.entry}`
  });
};

/**
 * Send welcome email
 */
const sendWelcomeEmail = async (user) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #161b22; border-radius: 8px; padding: 30px; }
        .header { color: #58a6ff; font-size: 28px; margin-bottom: 20px; text-align: center; }
        .button { display: inline-block; background: #238636; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">🎉 Welcome to Trading Platform!</div>
        
        <p>Hi ${user.firstName},</p>
        <p>Thank you for joining Trading Platform. Your account has been successfully created.</p>
        
        <p>Get started by:</p>
        <ul>
          <li>Exploring real-time market signals</li>
          <li>Viewing professional trade analysis</li>
          <li>Using our trading calculators</li>
          <li>Subscribing for full access</li>
        </ul>
        
        <div style="text-align: center;">
          <a href="${process.env.CLIENT_URL}/dashboard" class="button">Go to Dashboard</a>
        </div>
        
        <p>If you have any questions, feel free to reach out to our support team.</p>
        
        <p>Happy Trading!<br>The Trading Platform Team</p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: user.email,
    subject: 'Welcome to Trading Platform! 🚀',
    html,
    text: `Welcome to Trading Platform, ${user.firstName}!`
  });
};

module.exports = {
  sendEmail,
  sendSignalNotification,
  sendWelcomeEmail
};
