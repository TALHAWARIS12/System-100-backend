/**
 * Phase 2: Referral Controller
 * Affiliate/referral program management
 */
const { Referral, User } = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Generate unique referral code
 */
const generateReferralCode = (userId) => {
  const hash = crypto.createHash('sha256').update(userId + Date.now().toString()).digest('hex');
  return 'SYS' + hash.substring(0, 8).toUpperCase();
};

// @desc    Get referral dashboard data
// @route   GET /api/referrals/dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    // Generate referral code if not exists
    if (!user.referralCode) {
      const code = generateReferralCode(userId);
      await user.update({ referralCode: code });
    }

    // Get all referrals
    const referrals = await Referral.findAll({
      where: { referrerId: userId },
      include: [{
        model: User,
        as: 'referred',
        attributes: ['id', 'firstName', 'lastName', 'email', 'subscriptionStatus', 'subscriptionTier', 'createdAt']
      }],
      order: [['createdAt', 'DESC']]
    });

    const totalClicks = referrals.reduce((sum, r) => sum + (r.clicks || 0), 0);
    const totalSignups = referrals.filter(r => r.status !== 'pending').length;
    const totalSubscribed = referrals.filter(r => r.status === 'subscribed').length;
    const totalCommission = referrals.reduce((sum, r) => sum + parseFloat(r.totalCommission || 0), 0);
    const conversionRate = totalClicks > 0 ? ((totalSignups / totalClicks) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      dashboard: {
        referralCode: user.referralCode,
        referralLink: `${process.env.FRONTEND_URL || process.env.CLIENT_URL}/register?ref=${user.referralCode}`,
        stats: {
          totalClicks,
          totalSignups,
          totalSubscribed,
          totalCommission: parseFloat(totalCommission.toFixed(2)),
          pendingBalance: parseFloat(user.referralBalance || 0),
          conversionRate: parseFloat(conversionRate)
        },
        referrals: referrals.map(r => ({
          id: r.id,
          status: r.status,
          clicks: r.clicks,
          commission: parseFloat(r.totalCommission || 0),
          referred: r.referred ? {
            firstName: r.referred.firstName,
            lastName: r.referred.lastName,
            subscriptionStatus: r.referred.subscriptionStatus,
            subscriptionTier: r.referred.subscriptionTier,
            joinedAt: r.referred.createdAt
          } : null,
          createdAt: r.createdAt
        }))
      }
    });
  } catch (error) {
    logger.error('Referral dashboard error:', error);
    next(error);
  }
};

// @desc    Track referral click
// @route   POST /api/referrals/track
exports.trackClick = async (req, res, next) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ success: false, message: 'Referral code required' });
    }

    // Find the referrer
    const referrer = await User.findOne({ where: { referralCode: code } });
    if (!referrer) {
      return res.status(404).json({ success: false, message: 'Invalid referral code' });
    }

    // Find or create referral record
    let referral = await Referral.findOne({
      where: { referrerId: referrer.id, referralCode: code, status: 'pending' }
    });

    if (!referral) {
      referral = await Referral.create({
        referrerId: referrer.id,
        referralCode: code,
        clicks: 1,
        lastClickAt: new Date()
      });
    } else {
      await referral.update({
        clicks: referral.clicks + 1,
        lastClickAt: new Date()
      });
    }

    res.json({ success: true, message: 'Referral tracked' });
  } catch (error) {
    logger.error('Track click error:', error);
    next(error);
  }
};

// @desc    Process referral signup (called internally during registration)
exports.processReferralSignup = async (referralCode, newUserId) => {
  try {
    if (!referralCode) return;

    const referrer = await User.findOne({ where: { referralCode: referralCode } });
    if (!referrer) return;

    // Update or create referral record
    let referral = await Referral.findOne({
      where: { referrerId: referrer.id, referralCode: referralCode, status: 'pending' }
    });

    if (referral) {
      await referral.update({
        referredId: newUserId,
        status: 'signed_up'
      });
    } else {
      await Referral.create({
        referrerId: referrer.id,
        referredId: newUserId,
        referralCode: referralCode,
        status: 'signed_up'
      });
    }

    // Mark user as referred
    await User.update({ referredBy: referrer.id }, { where: { id: newUserId } });

    logger.info(`Referral signup processed: ${referrer.email} referred user ${newUserId}`);
  } catch (error) {
    logger.error('Process referral signup error:', error);
  }
};

// @desc    Process referral commission (called when referred user subscribes)
exports.processReferralCommission = async (subscriberId, amount) => {
  try {
    const subscriber = await User.findByPk(subscriberId);
    if (!subscriber || !subscriber.referredBy) return;

    const referral = await Referral.findOne({
      where: { referredId: subscriberId }
    });

    if (!referral) return;

    const commissionRate = parseFloat(referral.commissionRate || 20) / 100;
    const commission = amount * commissionRate;

    await referral.update({
      status: 'subscribed',
      totalCommission: parseFloat(referral.totalCommission || 0) + commission
    });

    // Add to referrer's balance
    const referrer = await User.findByPk(referral.referrerId);
    if (referrer) {
      await referrer.update({
        referralBalance: parseFloat(referrer.referralBalance || 0) + commission
      });
    }

    logger.info(`Referral commission: $${commission.toFixed(2)} credited to ${referrer?.email}`);
  } catch (error) {
    logger.error('Process referral commission error:', error);
  }
};

// @desc    Get referral code info (public)
// @route   GET /api/referrals/code/:code
exports.getCodeInfo = async (req, res, next) => {
  try {
    const { code } = req.params;
    const referrer = await User.findOne({
      where: { referralCode: code },
      attributes: ['firstName']
    });

    if (!referrer) {
      return res.status(404).json({ success: false, message: 'Invalid code' });
    }

    res.json({
      success: true,
      referrer: { firstName: referrer.firstName },
      valid: true
    });
  } catch (error) {
    next(error);
  }
};
