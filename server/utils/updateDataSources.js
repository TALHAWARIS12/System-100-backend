const { DataSource } = require('../models');
const { sequelize } = require('../config/database');

async function updateDataSources() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Update any alphavantage.com to alphavantage.co
    const result = await DataSource.update(
      { baseUrl: 'https://www.alphavantage.co' },
      { 
        where: { 
          baseUrl: 'https://www.alphavantage.com'
        } 
      }
    );

    console.log(`✅ Updated ${result[0]} data source(s)`);
    
    // Show all data sources
    const sources = await DataSource.findAll();
    console.log('\n📊 Current Data Sources:');
    sources.forEach(source => {
      console.log(`- ${source.name}: ${source.baseUrl} (${source.provider})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateDataSources();
