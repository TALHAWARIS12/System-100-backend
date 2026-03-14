const express = require('express');
const router = express.Router();
const { protect, requireTier } = require('../middleware/auth');
const {
  getState,
  triggerScan,
  getSignals,
  getPrices
} = require('../controllers/goldScannerController');

router.get('/state', protect, requireTier('gold'), getState);
router.post('/scan', protect, requireTier('gold'), triggerScan);
router.get('/signals', protect, requireTier('gold'), getSignals);
router.get('/prices', protect, requireTier('gold'), getPrices);

module.exports = router;
