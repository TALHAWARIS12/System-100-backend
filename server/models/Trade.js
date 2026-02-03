const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Trade = sequelize.define('Trade', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  educatorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  asset: {
    type: DataTypes.STRING,
    allowNull: false
  },
  direction: {
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
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'closed', 'cancelled'),
    defaultValue: 'active'
  },
  isVisible: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  result: {
    type: DataTypes.ENUM('win', 'loss', 'breakeven', 'pending'),
    defaultValue: 'pending'
  },
  closePrice: {
    type: DataTypes.DECIMAL(12, 5),
    allowNull: true
  },
  pips: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['educatorId'] },
    { fields: ['asset'] },
    { fields: ['status'] },
    { fields: ['isVisible'] }
  ]
});

module.exports = Trade;
