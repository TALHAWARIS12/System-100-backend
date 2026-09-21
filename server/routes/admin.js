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
  getUserActivity,
  updateMemberStatus,
  adminResetPassword,
  getAuditLogs
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
router.put('/users/:userId/member-status', updateMemberStatus);
router.post('/users/:userId/reset-password', adminResetPassword);
router.get('/users/:userId/activity', getUserActivity);
router.get('/audit-logs', getAuditLogs);

module.exports = router;
