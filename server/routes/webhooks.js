const express = require('express');
const router = express.Router();
const { handleStripeWebhook } = require('../controllers/webhookController');

router.post('/stripe', handleStripeWebhook);

module.exports = router;
