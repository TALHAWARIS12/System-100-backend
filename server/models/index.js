const User = require('./User');
const Trade = require('./Trade');
const ScannerResult = require('./ScannerResult');
const ScannerConfig = require('./ScannerConfig');
const DataSource = require('./DataSource');
const ChatRoom = require('./ChatRoom');
const ChatMessage = require('./ChatMessage');
const TradeJournal = require('./TradeJournal');
const Referral = require('./Referral');
const Notification = require('./Notification');
const Announcement = require('./Announcement');
const MarketData = require('./MarketData');
const Candle = require('./Candle');
const Signal = require('./Signal');
const EconomicEvent = require('./EconomicEvent');
const AuditLog = require('./AuditLog');

// ─── Phase 1 Relationships (unchanged) ───
Trade.belongsTo(User, { as: 'educator', foreignKey: 'educatorId', onDelete: 'CASCADE' });
User.hasMany(Trade, { as: 'trades', foreignKey: 'educatorId', onDelete: 'CASCADE' });

// ─── Phase 2 & 3 Relationships ───

// Audit Logs
AuditLog.belongsTo(User, { as: 'performer', foreignKey: 'performedBy', onDelete: 'SET NULL' });
AuditLog.belongsTo(User, { as: 'target', foreignKey: 'targetUserId', onDelete: 'SET NULL' });
User.hasMany(AuditLog, { as: 'auditLogsPerformed', foreignKey: 'performedBy', onDelete: 'SET NULL' });
User.hasMany(AuditLog, { as: 'auditLogsReceived', foreignKey: 'targetUserId', onDelete: 'SET NULL' });

// Chat
ChatRoom.hasMany(ChatMessage, { as: 'messages', foreignKey: 'roomId', onDelete: 'CASCADE' });
ChatMessage.belongsTo(ChatRoom, { as: 'room', foreignKey: 'roomId', onDelete: 'CASCADE' });
ChatMessage.belongsTo(User, { as: 'sender', foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(ChatMessage, { as: 'messages', foreignKey: 'userId', onDelete: 'CASCADE' });
ChatRoom.belongsTo(User, { as: 'creator', foreignKey: 'createdBy', onDelete: 'SET NULL' });

// Trade Journal
TradeJournal.belongsTo(User, { as: 'user', foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(TradeJournal, { as: 'journalEntries', foreignKey: 'userId', onDelete: 'CASCADE' });

// Referrals
Referral.belongsTo(User, { as: 'referrer', foreignKey: 'referrerId', onDelete: 'CASCADE' });
Referral.belongsTo(User, { as: 'referred', foreignKey: 'referredId', onDelete: 'SET NULL' });
User.hasMany(Referral, { as: 'referralsMade', foreignKey: 'referrerId', onDelete: 'CASCADE' });
User.hasMany(Referral, { as: 'referralsReceived', foreignKey: 'referredId', onDelete: 'SET NULL' });

// Notifications
Notification.belongsTo(User, { as: 'user', foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(Notification, { as: 'notifications', foreignKey: 'userId', onDelete: 'CASCADE' });

// Announcements
Announcement.belongsTo(User, { as: 'author', foreignKey: 'createdBy', onDelete: 'SET NULL' });

// Signals (admin/educator published)
Signal.belongsTo(User, { as: 'publisher', foreignKey: 'publishedBy', onDelete: 'SET NULL' });

module.exports = {
  User,
  Trade,
  ScannerResult,
  ScannerConfig,
  DataSource,
  ChatRoom,
  ChatMessage,
  TradeJournal,
  Referral,
  Notification,
  Announcement,
  MarketData,
  Candle,
  Signal,
  EconomicEvent,
  AuditLog
};
