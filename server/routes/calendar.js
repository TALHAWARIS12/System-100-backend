const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getEvents,
  getTodayEvents
} = require('../controllers/calendarController');

router.get('/events', protect, getEvents);
router.get('/today', protect, getTodayEvents);

module.exports = router;
