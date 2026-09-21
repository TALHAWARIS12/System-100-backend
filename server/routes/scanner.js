const express = require('express');
const router = express.Router();
const {
  getResults,
  getConfigs,
  createConfig,
  updateConfig,
  deleteConfig,
  runScanner,
  getStats,
  cleanupDuplicates
} = require('../controllers/scannerController');
const { protect, authorize, requireActiveSubscription, requireApprovedMember } = require('../middleware/auth');
const {
  scannerConfigValidation,
  validateId,
  paginationValidation
} = require('../middleware/validation');

// Public routes (require auth + member authorization + subscription)
router.get('/results', protect, requireApprovedMember, requireActiveSubscription, paginationValidation, getResults);
router.get('/stats', protect, requireApprovedMember, requireActiveSubscription, getStats);

// Admin/Educator routes
router.get('/configs', protect, authorize('admin', 'educator'), getConfigs);

// Admin only routes
router.post('/configs', protect, authorize('admin'), scannerConfigValidation, createConfig);
router.put('/configs/:id', protect, authorize('admin'), validateId, scannerConfigValidation, updateConfig);
router.delete('/configs/:id', protect, authorize('admin'), deleteConfig);
router.post('/run', protect, authorize('admin'), runScanner);
router.delete('/cleanup-duplicates', protect, authorize('admin'), cleanupDuplicates);

module.exports = router;
