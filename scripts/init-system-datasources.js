#!/usr/bin/env node

/**
 * Initialize System Data Sources
 * Run this script after database migration to create permanent, system-level data sources
 * Usage: node scripts/init-system-datasources.js
 */

require('dotenv').config({ path: '.env' });
const { DataSource } = require('../server/models');
const logger = require('../server/utils/logger');

const SYSTEM_DATA_SOURCES = [
  {
    name: 'TWELVE_DATA',
    provider: 'twelvedata',
    baseUrl: 'https://api.twelvedata.com',
    apiKey: '442090d2ledd439e8600blf0dcfbab9a',
    isActive: true,
    isSystem: true,
    priority: 1,
    rateLimit: 800,
    configuration: {
      description: 'Primary TwelveData API - System Data Source'
    }
  }
];

async function initSystemDataSources() {
  try {
    logger.info('Initializing system data sources...');

    for (const sourceData of SYSTEM_DATA_SOURCES) {
      // Check if already exists
      const existing = await DataSource.findOne({
        where: { name: sourceData.name, isSystem: true }
      });

      if (existing) {
        logger.info(`System data source already exists: ${sourceData.name}`);
        // Update the API key in case it changed
        await existing.update({
          apiKey: sourceData.apiKey,
          isActive: sourceData.isActive
        });
        logger.info(`Updated ${sourceData.name} API key`);
      } else {
        const created = await DataSource.create(sourceData);
        logger.info(`✓ Created system data source: ${created.name}`);
      }
    }

    logger.info('✓ System data sources initialization completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error initializing system data sources:', error);
    process.exit(1);
  }
}

initSystemDataSources();
