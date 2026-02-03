const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validator');
const {
  getDataSources,
  getDataSource,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testDataSource,
  resetUsageCounters
} = require('../controllers/dataSourceController');
const { protect, authorize } = require('../middleware/auth');

// All routes require admin authentication
router.use(protect, authorize('admin'));

router.get('/', getDataSources);
router.get('/:id', getDataSource);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('provider').isIn(['alphavantage', 'twelvedata', 'polygon', 'finnhub', 'custom']),
    body('baseUrl').trim().isURL().withMessage('Valid base URL required'),
    validate
  ],
  createDataSource
);

router.put('/:id', updateDataSource);
router.delete('/:id', deleteDataSource);
router.post('/:id/test', testDataSource);
router.post('/reset-usage', resetUsageCounters);

module.exports = router;
