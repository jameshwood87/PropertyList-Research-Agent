const Redis = require('ioredis');

class RedisCache {
  constructor() {
    this.redis = null;
    this.connected = false;
    this.defaultTTL = parseInt(process.env.CACHE_TTL) || 1800; // 30 minutes
  }

  /**
   * Initialize Redis connection
   */
  async init() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      };

      if (process.env.REDIS_PASSWORD) {
        redisConfig.password = process.env.REDIS_PASSWORD;
      }

      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL);
      } else {
        this.redis = new Redis(redisConfig);
      }

      // Event handlers
      this.redis.on('connect', () => {
        console.log('Redis connected successfully');
        this.connected = true;
      });

      this.redis.on('error', (error) => {
        console.error('Redis connection error:', error.message);
        this.connected = false;
      });

      this.redis.on('close', () => {
        console.log('Redis connection closed');
        this.connected = false;
      });

      // Test connection
      await this.redis.ping();
      console.log('Redis cache initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Redis cache:', error.message);
      console.warn('Running without Redis cache - performance may be reduced');
      this.redis = null;
      this.connected = false;
    }
  }

  /**
   * Generate cache key for comparables
   */
  generateComparablesKey(criteria) {
    const {
      latitude,
      longitude,
      urbanization,
      suburb,
      city,
      propertyType,
      bedrooms,
      radiusKm,
      minPrice,
      maxPrice
    } = criteria;

    // Create a deterministic key
    const keyParts = [
      'comparables',
      latitude ? `lat:${latitude.toFixed(6)}` : 'no-lat',
      longitude ? `lng:${longitude.toFixed(6)}` : 'no-lng',
      urbanization || suburb || city || 'no-location',
      `type:${propertyType || 'any'}`,
      `beds:${bedrooms || 'any'}`,
      `radius:${radiusKm || 5}`,
      minPrice ? `min:${minPrice}` : 'no-min',
      maxPrice ? `max:${maxPrice}` : 'no-max'
    ];

    return keyParts.join(':');
  }

  /**
   * Generate cache key for AI analysis
   */
  generateAIAnalysisKey(propertyData, comparablesData) {
    const propertyHash = this.hashObject({
      reference: propertyData.reference,
      price: propertyData.price,
      bedrooms: propertyData.bedrooms,
      buildArea: propertyData.build_square_meters,
      city: propertyData.city
    });

    const comparablesHash = this.hashObject({
      count: comparablesData.comparables.length,
      avgPrice: comparablesData.summary.averagePrice || 0,
      topIds: comparablesData.comparables.slice(0, 3).map(c => c.id)
    });

    return `ai:analysis:${propertyHash}:${comparablesHash}`;
  }

  /**
   * Generate cache key for market research
   */
  generateMarketResearchKey(location, propertyType) {
    return `market:research:${location}:${propertyType || 'any'}`;
  }

  /**
   * Generate cache key for feed statistics
   */
  generateFeedStatsKey() {
    return 'feed:stats';
  }

  /**
   * Get cached comparables
   */
  async getComparables(criteria) {
    if (!this.isConnected()) return null;

    try {
      const key = this.generateComparablesKey(criteria);
      const cached = await this.redis.get(key);
      
      if (cached) {
        console.log(`Cache HIT: ${key}`);
        return JSON.parse(cached);
      }
      
      console.log(`Cache MISS: ${key}`);
      return null;
      
    } catch (error) {
      console.error('Error getting cached comparables:', error.message);
      return null;
    }
  }

  /**
   * Cache comparables results
   */
  async setComparables(criteria, results, ttl = this.defaultTTL) {
    if (!this.isConnected()) return false;

    try {
      const key = this.generateComparablesKey(criteria);
      await this.redis.setex(key, ttl, JSON.stringify(results));
      console.log(`Cached comparables: ${key} (TTL: ${ttl}s)`);
      return true;
      
    } catch (error) {
      console.error('Error caching comparables:', error.message);
      return false;
    }
  }

  /**
   * Get cached AI analysis
   */
  async getAIAnalysis(propertyData, comparablesData) {
    if (!this.isConnected()) return null;

    try {
      const key = this.generateAIAnalysisKey(propertyData, comparablesData);
      const cached = await this.redis.get(key);
      
      if (cached) {
        console.log(`Cache HIT: AI analysis for ${propertyData.reference}`);
        return JSON.parse(cached);
      }
      
      return null;
      
    } catch (error) {
      console.error('Error getting cached AI analysis:', error.message);
      return null;
    }
  }

  /**
   * Cache AI analysis results
   */
  async setAIAnalysis(propertyData, comparablesData, results, ttl = 3600) {
    if (!this.isConnected()) return false;

    try {
      const key = this.generateAIAnalysisKey(propertyData, comparablesData);
      await this.redis.setex(key, ttl, JSON.stringify(results));
      console.log(`Cached AI analysis: ${propertyData.reference} (TTL: ${ttl}s)`);
      return true;
      
    } catch (error) {
      console.error('Error caching AI analysis:', error.message);
      return false;
    }
  }

  /**
   * Get cached market research
   */
  async getMarketResearch(location, propertyType) {
    if (!this.isConnected()) return null;

    try {
      const key = this.generateMarketResearchKey(location, propertyType);
      const cached = await this.redis.get(key);
      
      if (cached) {
        console.log(`Cache HIT: Market research for ${location}`);
        return JSON.parse(cached);
      }
      
      return null;
      
    } catch (error) {
      console.error('Error getting cached market research:', error.message);
      return null;
    }
  }

  /**
   * Cache market research results
   */
  async setMarketResearch(location, propertyType, results, ttl = 86400) { // 24 hours
    if (!this.isConnected()) return false;

    try {
      const key = this.generateMarketResearchKey(location, propertyType);
      await this.redis.setex(key, ttl, JSON.stringify(results));
      console.log(`Cached market research: ${location} (TTL: ${ttl}s)`);
      return true;
      
    } catch (error) {
      console.error('Error caching market research:', error.message);
      return false;
    }
  }

  /**
   * Get cached feed statistics
   */
  async getFeedStats() {
    if (!this.isConnected()) return null;

    try {
      const key = this.generateFeedStatsKey();
      const cached = await this.redis.get(key);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      return null;
      
    } catch (error) {
      console.error('Error getting cached feed stats:', error.message);
      return null;
    }
  }

  /**
   * Cache feed statistics
   */
  async setFeedStats(stats, ttl = 300) { // 5 minutes
    if (!this.isConnected()) return false;

    try {
      const key = this.generateFeedStatsKey();
      await this.redis.setex(key, ttl, JSON.stringify(stats));
      return true;
      
    } catch (error) {
      console.error('Error caching feed stats:', error.message);
      return false;
    }
  }

  /**
   * Clear all cache entries matching a pattern
   */
  async clearPattern(pattern) {
    if (!this.isConnected()) return false;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`Cleared ${keys.length} cache entries matching: ${pattern}`);
      }
      return true;
      
    } catch (error) {
      console.error('Error clearing cache pattern:', error.message);
      return false;
    }
  }

  /**
   * Clear all comparables cache
   */
  async clearComparablesCache() {
    return await this.clearPattern('comparables:*');
  }

  /**
   * Clear all AI analysis cache
   */
  async clearAICache() {
    return await this.clearPattern('ai:*');
  }

  /**
   * Clear all market research cache
   */
  async clearMarketCache() {
    return await this.clearPattern('market:*');
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    if (!this.isConnected()) {
      return {
        connected: false,
        keys: 0,
        memory: '0B',
        hits: 0,
        misses: 0
      };
    }

    try {
      const info = await this.redis.info('stats');
      const keyspace = await this.redis.info('keyspace');
      
      // Parse Redis info
      const stats = {};
      info.split('\r\n').forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      });

      // Count keys
      const keys = await this.redis.dbsize();

      return {
        connected: this.connected,
        keys: keys,
        memory: stats.used_memory_human || '0B',
        hits: parseInt(stats.keyspace_hits) || 0,
        misses: parseInt(stats.keyspace_misses) || 0,
        hitRate: stats.keyspace_hits && stats.keyspace_misses 
          ? (parseInt(stats.keyspace_hits) / (parseInt(stats.keyspace_hits) + parseInt(stats.keyspace_misses)) * 100).toFixed(2) + '%'
          : '0%'
      };
      
    } catch (error) {
      console.error('Error getting cache stats:', error.message);
      return {
        connected: false,
        keys: 0,
        memory: '0B',
        hits: 0,
        misses: 0,
        error: error.message
      };
    }
  }

  /**
   * Simple hash function for cache keys
   */
  hashObject(obj) {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if Redis is connected
   */
  isConnected() {
    return this.redis && this.connected;
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
      console.log('Redis connection closed');
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.isConnected()) {
      return { status: 'disconnected', message: 'Redis not connected' };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency: `${latency}ms`,
        connected: true
      };
      
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        connected: false
      };
    }
  }
}

module.exports = RedisCache; 