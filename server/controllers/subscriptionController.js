const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { User } = require('../models');
const logger = require('../utils/logger');

// @desc    Create checkout session
// @route   POST /api/subscriptions/create-checkout
// @access  Private
exports.createCheckoutSession = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id
        }
      });
      customerId = customer.id;
      await user.update({ stripeCustomerId: customerId });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || process.env.CLIENT_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || process.env.CLIENT_URL}/subscription/cancelled`,
      metadata: {
        userId: user.id
      }
    });

    res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    logger.error('Create checkout session error:', error);
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

      // Update user subscription if not already done by webhook
      if (user.subscriptionStatus !== 'active') {
        await user.update({
          stripeCustomerId: session.customer,
          subscriptionId: session.subscription,
          subscriptionStatus: 'active',
          subscriptionEndDate: subscriptionEndDate
        });
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
