/**
 * Rate Limiter Service
 * Implements request queuing, exponential backoff, and rate limit awareness
 * Prevents free tier API exhaustion
 */
const logger = require('../utils/logger');

class RateLimiter {
  constructor() {
    // Track requests per provider: { provider: { count, resetTime } }
    this.providers = new Map();
    
    // Request queues per provider
    this.queues = new Map();
    
    // Processing flags
    this.processing = new Map();
    
    // Backoff multipliers
    this.backoffMultipliers = new Map();
  }

  /**
   * Register a provider with rate limit config
   * @param {string} provider - Provider name (e.g., 'exchangerate-api')
   * @param {number} limit - Requests allowed per period
   * @param {number} periodMs - Time period in milliseconds
   * @param {number} maxRetries - Max retries on rate limit
   */
  registerProvider(provider, limit, periodMs, maxRetries = 3) {
    this.providers.set(provider, {
      limit,
      periodMs,
      maxRetries,
      count: 0,
      resetTime: Date.now() + periodMs,
      blocked: false,
      blockUntil: 0
    });
    this.queues.set(provider, []);
    this.backoffMultipliers.set(provider, 1);
    logger.info(`[RateLimiter] Registered ${provider}: ${limit} req/${periodMs}ms`);
  }

  /**
   * Check if provider is rate limited
   */
  isRateLimited(provider) {
    const config = this.providers.get(provider);
    if (!config) return false;

    // Check if blocked due to rate limit
    if (config.blocked && Date.now() < config.blockUntil) {
      return true;
    }

    // Check if limit exceeded in current period
    if (Date.now() < config.resetTime && config.count >= config.limit) {
      return true;
    }

    // Reset period if expired
    if (Date.now() >= config.resetTime) {
      config.count = 0;
      config.resetTime = Date.now() + config.periodMs;
      config.blocked = false;
      this.backoffMultipliers.set(provider, 1);
    }

    return false;
  }

  /**
   * Increment request count for provider
   */
  recordRequest(provider) {
    const config = this.providers.get(provider);
    if (config) {
      config.count++;
      logger.debug(`[RateLimiter] ${provider}: ${config.count}/${config.limit} requests`);
    }
  }

  /**
   * Handle rate limit response - trigger backoff
   */
  handleRateLimit(provider) {
    const config = this.providers.get(provider);
    if (!config) return;

    const multiplier = this.backoffMultipliers.get(provider) || 1;
    const backoffMs = Math.min(
      multiplier * 60000, // Start with 1 minute, max 30 minutes
      30 * 60 * 1000
    );

    config.blocked = true;
    config.blockUntil = Date.now() + backoffMs;
    this.backoffMultipliers.set(provider, multiplier * 2);

    logger.warn(`[RateLimiter] ${provider} rate limited! Backing off for ${backoffMs}ms`);
  }

  /**
   * Queue a request with automatic retry logic
   * @returns {Promise} Resolves when request can be executed
   */
  async queueRequest(provider, executor, retries = 0) {
    const config = this.providers.get(provider);
    if (!config) {
      logger.warn(`[RateLimiter] Unknown provider: ${provider}`);
      return executor();
    }

    // Check if rate limited
    if (this.isRateLimited(provider)) {
      if (retries < config.maxRetries) {
        const backoffMs = 5000 * (retries + 1);
        logger.info(`[RateLimiter] ${provider} rate limited. Retry in ${backoffMs}ms (${retries + 1}/${config.maxRetries})`);
        await this.sleep(backoffMs);
        return this.queueRequest(provider, executor, retries + 1);
      } else {
        throw new Error(`Rate limit exceeded for ${provider} after ${config.maxRetries} retries`);
      }
    }

    // Record and execute
    this.recordRequest(provider);
    try {
      const result = await executor();
      return result;
    } catch (error) {
      // Check if it's a rate limit error (429)
      if (error.response?.status === 429 || error.message?.includes('rate limit')) {
        this.handleRateLimit(provider);
        if (retries < config.maxRetries) {
          logger.info(`[RateLimiter] Detected rate limit. Retrying...`);
          await this.sleep(10000); // 10s backoff
          return this.queueRequest(provider, executor, retries + 1);
        }
      }
      throw error;
    }
  }

  /**
   * Get time until rate limit resets
   */
  getResetTime(provider) {
    const config = this.providers.get(provider);
    if (!config) return 0;

    const now = Date.now();
    if (config.blocked && now < config.blockUntil) {
      return config.blockUntil - now;
    }

    if (now < config.resetTime) {
      return config.resetTime - now;
    }

    return 0;
  }

  /**
   * Get provider stats
   */
  getStats(provider) {
    const config = this.providers.get(provider);
    if (!config) return null;

    return {
      provider,
      count: config.count,
      limit: config.limit,
      utilization: `${Math.round((config.count / config.limit) * 100)}%`,
      isRateLimited: this.isRateLimited(provider),
      resetIn: this.getResetTime(provider)
    };
  }

  /**
   * Helper: sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new RateLimiter();
