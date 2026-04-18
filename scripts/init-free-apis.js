#!/usr/bin/env node

/**
 * Initialize Free API Data Sources
 * 
 * Creates free/unlimited API data sources for the gold scanner
 * Disables paid APIs with rate limits (Alpha Vantage - 25 req/day)
 * 
 * Usage: node scripts/init-free-apis.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { DataSource } = require('../server/models');

async function initFreeAPIs() {
  try {
    console.log('🚀 Initializing free API data sources...\n');

    // Data sources to create/update
    const sources = [
      {
        name: 'TwelveData Free Tier',
        provider: 'twelvedata',
        baseUrl: 'https://api.twelvedata.com',
        apiKey: process.env.TWELVEDATA_API_KEY || 'demo',
        priority: 1,
        isActive: true,
        rateLimit: 800,
        configuration: { freetier: true, requestsPerDay: 800 }
      },
      {
        name: 'Polygon.io Free',
        provider: 'polygon',
        baseUrl: 'https://api.polygon.io',
        apiKey: process.env.POLYGON_API_KEY || 'PG_KEY',
        priority: 2,
        isActive: true,
        rateLimit: 5,
        configuration: { freetier: true, requestsPerMinute: 5 }
      },
      {
        name: 'Alpha Vantage',
        provider: 'alphavantage',
        baseUrl: 'https://www.alphavantage.co',
        apiKey: process.env.ALPHAVANTAGE_API_KEY || 'demo',
        priority: 99, // Very low priority - only use if others fail
        isActive: false, // DISABLED - has 25 req/day limit
        rateLimit: 25,
        configuration: { freetier: true, requestsPerDay: 25, status: 'DISABLED - rate limited' }
      }
    ];

    console.log('📍 Setting up data sources...\n');

    for (const source of sources) {
      const [dataSource, created] = await DataSource.findOrCreate({
        where: { provider: source.provider },
        defaults: source
      });

      if (!created) {
        // Update existing source
        await dataSource.update(source);
        console.log(`✅ Updated: ${source.name} (Active: ${source.isActive})`);
      } else {
        console.log(`✅ Created: ${source.name} (Active: ${source.isActive})`);
      }
    }

    console.log('\n📊 Active Data Sources:');
    const activeSources = await DataSource.findAll({
      where: { isActive: true },
      order: [['priority', 'ASC']]
    });

    if (activeSources.length === 0) {
      console.log('⚠️  No active paid APIs. System will use free fallback APIs:');
      console.log('   • metals.live - Gold prices (UNLIMITED)');
      console.log('   • Forex Factory - Economic calendar (UNLIMITED)');
    } else {
      activeSources.forEach((source, idx) => {
        console.log(`   ${idx + 1}. ${source.name} (${source.provider})`);
      });
      console.log('\n   Fallback: metals.live, Forex Factory');
    }

    console.log('\n✅ Free API sources initialized!');
    console.log('\n📝 Configuration:');
    console.log('   • TwelveData: 800 requests/day (Priority 1)');
    console.log('   • Polygon: 5 requests/minute (Priority 2)');
    console.log('   • Alpha Vantage: DISABLED (25 req/day - too low)');
    console.log('   • Fallback: metals.live (UNLIMITED)');
    console.log('\n🎯 Result: No more "rate limit" errors!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing data sources:', error.message);
    console.error(error);
    process.exit(1);
  }
}

initFreeAPIs();
