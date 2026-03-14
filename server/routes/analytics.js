const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getPerformance,
  getMonthlyTrends,
  getRiskAnalysis,
  getAssetPerformance,
  getPsychologyAnalysis,
  getBenchmarks,
  generateReport
} = require('../controllers/analyticsController');

const { protect } = require('../middleware/auth');

// Protect all analytics routes
router.use(protect);

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get comprehensive performance dashboard
 * @access  Private
 */
router.get('/dashboard', getDashboard);

/**
 * @route   GET /api/analytics/performance
 * @desc    Get detailed trading performance metrics
 * @access  Private
 */
router.get('/performance', getPerformance);

/**
 * @route   GET /api/analytics/monthly
 * @desc    Get monthly performance trends
 * @access  Private
 */
router.get('/monthly', getMonthlyTrends);

/**
 * @route   GET /api/analytics/risk
 * @desc    Get risk analysis metrics
 * @access  Private
 */
router.get('/risk', getRiskAnalysis);

/**
 * @route   GET /api/analytics/assets  
 * @desc    Get asset performance breakdown
 * @access  Private
 */
router.get('/assets', getAssetPerformance);

/**
 * @route   GET /api/analytics/psychology
 * @desc    Get trading psychology insights
 * @access  Private
 */
router.get('/psychology', getPsychologyAnalysis);

/**
 * @route   GET /api/analytics/benchmarks
 * @desc    Get comparative benchmarks
 * @access  Private
 */
router.get('/benchmarks', getBenchmarks);

/**
 * @route   GET /api/analytics/report
 * @desc    Generate comprehensive analytics report
 * @access  Private
 */
router.get('/report', generateReport);

module.exports = router;