require('dotenv').config();
const { Trade, User } = require('../server/models');

async function seed() {
  console.log('Seeding active educator trades across crypto and forex for 1h, 4h, and 1d...');
  
  // Find an educator or admin user to own these trades
  let educator = await User.findOne({ where: { role: 'educator' } });
  if (!educator) {
    educator = await User.findOne({ where: { role: 'admin' } });
  }

  if (!educator) {
    console.error('No educator or admin user found!');
    process.exit(1);
  }

  console.log(`Using educator account: ${educator.email} (${educator.id})`);

  const tradesToSeed = [
    {
      asset: 'BTCUSD',
      category: 'crypto',
      direction: 'buy',
      entry: 85240.00,
      stopLoss: 83500.00,
      takeProfit: 88500.00,
      takeProfit2: 90200.00,
      takeProfit3: 92500.00,
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

  for (const t of tradesToSeed) {
    const existing = await Trade.findOne({
      where: {
        asset: t.asset,
        timeframe: t.timeframe,
        status: 'active'
      }
    });

    if (!existing) {
      const created = await Trade.create({
        ...t,
        educatorId: educator.id
      });
      console.log(`✅ Created active trade: ${created.asset} [${created.category}] (${created.timeframe}) ${created.direction.toUpperCase()}`);
    } else {
      await existing.update({
        category: t.category,
        isVisible: true,
        entry: t.entry,
        stopLoss: t.stopLoss,
        takeProfit: t.takeProfit,
        takeProfit2: t.takeProfit2,
        takeProfit3: t.takeProfit3,
        notes: t.notes
      });
      console.log(`🔄 Updated active trade: ${existing.asset} [${t.category}] (${t.timeframe})`);
    }
  }

  // Also fix the category of the older closed trades
  await Trade.update({ category: 'crypto' }, { where: { asset: ['BTCUSD', 'ETHUSD'] } });

  const allActive = await Trade.findAll({ where: { status: 'active' } });
  console.log(`\n🎉 Success! Total active trades: ${allActive.length}`);
  allActive.forEach(t => {
    console.log(`- ${t.asset} | ${t.category} | ${t.timeframe} | ${t.direction.toUpperCase()} | Entry: ${t.entry} | SL: ${t.stopLoss} | TP: ${t.takeProfit}`);
  });

  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
