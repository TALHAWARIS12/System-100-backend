const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScannerResult = sequelize.define('ScannerResult', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  pair: {
    type: DataTypes.STRING,
    allowNull: false
  },
  timeframe: {
    type: DataTypes.STRING,
    allowNull: false
  },
  signalType: {
    type: DataTypes.ENUM('buy', 'sell'),
    allowNull: false
  },
  entry: {
    type: DataTypes.DECIMAL(12, 5),
    allowNull: false
  },
  stopLoss: {
    type: DataTypes.DECIMAL(12, 5),
    allowNull: false
  },
  takeProfit: {
    type: DataTypes.DECIMAL(12, 5),
    allowNull: false
  },
  confidence: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  strategyName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  indicators: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['pair'] },
    { fields: ['timeframe'] },
    { fields: ['isActive'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = ScannerResult;
