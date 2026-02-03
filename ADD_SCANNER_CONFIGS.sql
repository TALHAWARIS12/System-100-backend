-- Add more trading pairs to scanner configurations
-- Run this in your Neon dashboard SQL editor

-- Check existing configs
SELECT * FROM scanner_configs;

-- Add more crypto pairs
INSERT INTO scanner_configs (id, "strategyName", pairs, timeframes, "isEnabled", "scanInterval", "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'crypto_momentum', ARRAY['BTCUSD', 'ETHUSD', 'BNBUSD', 'SOLUSD', 'ADAUSD'], ARRAY['15min', '1h', '4h'], true, 15, NOW(), NOW()),
  (gen_random_uuid(), 'forex_major', ARRAY['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD'], ARRAY['1h', '4h'], true, 30, NOW(), NOW()),
  (gen_random_uuid(), 'crypto_scalp', ARRAY['BTCUSD', 'ETHUSD'], ARRAY['5min', '15min'], true, 5, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Verify
SELECT * FROM scanner_configs WHERE "isEnabled" = true;
