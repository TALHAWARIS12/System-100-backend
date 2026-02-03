const User = require('./User');
const Trade = require('./Trade');
const ScannerResult = require('./ScannerResult');
const ScannerConfig = require('./ScannerConfig');
const DataSource = require('./DataSource');

// Define relationships
Trade.belongsTo(User, { as: 'educator', foreignKey: 'educatorId' });
User.hasMany(Trade, { as: 'trades', foreignKey: 'educatorId' });

module.exports = {
  User,
  Trade,
  ScannerResult,
  ScannerConfig,
  DataSource
};
