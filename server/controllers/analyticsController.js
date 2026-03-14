const tradeAnalyticsService = require('../services/tradeAnalyticsService');
const logger = require('../utils/logger');

/**
 * @desc    Get comprehensive performance dashboard
 * @route   GET /api/analytics/dashboard
 * @access  Private
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    const dashboard = await tradeAnalyticsService.getPerformanceDashboard(
      req.user.id,
      timeframe
    );

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('Analytics dashboard error:', error);
    next(error);
  }
};

/**
 * @desc    Get detailed trading performance metrics
 * @route   GET /api/analytics/performance
 * @access  Private
 */
exports.getPerformance = async (req, res, next) => {
  try {
    const { timeframe = '30d' } = req.query;
    const dateRange = tradeAnalyticsService.getDateRange(timeframe);
    
    const performance = await tradeAnalyticsService.getTradeJournalStats(
      req.user.id,
      dateRange
    );

    res.json({
      success: true,
      data: performance,
      timeframe,
      dateRange
    });
  } catch (error) {
    logger.error('Performance analytics error:', error);
    next(error);
  }
};

/**
 * @desc    Get monthly performance trends
 * @route   GET /api/analytics/monthly
 * @access  Private
 */
exports.getMonthlyTrends = async (req, res, next) => {
  try {
    const { months = 12 } = req.query;
    
    const monthlyData = await tradeAnalyticsService.getMonthlyPerformance(
      req.user.id,
      parseInt(months)
    );

    res.json({
      success: true,
      data: monthlyData
    });
  } catch (error) {
    logger.error('Monthly trends error:', error);
    next(error);
  }
};

/**
 * @desc    Get risk analysis metrics
 * @route   GET /api/analytics/risk
 * @access  Private
 */
exports.getRiskAnalysis = async (req, res, next) => {
  try {
    const { timeframe = '30d' } = req.query;
    const dateRange = tradeAnalyticsService.getDateRange(timeframe);
    
    const stats = await tradeAnalyticsService.getTradeJournalStats(
      req.user.id,
      dateRange
    );

    res.json({
      success: true,
      data: {
        riskMetrics: stats.riskMetrics || {},
        tradingPsychology: stats.tradingPsychology || {},
        timeframe
      }
    });
  } catch (error) {
    logger.error('Risk analysis error:', error);
    next(error);
  }
};

/**
 * @desc    Get asset performance breakdown
 * @route   GET /api/analytics/assets
 * @access  Private
 */
exports.getAssetPerformance = async (req, res, next) => {
  try {
    const { timeframe = '30d' } = req.query;
    const dateRange = tradeAnalyticsService.getDateRange(timeframe);
    
    const stats = await tradeAnalyticsService.getTradeJournalStats(
      req.user.id,
      dateRange
    );

    res.json({
      success: true,
      data: {
        assetPerformance: stats.assetPerformance || [],
        strategyPerformance: stats.strategyPerformance || [],
        timeframe
      }
    });
  } catch (error) {
    logger.error('Asset performance error:', error);
    next(error);
  }
};

/**
 * @desc    Get trading psychology insights
 * @route   GET /api/analytics/psychology
 * @access  Private
 */
exports.getPsychologyAnalysis = async (req, res, next) => {
  try {
    const { timeframe = '90d' } = req.query;
    const dateRange = tradeAnalyticsService.getDateRange(timeframe);
    
    const stats = await tradeAnalyticsService.getTradeJournalStats(
      req.user.id,
      dateRange
    );

    const psychology = stats.tradingPsychology || {};
    res.json({
      success: true,
      data: {
        emotionAnalysis: psychology.emotionAnalysis || { breakdown: {}, dominantEmotion: null },
        discipline: psychology.tradingDiscipline || { followedPlan: 0, total: 0, rate: 0 },
        riskConsistency: psychology.riskConsistency || { avgRisk: 0, stdDev: 0, consistent: true },
        averageHoldTime: psychology.averageHoldTime || 0,
        timeframe
      }
    });
  } catch (error) {
    logger.error('Psychology analysis error:', error);
    next(error);
  }
};

/**
 * @desc    Get comparative benchmarks
 * @route   GET /api/analytics/benchmarks
 * @access  Private
 */
exports.getBenchmarks = async (req, res, next) => {
  try {
    // This could compare against market indices or other traders
    // For now, return basic benchmarking data
    
    const { timeframe = '30d' } = req.query;
    const dateRange = tradeAnalyticsService.getDateRange(timeframe);
    
    const userStats = await tradeAnalyticsService.getTradeJournalStats(
      req.user.id,
      dateRange
    );

    // Simple benchmarking against typical retail trader statistics
    const benchmarks = {
      retailTraderWinRate: 25, // Typical retail trader win rate
      userWinRate: parseFloat(userStats.overview.winRate),
      retailTraderProfitFactor: 0.8,
      userProfitFactor: parseFloat(userStats.profitability.profitFactor),
      retailTraderSharpe: -0.5,
      userSharpe: parseFloat(userStats.riskMetrics.sharpeRatio),
      improvement: {
        winRate: parseFloat(userStats.overview.winRate) - 25,
        profitFactor: parseFloat(userStats.profitability.profitFactor) - 0.8,
        sharpe: parseFloat(userStats.riskMetrics.sharpeRatio) - (-0.5)
      }
    };

    res.json({
      success: true,
      data: benchmarks
    });
  } catch (error) {
    logger.error('Benchmarks error:', error);
    next(error);
  }
};

/**
 * @desc    Generate analytics report (PDF/Export ready)
 * @route   GET /api/analytics/report
 * @access  Private
 */
exports.generateReport = async (req, res, next) => {
  try {
    const { timeframe = '30d', format = 'json' } = req.query;
    
    const dashboard = await tradeAnalyticsService.getPerformanceDashboard(
      req.user.id,
      timeframe
    );

    // Add metadata for report generation
    const report = {
      ...dashboard,
      metadata: {
        generatedAt: new Date(),
        userId: req.user.id,
        timeframe,
        reportType: 'comprehensive_analytics'
      }
    };

    if (format === 'csv') {
      // Convert to CSV format for Excel import
      const csvData = this.convertToCSV(dashboard.journal);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="trading-analytics.csv"');
      return res.send(csvData);
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Generate report error:', error);
    next(error);
  }
};

/**
 * Helper function to convert analytics to CSV
 */
exports.convertToCSV = (journalData) => {
  const headers = [
    'Metric',
    'Value',
    'Category'
  ];

  const rows = [
    ['Total Trades', journalData.overview.totalTrades, 'Overview'],
    ['Win Rate', journalData.overview.winRate + '%', 'Overview'],
    ['Total P&L', journalData.profitability.totalPnL, 'Profitability'],
    ['Total Pips', journalData.profitability.totalPips, 'Profitability'],
    ['Profit Factor', journalData.profitability.profitFactor, 'Profitability'],
    ['Sharpe Ratio', journalData.riskMetrics.sharpeRatio, 'Risk'],
    ['Max Drawdown', journalData.riskMetrics.maxDrawdown, 'Risk'],
    ['Average Risk:Reward', journalData.riskMetrics.avgRiskReward, 'Risk']
  ];

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  return csvContent;
};