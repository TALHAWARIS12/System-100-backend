const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAnalytics,
  publishSignal,
  createAnnouncement,
  getAnnouncements,
  suspendUser,
  updateUserTier,
  getUserActivity
} = require('../controllers/adminController');

// All routes require admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/analytics', getAnalytics);
router.post('/signals', publishSignal);
router.post('/announcements', createAnnouncement);
router.get('/announcements', getAnnouncements);
router.put('/users/:userId/suspend', suspendUser);
router.put('/users/:userId/tier', updateUserTier);
router.get('/users/:userId/activity', getUserActivity);

module.exports = router;
