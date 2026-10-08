#!/usr/bin/env node

/**
 * Initialize Scanner Configurations
 * Fully populates all strategies with Crypto, Forex, Indices and 15m, 1h, 4h, 1d timeframes
 * Usage: node scripts/init-scanner-config.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { initializeDefaultStrategies } = require('../server/utils/initStrategies');

async function run() {
  console.log('🔧 Initializing Scanner Configurations with full Crypto, Forex & 1h/4h/1d coverage...\n');
  await initializeDefaultStrategies();
  console.log('✅ All scanner configurations updated successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
