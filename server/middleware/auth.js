const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findByPk(decoded.id);

      if (!req.user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      if (!req.user.isActive) {
        return res.status(403).json({ success: false, message: 'Account is disabled' });
      }

      next();
    } catch (error) {
      logger.error('Token verification failed:', error);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

const requireActiveSubscription = (req, res, next) => {
  // Admin and educator bypass subscription check
  if (req.user.role === 'admin' || req.user.role === 'educator') {
    return next();
  }

  if (!req.user.hasActiveSubscription()) {
    return res.status(403).json({
      success: false,
      message: 'Active subscription required to access this resource'
    });
  }

  next();
};

// Tier hierarchy: platinum > gold > silver > bronze
const TIER_HIERARCHY = { bronze: 1, silver: 2, gold: 3, platinum: 4 };

/**
 * Require a minimum subscription tier.
 * Usage: requireTier('silver') — allows silver, gold, platinum
 * Usage: requireTier('gold', 'platinum') — allows only gold and platinum
 */
const requireTier = (...allowedTiers) => {
  return (req, res, next) => {
    // Admin and educator bypass tier check
    if (req.user.role === 'admin' || req.user.role === 'educator') {
      return next();
    }

    if (!req.user.hasActiveSubscription()) {
      return res.status(403).json({
        success: false,
        message: 'Active subscription required'
      });
    }

    const userTier = req.user.subscriptionTier || 'bronze';

    // If single tier provided, treat as minimum tier (user must be at or above)
    if (allowedTiers.length === 1) {
      const minLevel = TIER_HIERARCHY[allowedTiers[0]] || 1;
      const userLevel = TIER_HIERARCHY[userTier] || 0;
      if (userLevel >= minLevel) return next();
    } else {
      // If multiple tiers, user must be in one of them
      if (allowedTiers.includes(userTier)) return next();
    }

    return res.status(403).json({
      success: false,
      message: `This feature requires a ${allowedTiers.join(' or ')} subscription tier. Your current tier: ${userTier}`
    });
  };
};

module.exports = { protect, authorize, requireActiveSubscription, requireTier };
