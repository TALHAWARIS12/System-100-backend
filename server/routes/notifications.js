const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getNotifications,
  markAsRead,
  updatePreferences,
  updateFcmToken,
  subscribePush,
  getVapidKey
} = require('../controllers/notificationController');

router.get('/', protect, getNotifications);
router.put('/read', protect, markAsRead);
router.put('/preferences', protect, updatePreferences);
router.put('/fcm-token', protect, updateFcmToken);
router.post('/push/subscribe', protect, subscribePush);
router.get('/push/vapid-key', getVapidKey);

module.exports = router;
