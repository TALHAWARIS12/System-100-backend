const axios = require('axios');

const apiKey = '442090d2ledd439e8600blf0dcfbab9a';
const baseUrl = 'https://api.twelvedata.com';
const symbol = 'XAU/USD';
const interval = '1h';

async function testAPI() {
  try {
    console.log('\n🧪 Testing TwelveData API (VERBOSE)...\n');

    const params = {
      symbol: symbol,
      interval: interval,
      apikey: apiKey,
      outputsize: 200
    };

    const response = await axios.get(`${baseUrl}/time_series`, {
      params: params,
      timeout: 10000
    });

    console.log('📊 Full API Response:');
    console.log(JSON.stringify(response.data, null, 2));

    process.exit(0);

  } catch (error) {
    console.log('❌ Request Error:');
    console.log(error.message);
    
    if (error.response) {
      console.log('\n📊 Error Response:');
      console.log(JSON.stringify(error.response.data, null, 2));
    }
    
    process.exit(1);
  }
}

testAPI();
