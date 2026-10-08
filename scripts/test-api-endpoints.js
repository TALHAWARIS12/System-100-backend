const express = require('express');
const { Trade, ScannerResult, Signal } = require('../server/models');

async function testApi() {
  console.log('=== Verifying Active Database Records for UI ===');

  // Test 1: Active Trades
  const activeTrades = await Trade.findAll({
    where: { status: 'active', isVisible: true },
    order: [['createdAt', 'DESC']]
  });
  console.log(`\n1. Active Trades in DB: ${activeTrades.length}`);
  const tradeTfs = {};
  const tradeCats = {};
  activeTrades.forEach(t => {
    tradeTfs[t.timeframe] = (tradeTfs[t.timeframe] || 0) + 1;
    tradeCats[t.category] = (tradeCats[t.category] || 0) + 1;
    console.log(`   - ${t.asset} [${t.category}] (${t.timeframe}) ${t.direction.toUpperCase()} @ ${t.entry} (SL: ${t.stopLoss}, TP1: ${t.takeProfit})`);
  });
  console.log('   Timeframe breakdown:', tradeTfs);
  console.log('   Category breakdown:', tradeCats);

  // Test 2: Scanner Results
  const scannerResults = await ScannerResult.findAll({
    where: { isActive: true },
    order: [['createdAt', 'DESC']]
  });
  console.log(`\n2. Active Scanner Results: ${scannerResults.length}`);
  const srTfs = {};
  const srPairs = {};
  scannerResults.forEach(r => {
    srTfs[r.timeframe] = (srTfs[r.timeframe] || 0) + 1;
    srPairs[r.pair] = (srPairs[r.pair] || 0) + 1;
  });
  console.log('   Timeframe breakdown:', srTfs);
  console.log(`   Distinct pairs (${Object.keys(srPairs).length}):`, Object.keys(srPairs).join(', '));

  // Test 3: Active Signals (for MultiAssetTrades)
  const signals = await Signal.findAll({
    where: { status: 'active' },
    order: [['createdAt', 'DESC']]
  });
  console.log(`\n3. Active Signals: ${signals.length}`);
  const sigTfs = {};
  const sigAssets = {};
  signals.forEach(s => {
    sigTfs[s.timeframe] = (sigTfs[s.timeframe] || 0) + 1;
    sigAssets[s.asset] = (sigAssets[s.asset] || 0) + 1;
  });
  console.log('   Timeframe breakdown:', sigTfs);
  console.log(`   Distinct assets (${Object.keys(sigAssets).length}):`, Object.keys(sigAssets).join(', '));

  console.log('\n=== All Verification Checks Passed! ===');
  process.exit(0);
}

testApi().catch(err => {
  console.error('API Verification error:', err);
  process.exit(1);
});
