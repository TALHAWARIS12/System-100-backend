const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TradeJournal = sequelize.define('TradeJournal', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  asset: {
    type: DataTypes.STRING,
    allowNull: false
  },
  direction: {
    type: DataTypes.ENUM('long', 'short'),
    allowNull: false
  },
  entry: {
    type: DataTypes.DECIMAL(12, 5),
    allowNull: false
  },
  exit: {
    type: DataTypes.DECIMAL(12, 5),
    allowNull: true
  },
  stopLoss: {
    type: DataTypes.DECIMAL(12, 5),
    allowNull: false
  },
  takeProfit: {
    type: DataTypes.DECIMAL(12, 5),
    allowNull: false
  },
  lotSize: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: true,
    defaultValue: 0.01
  },
  strategy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  timeframe: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  emotionTag: {
    type: DataTypes.ENUM('confident', 'fearful', 'greedy', 'neutral', 'revenge', 'disciplined', 'anxious'),
    allowNull: true
  },
  screenshotUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('open', 'closed', 'cancelled'),
    defaultValue: 'open'
  },
  result: {
    type: DataTypes.ENUM('win', 'loss', 'breakeven', 'pending'),
    defaultValue: 'pending'
  },
  pnl: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  pips: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  riskRewardActual: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  enteredAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  exitedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  linkedSignalId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['asset'] },
    { fields: ['status'] },
    { fields: ['result'] },
    { fields: ['enteredAt'] },
    { fields: ['strategy'] }
  ]
});

module.exports = TradeJournal;