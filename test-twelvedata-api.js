const axios = require('axios');

const apiKey = '442090d21edd439e8600b1f0dcfbab9a';
const baseUrl = 'https://api.twelvedata.com';
const symbol = 'XAU/USD';
const interval = '1h';

async function testAPI() {
  try {
    console.log('\n🧪 Testing TwelveData API...\n');
    console.log('📊 Request Details:');
    console.log(`   URL: ${baseUrl}/time_series`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Interval: ${interval}`);
    console.log(`   API Key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}`);
    console.log();

    const params = {
      symbol: symbol,
      interval: interval,
      apikey: apiKey,
      outputsize: 200
    };

    console.log('📤 Sending request...\n');

    const response = await axios.get(`${baseUrl}/time_series`, {
      params: params,
      timeout: 10000
    });

    console.log('✅ SUCCESS! API Response:');
    console.log(`   Status: ${response.status}`);
    console.log(`   Data keys: ${Object.keys(response.data).join(', ')}`);
    
    if (response.data.values) {
      console.log(`   Candles returned: ${response.data.values.length}`);
      if (response.data.values.length > 0) {
        const latest = response.data.values[0];
        console.log(`   Latest candle: Close=${latest.close}`);
      }
    }

    console.log('\n✅ TwelveData API is working correctly!\n');
    process.exit(0);

  } catch (error) {
    console.log('❌ ERROR!\n');
    console.log(`Error Message: ${error.message}`);
    
    if (error.response) {
      console.log(`Status Code: ${error.response.status}`);
      console.log(`Response Data:`, error.response.data);
    }

    console.log('\n⚠️  Possible causes:');
    console.log('   1. API key is invalid or expired');
    console.log('   2. API key has no remaining quota');
    console.log('   3. Network/firewall blocking the request');
    console.log('   4. TwelveData API is down\n');
    
    process.exit(1);
  }
}

testAPI();
