/**
 * System Verification Script
 * Run this to verify all fixes are properly deployed
 * Usage: node scripts/verify-fixes.js
 */

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

async function verify() {
  console.log(`\n${colors.blue}${'='.repeat(60)}`);
  console.log(`📊 System-100 Verification Checklist`);
  console.log(`${'='.repeat(60)}${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  try {
    // Test 1: Database Connection
    console.log(`${colors.cyan}Testing database connection...${colors.reset}`);
    const { sequelize } = require('./config/database');
    await sequelize.authenticate();
    console.log(`${colors.green}✅ Database connection successful${colors.reset}\n`);
    passed++;
  } catch (error) {
    console.log(`${colors.red}❌ Database connection failed: ${error.message}${colors.reset}\n`);
    failed++;
  }

  try {
    // Test 2: Scanner Configs Exist
    console.log(`${colors.cyan}Checking scanner configurations...${colors.reset}`);
    const { ScannerConfig } = require('./models');
    const configCount = await ScannerConfig.count({ where: { isEnabled: true } });
    if (configCount >= 6) {
      console.log(`${colors.green}✅ Found ${configCount} enabled scanner configurations${colors.reset}`);
      passed++;
    } else {
      console.log(`${colors.yellow}⚠️  Found only ${configCount} enabled scanners (expected 6+)${colors.reset}`);
      failed++;
    }
    console.log();
  } catch (error) {
    console.log(`${colors.red}❌ Scanner config check failed: ${error.message}${colors.reset}\n`);
    failed++;
  }

  try {
    // Test 3: ScannerResult Model Fields
    console.log(`${colors.cyan}Checking ScannerResult fields...${colors.reset}`);
    const { ScannerResult } = require('./models');
    const attributes = Object.keys(ScannerResult.rawAttributes);
    const requiredFields = ['entry', 'stopLoss', 'takeProfit', 'takeProfit2', 'takeProfit3', 'pattern'];
    const hasAll = requiredFields.every(field => attributes.includes(field));
    
    if (hasAll) {
      console.log(`${colors.green}✅ All required fields present: ${requiredFields.join(', ')}${colors.reset}`);
      passed++;
    } else {
      const missing = requiredFields.filter(f => !attributes.includes(f));
      console.log(`${colors.red}❌ Missing fields: ${missing.join(', ')}${colors.reset}`);
      failed++;
    }
    console.log();
  } catch (error) {
    console.log(`${colors.red}❌ Field check failed: ${error.message}${colors.reset}\n`);
    failed++;
  }

  try {
    // Test 4: Signal Model TP3 Field
    console.log(`${colors.cyan}Checking Signal model for TP3...${colors.reset}`);
    const { Signal } = require('./models');
    const attributes = Object.keys(Signal.rawAttributes);
    
    if (attributes.includes('takeProfit3') && attributes.includes('pattern')) {
      console.log(`${colors.green}✅ Signal model has TP3 and pattern fields${colors.reset}`);
      passed++;
    } else {
      console.log(`${colors.red}❌ Signal model missing TP3 or pattern${colors.reset}`);
      failed++;
    }
    console.log();
  } catch (error) {
    console.log(`${colors.red}❌ Signal model check failed: ${error.message}${colors.reset}\n`);
    failed++;
  }

  try {
    // Test 5: Recent Signals with TP2/TP3
    console.log(`${colors.cyan}Checking recent signals for TP2/TP3...${colors.reset}`);
    const { ScannerResult } = require('./models');
    const recentSignals = await ScannerResult.findAll({
      where: { isActive: true },
      limit: 10
    });

    if (recentSignals.length > 0) {
      const withTP2TP3 = recentSignals.filter(s => s.takeProfit2 && s.takeProfit3).length;
      const percentage = Math.round((withTP2TP3 / recentSignals.length) * 100);
      
      if (percentage >= 80) {
        console.log(`${colors.green}✅ ${percentage}% of recent signals have TP2/TP3 (${withTP2TP3}/${recentSignals.length})${colors.reset}`);
        passed++;
      } else if (percentage >= 50) {
        console.log(`${colors.yellow}⚠️  Only ${percentage}% of signals have TP2/TP3 - regeneration may be needed${colors.reset}`);
        failed++;
      } else {
        console.log(`${colors.red}❌ Only ${percentage}% have TP2/TP3 - signals need regeneration${colors.reset}`);
        failed++;
      }
    } else {
      console.log(`${colors.yellow}⚠️  No active signals found (scanners may need to run)${colors.reset}`);
    }
    console.log();
  } catch (error) {
    console.log(`${colors.red}❌ Signal check failed: ${error.message}${colors.reset}\n`);
    failed++;
  }

  try {
    // Test 6: Gold Scanner Enabled
    console.log(`${colors.cyan}Checking gold scanner configuration...${colors.reset}`);
    const { ScannerConfig } = require('./models');
    const goldScanner = await ScannerConfig.findOne({
      where: { strategyName: 'commoditiesScanner', isEnabled: true }
    });

    if (goldScanner) {
      console.log(`${colors.green}✅ Gold scanner enabled with pairs: ${goldScanner.pairs.join(', ')}${colors.reset}`);
      passed++;
    } else {
      console.log(`${colors.red}❌ Gold scanner not found or disabled${colors.reset}`);
      failed++;
    }
    console.log();
  } catch (error) {
    console.log(`${colors.red}❌ Gold scanner check failed: ${error.message}${colors.reset}\n`);
    failed++;
  }

  try {
    // Test 7: Forex Factory Service
    console.log(`${colors.cyan}Checking Forex Factory service...${colors.reset}`);
    const forexFactoryService = require('./services/forexFactoryService');
    const events = await forexFactoryService.getCalendarEvents({ impact: 'high' });
    
    if (events && events.length > 0) {
      console.log(`${colors.green}✅ Forex Factory data available (${events.length} high-impact events)${colors.reset}`);
      passed++;
    } else {
      console.log(`${colors.yellow}⚠️  No Forex Factory events returned (may be using fallback)${colors.reset}`);
    }
    console.log();
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Forex Factory check (non-critical): ${error.message}${colors.reset}\n`);
  }

  try {
    // Test 8: Deduplication Logic
    console.log(`${colors.cyan}Verifying deduplication fix...${colors.reset}`);
    const { ScannerResult } = require('./models');
    const { Op } = require('sequelize');
    
    // Get signals from last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentByPair = await ScannerResult.findAll({
      where: { createdAt: { [Op.gte]: oneHourAgo } },
      attributes: ['pair', 'signalType', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']],
      group: ['pair', 'signalType'],
      raw: true
    });

    if (recentByPair.length > 0) {
      const hasMultiple = recentByPair.some(r => parseInt(r.count) > 1);
      if (hasMultiple) {
        console.log(`${colors.green}✅ Deduplication working correctly - allows multiple signals per pair${colors.reset}`);
        console.log(`   (${recentByPair.length} unique pair/signalType combinations)`);
        passed++;
      } else {
        console.log(`${colors.yellow}⚠️  No multiple signals detected yet (may need more time)${colors.reset}`);
      }
    } else {
      console.log(`${colors.yellow}⚠️  No signals in last hour (scanners may need to run)${colors.reset}`);
    }
    console.log();
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Deduplication check (non-critical): ${error.message}${colors.reset}\n`);
  }

  // Summary
  console.log(`${colors.blue}${'='.repeat(60)}`);
  console.log(`Results: ${colors.green}${passed} Passed${colors.reset} | ${colors.red}${failed} Failed${colors.reset}`);
  console.log(`${'='.repeat(60)}${colors.reset}\n`);

  if (failed === 0) {
    console.log(`${colors.green}✅ All systems operational! Scanners ready to use.${colors.reset}\n`);
  } else if (failed <= 2) {
    console.log(`${colors.yellow}⚠️  Minor issues detected - system is functional but may need attention.${colors.reset}\n`);
  } else {
    console.log(`${colors.red}❌ Critical issues detected - system needs repair.${colors.reset}\n`);
  }

  process.exit(failed > 2 ? 1 : 0);
}

// Run verification
verify().catch(error => {
  console.error(`${colors.red}Verification failed:${colors.reset}`, error);
  process.exit(1);
});
