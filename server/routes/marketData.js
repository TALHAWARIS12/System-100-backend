const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const forexFactoryService = require('../services/forexFactoryService');
const currencyStrengthService = require('../services/currencyStrengthService');
const logger = require('../utils/logger');

/**
 * @route GET /api/market-data/calendar
 * @desc Get economic calendar events (Forex Factory data)
 * @access Private (subscription required)
 */
router.get('/calendar', protect, async (req, res) => {
  try {
    const { impact, currency, startDate, endDate } = req.query;
    
    const filters = {};
    if (impact) filters.impact = impact.split(',');
    if (currency) filters.currency = currency.split(',');
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const events = await forexFactoryService.getCalendarEvents(filters);
    
    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    logger.error('Calendar fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch calendar events'
    });
  }
});

/**
 * @route GET /api/market-data/calendar/today
 * @desc Get today's high impact events
 * @access Private
 */
router.get('/calendar/today', protect, async (req, res) => {
  try {
    const events = await forexFactoryService.getTodayHighImpact();
    
    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    logger.error('Today events fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch today\'s events'
    });
  }
});

/**
 * @route GET /api/market-data/calendar/upcoming
 * @desc Get upcoming events (next 24 hours by default)
 * @access Private
 */
router.get('/calendar/upcoming', protect, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const events = await forexFactoryService.getUpcomingEvents(hours);
    
    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    logger.error('Upcoming events fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming events'
    });
  }
});

/**
 * @route GET /api/market-data/currency-strength
 * @desc Get currency strength meter data
 * @access Private (subscription required)
 */
router.get('/currency-strength', protect, async (req, res) => {
  try {
    const strength = await currencyStrengthService.getCurrencyStrength();
    
    res.json({
      success: true,
      data: strength
    });
  } catch (error) {
    logger.error('Currency strength fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch currency strength data'
    });
  }
});

/**
 * @route GET /api/market-data/analysis
 * @desc Get combined market analysis (calendar + strength)
 * @access Private (subscription required)
 */
router.get('/analysis', protect, async (req, res) => {
  try {
    const [calendarEvents, currencyStrength] = await Promise.all([
      forexFactoryService.getTodayHighImpact(),
      currencyStrengthService.getCurrencyStrength()
    ]);
    
    res.json({
      success: true,
      data: {
        calendar: calendarEvents,
        currencyStrength,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Market analysis fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch market analysis'
    });
  }
});

module.exports = router;
