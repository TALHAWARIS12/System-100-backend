const { User } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (admin only)
exports.getUsers = async (req, res, next) => {
  try {
    const { role, subscriptionStatus, limit = 50 } = req.query;

    const where = {};
    if (role) where.role = role;
    if (subscriptionStatus) where.subscriptionStatus = subscriptionStatus;

    const users = await User.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    logger.error('Get users error:', error);
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (admin only)
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    logger.error('Get user error:', error);
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (admin only)
exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Don't allow password update through this route
    const { password, ...updateData } = req.body;

    await user.update(updateData);

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    logger.error('Update user error:', error);
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (admin only)
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent deleting yourself
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    await user.destroy();

    res.status(200).json({
      success: true,
      message: 'User deleted'
    });
  } catch (error) {
    logger.error('Delete user error:', error);
    next(error);
  }
};

// @desc    Create educator account
// @route   POST /api/users/educator
// @access  Private (admin only)
exports.createEducator = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const educator = await User.create({
      email,
      password,
      firstName,
      lastName,
      role: 'educator',
      subscriptionStatus: 'active',
      isActive: true
    });

    res.status(201).json({
      success: true,
      user: educator
    });
  } catch (error) {
    logger.error('Create educator error:', error);
    next(error);
  }
};

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private (admin only)
exports.getUserStats = async (req, res, next) => {
  try {
    const totalUsers = await User.count();
    const activeSubscriptions = await User.count({
      where: { subscriptionStatus: 'active' }
    });
    const educators = await User.count({
      where: { role: 'educator' }
    });
    const clients = await User.count({
      where: { role: 'client' }
    });

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        activeSubscriptions,
        educators,
        clients
      }
    });
  } catch (error) {
    logger.error('Get user stats error:', error);
    next(error);
  }
};
