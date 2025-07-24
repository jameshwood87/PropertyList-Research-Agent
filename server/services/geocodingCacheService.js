const NodeCache = require('node-cache');
const fs = require('fs').promises;
const path = require('path');

class GeocodingCacheService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    this.cache = new NodeCache({ 
      stdTTL: 86400 * 7, // 7 days for geocoding results
      checkperiod: 3600,  // Check for expired keys every hour
      useClones: false    // Better performance
    });
    
    this.persistentCacheFile = path.join(__dirname, '../data/geocoding-cache.json');
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      warmingCount: 0
    };
    
    // Cache warming patterns - common Spanish real estate locations
    this.warmingPatterns = [
      'Marbella', 'Estepona', 'Benahavis', 'Puerto Banus',
      'Nueva Andalucia', 'San Pedro Alcantara', 'Fuengirola',
      'Mijas', 'Casares', 'Malaga', 'Torremolinos', 'Benalmadena',
      'La Quinta', 'Los Monteros', 'Golden Mile', 'Guadalmina',
      'Sotogrande', 'La Duquesa', 'Manilva', 'Alcaidesa'
    ];
    
    // Initialize cache
    this.init();
  }

  async init() {
    try {
      // Load persistent cache from disk
      await this.loadPersistentCache();
      
      // Set up auto-save
      this.setupAutoSave();
      
      console.log('🎯 Geocoding cache service initialized');
    } catch (error) {
      console.warn('⚠️  Cache initialization warning:', error.message);
    }
  }

  /**
   * Get geocoding result from cache
   */
  get(key) {
    const result = this.cache.get(key);
    if (result) {
      this.stats.hits++;
      return result;
    } else {
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set geocoding result in cache
   */
  set(key, value, ttl = null) {
    this.stats.sets++;
    return this.cache.set(key, value, ttl);
  }

  /**
   * Check if key exists in cache
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Pre-warm cache with common locations from property database
   */
  async warmCacheFromDatabase() {
    console.log('🔥 Warming geocoding cache from property database...');
    
    try {
      // Get top locations by property count that already have coordinates
      const query = `
        SELECT 
          CASE 
            WHEN urbanization IS NOT NULL AND TRIM(urbanization) != '' 
              THEN LOWER(TRIM(regexp_replace(
                CONCAT_WS('||', urbanization, suburb, city),
                '\\s+', ' ', 'g'
              )))
            WHEN suburb IS NOT NULL AND TRIM(suburb) != '' 
              THEN LOWER(TRIM(regexp_replace(
                CONCAT_WS('||', '', suburb, city),
                '\\s+', ' ', 'g'
              )))
            ELSE LOWER(TRIM(city))
          END as location_key,
          CASE 
            WHEN urbanization IS NOT NULL AND TRIM(urbanization) != '' 
              THEN CONCAT_WS(', ', urbanization, suburb, city) || ', Spain'
            WHEN suburb IS NOT NULL AND TRIM(suburb) != ''
              THEN CONCAT_WS(', ', suburb, city) || ', Spain'  
            ELSE city || ', Spain'
          END as location_query,
          AVG(latitude) as avg_lat,
          AVG(longitude) as avg_lng,
          COUNT(*) as property_count
        FROM properties 
        WHERE is_active = true 
          AND latitude IS NOT NULL 
          AND longitude IS NOT NULL
          AND city IS NOT NULL
        GROUP BY location_key, location_query
        HAVING COUNT(*) >= 2  -- Only cache locations with multiple properties
        ORDER BY COUNT(*) DESC
        LIMIT 100
      `;

      const result = await this.propertyDb.pool.query(query);
      const locations = result.rows;

      let warmedCount = 0;
      for (const location of locations) {
        const cacheKey = `group:${location.location_key}`;
        
        // Only cache if not already present
        if (!this.has(cacheKey)) {
          const geocodeResult = {
            coordinates: {
              lat: parseFloat(location.avg_lat),
              lng: parseFloat(location.avg_lng)
            },
            confidence: 0.95, // High confidence for database coordinates
            method: 'database_average',
            address: location.location_query,
            cached_at: new Date().toISOString(),
            property_count: location.property_count
          };
          
          this.set(cacheKey, geocodeResult);
          warmedCount++;
        }
      }

      this.stats.warmingCount = warmedCount;
      console.log(`✅ Cache warmed with ${warmedCount} locations from database`);
      
      return warmedCount;
    } catch (error) {
      console.error('❌ Cache warming error:', error);
      return 0;
    }
  }

  /**
   * Pre-warm cache with common Spanish real estate patterns
   */
  async warmCacheWithCommonPatterns() {
    console.log('🌡️ Pre-warming cache with common Spanish real estate locations...');
    
    const GoogleMapsService = this.getGoogleMapsService();
    if (!GoogleMapsService) {
      console.log('⚠️  Google Maps API not available for pattern warming');
      return 0;
    }

    let warmedCount = 0;
    for (const pattern of this.warmingPatterns) {
      const cacheKey = `pattern:${pattern.toLowerCase()}`;
      
      if (!this.has(cacheKey)) {
        try {
          const query = `${pattern}, Málaga, Spain`;
          const result = await GoogleMapsService.geocode(query);
          
          if (result.coordinates) {
            this.set(cacheKey, {
              ...result,
              cached_at: new Date().toISOString(),
              source: 'pattern_warming'
            });
            warmedCount++;
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.warn(`⚠️  Failed to warm pattern "${pattern}":`, error.message);
        }
      }
    }

    console.log(`✅ Pattern warming complete: ${warmedCount} new entries`);
    return warmedCount;
  }

  /**
   * Get a mock Google Maps service for testing
   */
  getGoogleMapsService() {
    // This would be replaced with actual Google Maps service in production
    return null;
  }

  /**
   * Load persistent cache from disk
   */
  async loadPersistentCache() {
    try {
      // Ensure data directory exists
      await fs.mkdir(path.dirname(this.persistentCacheFile), { recursive: true });
      
      const data = await fs.readFile(this.persistentCacheFile, 'utf8');
      const persistentData = JSON.parse(data);
      
      let loadedCount = 0;
      for (const [key, value] of Object.entries(persistentData)) {
        // Check if cache entry is still valid (not expired)
        if (value.cached_at) {
          const cacheAge = Date.now() - new Date(value.cached_at).getTime();
          const maxAge = 86400 * 7 * 1000; // 7 days in milliseconds
          
          if (cacheAge < maxAge) {
            this.cache.set(key, value);
            loadedCount++;
          }
        }
      }
      
      console.log(`📂 Loaded ${loadedCount} entries from persistent cache`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('⚠️  Failed to load persistent cache:', error.message);
      }
    }
  }

  /**
   * Save cache to disk
   */
  async savePersistentCache() {
    try {
      const cacheData = {};
      for (const key of this.cache.keys()) {
        cacheData[key] = this.cache.get(key);
      }
      
      await fs.writeFile(
        this.persistentCacheFile, 
        JSON.stringify(cacheData, null, 2), 
        'utf8'
      );
      
      console.log(`💾 Saved ${Object.keys(cacheData).length} entries to persistent cache`);
    } catch (error) {
      console.error('❌ Failed to save persistent cache:', error);
    }
  }

  /**
   * Set up automatic cache saving
   */
  setupAutoSave() {
    // Save cache every 10 minutes
    setInterval(() => {
      this.savePersistentCache();
    }, 10 * 60 * 1000);

    // Save on process exit
    process.on('exit', () => {
      try {
        this.savePersistentCache();
      } catch (error) {
        console.error('Failed to save cache on exit:', error);
      }
    });

    process.on('SIGINT', () => {
      console.log('\n💾 Saving cache before exit...');
      this.savePersistentCache().then(() => {
        process.exit(0);
      });
    });
  }

  /**
   * Generate cache statistics
   */
  getStats() {
    const keys = this.cache.keys();
    const hitRate = this.stats.hits + this.stats.misses > 0 ? 
      (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1) : 0;

    return {
      totalEntries: keys.length,
      hitRate: `${hitRate}%`,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      warmedEntries: this.stats.warmingCount,
      cacheKeys: keys.slice(0, 10) // Sample of keys
    };
  }

  /**
   * Clear expired entries manually
   */
  clearExpired() {
    const beforeCount = this.cache.keys().length;
    // NodeCache automatically handles expiration, but we can force a check
    this.cache.del(this.cache.keys().filter(key => this.cache.getTtl(key) < Date.now()));
    const afterCount = this.cache.keys().length;
    
    console.log(`🧹 Cleared ${beforeCount - afterCount} expired cache entries`);
    return beforeCount - afterCount;
  }

  /**
   * Invalidate cache for a specific location
   */
  invalidateLocation(locationKey) {
    const keys = this.cache.keys().filter(key => key.includes(locationKey));
    for (const key of keys) {
      this.cache.del(key);
    }
    
    console.log(`🗑️ Invalidated ${keys.length} cache entries for location: ${locationKey}`);
    return keys.length;
  }

  /**
   * Preload cache for upcoming geocoding session
   */
  async preloadForSession(locationGroups) {
    console.log('🎯 Preloading cache for geocoding session...');
    
    let alreadyCached = 0;
    let needGeocoding = 0;
    
    for (const group of locationGroups) {
      if (this.has(`group:${group.groupKey}`)) {
        alreadyCached++;
      } else {
        needGeocoding++;
      }
    }
    
    console.log(`📊 Cache preload analysis:`);
    console.log(`  Already cached: ${alreadyCached} groups`);
    console.log(`  Need geocoding: ${needGeocoding} groups`);
    console.log(`  Cache hit rate: ${(alreadyCached / locationGroups.length * 100).toFixed(1)}%`);
    
    return {
      alreadyCached,
      needGeocoding,
      hitRate: alreadyCached / locationGroups.length
    };
  }
}

module.exports = GeocodingCacheService; 