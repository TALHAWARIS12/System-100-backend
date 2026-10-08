require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sequelize } = require('../server/config/database');

async function migrate() {
  await sequelize.authenticate();
  const pg = await sequelize.connectionManager.getConnection({ type: 'write' });
  try {
    await pg.query(`ALTER TYPE "enum_Trades_timeframe" ADD VALUE IF NOT EXISTS '1d'`);
    await pg.query(`ALTER TYPE "enum_Trades_timeframe" ADD VALUE IF NOT EXISTS 'daily'`);
    console.log('✅ Added 1d and daily to enum_Trades_timeframe');
  } catch(e) {
    console.error('Error migrating enum:', e.message);
  } finally {
    sequelize.connectionManager.releaseConnection(pg);
  }
  process.exit(0);
}

migrate();
