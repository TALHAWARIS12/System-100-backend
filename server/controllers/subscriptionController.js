const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { User } = require('../models');
const logger = require('../utils/logger');
const { processReferralCommission } = require('./referralController');

// Gold Circle Plans — all prices in USD
const PLANS = {
  'gold-circle': {
    name: 'Gold Circle Monthly Subscription',
    stripePriceId: process.env.STRIPE_PRICE_GOLD_CIRCLE || process.env.STRIPE_PRICE_ID,
    monthlyPrice: 200.77,        // $200.77/month
    setupFee: 0,
    currency: 'usd',
    tier: 'gold',                // internal tier for feature gating
    interval: 'month',
    hasAssimilationAccount: false,
    noTest: false,
    description: 'Full Gold Circle membership with all platform features'
  },
  'gold-circle-plus-10k': {
    name: 'Gold Circle PLUS & 10k Assimilation Account',
    stripePriceId: process.env.STRIPE_PRICE_GOLD_CIRCLE_PLUS_10K || process.env.STRIPE_PRICE_ID,
    setupPriceId: process.env.STRIPE_SETUP_GOLD_CIRCLE_PLUS_10K,
    monthlyPrice: 249,           // $249/month recurring
    setupFee: 599,               // $599 one-off setup
    currency: 'usd',
    tier: 'gold',
    interval: 'month',
    hasAssimilationAccount: true,
    accountSize: '10k',
    noTest: true,
    description: 'Gold Circle PLUS with 10k funded account — no test required'
  },
  'gold-circle-10k': {
    name: 'Gold Circle & 10k Assimilation Account',
    stripePriceId: process.env.STRIPE_PRICE_GOLD_CIRCLE_10K || process.env.STRIPE_PRICE_ID,
    setupPriceId: process.env.STRIPE_SETUP_GOLD_CIRCLE_10K,
    monthlyPrice: 124.77,       // $124.77/month recurring
    setupFee: 350.77,           // $350.77 one-off setup
    currency: 'usd',
    tier: 'gold',
    interval: 'month',
    hasAssimilationAccount: true,
    accountSize: '10k',
    noTest: true,
    description: 'Gold Circle with 10k funded account — no test required'
  }
};

// @desc    Create checkout session
// @route   POST /api/subscriptions/create-checkout
// @access  Private
exports.createCheckoutSession = async (req, res, next) => {
  try {
    const { planId = 'gold-circle' } = req.body;
    const plan = PLANS[planId];
    const user = await User.findByPk(req.user.id);

    if (!plan) {
      return res.status(400).json({ success: false, message: 'Invalid plan selected' });
    }

    // Validate required Stripe configuration
    if (!process.env.STRIPE_SECRET_KEY) {
      logger.error('STRIPE_SECRET_KEY is not configured');
      return res.status(500).json({ success: false, message: 'Payment service not configured. Please contact support.' });
    }

    if (!plan.stripePriceId) {
      logger.error(`STRIPE price ID not configured for plan: ${planId}`);
      return res.status(500).json({ success: false, message: `Payment plan ${planId} not configured. Please contact support.` });
    }

    const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL;
    if (!frontendUrl) {
      logger.error('FRONTEND_URL and CLIENT_URL are not configured');
      return res.status(500).json({ success: false, message: 'Frontend URL not configured. Please contact support.' });
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
          planId
        }
      });
      customerId = customer.id;
      await user.update({ stripeCustomerId: customerId });
    }

    // Build line items
    const lineItems = [
      {
        price: plan.stripePriceId,
        quantity: 1
      }
    ];

    // Add one-off setup fee if applicable
    if (plan.setupFee > 0 && plan.setupPriceId) {
      lineItems.push({
        price: plan.setupPriceId,
        quantity: 1
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      currency: plan.currency,
      success_url: `${frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/subscription/cancelled`,
      metadata: {
        userId: user.id,
        planId,
        tier: plan.tier
      }
    });

    res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    logger.error('Create checkout session error:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stripeError: error.raw || error
    });
    
    // Don't forward Stripe's status codes — return a clear message
    if (error.type === 'StripeAuthenticationError') {
      return res.status(500).json({ success: false, message: 'Payment service configuration error. Please contact support.' });
    }
    if (error.type && error.type.startsWith('Stripe')) {
      return res.status(502).json({ success: false, message: error.message || 'Payment service error' });
    }
    next(error);
  }
};

// @desc    Create customer portal session
// @route   POST /api/subscriptions/create-portal
// @access  Private
exports.createPortalSession = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'No subscription found'
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || process.env.CLIENT_URL}/dashboard`
    });

    res.status(200).json({
      success: true,
      url: session.url
    });
  } catch (error) {
    logger.error('Create portal session error:', error);
    if (error.type && error.type.startsWith('Stripe')) {
      return res.status(502).json({ success: false, message: 'Payment service error. Please try again later.' });
    }
    next(error);
  }
};

// @desc    Get subscription status
// @route   GET /api/subscriptions/status
// @access  Private
exports.getSubscriptionStatus = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);

    res.status(200).json({
      success: true,
      subscription: {
        status: user.subscriptionStatus,
        tier: user.subscriptionTier,
        endDate: user.subscriptionEndDate,
        hasAccess: user.subscriptionStatus === 'active'
      }
    });
  } catch (error) {
    logger.error('Get subscription status error:', error);
    next(error);
  }
};

// @desc    Verify checkout session
// @route   POST /api/subscriptions/verify-session
// @access  Private
exports.verifySession = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID required'
      });
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid' && session.metadata.userId === user.id) {
      // Get subscription details from Stripe to get end date
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      const subscriptionEndDate = new Date(subscription.current_period_end * 1000);
      const tier = session.metadata.tier || 'gold';
      const planId = session.metadata.planId || 'gold-circle';

      // Update user subscription if not already done by webhook
      if (user.subscriptionStatus !== 'active') {
        await user.update({
          stripeCustomerId: session.customer,
          subscriptionId: session.subscription,
          subscriptionStatus: 'active',
          subscriptionTier: tier,
          subscriptionEndDate: subscriptionEndDate
        });

        // Process referral commission based on plan monthly price
        try {
          const plan = PLANS[planId];
          await processReferralCommission(user.id, plan ? plan.monthlyPrice : 200);
        } catch (refErr) {
          logger.warn('Referral commission processing error:', refErr.message);
        }
      }

      res.status(200).json({
        success: true,
        subscription: {
          status: 'active',
          sessionId: sessionId,
          endDate: subscriptionEndDate
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }
  } catch (error) {
    logger.error('Verify session error:', error);
    next(error);
  }
};

// @desc    Get available subscription plans
// @route   GET /api/subscriptions/plans
// @access  Public
exports.getPlans = async (req, res) => {
  const plans = Object.entries(PLANS).map(([planId, plan]) => ({
    planId,
    name: plan.name,
    monthlyPrice: plan.monthlyPrice,
    setupFee: plan.setupFee,
    currency: plan.currency,
    interval: plan.interval,
    description: plan.description,
    hasAssimilationAccount: plan.hasAssimilationAccount,
    accountSize: plan.accountSize || null,
    noTest: plan.noTest,
    features: {
      tradeScanner: true,
      economicCalendar: true,
      communityChat: true,
      tradeJournal: true,
      premiumSignals: true,
      strategyEducation: true,
      goldScanner: true,
      referralProgram: true,
      prioritySupport: true,
      assimilationAccount: plan.hasAssimilationAccount,
      noTestRequired: plan.noTest
    }
  }));

  res.json({ success: true, plans });
};
