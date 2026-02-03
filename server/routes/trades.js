const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validator');
const {
  getTrades,
  getTrade,
  createTrade,
  updateTrade,
  deleteTrade,
  closeTrade,
  getMyTrades,
  getTradeStats
} = require('../controllers/tradeController');
const { protect, authorize, requireActiveSubscription } = require('../middleware/auth');

// Public routes (require auth + subscription)
router.get('/', protect, requireActiveSubscription, getTrades);
router.get('/stats', protect, requireActiveSubscription, getTradeStats);
router.get('/:id', protect, requireActiveSubscription, getTrade);

// Educator routes
router.get('/educator/mine', protect, authorize('educator', 'admin'), getMyTrades);

router.post(
  '/',
  protect,
  authorize('educator', 'admin'),
  require('../middleware/validation').createTradeValidation,
  createTrade
);

router.put('/:id', protect, authorize('educator', 'admin'), updateTrade);
router.delete('/:id', protect, authorize('educator', 'admin'), deleteTrade);

router.post(
  '/:id/close',
  protect,
  authorize('educator', 'admin'),
  [
    body('closePrice').isFloat({ min: 0 }),
    body('result').isIn(['win', 'loss', 'breakeven']),
    validate
  ],
  closeTrade
);

module.exports = router;
