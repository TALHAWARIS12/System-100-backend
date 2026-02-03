const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScannerConfig = sequelize.define('ScannerConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  strategyName: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  rules: {
    type: DataTypes.JSONB,
    allowNull: false,
    comment: 'Strategy rules configuration'
  },
  timeframes: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: ['1h', '4h', '1d']
  },
  pairs: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: ['EURUSD', 'GBPUSD', 'USDJPY']
  },
  isEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  scanInterval: {
    type: DataTypes.INTEGER,
    defaultValue: 60,
    comment: 'Scan interval in minutes'
  }
}, {
  timestamps: true
});

module.exports = ScannerConfig;
