const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DataSource = sequelize.define('DataSource', {
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
  provider: {
    type: DataTypes.ENUM('alphavantage', 'twelvedata', 'polygon', 'finnhub', 'custom'),
    allowNull: false
  },
  baseUrl: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'API base URL'
  },
  apiKey: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'API key for authentication'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Lower number = higher priority (0 = primary)'
  },
  rateLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 500,
    comment: 'API calls per day limit'
  },
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'API calls made today'
  },
  lastUsed: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastError: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  configuration: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Provider-specific configuration (headers, params, etc.)'
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['isActive', 'priority'] },
    { fields: ['provider'] }
  ]
});

module.exports = DataSource;
