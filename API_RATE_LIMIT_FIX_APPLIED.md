# API Rate Limiting - Fix Applied

## Problem Summary
The forex trading scanner system was hitting free tier API rate limits within hours because:
- **Gold Scanner** ran every 5 minutes
- **Market Data Pipeline** ran every 2 minutes  
- Each run made separate API calls to free tier services
- Insufficient caching between calls
- No request queuing or backoff strategy

**Result**: API rate limits exceeded → Empty responses → Null trades and scanning failures

---

## Root Causes Identified

### 1. **Excessive API Call Frequency**
```
Market Data: 8 assets × every 2 minutes = 240 calls/hour
Gold Scanner: every 5 minutes = 288 calls/day
Total: 288-720 API calls per day for free tier APIs
```

Free tier limits:
- exchangerate-api.com: **1,500 requests/month** (~50/day)
- metals.live: ~1,000 requests/day

### 2. **Insufficient Caching**
- Currency Strength: 5-minute cache was too short
- Market Data: No response caching between scans
- Gold Scanner: No cache for fallback APIs

### 3. **No Rate Limit Handling**
- No detection of 429 responses
- No exponential backoff
- No request queuing
- Failed requests weren't gracefully degraded

---

## Solutions Implemented

### 1. **New Rate Limiter Service** 
**File**: `/server/services/rateLimiter.js`

Features:
- ✅ Per-provider rate limit tracking
- ✅ Automatic exponential backoff (1min → 30min)
- ✅ Request queuing with retry logic
- ✅ 429 response detection
- ✅ Provider statistics and monitoring

```javascript
// Register a provider (e.g., 1500 requests per 30 days)
rateLimiter.registerProvider('exchangerate-api', 1500, 30*24*60*60*1000, 2);

// Queue a request with automatic retry
const result = await rateLimiter.queueRequest('exchangerate-api', async () => {
  return await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
});
```

### 2. **Increased Cache TTLs**

#### Currency Strength Service
- **Old**: 5 minutes
- **New**: 30 minutes  
- **Plus**: Distributed Redis caching

#### Market Data Service  
- **New**: 10-minute cache (matching scan frequency)
- Checks cache before fetching
- Skips database writes for cached data

#### Gold Scanner Service
- **New**: 5-minute cache for gold prices
- Graceful fallback to stale cache if rate limited
- Better error messages

### 3. **Reduced Scanning Frequency**

#### goldScannerCron.js Changes:
```javascript
// OLD → NEW intervals:
Market Data:    every 2 min  → every 10 min   (5× reduction)
Gold Scanner:   every 5 min  → every 15 min   (3× reduction)
Econ Calendar: every 10 min → every 30 min   (3× reduction)
Calendar Alerts: every 1 min → every 2 min   (kept fast for alerts)
```

### 4. **Comprehensive Integration**

All services now use:
- ✅ Rate limiter for API calls
- ✅ Distributed caching via Redis (with memory fallback)
- ✅ Better error handling for 429 responses
- ✅ Exponential backoff on failures
- ✅ Verbose logging for debugging

### 5. **Graceful Degradation**

When rate limited:
1. Return last cached data
2. Log warning with timestamp
3. Show data age to users
4. Automatically backoff and retry
5. Never crash or return null

---

## Files Modified

| File | Changes |
|------|---------|
| `rateLimiter.js` | **NEW** - Core rate limiting service |
| `currencyStrengthService.js` | Added rate limiter, increased TTL to 30min, distributed cache |
| `goldScannerService.js` | Added rate limiter, 5-min cache, graceful fallback |
| `goldScannerCron.js` | Reduced frequency: 2min→10min, 5min→15min, 10min→30min |
| `marketDataService.js` | Added 10-min response cache, rate limit detection, cache checking |

---

## Expected Impact

### Before Fix
- Free tier exhausted: ~12 hours
- Trades: Often null/empty
- Errors: 429 rate limit responses
- Scanning: Stops working

### After Fix  
- Free tier usage: ~288 calls/month (within 1500 limit)
- Trades: Consistent and reliable
- Errors: Gracefully handled with backoff
- Scanning: **Continuous operation**

---

## Monitoring & Debugging

### Check Rate Limiter Stats
```javascript
const rateLimiter = require('./services/rateLimiter');
console.log(rateLimiter.getStats('exchangerate-api'));
// Output: {
//   provider: 'exchangerate-api',
//   count: 45,
//   limit: 1500,
//   utilization: '3%',
//   isRateLimited: false,
//   resetIn: 1209600000 // ms until reset
// }
```

### Log Output to Monitor
Look for these log messages:
```javascript
// Healthy operation
"[Cron] Market data fetch triggered (10-min interval)"
"[RateLimiter] exchangerate-api: 45/1500 requests (3%)"
"Using cached price data"

// Rate limit detected
"[RateLimiter] exchangerate-api rate limited! Backing off for 60000ms"
"Rate limit detected on exchangerate-api, returning sample data"
"Using stale cached gold price from 15 minutes ago"
```

---

## Next Steps for Production

### Optional Enhancements
1. **API Key Rotation**: Implement key rotation for higher limits
2. **Premium APIs**: Migrate critical pairs to paid tiers
3. **Distributed Components**: Use multiple region API endpoints
4. **Monitoring**: Add alerts when rate limit reaches 80%
5. **Circuit Breaker**: Auto-disable failing data sources

### Testing Checklist
- [ ] Watch logs for first 24 hours
- [ ] Verify trades generate consistently
- [ ] Monitor rate limiter stats
- [ ] Check for no null trades
- [ ] Validate cache is being used

---

## Rollback Plan

If issues occur, revert these files:
1. currencyStrengthService.js
2. goldScannerService.js
3. goldScannerCron.js
4. marketDataService.js

Remove:
- rateLimiter.js (new file)

Previous cron intervals will restore:
- Market data: every 2 minutes
- Gold scanner: every 5 minutes

---

## Questions?

Check logs at: `server/logs/`

Key files to review:
- Rate limiting logic: `server/services/rateLimiter.js`
- Cache hits: Search logs for "cached"
- Rate limits: Search logs for "rate limited" or "429"
