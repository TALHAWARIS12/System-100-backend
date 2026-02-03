const logger = require('../utils/logger');

// @desc    Calculate pips
// @route   POST /api/calculators/pips
// @access  Private
exports.calculatePips = async (req, res, next) => {
  try {
    const { pair, entryPrice, exitPrice, direction } = req.body;

    if (!pair || !entryPrice || !exitPrice || !direction) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Determine pip multiplier based on pair
    let pipMultiplier = 10000; // Default for most pairs
    
    if (pair.includes('JPY')) {
      pipMultiplier = 100; // JPY pairs use 2 decimal places
    }

    // Calculate pip difference
    let pips;
    if (direction.toLowerCase() === 'buy') {
      pips = (exitPrice - entryPrice) * pipMultiplier;
    } else {
      pips = (entryPrice - exitPrice) * pipMultiplier;
    }

    res.status(200).json({
      success: true,
      result: {
        pips: parseFloat(pips.toFixed(1)),
        entry: entryPrice,
        exit: exitPrice,
        direction,
        pair
      }
    });
  } catch (error) {
    logger.error('Calculate pips error:', error);
    next(error);
  }
};

// @desc    Calculate position size / risk
// @route   POST /api/calculators/risk
// @access  Private
exports.calculateRisk = async (req, res, next) => {
  try {
    const {
      accountBalance,
      riskPercentage,
      entryPrice,
      stopLoss,
      pair
    } = req.body;

    if (!accountBalance || !riskPercentage || !entryPrice || !stopLoss) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Calculate risk amount
    const riskAmount = (accountBalance * riskPercentage) / 100;

    // Calculate pip difference
    let pipMultiplier = 10000;
    if (pair && pair.includes('JPY')) {
      pipMultiplier = 100;
    }

    const pipDifference = Math.abs(entryPrice - stopLoss) * pipMultiplier;

    // Calculate position size (lots)
    // Standard lot value per pip (approximate)
    const pipValue = 10; // $10 per pip for 1 standard lot
    const positionSize = riskAmount / (pipDifference * pipValue);

    res.status(200).json({
      success: true,
      result: {
        riskAmount: parseFloat(riskAmount.toFixed(2)),
        pipDifference: parseFloat(pipDifference.toFixed(1)),
        positionSize: parseFloat(positionSize.toFixed(2)),
        positionSizeMicro: parseFloat((positionSize * 100).toFixed(0)), // Micro lots
        accountBalance,
        riskPercentage
      }
    });
  } catch (error) {
    logger.error('Calculate risk error:', error);
    next(error);
  }
};

// @desc    Calculate profit/loss
// @route   POST /api/calculators/profit-loss
// @access  Private
exports.calculateProfitLoss = async (req, res, next) => {
  try {
    const {
      pair,
      entryPrice,
      exitPrice,
      positionSize, // in lots
      direction
    } = req.body;

    if (!entryPrice || !exitPrice || !positionSize || !direction) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Calculate pip difference
    let pipMultiplier = 10000;
    if (pair && pair.includes('JPY')) {
      pipMultiplier = 100;
    }

    let pips;
    if (direction.toLowerCase() === 'buy') {
      pips = (exitPrice - entryPrice) * pipMultiplier;
    } else {
      pips = (entryPrice - exitPrice) * pipMultiplier;
    }

    // Calculate P/L (assuming $10 per pip per standard lot)
    const pipValue = 10;
    const profitLoss = pips * positionSize * pipValue;

    res.status(200).json({
      success: true,
      result: {
        pips: parseFloat(pips.toFixed(1)),
        profitLoss: parseFloat(profitLoss.toFixed(2)),
        entry: entryPrice,
        exit: exitPrice,
        positionSize,
        direction,
        pair
      }
    });
  } catch (error) {
    logger.error('Calculate profit/loss error:', error);
    next(error);
  }
};
