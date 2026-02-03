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

module.exports = { protect, authorize, requireActiveSubscription };
