const { TradeJournal, Trade } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Enhanced Trade Analytics Service
 * 
 * Provides comprehensive trading performance analytics including:
 * - Advanced performance metrics
 * - Risk analysis
 * - Trading psychology insights
 * - Portfolio analysis
 * - Comparative benchmarking
 */
class TradeAnalyticsService {
  
  /**
   * Get comprehensive performance dashboard data
   */
  async getPerformanceDashboard(userId, timeframe = '30d') {
    try {
      const dateRange = this.getDateRange(timeframe);
      
      // Handle case where user has no data yet
      const tradeCount = await TradeJournal.count({
        where: {
          userId,
          status: 'closed'
        }
      });

      if (tradeCount === 0) {
        return {
          journal: this.getEmptyJournalStats(),
          educator: this.getEmptyEducatorStats(), 
          monthly: [],
          timeframe,
          generatedAt: new Date(),
          isEmpty: true
        };
      }
      
      const [journalStats, educatorStats, monthlyData] = await Promise.all([
        this.getTradeJournalStats(userId, dateRange),
        this.getEducatorTradeStats(userId, dateRange),
        this.getMonthlyPerformance(userId)
      ]);

      return {
        journal: journalStats,
        educator: educatorStats,
        monthly: monthlyData,
        timeframe,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error('Dashboard analytics error:', error);
      // Return empty data instead of throwing
      return {
        journal: this.getEmptyJournalStats(),
        educator: this.getEmptyEducatorStats(),
        monthly: [],
        timeframe,
        generatedAt: new Date(),
        error: true
      };
    }
  }

  /**
   * Get detailed trade journal analytics
   */
  async getTradeJournalStats(userId, dateRange) {
    const where = {
      userId,
      status: 'closed',
      exitedAt: {
        [Op.between]: [dateRange.start, dateRange.end]
      }
    };

    const trades = await TradeJournal.findAll({
      where,
      order: [['exitedAt', 'ASC']]
    });

    if (trades.length === 0) {
      return this.getEmptyStats();
    }

    const wins = trades.filter(t => t.result === 'win');
    const losses = trades.filter(t => t.result === 'loss');
    const breakevens = trades.filter(t => t.result === 'breakeven');

    return {
      overview: {
        totalTrades: trades.length,
        wins: wins.length,
        losses: losses.length,
        breakevens: breakevens.length,
        winRate: ((wins.length / trades.length) * 100).toFixed(2),
        avgTradesPerDay: this.calculateAvgTradesPerDay(trades, dateRange)
      },
      
      profitability: {
        totalPnL: this.calculateTotalPnL(trades),
        totalPips: this.calculateTotalPips(trades),
        avgWinPips: this.calculateAvgPips(wins),
        avgLossPips: this.calculateAvgPips(losses),
        biggestWin: this.getBiggestTrade(wins, 'win'),
        biggestLoss: this.getBiggestTrade(losses, 'loss'),
        profitFactor: this.calculateProfitFactor(wins, losses),
        expectancy: this.calculateExpectancy(trades)
      },

      riskMetrics: {
        avgRiskReward: this.calculateAvgRiskReward(trades),
        maxDrawdown: this.calculateMaxDrawdown(trades),
        maxDrawdownPercent: this.calculateMaxDrawdownPercent(trades),
        consecutiveWins: this.calculateMaxConsecutive(trades, 'win'),
        consecutiveLosses: this.calculateMaxConsecutive(trades, 'loss'),
        recoveryFactor: this.calculateRecoveryFactor(trades),
        sharpeRatio: this.calculateSharpeRatio(trades)
      },

      tradingPsychology: {
        emotionAnalysis: this.analyzeEmotions(trades),
        averageHoldTime: this.calculateAverageHoldTime(trades),
        tradingDiscipline: this.analyzeTradingDiscipline(trades),
        riskConsistency: this.analyzeRiskConsistency(trades)
      },

      assetPerformance: this.analyzeAssetPerformance(trades),
      strategyPerformance: this.analyzeStrategyPerformance(trades),
      timeFrameAnalysis: this.analyzeTimeFrames(trades)
    };
  }

  /**
   * Get educator performance stats
   */
  async getEducatorTradeStats(userId, dateRange) {
    // For users who are also educators
    const where = {
      educatorId: userId,
      status: 'closed',
      closedAt: {
        [Op.between]: [dateRange.start, dateRange.end]
      }
    };

    const trades = await Trade.findAll({ where });
    
    if (trades.length === 0) {
      return null;
    }

    const wins = trades.filter(t => t.result === 'win');
    const losses = trades.filter(t => t.result === 'loss');

    return {
      totalSignals: trades.length,
      winRate: ((wins.length / trades.length) * 100).toFixed(2),
      avgPips: this.calculateAvgPips(trades),
      totalPips: this.calculateTotalPips(trades),
      performance: this.calculateEducatorPerformance(trades)
    };
  }

  /**
   * Calculate monthly performance trends
   */
  async getMonthlyPerformance(userId, months = 12) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - months);

    const trades = await TradeJournal.findAll({
      where: {
        userId,
        status: 'closed',
        exitedAt: {
          [Op.between]: [startDate, endDate]
        }
      },
      order: [['exitedAt', 'ASC']]
    });

    const monthlyData = {};
    
    for (let i = 0; i < months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
      monthlyData[monthKey] = {
        month: monthKey,
        trades: 0,
        wins: 0,
        losses: 0,
        pnl: 0,
        pips: 0,
        winRate: 0
      };
    }

    trades.forEach(trade => {
      const monthKey = trade.exitedAt.toISOString().slice(0, 7);
      if (monthlyData[monthKey]) {
        const month = monthlyData[monthKey];
        month.trades++;
        month.pnl += parseFloat(trade.pnl || 0);
        month.pips += parseFloat(trade.pips || 0);
        
        if (trade.result === 'win') {
          month.wins++;
        } else if (trade.result === 'loss') {
          month.losses++;
        }
        
        month.winRate = month.trades > 0 ? ((month.wins / month.trades) * 100).toFixed(2) : 0;
      }
    });

    return Object.values(monthlyData).reverse();
  }

  /**
   * Calculate comprehensive risk metrics
   */
  calculateMaxDrawdown(trades) {
    let maxDrawdown = 0;
    let peak = 0;
    let runningTotal = 0;

    trades.forEach(trade => {
      runningTotal += parseFloat(trade.pnl || 0);
      if (runningTotal > peak) {
        peak = runningTotal;
      }
      const drawdown = peak - runningTotal;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return maxDrawdown.toFixed(2);
  }

  calculateSharpeRatio(trades) {
    if (trades.length < 2) return 0;
    
    const returns = trades.map(t => parseFloat(t.pnl || 0));
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    // Calculate standard deviation of returns
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Simplified Sharpe ratio (assuming 0% risk-free rate)
    return stdDev > 0 ? (avgReturn / stdDev).toFixed(2) : 0;
  }

  analyzeEmotions(trades) {
    const emotions = {};
    let totalWithEmotion = 0;

    trades.forEach(trade => {
      if (trade.emotionTag) {
        emotions[trade.emotionTag] = emotions[trade.emotionTag] || { count: 0, wins: 0 };
        emotions[trade.emotionTag].count++;
        if (trade.result === 'win') {
          emotions[trade.emotionTag].wins++;
        }
        totalWithEmotion++;
      }
    });

    // Calculate win rates for each emotion
    Object.keys(emotions).forEach(emotion => {
      const data = emotions[emotion];
      data.winRate = ((data.wins / data.count) * 100).toFixed(2);
      data.percentage = ((data.count / totalWithEmotion) * 100).toFixed(2);
    });

    return {
      breakdown: emotions,
      coverageRate: ((totalWithEmotion / trades.length) * 100).toFixed(2)
    };
  }

  analyzeTradingDiscipline(trades) {
    let disciplinedTrades = 0;
    let totalAnalyzed = 0;

    trades.forEach(trade => {
      if (trade.stopLoss && trade.takeProfit) {
        totalAnalyzed++;
        
        // Check if exit was close to planned levels (within 5%)
        const exitPrice = parseFloat(trade.exit);
        const stopLoss = parseFloat(trade.stopLoss);
        const takeProfit = parseFloat(trade.takeProfit);
        
        const stopLossVariance = Math.abs(exitPrice - stopLoss) / stopLoss;
        const takeProfitVariance = Math.abs(exitPrice - takeProfit) / takeProfit;
        
        if (stopLossVariance <= 0.05 || takeProfitVariance <= 0.05) {
          disciplinedTrades++;
        }
      }
    });

    return {
      disciplineRate: totalAnalyzed > 0 ? ((disciplinedTrades / totalAnalyzed) * 100).toFixed(2) : 0,
      analyzedTrades: totalAnalyzed
    };
  }

  analyzeAssetPerformance(trades) {
    const assets = {};
    
    trades.forEach(trade => {
      if (!assets[trade.asset]) {
        assets[trade.asset] = {
          totalTrades: 0,
          wins: 0,
          losses: 0,
          totalPnL: 0,
          totalPips: 0
        };
      }
      
      const asset = assets[trade.asset];
      asset.totalTrades++;
      asset.totalPnL += parseFloat(trade.pnl || 0);
      asset.totalPips += parseFloat(trade.pips || 0);
      
      if (trade.result === 'win') {
        asset.wins++;
      } else if (trade.result === 'loss') {
        asset.losses++;
      }
    });

    // Calculate derived metrics
    Object.keys(assets).forEach(asset => {
      const data = assets[asset];
      data.winRate = ((data.wins / data.totalTrades) * 100).toFixed(2);
      data.avgPnL = (data.totalPnL / data.totalTrades).toFixed(2);
      data.avgPips = (data.totalPips / data.totalTrades).toFixed(2);
    });

    return Object.entries(assets)
      .sort(([,a], [,b]) => b.totalTrades - a.totalTrades)
      .slice(0, 10); // Top 10 most traded assets
  }

  /**
   * Utility methods
   */
  getDateRange(timeframe) {
    const end = new Date();
    const start = new Date();
    
    switch (timeframe) {
      case '7d':
        start.setDays(start.getDays() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(start.getFullYear() - 1);
        break;
      default:
        start.setDate(start.getDate() - 30);
    }
    
    return { start, end };
  }

  calculateTotalPnL(trades) {
    return trades.reduce((total, trade) => total + parseFloat(trade.pnl || 0), 0).toFixed(2);
  }

  calculateTotalPips(trades) {
    return trades.reduce((total, trade) => total + parseFloat(trade.pips || 0), 0).toFixed(2);
  }

  calculateAvgPips(trades) {
    if (trades.length === 0) return 0;
    const total = this.calculateTotalPips(trades);
    return (parseFloat(total) / trades.length).toFixed(2);
  }

  calculateProfitFactor(wins, losses) {
    const grossProfit = wins.reduce((sum, trade) => sum + Math.abs(parseFloat(trade.pnl || 0)), 0);
    const grossLoss = losses.reduce((sum, trade) => sum + Math.abs(parseFloat(trade.pnl || 0)), 0);
    
    return grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : '∞';
  }

  calculateExpectancy(trades) {
    if (trades.length === 0) return 0;
    const totalPnL = parseFloat(this.calculateTotalPnL(trades));
    return (totalPnL / trades.length).toFixed(2);
  }

  getBiggestTrade(trades, type) {
    if (trades.length === 0) return null;
    
    const biggest = trades.reduce((max, trade) => {
      const pnl = Math.abs(parseFloat(trade.pnl || 0));
      return pnl > Math.abs(parseFloat(max.pnl || 0)) ? trade : max;
    });
    
    return {
      asset: biggest.asset,
      pnl: biggest.pnl,
      pips: biggest.pips,
      date: biggest.exitedAt
    };
  }

  getEmptyStats() {
    return {
      overview: { totalTrades: 0, wins: 0, losses: 0, breakevens: 0, winRate: '0.00', avgTradesPerDay: 0 },
      profitability: { totalPnL: '0.00', totalPips: '0.00', avgWinPips: '0.00', avgLossPips: '0.00', biggestWin: null, biggestLoss: null, profitFactor: 0, expectancy: 0 },
      riskMetrics: { avgRiskReward: 0, maxDrawdown: 0, maxDrawdownPercent: 0, consecutiveWins: 0, consecutiveLosses: 0, recoveryFactor: 0, sharpeRatio: 0 },
      tradingPsychology: {
        emotionAnalysis: { breakdown: {}, dominantEmotion: null },
        averageHoldTime: 0,
        tradingDiscipline: { followedPlan: 0, total: 0, rate: 0 },
        riskConsistency: { avgRisk: 0, stdDev: 0, consistent: true }
      },
      assetPerformance: [],
      strategyPerformance: [],
      timeFrameAnalysis: []
    };
  }

  // Additional calculation methods...
  calculateMaxConsecutive(trades, type) {
    let maxStreak = 0;
    let currentStreak = 0;
    
    trades.forEach(trade => {
      if (trade.result === type) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });
    
    return maxStreak;
  }

  /**
   * Get empty journal stats for new users
   */
  getEmptyJournalStats() {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnl: 0,
      totalPips: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      longestWinStreak: 0,
      longestLossStreak: 0,
      averageHoldTime: 0,
      riskRewardRatio: 0,
      totalVolume: 0
    };
  }

  /**
   * Get empty educator stats for new users
   */
  getEmptyEducatorStats() {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnl: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0
    };
  }
}

module.exports = new TradeAnalyticsService();