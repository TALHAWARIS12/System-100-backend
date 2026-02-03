const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { User } = require('../models');
const logger = require('../utils/logger');

// @desc    Handle Stripe webhooks
// @route   POST /api/webhooks/stripe
// @access  Public (verified by Stripe signature)
exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};

async function handleCheckoutCompleted(session) {
  const userId = session.metadata.userId;
  const customerId = session.customer;

  const user = await User.findByPk(userId);
  if (user) {
    // Get subscription to get the end date
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    const endDate = new Date(subscription.current_period_end * 1000);

    await user.update({
      stripeCustomerId: customerId,
      subscriptionId: session.subscription,
      subscriptionStatus: 'active',
      subscriptionEndDate: endDate
    });
    logger.info(`Checkout completed for user ${userId}`);
  }
}

async function handleSubscriptionUpdate(subscription) {
  const user = await User.findOne({
    where: { stripeCustomerId: subscription.customer }
  });

  if (user) {
    const endDate = new Date(subscription.current_period_end * 1000);
    await user.update({
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionEndDate: endDate
    });
    logger.info(`Subscription updated for user ${user.id}: ${subscription.status}`);
  }
}

async function handleSubscriptionDeleted(subscription) {
  const user = await User.findOne({
    where: { stripeCustomerId: subscription.customer }
  });

  if (user) {
    await user.update({
      subscriptionStatus: 'cancelled',
      subscriptionEndDate: new Date()
    });
    logger.info(`Subscription cancelled for user ${user.id}`);
  }
}

async function handlePaymentSucceeded(invoice) {
  const user = await User.findOne({
    where: { stripeCustomerId: invoice.customer }
  });

  if (user && invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    const endDate = new Date(subscription.current_period_end * 1000);
    
    await user.update({
      subscriptionStatus: 'active',
      subscriptionEndDate: endDate
    });
    logger.info(`Payment succeeded for user ${user.id}`);
  }
}

async function handlePaymentFailed(invoice) {
  const user = await User.findOne({
    where: { stripeCustomerId: invoice.customer }
  });

  if (user) {
    await user.update({
      subscriptionStatus: 'past_due'
    });
    logger.warn(`Payment failed for user ${user.id}`);
  }
}
