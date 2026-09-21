const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Action performed (e.g. CONCIERGE_PASSWORD_RESET, MEMBER_STATUS_CHANGE)'
  },
  performedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  targetUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  details: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'AuditLogs',
  indexes: [
    { fields: ['performedBy'] },
    { fields: ['targetUserId'] },
    { fields: ['action'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = AuditLog;
