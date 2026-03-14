/**
 * Phase 2: Chat Controller
 * Handles community chat rooms and messages
 */
const { ChatRoom, ChatMessage, User } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

// @desc    Get all chat rooms
// @route   GET /api/chat/rooms
exports.getRooms = async (req, res, next) => {
  try {
    const rooms = await ChatRoom.findAll({
      where: { isActive: true },
      include: [{ model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }],
      order: [['createdAt', 'ASC']]
    });

    res.json({ success: true, rooms });
  } catch (error) {
    logger.error('Get rooms error:', error);
    next(error);
  }
};

// @desc    Get messages for a room
// @route   GET /api/chat/rooms/:roomId/messages
exports.getMessages = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before } = req.query;

    const where = { roomId, isDeleted: false };
    if (before) {
      where.createdAt = { [Op.lt]: new Date(before) };
    }

    const messages = await ChatMessage.findAll({
      where,
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'firstName', 'lastName', 'role']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    res.json({ success: true, messages: messages.reverse() });
  } catch (error) {
    logger.error('Get messages error:', error);
    next(error);
  }
};

// @desc    Send a message
// @route   POST /api/chat/rooms/:roomId/messages
exports.sendMessage = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { content, messageType = 'text', fileUrl } = req.body;

    // Check if user is banned
    if (req.user.isBanned) {
      return res.status(403).json({ success: false, message: 'You are banned from chat' });
    }

    const room = await ChatRoom.findByPk(roomId);
    if (!room || !room.isActive) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    // Tier-based room access check
    if (room.requiredTier && room.requiredTier !== 'none') {
      const TIER_HIERARCHY = { bronze: 1, silver: 2, gold: 3, platinum: 4 };
      const userTier = req.user.subscriptionTier || 'bronze';
      const requiredLevel = TIER_HIERARCHY[room.requiredTier] || 1;
      const userLevel = TIER_HIERARCHY[userTier] || 0;

      if (req.user.role !== 'admin' && req.user.role !== 'educator' && userLevel < requiredLevel) {
        return res.status(403).json({
          success: false,
          message: `This room requires a ${room.requiredTier} subscription or higher`
        });
      }
    }

    const message = await ChatMessage.create({
      roomId,
      userId: req.user.id,
      content,
      messageType,
      fileUrl
    });

    const populated = await ChatMessage.findByPk(message.id, {
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'firstName', 'lastName', 'role']
      }]
    });

    res.status(201).json({ success: true, message: populated });
  } catch (error) {
    logger.error('Send message error:', error);
    next(error);
  }
};

// @desc    Delete a message (admin only)
// @route   DELETE /api/chat/messages/:messageId
exports.deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const message = await ChatMessage.findByPk(messageId);

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Allow admin or message author to delete
    if (req.user.role !== 'admin' && message.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await message.update({ isDeleted: true, content: '[Message deleted]' });
    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    logger.error('Delete message error:', error);
    next(error);
  }
};

// @desc    Pin a message (admin only)
// @route   PUT /api/chat/messages/:messageId/pin
exports.pinMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const message = await ChatMessage.findByPk(messageId);

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    await message.update({ isPinned: !message.isPinned });
    
    // Update room's pinned message
    if (message.isPinned) {
      await ChatRoom.update({ pinnedMessage: message.content }, { where: { id: message.roomId } });
    }

    res.json({ success: true, isPinned: message.isPinned });
  } catch (error) {
    logger.error('Pin message error:', error);
    next(error);
  }
};

// @desc    Create a chat room (admin only)
// @route   POST /api/chat/rooms
exports.createRoom = async (req, res, next) => {
  try {
    const { name, description, type = 'public', requiredTier = 'none' } = req.body;

    const room = await ChatRoom.create({
      name,
      description,
      type,
      requiredTier,
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, room });
  } catch (error) {
    logger.error('Create room error:', error);
    next(error);
  }
};

// @desc    Ban/unban user from chat (admin only)
// @route   PUT /api/chat/users/:userId/ban
exports.toggleBan = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await user.update({ isBanned: !user.isBanned });
    res.json({ success: true, isBanned: user.isBanned });
  } catch (error) {
    logger.error('Toggle ban error:', error);
    next(error);
  }
};

// @desc    Upload file for chat
// @route   POST /api/chat/upload
exports.uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileUrl = `/uploads/chat/${req.file.filename}`;
    const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';

    res.json({
      success: true,
      file: {
        url: fileUrl,
        name: req.file.originalname,
        size: req.file.size,
        type: fileType,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    logger.error('Upload file error:', error);
    next(error);
  }
};
