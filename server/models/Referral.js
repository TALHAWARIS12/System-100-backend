const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Referral = sequelize.define('Referral', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  referrerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  referredId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Users', key: 'id' }
  },
  referralCode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'signed_up', 'subscribed', 'expired'),
    defaultValue: 'pending'
  },
  clicks: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  commissionRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 20.00
  },
  totalCommission: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  lastClickAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['referrerId'] },
    { fields: ['referredId'] },
    { fields: ['referralCode'], unique: true },
    { fields: ['status'] }
  ]
});

module.exports = Referral;