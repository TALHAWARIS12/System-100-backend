/**
 * Phase 2: Redis Cache Abstraction
 *
 * Provides get/set/del with graceful fallback to in-memory Map
 * when REDIS_URL is not configured.
 *
 * Usage:
 *   const cache = require('./redisCache');
 *   await cache.set('key', data, 120);   // 120s TTL
 *   const val = await cache.get('key');
 *   await cache.del('key');
 */
const logger = require('../utils/logger');

let redisClient = null;
const memoryCache = new Map(); // fallback
const memoryTTLs = new Map();

async function initRedis() {
  if (redisClient) return redisClient;
  if (!process.env.REDIS_URL) {
    logger.info('[Cache] No REDIS_URL — using in-memory fallback');
    return null;
  }

  try {
    // Lazy-require so the app doesn't crash if ioredis is missing
    const Redis = require('ioredis');
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
      enableReadyCheck: true,
      lazyConnect: true
    });

    await redisClient.connect();
    logger.info('[Cache] Connected to Redis');

    redisClient.on('error', (err) => {
      logger.error('[Cache] Redis error — falling back to memory', err.message);
      redisClient = null;
    });

    return redisClient;
  } catch (err) {
    logger.warn('[Cache] Redis unavailable — using in-memory fallback:', err.message);
    redisClient = null;
    return null;
  }
}

// ── In-memory helpers ──────────────────────────────────────────

function memoryGet(key) {
  const ttl = memoryTTLs.get(key);
  if (ttl && Date.now() > ttl) {
    memoryCache.delete(key);
    memoryTTLs.delete(key);
    return null;
  }
  return memoryCache.has(key) ? memoryCache.get(key) : null;
}

function memorySet(key, value, ttlSeconds) {
  memoryCache.set(key, value);
  if (ttlSeconds) {
    memoryTTLs.set(key, Date.now() + ttlSeconds * 1000);
  }
}

function memoryDel(key) {
  memoryCache.delete(key);
  memoryTTLs.delete(key);
}

// Periodic cleanup of expired in-memory entries (every 60s)
setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of memoryTTLs) {
    if (now > expiry) {
      memoryCache.delete(key);
      memoryTTLs.delete(key);
    }
  }
}, 60_000);

// ── Public API ─────────────────────────────────────────────────

const cache = {
  /**
   * Get a cached value (parsed JSON for Redis, raw for memory)
   */
  async get(key) {
    try {
      const client = await initRedis();
      if (client) {
        const raw = await client.get(key);
        return raw ? JSON.parse(raw) : null;
      }
      return memoryGet(key);
    } catch {
      return memoryGet(key);
    }
  },

  /**
   * Set a value with optional TTL (seconds)
   */
  async set(key, value, ttlSeconds = 300) {
    const serialised = typeof value === 'string' ? value : JSON.stringify(value);
    try {
      const client = await initRedis();
      if (client) {
        if (ttlSeconds) {
          await client.set(key, serialised, 'EX', ttlSeconds);
        } else {
          await client.set(key, serialised);
        }
      }
    } catch {
      // Redis failed; still store in memory
    }
    // Always keep in memory as fast local hit
    memorySet(key, value, ttlSeconds);
  },

  /**
   * Delete a key
   */
  async del(key) {
    try {
      const client = await initRedis();
      if (client) await client.del(key);
    } catch { /* ignore */ }
    memoryDel(key);
  },

  /**
   * Clear all keys matching a pattern (e.g. 'market:*')
   */
  async clearPattern(pattern) {
    try {
      const client = await initRedis();
      if (client) {
        const keys = await client.keys(pattern);
        if (keys.length) await client.del(...keys);
      }
    } catch { /* ignore */ }

    // Clear matching in-memory keys (regex from glob)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        memoryCache.delete(key);
        memoryTTLs.delete(key);
      }
    }
  },

  /**
   * Check if Redis is connected
   */
  async isRedisConnected() {
    try {
      const client = await initRedis();
      return !!client;
    } catch {
      return false;
    }
  }
};

module.exports = cache;
