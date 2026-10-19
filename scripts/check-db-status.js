const { Client } = require('pg');
require('dotenv').config();

const connStr = process.argv[2] || process.env.DATABASE_URL;
console.log('Connecting to:', connStr ? connStr.replace(/:[^:@]+@/, ':***@') : 'No DATABASE_URL set');

async function check() {
  const client = new Client({ connectionString: connStr });
  await client.connect();
  console.log('Successfully connected to database!');
  
  const tables = ['Users', 'Trades', 'Signals', 'ScannerResults', 'Candles', 'MarketData', 'AuditLogs', 'TradeJournals', 'ChatMessages', 'ScannerConfigs', 'DataSources', 'Notifications', 'Announcements'];
  console.log('\n--- Table Counts ---');
  for (const t of tables) {
    try {
      const res = await client.query(`SELECT count(*) FROM "${t}"`);
      console.log(`${t.padEnd(16)}: ${res.rows[0].count}`);
    } catch(err) {
      console.log(`${t} error: ${err.message}`);
    }
  }

  const dbSize = await client.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as size`);
  console.log(`\nTotal Database Size: ${dbSize.rows[0].size}`);
  await client.end();
}

check().catch(err => {
  console.error('Connection/Query error:', err);
});
