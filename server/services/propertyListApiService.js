const axios = require('axios');
const Bottleneck = require('bottleneck');
const CircuitBreaker = require('opossum');

/**
 * PropertyList API Service
 * Handles all communication with PropertyList.es API with proper rate limiting and error handling
 * Complies with API usage terms and rate limits
 */
class PropertyListApiService {
  constructor() {
    // API Configuration from environment
    this.baseURL = process.env.PROPERTYLIST_API_BASE_URL || 'https://api.propertylist.es/v2';
    this.username = process.env.PROPERTYLIST_API_USERNAME;
    this.password = process.env.PROPERTYLIST_API_PASSWORD;
    
    // Rate limiting configuration (per API documentation)
    this.rateLimits = {
      global: parseInt(process.env.PROPERTYLIST_RATE_LIMIT_GLOBAL) || 100,
      listings: parseInt(process.env.PROPERTYLIST_RATE_LIMIT_LISTINGS) || 30,
      details: parseInt(process.env.PROPERTYLIST_RATE_LIMIT_DETAILS) || 40
    };
    
    // Initialize rate limiters
    this.setupRateLimiters();
    
    // Initialize circuit breakers
    this.setupCircuitBreakers();
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitHits: 0,
      circuitBreakerActivations: 0,
      averageResponseTime: 0,
      lastReset: new Date()
    };
    
    console.log('🔗 PropertyList API Service initialized');
    console.log(`   Base URL: ${this.baseURL}`);
    console.log(`   Rate Limits: ${this.rateLimits.listings}/min listings, ${this.rateLimits.details}/min details`);
  }
  
  /**
   * Setup rate limiters using Bottleneck
   */
  setupRateLimiters() {
    // Global rate limiter (100/minute)
    this.globalLimiter = new Bottleneck({
      reservoir: this.rateLimits.global,
      reservoirRefreshAmount: this.rateLimits.global,
      reservoirRefreshInterval: 60 * 1000, // 1 minute
      maxConcurrent: 5 // Max 5 concurrent requests
    });
    
    // Listings endpoint rate limiter (30/minute)
    this.listingsLimiter = new Bottleneck({
      reservoir: this.rateLimits.listings,
      reservoirRefreshAmount: this.rateLimits.listings,
      reservoirRefreshInterval: 60 * 1000,
      maxConcurrent: 2
    });
    
    // Details endpoint rate limiter (40/minute)
    this.detailsLimiter = new Bottleneck({
      reservoir: this.rateLimits.details,
      reservoirRefreshAmount: this.rateLimits.details,
      reservoirRefreshInterval: 60 * 1000,
      maxConcurrent: 3
    });
    
    // Add rate limit event handlers
    this.globalLimiter.on('failed', (error, jobInfo) => {
      console.warn(`🚦 Global rate limit job failed:`, error.message);
      this.metrics.rateLimitHits++;
    });
    
    this.listingsLimiter.on('failed', (error, jobInfo) => {
      console.warn(`🚦 Listings rate limit job failed:`, error.message);
      this.metrics.rateLimitHits++;
    });
    
    this.detailsLimiter.on('failed', (error, jobInfo) => {
      console.warn(`🚦 Details rate limit job failed:`, error.message);
      this.metrics.rateLimitHits++;
    });
  }
  
  /**
   * Setup circuit breakers for resilience
   */
  setupCircuitBreakers() {
    const breakerOptions = {
      timeout: 10000, // 10 second timeout
      errorThresholdPercentage: 50, // Trip at 50% failure rate
      resetTimeout: 30000, // 30 second reset timeout
      volumeThreshold: 5 // Minimum 5 requests before calculating failure rate
    };
    
    // API call circuit breaker
    this.apiBreaker = new CircuitBreaker(this.makeApiCall.bind(this), breakerOptions);
    
    this.apiBreaker.on('open', () => {
      console.error('🔴 PropertyList API circuit breaker OPEN - API calls suspended');
      this.metrics.circuitBreakerActivations++;
    });
    
    this.apiBreaker.on('halfOpen', () => {
      console.warn('🟡 PropertyList API circuit breaker HALF-OPEN - testing API');
    });
    
    this.apiBreaker.on('close', () => {
      console.log('🟢 PropertyList API circuit breaker CLOSED - API calls resumed');
    });
  }
  
  /**
   * Make authenticated API call with error handling
   */
  async makeApiCall(url, config = {}) {
    const startTime = Date.now();
    
    try {
      this.metrics.totalRequests++;
      
      const response = await axios({
        url,
        ...config,
        auth: {
          username: this.username,
          password: this.password
        },
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'PropertyList-AI-Agent/1.0',
          'Accept': 'application/json',
          ...config.headers
        }
      });
      
      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeMetrics(responseTime);
      this.metrics.successfulRequests++;
      
      // Log rate limit headers for monitoring
      this.logRateLimitHeaders(response.headers);
      
      return response;
      
    } catch (error) {
      this.metrics.failedRequests++;
      
      // Handle rate limit errors specifically
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 60;
        console.warn(`🚦 Rate limit hit, retry after ${retryAfter} seconds`);
        this.metrics.rateLimitHits++;
        
        // Wait and retry if retry-after is reasonable
        if (retryAfter <= 120) {
          await this.sleep(retryAfter * 1000);
          return this.makeApiCall(url, config);
        }
      }
      
      // Handle authentication errors
      if (error.response?.status === 401) {
        console.error('🔐 PropertyList API authentication failed - check credentials');
        throw new Error('PropertyList API authentication failed');
      }
      
      // Handle not found errors
      if (error.response?.status === 404) {
        console.warn('❌ PropertyList API resource not found');
        return null;
      }
      
      console.error('❌ PropertyList API call failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Get property details by ID
   */
  async getPropertyDetails(propertyId, language = 'en') {
    console.log(`🏠 Fetching property details: ${propertyId}`);
    
    const url = `${this.baseURL}/properties/${propertyId}`;
    const params = { language };
    
    // Use details rate limiter and circuit breaker
    return await this.detailsLimiter.schedule(async () => {
      return await this.globalLimiter.schedule(async () => {
        const response = await this.apiBreaker.fire(url, { params });
        // NOTE: Detail endpoint returns single object (no wrapper), so keep original
        return response?.data || null;
      });
    });
  }
  
  /**
   * Search properties with filters
   */
  async searchProperties(filters = {}) {
    console.log(`🔍 Searching properties with filters:`, filters);
    
    const url = `${this.baseURL}/properties`;
    const params = {
      page_size: 12,
      ...filters
    };
    
    // Use listings rate limiter and circuit breaker
    return await this.listingsLimiter.schedule(async () => {
      return await this.globalLimiter.schedule(async () => {
        const response = await this.apiBreaker.fire(url, { params });
        // FIXED: Handle correct API response format with data wrapper
        return response?.data?.data || null;
      });
    });
  }
  
  /**
   * Find comparable properties for a given property
   */
  async findComparables(mainProperty, maxResults = 12) {
    console.log(`🎯 Finding comparables for property in ${mainProperty.city}`);
    
    try {
      // Determine search criteria from main property
      const searchCriteria = this.extractSearchCriteria(mainProperty);
      
      // Search for comparable properties
      const searchResults = await this.searchProperties(searchCriteria);
      
      if (!searchResults || !Array.isArray(searchResults)) {
        console.warn('❌ No search results returned from PropertyList API');
        return [];
      }
      
      // Filter out the main property if it appears in results
      let comparables = searchResults.filter(prop => 
        prop.id !== mainProperty.id && 
        prop.reference !== mainProperty.reference
      );
      
      // Limit results
      comparables = comparables.slice(0, maxResults);
      
      console.log(`✅ Found ${comparables.length} comparable properties`);
      return comparables;
      
    } catch (error) {
      console.error('❌ Error finding comparables:', error.message);
      return [];
    }
  }
  
  /**
   * Get detailed information for multiple properties (batch)
   */
  async getMultiplePropertyDetails(propertyIds, language = 'en') {
    console.log(`📦 Fetching details for ${propertyIds.length} properties`);
    
    const results = [];
    const errors = [];
    
    // Process properties with concurrency control
    const promises = propertyIds.map(async (id, index) => {
      try {
        // Add small delay to spread requests
        await this.sleep(index * 100);
        
        const details = await this.getPropertyDetails(id, language);
        if (details) {
          results.push(details);
        } else {
          errors.push({ id, error: 'Not found' });
        }
      } catch (error) {
        console.error(`❌ Failed to fetch property ${id}:`, error.message);
        errors.push({ id, error: error.message });
      }
    });
    
    await Promise.all(promises);
    
    console.log(`✅ Successfully fetched ${results.length}/${propertyIds.length} property details`);
    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} properties failed to fetch`);
    }
    
    return { results, errors };
  }
  
  /**
   * Extract search criteria from a property for finding comparables
   */
  extractSearchCriteria(property) {
    const criteria = {
      page_size: 12,
      sort: 'price_low_high'
    };
    
    // Property type
    if (property.property_type) {
      criteria.property_types = property.property_type;
    }
    
    // Search type (for-sale vs rental)
    if (property.sale_price || property.for_sale_price) {
      criteria.search_type = 'for-sale';
    } else if (property.monthly_price || property.rent_price) {
      criteria.search_type = 'long-term';
    }
    
    // Location - prefer city_id if available
    if (property.city_id) {
      criteria.locations = property.city_id;
    } else if (property.city) {
      // Note: In real implementation, you'd need to resolve city name to city_id
      // For now, we'll use a fuzzy approach
      console.warn(`⚠️ Using city name instead of city_id: ${property.city}`);
    }
    
    // Bedrooms range
    if (property.bedrooms) {
      criteria.bedrooms_min = Math.max(1, property.bedrooms - 1);
      criteria.bedrooms_max = property.bedrooms + 1;
    }
    
    // Price range (±30%)
    const price = property.sale_price || property.for_sale_price || property.monthly_price || property.rent_price;
    if (price) {
      criteria.price_min = Math.round(price * 0.7);
      criteria.price_max = Math.round(price * 1.3);
    }
    
    console.log(`🎯 Search criteria:`, criteria);
    return criteria;
  }
  
  /**
   * Log rate limit headers for monitoring
   */
  logRateLimitHeaders(headers) {
    const remaining = headers['x-ratelimit-remaining'];
    const limit = headers['x-ratelimit-limit'];
    const reset = headers['x-ratelimit-reset'];
    
    if (remaining !== undefined) {
      console.log(`🚦 Rate limit: ${remaining}/${limit} remaining, reset at ${reset}`);
      
      // Warn if getting close to limit
      if (parseInt(remaining) < 5) {
        console.warn(`⚠️ Rate limit warning: Only ${remaining} requests remaining`);
      }
    }
  }
  
  /**
   * Update response time metrics
   */
  updateResponseTimeMetrics(responseTime) {
    // Simple moving average calculation
    const totalRequests = this.metrics.successfulRequests;
    this.metrics.averageResponseTime = 
      ((this.metrics.averageResponseTime * (totalRequests - 1)) + responseTime) / totalRequests;
  }
  
  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      rateLimitStatus: {
        global: this.globalLimiter.reservoir,
        listings: this.listingsLimiter.reservoir,
        details: this.detailsLimiter.reservoir
      },
      circuitBreakerStatus: {
        state: this.apiBreaker.stats.state,
        failures: this.apiBreaker.stats.failures,
        successes: this.apiBreaker.stats.successes
      }
    };
  }
  
  /**
   * Test API connectivity
   */
  async testConnection() {
    try {
      console.log('🔧 Testing PropertyList API connection...');
      
      // Test with a simple search
      const response = await this.searchProperties({ page_size: 1 });
      
      if (response) {
        console.log('✅ PropertyList API connection successful');
        return { success: true, message: 'API connection successful' };
      } else {
        console.error('❌ PropertyList API connection failed - no response');
        return { success: false, message: 'No response from API' };
      }
      
    } catch (error) {
      console.error('❌ PropertyList API connection test failed:', error.message);
      return { success: false, message: error.message };
    }
  }
  
  /**
   * Utility: Sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitHits: 0,
      circuitBreakerActivations: 0,
      averageResponseTime: 0,
      lastReset: new Date()
    };
    console.log('📊 PropertyList API metrics reset');
  }
}

module.exports = PropertyListApiService; 