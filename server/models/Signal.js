/**
 * Phase 2: Signal Model
 * Dedicated signal storage for admin-published and scanner-generated signals.
 * Separate from Phase 1 ScannerResults — this tracks lifecycle (active → hit_tp/hit_sl/expired).
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Signal = sequelize.define('Signal', {
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
    type: DataTypes.STRING(10),
    allowNull: true,
    defaultValue: '1h'
  },
  direction: {
    type: DataTypes.ENUM('buy', 'sell'),
    allowNull: false
  },
  entry: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: false
  },
  stopLoss: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: false
  },
  takeProfit: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: false
  },
  takeProfit2: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: true
  },
  confidence: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  strategy: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'system-100'
  },
  indicators: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'hit_tp', 'hit_sl', 'expired', 'cancelled'),
    defaultValue: 'active'
  },
  result: {
    type: DataTypes.DECIMAL(14, 5),
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  source: {
    type: DataTypes.ENUM('scanner', 'admin', 'educator', 'gold-scanner'),
    defaultValue: 'scanner'
  },
  publishedBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  publishedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'Signals',
  indexes: [
    { fields: ['asset'] },
    { fields: ['status'] },
    { fields: ['publishedAt'] },
    { fields: ['asset', 'status'], name: 'idx_signal_asset_status' },
    { fields: ['publishedBy'] }
  ]
});

module.exports = Signal;