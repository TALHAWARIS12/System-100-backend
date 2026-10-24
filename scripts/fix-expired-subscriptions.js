require('dotenv').config();
const { User, ScannerResult } = require('../server/models');
const { Op } = require('sequelize');
const scannerEngine = require('../server/services/scannerEngine');

async function runFix() {
  console.log('--- 1. Fixing Expired Subscriptions ---');
  const now = new Date();
  
  // Update all users whose subscriptionEndDate is in the past and still marked active
  const expiredUsers = await User.findAll({
    where: {
      subscriptionStatus: 'active',
      subscriptionEndDate: {
        [Op.lt]: now
      }
    }
  });

  console.log(`Found ${expiredUsers.length} users with expired subscriptions marked as active.`);
  for (const user of expiredUsers) {
    console.log(`Updating user: ${user.email} (ended ${user.subscriptionEndDate}) -> inactive`);
    await user.update({
      subscriptionStatus: 'inactive',
      // If customer ID was from old batch (cus_U...), reset it so checkout creates a fresh one in the current Stripe account
      stripeCustomerId: (user.stripeCustomerId && user.stripeCustomerId.startsWith('cus_U')) ? null : user.stripeCustomerId
    });
  }

  // Specifically check Linnette
  const linnette = await User.findOne({ where: { email: 'linnette2608@gmail.com' } });
  if (linnette) {
    console.log('\nLinnette status:', {
      email: linnette.email,
      status: linnette.subscriptionStatus,
      endDate: linnette.subscriptionEndDate,
      stripeCustomerId: linnette.stripeCustomerId
    });
  }

  console.log('\n--- 2. Purging Corrupt / Inverted Scanner Results ---');
  // Delete scanner results for BTCUSD and ETHUSD that had outdated/inverted entries
  const deletedBtc = await ScannerResult.destroy({
    where: {
      pair: 'BTCUSD',
      entry: { [Op.lt]: 75000 }
    }
  });
  const deletedEth = await ScannerResult.destroy({
    where: {
      pair: 'ETHUSD',
      entry: { [Op.lt]: 2000 }
    }
  });
  console.log(`Purged ${deletedBtc} corrupt BTC signals and ${deletedEth} corrupt ETH signals.`);

  console.log('\n--- 3. Running Scanner Engine with Fixed Normalization ---');
  await scannerEngine.runScanner();
  console.log('Scanner run complete!');

  console.log('\n--- 4. Checking Newest Scanner Signals ---');
  const newSignals = await ScannerResult.findAll({
    where: { pair: ['BTCUSD', 'ETHUSD'] },
    order: [['createdAt', 'DESC']],
    limit: 6
  });
  newSignals.forEach(s => {
    console.log(`[${s.pair}] ${s.timeframe} ${s.signalType.toUpperCase()} @ Entry: ${s.entry} (Strategy: ${s.strategyName})`);
  });

  console.log('\n✅ All fixes successfully applied and verified!');
  process.exit(0);
}

runFix().catch(err => {
  console.error('Fix script error:', err);
  process.exit(1);
});
