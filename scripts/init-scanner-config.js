#!/usr/bin/env node

/**
 * Initialize Scanner Configurations
 * 
 * Creates default scanner strategies for the Freedom Strategy Nehemiah 6:3
 * Ensures all required configs exist in the database
 * 
 * Usage: node scripts/init-scanner-config.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { ScannerConfig, DataSource } = require('../server/models');
const logger = require('../server/utils/logger');

async function initScannerConfigs() {
  try {
    console.log('🔧 Initializing Scanner Configurations...\n');

    // Define strategies
    const strategies = [
      {
        strategyName: 'freedomStrategyNehemiah',
        description: 'Freedom Strategy Nehemiah 6:3 - Multi-indicator analysis for gold and forex',
        pairs: ['XAUUSD', 'EURUSD', 'GBPUSD', 'GBPJPY', 'XAGUSD'],
        timeframes: ['15m', '1h', '4h'],
        isEnabled: true,
        scanInterval: 15, // Every 15 minutes
        rules: {
          rsiOversold: 30,
          rsiOverbought: 70,
          maPeriods: [20, 50, 200],
          volumeThreshold: 1.5,
          confidence: 65
        }
      },
      {
        strategyName: 'macdCrossover',
        description: 'MACD Crossover Strategy - Trend reversal detection',
        pairs: ['EURUSD', 'GBPUSD', 'USDJPY'],
        timeframes: ['1h', '4h', '1d'],
        isEnabled: true,
        scanInterval: 30,
        rules: {
          macdThreshold: 0.0001,
          confidenceMultiplier: 1.2,
          minCandles: 50
        }
      },
      {
        strategyName: 'supportResistance',
        description: 'Support/Resistance Breakout - Price action patterns',
        pairs: ['XAUUSD', 'EURUSD', 'GBPUSD'],
        timeframes: ['4h', '1d'],
        isEnabled: true,
        scanInterval: 60,
        rules: {
          breakoutPercent: 0.5,
          lookbackPeriod: 50,
          minimumWicks: 3
        }
      },
      {
        strategyName: 'bollingerBreakout',
        description: 'Bollinger Bands Breakout - Volatility-based signals',
        pairs: ['EURUSD', 'GBPUSD', 'XAUUSD'],
        timeframes: ['15m', '1h'],
        isEnabled: true,
        scanInterval: 10,
        rules: {
          standardDeviations: 2,
          maPeriod: 20,
          confirmationBars: 1
        }
      }
    ];

    console.log('📍 Creating/Updating Scanner Configurations...\n');

    let created = 0;
    let updated = 0;

    for (const strategy of strategies) {
      const [config, isNew] = await ScannerConfig.findOrCreate({
        where: { strategyName: strategy.strategyName },
        defaults: strategy
      });

      if (!isNew) {
        // Update existing
        await config.update(strategy);
        console.log(`✅ Updated: ${strategy.description}`);
        updated++;
      } else {
        console.log(`✨ Created: ${strategy.description}`);
        created++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Created: ${created} new strategies`);
    console.log(`   Updated: ${updated} existing strategies`);
    console.log(`   Total: ${strategies.length} strategies configured`);

    // Verify data sources
    console.log('\n🔌 Verifying Data Sources...');
    const activeSources = await DataSource.findAll({
      where: { isActive: true },
      order: [['priority', 'ASC']]
    });

    if (activeSources.length === 0) {
      console.log('⚠️  WARNING: No active data sources!');
      console.log('   Run: node scripts/init-free-apis.js');
    } else {
      console.log(`✅ Active Data Sources: ${activeSources.length}`);
      activeSources.forEach((source, idx) => {
        console.log(`   ${idx + 1}. ${source.name} (${source.provider})`);
      });
    }

    console.log('\n✅ Scanner configuration initialized!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run: npm start');
    console.log('   2. Go to Admin Panel → Market Data');
    console.log('   3. Verify TwelveData API key is set and active');
    console.log('   4. Go to Scanner page and click "SCAN NOW"');
    console.log('   5. Check logs for market data fetching errors\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing scanner configs:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run initialization
initScannerConfigs().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
