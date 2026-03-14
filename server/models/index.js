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

// ─── Phase 1 Relationships (unchanged) ───
Trade.belongsTo(User, { as: 'educator', foreignKey: 'educatorId' });
User.hasMany(Trade, { as: 'trades', foreignKey: 'educatorId' });

// ─── Phase 2 Relationships ───

// Chat
ChatRoom.hasMany(ChatMessage, { as: 'messages', foreignKey: 'roomId' });
ChatMessage.belongsTo(ChatRoom, { as: 'room', foreignKey: 'roomId' });
ChatMessage.belongsTo(User, { as: 'sender', foreignKey: 'userId' });
User.hasMany(ChatMessage, { as: 'messages', foreignKey: 'userId' });
ChatRoom.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });

// Trade Journal
TradeJournal.belongsTo(User, { as: 'user', foreignKey: 'userId' });
User.hasMany(TradeJournal, { as: 'journalEntries', foreignKey: 'userId' });

// Referrals
Referral.belongsTo(User, { as: 'referrer', foreignKey: 'referrerId' });
Referral.belongsTo(User, { as: 'referred', foreignKey: 'referredId' });
User.hasMany(Referral, { as: 'referralsMade', foreignKey: 'referrerId' });
User.hasMany(Referral, { as: 'referralsReceived', foreignKey: 'referredId' });

// Notifications
Notification.belongsTo(User, { as: 'user', foreignKey: 'userId' });
User.hasMany(Notification, { as: 'notifications', foreignKey: 'userId' });

// Announcements
Announcement.belongsTo(User, { as: 'author', foreignKey: 'createdBy' });

// Signals (admin/educator published)
Signal.belongsTo(User, { as: 'publisher', foreignKey: 'publishedBy' });

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
  EconomicEvent
};
