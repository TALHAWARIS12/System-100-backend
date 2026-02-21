-- Add more trading pairs to scanner configurations
-- Run this in your Neon dashboard SQL editor

-- Check existing configs
SELECT * FROM scanner_configs;

-- Delete existing configs to recreate with new pairs (optional - comment out if you want to keep existing)
-- DELETE FROM scanner_configs;

-- Add comprehensive scanner configurations for all asset types
INSERT INTO scanner_configs (id, "strategyName", description, pairs, timeframes, "isEnabled", "scanInterval", rules, "createdAt", "updatedAt")
VALUES 
  -- RSI Strategy for Forex & Commodities
  (gen_random_uuid(), 'rsiOversold', 'RSI Oversold/Overbought Strategy - Forex & Commodities', 
   ARRAY['EURUSD', 'GBPUSD', 'GBPJPY', 'XAUUSD', 'XAGUSD', 'US30USD'], 
   ARRAY['1h', '4h', '1d'], true, 60, 
   '{"rsiOverbought": 70, "rsiOversold": 30}'::jsonb, NOW(), NOW()),
  
  -- MACD Crossover for All Assets
  (gen_random_uuid(), 'macdCrossover', 'MACD Crossover Strategy - All Assets', 
   ARRAY['EURUSD', 'GBPUSD', 'GBPJPY', 'XAUUSD', 'XAGUSD', 'US30USD', 'BTCUSD', 'ETHUSD'], 
   ARRAY['4h', '1d'], true, 120,
   '{"minHistogram": 0}'::jsonb, NOW(), NOW()),
  
  -- Moving Average Strategy for Forex & Commodities
  (gen_random_uuid(), 'movingAverageCross', 'MA Crossover - Forex & Commodities', 
   ARRAY['EURUSD', 'GBPUSD', 'GBPJPY', 'XAUUSD', 'XAGUSD'], 
   ARRAY['4h', '1d'], true, 120,
   '{"fastMA": 20, "slowMA": 50}'::jsonb, NOW(), NOW()),
  
  -- Crypto Momentum for BTC & ETH
  (gen_random_uuid(), 'cryptoMomentum', 'Crypto Momentum Strategy - BTC & ETH', 
   ARRAY['BTCUSD', 'ETHUSD'], 
   ARRAY['1h', '4h', '1d'], true, 30,
   '{"rsiOverbought": 70, "rsiOversold": 30, "minHistogram": 0}'::jsonb, NOW(), NOW()),
  
  -- Commodities Scanner for Gold & Silver
  (gen_random_uuid(), 'commoditiesScanner', 'Commodities Scanner - Gold & Silver', 
   ARRAY['XAUUSD', 'XAGUSD'], 
   ARRAY['1h', '4h', '1d'], true, 60,
   '{"rsiOverbought": 70, "rsiOversold": 30}'::jsonb, NOW(), NOW()),
  
  -- Indices Scanner for US30
  (gen_random_uuid(), 'indicesScanner', 'Indices Scanner - US30', 
   ARRAY['US30USD'], 
   ARRAY['1h', '4h', '1d'], true, 60,
   '{"rsiOverbought": 70, "rsiOversold": 30}'::jsonb, NOW(), NOW())
ON CONFLICT ("strategyName") DO UPDATE SET
  pairs = EXCLUDED.pairs,
  timeframes = EXCLUDED.timeframes,
  "isEnabled" = EXCLUDED."isEnabled",
  "scanInterval" = EXCLUDED."scanInterval",
  rules = EXCLUDED.rules,
  "updatedAt" = NOW();

-- Verify
SELECT * FROM scanner_configs WHERE "isEnabled" = true;
