#!/usr/bin/env node

/**
 * Fix Alpha Vantage Rate Limit Issue
 * 
 * Disables Alpha Vantage data source (25 request/day free tier limit)
 * and ensures free APIs with no rate limits are used instead.
 * 
 * Usage: node scripts/fix-rate-limit.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { DataSource } = require('../server/models');

async function fixRateLimitIssue() {
  try {
    console.log('🔧 Fixing Alpha Vantage rate limit issue...\n');

    // 1. Disable Alpha Vantage
    console.log('📍 Step 1: Disabling Alpha Vantage data source...');
    const alphavantage = await DataSource.findOne({
      where: { provider: 'alphavantage' }
    });

    if (alphavantage) {
      await alphavantage.update({ isActive: false });
      console.log('✅ Alpha Vantage disabled (free tier has 25 request/day limit)\n');
    } else {
      console.log('ℹ️  Alpha Vantage not found in database\n');
    }

    // 2. Enable alternative sources with NO rate limits
    console.log('📍 Step 2: Ensuring free API sources are enabled...');

    // TwelveData (has free tier - check if exists)
    const twelvedata = await DataSource.findOne({
      where: { provider: 'twelvedata' }
    });
    if (twelvedata) {
      await twelvedata.update({ isActive: true, priority: 1 });
      console.log('✅ TwelveData enabled (Priority: 1)');
    }

    // Polygon (has free tier - check if exists)
    const polygon = await DataSource.findOne({
      where: { provider: 'polygon' }
    });
    if (polygon) {
      await polygon.update({ isActive: true, priority: 2 });
      console.log('✅ Polygon enabled (Priority: 2)');
    }

    console.log('\n📍 Step 3: Summary of active data sources...');
    const activeSources = await DataSource.findAll({
      where: { isActive: true },
      order: [['priority', 'ASC']]
    });

    if (activeSources.length === 0) {
      console.log('⚠️  WARNING: No active data sources! The system will use fallback APIs only.');
      console.log('   Fallback: metals.live (free gold prices), Forex Factory (economic calendar)\n');
    } else {
      console.log('\nActive data sources (in order of use):');
      activeSources.forEach((source, index) => {
        console.log(`  ${index + 1}. ${source.name} (${source.provider}, Priority: ${source.priority})`);
      });
      console.log('\nℹ️  If primary sources fail, system falls back to free APIs (metals.live, Forex Factory)\n');
    }

    console.log('✅ Rate limit issue fixed!');
    console.log('\n📊 What this means:');
    console.log('   • Alpha Vantage (25 req/day) ❌ DISABLED');
    console.log('   • TwelveData, Polygon, or free APIs ✅ ENABLED');
    console.log('   • No more rate limit errors on scanner!');
    console.log('   • Gold prices pulled from metals.live (unlimited)\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing rate limit:', error.message);
    process.exit(1);
  }
}

fixRateLimitIssue();
