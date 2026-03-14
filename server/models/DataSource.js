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
    allowNull: false
  },
  apiKey: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  rateLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 500
  },
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
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
    defaultValue: {}
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['isActive', 'priority'] },
    { fields: ['provider'] }
  ]
});

module.exports = DataSource;