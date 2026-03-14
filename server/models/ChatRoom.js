const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChatRoom = sequelize.define('ChatRoom', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('public', 'private', 'direct'),
    defaultValue: 'public'
  },
  requiredTier: {
    type: DataTypes.ENUM('bronze', 'silver', 'gold', 'platinum', 'none'),
    defaultValue: 'none'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Users', key: 'id' }
  },
  pinnedMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  memberCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['type'] },
    { fields: ['isActive'] }
  ]
});

module.exports = ChatRoom;