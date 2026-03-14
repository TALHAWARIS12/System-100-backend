/**
 * Phase 2: Economic Calendar Controller
 */
const economicCalendarService = require('../services/economicCalendarService');
const logger = require('../utils/logger');

// @desc    Get economic calendar events
// @route   GET /api/calendar/events
exports.getEvents = async (req, res, next) => {
  try {
    const events = await economicCalendarService.fetchEvents();

    // Filters
    const { impact, country, currency, upcoming, startDate, endDate } = req.query;
    let filtered = events;

    // Date range filtering
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(e => new Date(e.date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(e => new Date(e.date) <= end);
    }

    if (impact) {
      filtered = filtered.filter(e => e.impact === impact);
    }
    if (country) {
      filtered = filtered.filter(e => e.country === country);
    }
    if (currency) {
      filtered = filtered.filter(e => e.currency === currency);
    }
    if (upcoming === 'true') {
      filtered = filtered.filter(e => new Date(e.date) > new Date());
    }

    res.json({ success: true, events: filtered, total: filtered.length });
  } catch (error) {
    logger.error('Get calendar events error:', error);
    next(error);
  }
};

// @desc    Get today's high impact events
// @route   GET /api/calendar/today
exports.getTodayEvents = async (req, res, next) => {
  try {
    const events = await economicCalendarService.fetchEvents();
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    const todayEvents = events.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate >= startOfDay && eventDate < endOfDay;
    });

    res.json({ success: true, events: todayEvents });
  } catch (error) {
    logger.error('Get today events error:', error);
    next(error);
  }
};
