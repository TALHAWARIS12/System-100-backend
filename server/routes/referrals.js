const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getDashboard,
  trackClick,
  getCodeInfo
} = require('../controllers/referralController');

router.get('/dashboard', protect, getDashboard);
router.post('/track', trackClick); // Public endpoint
router.get('/code/:code', getCodeInfo); // Public endpoint

module.exports = router;
