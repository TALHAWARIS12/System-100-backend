const express = require('express');
const router = express.Router();
const { protect, requireTier } = require('../middleware/auth');
const {
  getEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  getAnalytics,
  compareWithSignals
} = require('../controllers/journalController');

router.get('/', protect, requireTier('silver'), getEntries);
router.post('/', protect, requireTier('silver'), createEntry);
router.put('/:id', protect, requireTier('silver'), updateEntry);
router.delete('/:id', protect, requireTier('silver'), deleteEntry);
router.get('/analytics', protect, requireTier('silver'), getAnalytics);
router.get('/compare', protect, requireTier('silver'), compareWithSignals);

module.exports = router;
