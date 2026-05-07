#!/usr/bin/env node

/**
 * Scanner System Diagnostic
 * 
 * Checks if scanner is properly configured:
 * - Data sources active
 * - Scanner configs exist
 * - API keys configured
 * - Database connectivity
 * 
 * Usage: node scripts/diagnostic.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { DataSource, ScannerConfig, ScannerResult } = require('../server/models');
const logger = require('../server/utils/logger');

async function runDiagnostic() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         GOLD CIRCLE CAPITAL - SCANNER DIAGNOSTIC           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 1. Check Data Sources
    console.log('📊 DATA SOURCES CHECK');
    console.log('─'.repeat(60));
    
    const sources = await DataSource.findAll();
    console.log(`Total sources: ${sources.length}`);
    
    const activeSources = sources.filter(s => s.isActive);
    console.log(`Active sources: ${activeSources.length}\n`);
    
    if (activeSources.length === 0) {
      console.log('❌ NO ACTIVE DATA SOURCES!');
      console.log('   Fix: Run: node scripts/init-free-apis.js\n');
    } else {
      activeSources.forEach((source, idx) => {
        console.log(`   ${idx + 1}. ${source.name}`);
        console.log(`      Provider: ${source.provider}`);
        console.log(`      Priority: ${source.priority}`);
        console.log(`      API Key: ${source.apiKey ? '✅ Set' : '❌ MISSING'}`);
        console.log(`      Rate Limit: ${source.usageCount}/${source.rateLimit}`);
        if (source.lastError) {
          console.log(`      Last Error: ${source.lastError.substring(0, 60)}...`);
        }
        console.log();
      });
    }

    // 2. Check Scanner Configs
    console.log('\n🔧 SCANNER CONFIGURATIONS');
    console.log('─'.repeat(60));
    
    const configs = await ScannerConfig.findAll();
    console.log(`Total configurations: ${configs.length}\n`);
    
    if (configs.length === 0) {
      console.log('❌ NO SCANNER CONFIGURATIONS!');
      console.log('   Fix: Run: node scripts/init-scanner-config.js\n');
    } else {
      const enabledConfigs = configs.filter(c => c.isEnabled);
      console.log(`Enabled: ${enabledConfigs.length}/${configs.length}\n`);
      
      enabledConfigs.forEach((config, idx) => {
        console.log(`   ${idx + 1}. ${config.strategyName}`);
        console.log(`      Pairs: ${config.pairs.join(', ')}`);
        console.log(`      Timeframes: ${config.timeframes.join(', ')}`);
        console.log(`      Scan Interval: ${config.scanInterval} min`);
      });
    }

    // 3. Check Recent Signals
    console.log('\n\n📈 RECENT SIGNALS');
    console.log('─'.repeat(60));
    
    const signals = await ScannerResult.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    
    if (signals.length === 0) {
      console.log('❌ NO SIGNALS GENERATED YET');
      console.log('   Likely causes:');
      console.log('   • Scanner has not run yet');
      console.log('   • No active data sources');
      console.log('   • Market data not available\n');
    } else {
      console.log(`Total signals in database: ${await ScannerResult.count()}\n`);
      signals.forEach((signal, idx) => {
        console.log(`   ${idx + 1}. ${signal.pair} ${signal.signalType.toUpperCase()}`);
        console.log(`      Entry: ${signal.entry}`);
        console.log(`      Confidence: ${signal.confidence}%`);
        console.log(`      Created: ${signal.createdAt}`);
      });
    }

    // 4. System Status
    console.log('\n\n✅ SYSTEM STATUS');
    console.log('─'.repeat(60));
    console.log(`Database: ✅ Connected`);
    console.log(`Data Sources: ${activeSources.length > 0 ? '✅' : '❌'} ${activeSources.length} active`);
    console.log(`Strategies: ${enabledConfigs ? enabledConfigs.length : 0} enabled`);
    console.log(`Signals: ${signals.length > 0 ? '✅' : '❌'} ${await ScannerResult.count()} total`);

    // 5. Next Steps
    console.log('\n\n🚀 NEXT STEPS');
    console.log('─'.repeat(60));
    if (activeSources.length === 0) {
      console.log('1. Initialize data sources:');
      console.log('   node scripts/init-free-apis.js\n');
    }
    if (configs.length === 0) {
      console.log('2. Initialize scanner configs:');
      console.log('   node scripts/init-scanner-config.js\n');
    }
    console.log('3. Start the server:');
    console.log('   npm start\n');
    console.log('4. Go to Admin Panel and verify settings\n');
    console.log('5. Click "SCAN NOW" on the Market Scanner page\n');

    console.log('✅ Diagnostic complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runDiagnostic().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
