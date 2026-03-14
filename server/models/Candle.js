/**
 * Phase 2: Candle Model
 * Stores OHLCV candlestick data for all tracked assets and timeframes.
 * Populated by marketDataService.js and goldScannerService.js.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Candle = sequelize.define('Candle', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  asset: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  timeframe: {
    type: DataTypes.ENUM('1m', '5m', '15m', '1h', '4h', '1d', '1w'),
    allowNull: false
  },
  open: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: false
  },
  high: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: false
  },
  low: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: false
  },
  close: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: false
  },
  volume: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    defaultValue: 0
  },
  openTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  closeTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  source: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  isClosed: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true,
  tableName: 'Candles',
  indexes: [
    { fields: ['asset', 'timeframe', 'openTime'], unique: true, name: 'idx_candle_unique' },
    { fields: ['asset', 'timeframe'] },
    { fields: ['openTime'] }
  ]
});

module.exports = Candle;