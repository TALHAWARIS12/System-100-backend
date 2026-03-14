/**
 * Phase 2: EconomicEvent Model
 * Stores fetched economic calendar events from FMP / TradingEconomics.
 * Events are fetched by economicCalendarService.js and served to the frontend.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EconomicEvent = sequelize.define('EconomicEvent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  event: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  country: {
    type: DataTypes.STRING(5),
    allowNull: true
  },
  currency: {
    type: DataTypes.STRING(5),
    allowNull: true
  },
  impact: {
    type: DataTypes.ENUM('high', 'medium', 'low'),
    allowNull: true,
    defaultValue: 'low'
  },
  forecast: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  previous: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  actual: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  eventTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  source: {
    type: DataTypes.STRING(30),
    allowNull: true,
    defaultValue: 'fmp'
  },
  alertSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true,
  tableName: 'EconomicEvents',
  indexes: [
    { fields: ['eventTime'] },
    { fields: ['impact'] },
    { fields: ['currency'] },
    { fields: ['eventTime', 'impact'], name: 'idx_event_time_impact' },
    { fields: ['event', 'eventTime'], unique: true, name: 'idx_event_unique' }
  ]
});

module.exports = EconomicEvent;