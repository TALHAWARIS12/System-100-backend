const express = require('express');
const router = express.Router();
const { protect, requireTier, requireApprovedMember } = require('../middleware/auth');
const {
  getState,
  triggerScan,
  getSignals,
  getPrices
} = require('../controllers/goldScannerController');

router.use(protect);
router.use(requireApprovedMember);

router.get('/state', requireTier('gold'), getState);
router.post('/scan', requireTier('gold'), triggerScan);
router.get('/signals', requireTier('gold'), getSignals);
router.get('/prices', requireTier('gold'), getPrices);

module.exports = router;
