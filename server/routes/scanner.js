const express = require('express');
const router = express.Router();
const {
  getResults,
  getConfigs,
  createConfig,
  updateConfig,
  deleteConfig,
  runScanner,
  getStats
} = require('../controllers/scannerController');
const { protect, authorize, requireActiveSubscription } = require('../middleware/auth');
const {
  scannerConfigValidation,
  validateId,
  paginationValidation
} = require('../middleware/validation');

// Public routes (require auth + subscription)
router.get('/results', protect, requireActiveSubscription, paginationValidation, getResults);
router.get('/stats', protect, requireActiveSubscription, getStats);

// Admin/Educator routes
router.get('/configs', protect, authorize('admin', 'educator'), getConfigs);

// Admin only routes
router.post('/configs', protect, authorize('admin'), scannerConfigValidation, createConfig);
router.put('/configs/:id', protect, authorize('admin'), validateId, scannerConfigValidation, updateConfig);
router.delete('/configs/:id', protect, authorize('admin'), deleteConfig);
router.post('/run', protect, authorize('admin'), runScanner);

module.exports = router;
