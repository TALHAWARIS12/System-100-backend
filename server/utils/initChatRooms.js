/**
 * Phase 2: Initialize default chat rooms
 */
const { ChatRoom } = require('../models');
const logger = require('./logger');

const defaultRooms = [
  { name: 'Gold Trading', description: 'XAUUSD trade discussion and analysis', type: 'public', requiredTier: 'none' },
  { name: 'GOLD CIRCLE CAPITAL Signals', description: 'Official GOLD CIRCLE CAPITAL signal discussion', type: 'public', requiredTier: 'silver' },
  { name: 'Trade Ideas', description: 'Share and discuss trade setups', type: 'public', requiredTier: 'none' },
  { name: 'Beginner Questions', description: 'New traders welcome - ask anything', type: 'public', requiredTier: 'none' },
  { name: 'Premium Lounge', description: 'Exclusive discussion for Gold & Platinum members', type: 'public', requiredTier: 'gold' },
  { name: 'Strategy Lab', description: 'Advanced strategy research and development', type: 'public', requiredTier: 'platinum' }
];

const initializeDefaultChatRooms = async () => {
  try {
    for (const room of defaultRooms) {
      const existing = await ChatRoom.findOne({ where: { name: room.name } });
      if (!existing) {
        await ChatRoom.create(room);
        logger.info(`Chat room created: ${room.name}`);
      }
    }
    logger.info('Default chat rooms initialized');
  } catch (error) {
    logger.error('Chat room initialization error:', error.message);
  }
};

module.exports = { initializeDefaultChatRooms };
