require('dotenv').config();
const { DataSource } = require('./server/models');

(async () => {
  try {
    const sources = await DataSource.findAll({ raw: true });
    console.log('\n📋 ALL DATA SOURCES:\n');
    sources.forEach((s, i) => {
      console.log(`${i + 1}. ${s.name}`);
      console.log(`   Provider: ${s.provider}`);
      console.log(`   Active: ${s.isActive}`);
      console.log(`   API Key: "${s.apiKey || 'EMPTY'}"`);
      console.log(`   Base URL: ${s.baseUrl}`);
      console.log();
    });
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
