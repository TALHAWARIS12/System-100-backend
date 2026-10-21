const { 
  User, 
  Trade, 
  AuditLog, 
  ChatMessage, 
  ChatRoom, 
  TradeJournal, 
  Referral, 
  Notification, 
  Announcement, 
  Signal 
} = require('../models');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

// Helper to perform safe transactional delete of a single user
async function executeUserCascadeDelete(targetUser, adminUser, clientIp, transaction) {
  const userId = targetUser.id;

  // 1. Delete notifications
  await Notification.destroy({ where: { userId }, transaction });

  // 2. Delete trade journals
  await TradeJournal.destroy({ where: { userId }, transaction });

  // 3. Delete chat messages
  await ChatMessage.destroy({ where: { userId }, transaction });

  // 4. Delete / nullify referrals
  await Referral.destroy({
    where: {
      [Op.or]: [{ referrerId: userId }, { referredId: userId }]
    },
    transaction
  });

  // 5. Delete trades if educator
  await Trade.destroy({ where: { educatorId: userId }, transaction });

  // 6. Nullify createdBy in chat rooms
  await ChatRoom.update({ createdBy: null }, { where: { createdBy: userId }, transaction });

  // 7. Delete announcements created by user
  await Announcement.destroy({ where: { createdBy: userId }, transaction });

  // 8. Nullify publishedBy in Signals
  await Signal.update({ publishedBy: null }, { where: { publishedBy: userId }, transaction });

  // 9. Nullify referredBy in Users
  await User.update({ referredBy: null }, { where: { referredBy: userId }, transaction });

  // 10. Nullify targetUserId in AuditLogs
  await AuditLog.update({ targetUserId: null }, { where: { targetUserId: userId }, transaction });

  // 11. Nullify performedBy in AuditLogs (keeps history without blocking delete)
  await AuditLog.update({ performedBy: null }, { where: { performedBy: userId }, transaction });

  // 12. Destroy the user record
  await targetUser.destroy({ transaction });

  // 13. Record audit log of deletion
  if (adminUser) {
    await AuditLog.create({
      action: 'USER_DELETED',
      performedBy: adminUser.id,
      details: {
        deletedUserEmail: targetUser.email,
        deletedUserId: targetUser.id,
        deletedUserName: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim(),
        role: targetUser.role,
        memberStatus: targetUser.memberStatus,
        subscriptionStatus: targetUser.subscriptionStatus
      },
      ipAddress: clientIp
    }, { transaction });
  }
}

// @desc    Get all users (with search, filtering, and summary counts)
// @route   GET /api/users
// @access  Private (admin only)
exports.getUsers = async (req, res, next) => {
  try {
    const { 
      role, 
      subscriptionStatus, 
      memberStatus, 
      subscriptionTier, 
      filter, 
      search, 
      limit = 500, 
      page = 1 
    } = req.query;

    const where = {};
    if (role) where.role = role;
    if (subscriptionStatus) where.subscriptionStatus = subscriptionStatus;
    if (memberStatus) where.memberStatus = memberStatus;
    if (subscriptionTier) where.subscriptionTier = subscriptionTier;

    // Quick filter presets (e.g. inactive, active, pending)
    if (filter === 'inactive') {
      where[Op.or] = [
        { subscriptionStatus: 'inactive' },
        { subscriptionTier: 'none' },
        { memberStatus: { [Op.in]: ['suspended', 'revoked'] } },
        { isActive: false }
      ];
    } else if (filter === 'active') {
      where.subscriptionStatus = 'active';
      where.memberStatus = { [Op.in]: ['approved', 'active'] };
    } else if (filter === 'pending') {
      where.memberStatus = 'pending';
    }

    // Search by name or email
    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      const searchCondition = [
        { email: { [Op.iLike]: s } },
        { firstName: { [Op.iLike]: s } },
        { lastName: { [Op.iLike]: s } }
      ];
      if (where[Op.or]) {
        where[Op.and] = [
          { [Op.or]: where[Op.or] },
          { [Op.or]: searchCondition }
        ];
        delete where[Op.or];
      } else {
        where[Op.or] = searchCondition;
      }
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: users } = await User.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset >= 0 ? offset : 0
    });

    // Compute status counts for UI tabs
    const totalCount = await User.count();
    const inactiveCount = await User.count({
      where: {
        [Op.or]: [
          { subscriptionStatus: 'inactive' },
          { subscriptionTier: 'none' },
          { memberStatus: { [Op.in]: ['suspended', 'revoked'] } },
          { isActive: false }
        ]
      }
    });
    const pendingCount = await User.count({ where: { memberStatus: 'pending' } });
    const approvedCount = await User.count({ where: { memberStatus: { [Op.in]: ['approved', 'active'] } } });

    res.status(200).json({
      success: true,
      count,
      totalCount,
      counts: {
        total: totalCount,
        inactive: inactiveCount,
        pending: pendingCount,
        approved: approvedCount
      },
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

// @desc    Delete user with cascading cleanup
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

    // Prevent deleting master admin
    const masterEmail = (process.env.MASTER_ADMIN_EMAIL || 'admin@tradingplatform.com').toLowerCase();
    if (user.role === 'admin' && user.email.toLowerCase() === masterEmail) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete the master admin account'
      });
    }

    await sequelize.transaction(async (t) => {
      await executeUserCascadeDelete(user, req.user, req.ip, t);
    });

    logger.info(`Admin ${req.user.email} deleted user ${user.email} (${user.id})`);

    res.status(200).json({
      success: true,
      message: `User ${user.email} deleted successfully`
    });
  } catch (error) {
    logger.error('Delete user error:', error);
    next(error);
  }
};

// @desc    Bulk delete users with cascading cleanup
// @route   POST /api/users/bulk-delete
// @access  Private (admin only)
exports.bulkDeleteUsers = async (req, res, next) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of user IDs to delete'
      });
    }

    const masterEmail = (process.env.MASTER_ADMIN_EMAIL || 'admin@tradingplatform.com').toLowerCase();

    // Find users
    const usersToDelete = await User.findAll({
      where: {
        id: { [Op.in]: userIds }
      }
    });

    if (usersToDelete.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No matching users found to delete'
      });
    }

    // Filter out current admin and master admin
    const safeUsers = usersToDelete.filter(u => {
      if (u.id === req.user.id) return false;
      if (u.role === 'admin' && u.email.toLowerCase() === masterEmail) return false;
      return true;
    });

    if (safeUsers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected users cannot be deleted (contains your account or master admin)'
      });
    }

    let deletedCount = 0;
    await sequelize.transaction(async (t) => {
      for (const user of safeUsers) {
        await executeUserCascadeDelete(user, req.user, req.ip, t);
        deletedCount++;
      }
    });

    logger.info(`Admin ${req.user.email} bulk deleted ${deletedCount} users`);

    res.status(200).json({
      success: true,
      count: deletedCount,
      message: `Successfully deleted ${deletedCount} user${deletedCount === 1 ? '' : 's'}`
    });
  } catch (error) {
    logger.error('Bulk delete users error:', error);
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
