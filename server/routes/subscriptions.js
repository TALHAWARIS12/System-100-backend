const express = require('express');
const router = express.Router();
const {
  createCheckoutSession,
  createPortalSession,
  getSubscriptionStatus,
  verifySession
} = require('../controllers/subscriptionController');
const { protect } = require('../middleware/auth');

router.post('/create-checkout', protect, createCheckoutSession);
router.post('/create-portal', protect, createPortalSession);
router.post('/verify-session', protect, verifySession);
router.get('/status', protect, getSubscriptionStatus);

module.exports = router;
