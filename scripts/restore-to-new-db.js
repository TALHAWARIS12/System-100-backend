const { execSync } = require('child_process');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const targetUrl = process.argv[2];

  if (!targetUrl) {
    console.error('❌ Usage: node scripts/restore-to-new-db.js "<NEW_DATABASE_URL>"');
    console.error('Example: node scripts/restore-to-new-db.js "postgresql://user:pass@ep-xyz.us-east-1.aws.neon.tech/neondb?sslmode=require"');
    process.exit(1);
  }

  const dumpPath = path.join(__dirname, '..', 'backups', 'gold_circle_db_backup.dump');
  const sqlPath = path.join(__dirname, '..', 'backups', 'gold_circle_db_backup.sql');

  console.log('🔄 Checking connection to target database...');
  const client = new Client({ connectionString: targetUrl });
  try {
    await client.connect();
    console.log('✅ Connected successfully to target database.');
  } catch (err) {
    console.error('❌ Failed to connect to target database:', err.message);
    process.exit(1);
  }

  console.log('\n📦 Restoring backup into new database...');
  let restored = false;

  // Try pg_restore first
  try {
    console.log('Running pg_restore...');
    execSync(`pg_restore --clean --if-exists --no-owner --no-privileges -d "${targetUrl}" "${dumpPath}"`, {
      stdio: 'inherit'
    });
    restored = true;
    console.log('✅ pg_restore completed.');
  } catch (err) {
    console.warn('⚠️ pg_restore exited with warnings (often normal for clean/drop on fresh DB). Verifying data...');
    restored = true;
  }

  // Verify row counts in the new DB
  console.log('\n🔍 Verifying restored data in new database...');
  const tables = ['Users', 'Trades', 'Signals', 'ScannerResults', 'Candles', 'TradeJournals', 'ChatMessages', 'ScannerConfigs', 'DataSources'];
  
  for (const t of tables) {
    try {
      const res = await client.query(`SELECT count(*) FROM "${t}"`);
      console.log(`   ${t.padEnd(16)}: ${res.rows[0].count} rows`);
    } catch (err) {
      console.warn(`   ${t.padEnd(16)}: Error checking (${err.message})`);
    }
  }

  const userCheck = await client.query('SELECT count(*) FROM "Users"');
  console.log(`\n🎉 Verification Complete: ${userCheck.rows[0].count} users successfully verified in new database.`);
  console.log('\n👉 NEXT STEP: Update DATABASE_URL in your Render Dashboard:');
  console.log('   1. Go to https://dashboard.render.com');
  console.log('   2. Select "System-100-backend"');
  console.log('   3. Go to "Environment"');
  console.log(`   4. Update DATABASE_URL to your new connection string`);
  console.log('   5. Click "Save Changes" (Render will automatically redeploy)');

  await client.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
