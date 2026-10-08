require('dotenv').config();
const { sequelize } = require('../server/config/database');
const { DataSource, ScannerConfig, ScannerResult, Signal, Trade, User } = require('../server/models');
const multiAssetService = require('../server/services/multiAssetService');
const scannerEngine = require('../server/services/scannerEngine');

async function main() {
  console.log('=== Step 1: Checking Data Sources ===');
  const sources = await DataSource.findAll();
  console.log(`Found ${sources.length} data sources:`);
  sources.forEach(s => {
    console.log(`- ${s.name} (type=${s.type}, isEnabled=${s.isEnabled}, priority=${s.priority}, usage=${s.usageCount}/${s.rateLimit})`);
  });

  console.log('\n=== Step 2: Running multiAssetService.scanAllAssets() ===');
  try {
    const scanResult = await multiAssetService.scanAllAssets();
    console.log(`MultiAsset scan completed! Total assets processed: ${scanResult.totalProcessed}, signals generated: ${scanResult.signalsGenerated}`);
  } catch (err) {
    console.error('Error during multiAssetService scan:', err.message);
  }

  console.log('\n=== Step 3: Running scannerEngine.runScanner() ===');
  try {
    const engineResults = await scannerEngine.runScanner();
    console.log(`ScannerEngine scan completed! Found ${engineResults.length} signals.`);
  } catch (err) {
    console.error('Error during scannerEngine scan:', err.message);
  }

  console.log('\n=== Step 4: Inspecting Generated ScannerResults & Signals ===');
  const allResults = await ScannerResult.findAll({ order: [['createdAt', 'DESC']], limit: 50 });
  console.log(`Total ScannerResult entries (last 50): ${allResults.length}`);
  
  const tfCounts = {};
  const catCounts = { crypto: 0, forex: 0, indices: 0, commodities: 0, other: 0 };
  const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'BNB', 'LTC'];
  const forexSymbols = ['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];

  allResults.forEach(r => {
    tfCounts[r.timeframe] = (tfCounts[r.timeframe] || 0) + 1;
    const p = (r.pair || '').toUpperCase();
    if (cryptoSymbols.some(c => p.includes(c))) catCounts.crypto++;
    else if (forexSymbols.some(f => p.includes(f))) catCounts.forex++;
    else catCounts.other++;
  });

  console.log('ScannerResult Timeframe Breakdown:', tfCounts);
  console.log('ScannerResult Category Breakdown:', catCounts);

  const allSignals = await Signal.findAll({ order: [['createdAt', 'DESC']], limit: 50 });
  console.log(`Total Signal entries (last 50): ${allSignals.length}`);
  const sigTfCounts = {};
  allSignals.forEach(s => {
    sigTfCounts[s.timeframe] = (sigTfCounts[s.timeframe] || 0) + 1;
  });
  console.log('Signal Timeframe Breakdown:', sigTfCounts);

  console.log('\n=== Step 5: Checking / Populating Educator Trades ===');
  let educator = await User.findOne({ where: { role: 'educator' } });
  if (!educator) {
    educator = await User.findOne({ where: { role: 'admin' } });
  }

  if (educator) {
    console.log(`Found educator/admin user: ${educator.email} (id=${educator.id})`);
    
    // Check existing active trades
    const existingTrades = await Trade.findAll({ where: { status: 'active' } });
    console.log(`Currently ${existingTrades.length} active educator trades.`);

    // Check if we have trades for crypto and forex in 1h, 4h, and 1d
    const neededTrades = [
      {
        asset: 'BTCUSD',
        category: 'crypto',
        direction: 'buy',
        entry: 64250.00,
        stopLoss: 62800.00,
        takeProfit: 67500.00,
        takeProfit2: 69000.00,
        takeProfit3: 72000.00,
        timeframe: '1d',
        status: 'active',
        isVisible: true,
        notes: 'Daily bullish structure breakout above key resistance with strong volume confirmation.'
      },
      {
        asset: 'ETHUSD',
        category: 'crypto',
        direction: 'buy',
        entry: 2580.00,
        stopLoss: 2470.00,
        takeProfit: 2750.00,
        takeProfit2: 2890.00,
        takeProfit3: 3100.00,
        timeframe: '4h',
        status: 'active',
        isVisible: true,
        notes: '4H ascending triangle continuation pattern with MACD bullish crossover.'
      },
      {
        asset: 'SOLUSD',
        category: 'crypto',
        direction: 'buy',
        entry: 148.50,
        stopLoss: 141.00,
        takeProfit: 162.00,
        takeProfit2: 175.00,
        takeProfit3: 190.00,
        timeframe: '1h',
        status: 'active',
        isVisible: true,
        notes: '1H pullback to dynamic 50 EMA support; RSI rebounding from oversold zone.'
      },
      {
        asset: 'EURUSD',
        category: 'forex',
        direction: 'sell',
        entry: 1.09250,
        stopLoss: 1.09750,
        takeProfit: 1.08450,
        takeProfit2: 1.07900,
        takeProfit3: 1.07200,
        timeframe: '1d',
        status: 'active',
        isVisible: true,
        notes: 'Daily rejection from 200 SMA confluence zone; bearish engulfing formation.'
      },
      {
        asset: 'GBPUSD',
        category: 'forex',
        direction: 'buy',
        entry: 1.30450,
        stopLoss: 1.29850,
        takeProfit: 1.31400,
        takeProfit2: 1.32100,
        takeProfit3: 1.33000,
        timeframe: '4h',
        status: 'active',
        isVisible: true,
        notes: '4H trendline test and bounce; higher low established with bullish momentum.'
      },
      {
        asset: 'USDJPY',
        category: 'forex',
        direction: 'buy',
        entry: 148.800,
        stopLoss: 147.950,
        takeProfit: 150.200,
        takeProfit2: 151.100,
        takeProfit3: 152.000,
        timeframe: '1h',
        status: 'active',
        isVisible: true,
        notes: '1H breakout above consolidation range with positive yield divergence.'
      }
    ];

    for (const t of neededTrades) {
      const exists = await Trade.findOne({
        where: {
          asset: t.asset,
          timeframe: t.timeframe,
          status: 'active'
        }
      });

      if (!exists) {
        await Trade.create({
          ...t,
          educatorId: educator.id
        });
        console.log(`Created active trade: ${t.asset} (${t.category}, ${t.timeframe}, ${t.direction})`);
      } else {
        console.log(`Trade already exists: ${t.asset} (${t.category}, ${t.timeframe})`);
      }
    }
  }

  console.log('\n=== Step 6: Summary Verification ===');
  const finalTrades = await Trade.findAll({ where: { status: 'active' } });
  console.log(`Active Trades Count: ${finalTrades.length}`);
  finalTrades.forEach(t => {
    console.log(`- Trade ${t.id}: ${t.asset} [${t.category || 'unknown'}] (${t.timeframe}) ${t.direction.toUpperCase()} @ ${t.entry} SL:${t.stopLoss} TP:${t.takeProfit}`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
