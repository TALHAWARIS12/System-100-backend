const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validator');
const {
  calculatePips,
  calculateRisk,
  calculateProfitLoss
} = require('../controllers/calculatorController');
const { protect } = require('../middleware/auth');

// All calculator routes require authentication
router.use(protect);

router.post(
  '/pips',
  [
    body('pair').trim().notEmpty(),
    body('entryPrice').isFloat({ min: 0 }),
    body('exitPrice').isFloat({ min: 0 }),
    body('direction').isIn(['buy', 'sell']),
    validate
  ],
  calculatePips
);

router.post(
  '/risk',
  [
    body('accountBalance').isFloat({ min: 0 }),
    body('riskPercentage').isFloat({ min: 0, max: 100 }),
    body('entryPrice').isFloat({ min: 0 }),
    body('stopLoss').isFloat({ min: 0 }),
    validate
  ],
  calculateRisk
);

router.post(
  '/profit-loss',
  [
    body('entryPrice').isFloat({ min: 0 }),
    body('exitPrice').isFloat({ min: 0 }),
    body('positionSize').isFloat({ min: 0 }),
    body('direction').isIn(['buy', 'sell']),
    validate
  ],
  calculateProfitLoss
);

module.exports = router;
