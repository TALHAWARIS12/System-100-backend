/**
 * Phase 2: MarketData Model
 * Stores real-time and historical price snapshots for all tracked assets.
 * Fed by marketDataService.js — never populated with static data.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MarketData = sequelize.define('MarketData', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  asset: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: false
  },
  bid: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: true
  },
  ask: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: true
  },
  volume: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    defaultValue: 0
  },
  change24h: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: true
  },
  high24h: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: true
  },
  low24h: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: true
  },
  source: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  },
  fetchedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: true,
  tableName: 'MarketData',
  indexes: [
    { fields: ['asset'] },
    { fields: ['fetchedAt'] },
    { fields: ['asset', 'fetchedAt'], name: 'idx_market_asset_time' }
  ]
});

module.exports = MarketData;