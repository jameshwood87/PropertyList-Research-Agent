const LocationIntelligenceService = require('./locationIntelligenceService');
const SmartLocationGroupingService = require('./smartLocationGroupingService');
const GeocodingCacheService = require('./geocodingCacheService');
const IntelligentCoordinateService = require('./intelligentCoordinateService');

class BatchGeocodingService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    this.locationService = new LocationIntelligenceService(propertyDatabase);
    this.groupingService = new SmartLocationGroupingService(propertyDatabase);
    this.cacheService = new GeocodingCacheService(propertyDatabase);
    this.intelligentCoordinates = new IntelligentCoordinateService(propertyDatabase);
    
    this.stats = {
      total: 0,
      totalGroups: 0,
      processed: 0,
      geocoded: 0,
      failed: 0,
      cached: 0,
      groupsProcessed: 0,
      propertiesUpdated: 0,
      startTime: null,
      endTime: null
    };
    
    // Confidence thresholds
    this.confidenceThresholds = {
      excellent: 0.95,    // ROOFTOP precision
      good: 0.85,         // RANGE_INTERPOLATED
      acceptable: 0.75,   // GEOMETRIC_CENTER
      minimum: 0.65       // APPROXIMATE (review needed)
    };
  }

  /**
   * Smart batch geocoding using location groups for maximum efficiency
   */
  async geocodeAllProperties(options = {}) {
    const { 
      batchSize = 20, 
      delayMs = 1000, 
      maxGroups = null,
      dryRun = false,
      useSmartGrouping = true
    } = options;

    console.log('🌍 STARTING SMART BATCH GEOCODING');
    console.log('=================================');
    console.log(`Mode: ${useSmartGrouping ? 'Smart Grouping' : 'Individual Properties'}`);
    console.log(`Batch size: ${batchSize} ${useSmartGrouping ? 'groups' : 'properties'}`);
    console.log(`Delay between batches: ${delayMs}ms`);
    console.log(`Dry run: ${dryRun ? 'Yes' : 'No'}`);
    console.log('');

    this.stats.startTime = Date.now();

    try {
      if (useSmartGrouping) {
        return await this.geocodeUsingSmartGroups(options);
      } else {
        return await this.geocodeIndividually(options);
      }
    } catch (error) {
      console.error('❌ Smart batch geocoding failed:', error);
      throw error;
    }
  }

  /**
   * Geocode using smart location groups (recommended approach)
   */
  async geocodeUsingSmartGroups(options = {}) {
    const { batchSize = 20, delayMs = 1000, maxGroups = null, dryRun = false } = options;

    console.log('🧠 Creating smart location groups...');
    const groupingResult = await this.groupingService.createLocationGroups();
    const geocodingQueue = await this.groupingService.getGeocodingQueue(groupingResult.groups);
    
    // Warm cache from database (existing coordinates)
    await this.cacheService.warmCacheFromDatabase();
    
    // Analyze cache effectiveness before processing
    await this.cacheService.preloadForSession(geocodingQueue);
    
    // Filter to groups that need geocoding (no coordinates yet)
    const groupsToGeocode = geocodingQueue.filter(group => 
      !group.representative.latitude || !group.representative.longitude
    );

    const totalGroups = maxGroups ? Math.min(groupsToGeocode.length, maxGroups) : groupsToGeocode.length;
    const processGroups = groupsToGeocode.slice(0, totalGroups);
    
    this.stats.totalGroups = totalGroups;
    this.stats.total = processGroups.reduce((sum, group) => sum + group.propertyCount, 0);
    
    console.log(`📊 Smart grouping analysis:`);
    console.log(`  Total groups to geocode: ${totalGroups}`);
    console.log(`  Total properties affected: ${this.stats.total}`);
    console.log(`  Cost savings: ${groupingResult.analysis.costReduction.percentage}%`);
    console.log(`  Largest group: ${groupingResult.analysis.groupDistribution.largestGroup} properties`);
    console.log('');

    if (totalGroups === 0) {
      console.log('✅ All location groups already have coordinates!');
      return this.stats;
    }

    // Process groups in batches
    for (let i = 0; i < processGroups.length; i += batchSize) {
      const batch = processGroups.slice(i, i + batchSize);
      console.log(`\n🔄 Processing group batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(processGroups.length/batchSize)} (${batch.length} groups)`);
      
      await this.processGroupBatch(batch, dryRun);
      
      // Progress update
      const progress = Math.round((this.stats.groupsProcessed / totalGroups) * 100);
      console.log(`📈 Progress: ${this.stats.groupsProcessed}/${totalGroups} groups (${progress}%) - Properties updated: ${this.stats.propertiesUpdated}`);
      
      // Delay between batches
      if (i + batchSize < processGroups.length && delayMs > 0) {
        console.log(`⏳ Waiting ${delayMs}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    this.stats.endTime = Date.now();
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    
    console.log('\n🎉 SMART GEOCODING COMPLETE');
    console.log('===========================');
    console.log(`Groups processed: ${this.stats.groupsProcessed}`);
    console.log(`Properties updated: ${this.stats.propertiesUpdated}`);
    console.log(`Cache hits: ${this.stats.cached}`);
    console.log(`Successful geocodes: ${this.stats.geocoded}`);
    console.log(`Failed geocodes: ${this.stats.failed}`);
    console.log(`Duration: ${duration.toFixed(1)} seconds`);
    console.log(`Efficiency: ${(this.stats.propertiesUpdated / duration).toFixed(1)} properties/second`);
    
    // Enhanced cache statistics
    const cacheStats = this.cacheService.getStats();
    console.log('\n📊 CACHE PERFORMANCE');
    console.log('===================');
    console.log(`Cache entries: ${cacheStats.totalEntries}`);
    console.log(`Hit rate: ${cacheStats.hitRate}`);
    console.log(`Warmed entries: ${cacheStats.warmedEntries}`);

    return { ...this.stats, cacheStats };
  }

  /**
   * Process a batch of location groups
   */
  async processGroupBatch(groups, dryRun = false) {
    const promises = groups.map(group => this.geocodeLocationGroup(group, dryRun));
    await Promise.allSettled(promises);
  }

  /**
   * Geocode a single location group and update all properties in the group
   */
  async geocodeLocationGroup(group, dryRun = false) {
    try {
      this.stats.groupsProcessed++;

      const cacheKey = `group:${group.groupKey}`;
      let geocodeResult = this.cacheService.get(cacheKey);

      if (geocodeResult) {
        console.log(`⚡ ${group.groupKey}: Cache hit for ${group.propertyCount} properties`);
        this.stats.cached++;
      } else {
        console.log(`🗺️ ${group.groupKey}: Geocoding "${group.locationQuery}" (${group.propertyCount} properties)`);
        
        // Geocode the representative location
        geocodeResult = await this.directGeocode(group.locationQuery);
        
        // Cache the result with enhanced metadata
        if (geocodeResult.coordinates) {
          geocodeResult.cached_at = new Date().toISOString();
          geocodeResult.group_size = group.propertyCount;
          this.cacheService.set(cacheKey, geocodeResult);
        }
      }

      // ENHANCED: Use intelligent coordinate validation
      const shouldSaveDecision = await this.intelligentCoordinates.shouldSaveCoordinates(
        group.representative, 
        geocodeResult
      );
      
      if (shouldSaveDecision.shouldSave) {
        const confidenceLevel = this.getConfidenceLevel(geocodeResult.confidence);
        console.log(`✅ ${group.groupKey}: INTELLIGENT APPROVAL - ${shouldSaveDecision.reason}`);
        
        if (!dryRun) {
          // Update all properties in the group with the same coordinates
          const updatedCount = await this.bulkUpdateGroupCoordinatesIntelligent(
            group.propertyIds,
            geocodeResult.coordinates.lat,
            geocodeResult.coordinates.lng,
            geocodeResult,
            shouldSaveDecision
          );
          
          this.stats.propertiesUpdated += updatedCount;
        } else {
          this.stats.propertiesUpdated += group.propertyCount; // Simulated count for dry run
        }
        
        this.stats.geocoded++;
      } else {
        console.log(`❌ ${group.groupKey}: INTELLIGENT REJECTION - ${shouldSaveDecision.reason}`);
        this.stats.failed++;
      }

    } catch (error) {
      console.log(`❌ ${group.groupKey}: Error - ${error.message}`);
      this.stats.failed++;
    }
  }

  /**
   * Get human-readable confidence level
   */
  getConfidenceLevel(confidence) {
    if (confidence >= this.confidenceThresholds.excellent) return 'Excellent';
    if (confidence >= this.confidenceThresholds.good) return 'Good';
    if (confidence >= this.confidenceThresholds.acceptable) return 'Acceptable';
    return 'Minimum';
  }

  /**
   * Bulk update coordinates for all properties in a group with intelligent validation (transactional)
   */
  async bulkUpdateGroupCoordinatesIntelligent(propertyIds, latitude, longitude, geocodeResult, intelligentDecision) {
    const client = await this.propertyDb.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update coordinates for all properties in the group
      const updateQuery = `
        UPDATE properties 
        SET 
          latitude = $1,
          longitude = $2,
          geom = ST_SetSRID(ST_Point($2, $1), 4326),
          updated_timestamp = NOW()
        WHERE id = ANY($3)
          AND is_active = true
      `;
      
      const result = await client.query(updateQuery, [latitude, longitude, propertyIds]);
      
      // Store intelligent geocoding metadata
      const metadataQuery = `
        UPDATE properties 
        SET raw_data = COALESCE(raw_data, '{}'::jsonb) || $1::jsonb
        WHERE id = ANY($2)
      `;
      
      const intelligentMetadata = {
        intelligent_geocoding: {
          geocoded_at: new Date().toISOString(),
          geocoding_method: geocodeResult.method,
          geocoding_confidence: geocodeResult.confidence,
          quality_level: intelligentDecision.quality,
          validation_reason: intelligentDecision.reason,
          geocoding_source: 'intelligent_batch_geocoding',
          geocoding_address: geocodeResult.address,
          group_geocoding: true,
          meets_quality_standards: true,
          ai_confidence_threshold: 0.80
        }
      };
      
      await client.query(metadataQuery, [JSON.stringify(intelligentMetadata), propertyIds]);
      
      await client.query('COMMIT');
      
      console.log(`📍 INTELLIGENT coordinates updated for ${result.rowCount} properties (Quality: ${intelligentDecision.quality})`);
      return result.rowCount;
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error bulk updating intelligent coordinates:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Legacy bulk update coordinates for all properties in a group (transactional) - kept for compatibility
   */
  async bulkUpdateGroupCoordinates(propertyIds, latitude, longitude, geocodeResult) {
    const client = await this.propertyDb.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update coordinates for all properties in the group
      const updateQuery = `
        UPDATE properties 
        SET 
          latitude = $1,
          longitude = $2,
          geom = ST_SetSRID(ST_Point($2, $1), 4326),
          updated_timestamp = NOW()
        WHERE id = ANY($3)
          AND is_active = true
      `;
      
      const result = await client.query(updateQuery, [latitude, longitude, propertyIds]);
      
      // Optionally store geocoding metadata
      if (geocodeResult.method) {
        const metadataQuery = `
          UPDATE properties 
          SET raw_data = COALESCE(raw_data, '{}'::jsonb) || $1::jsonb
          WHERE id = ANY($2)
        `;
        
        const geocodingMetadata = {
          geocoded_at: new Date().toISOString(),
          geocoding_method: geocodeResult.method,
          geocoding_confidence: geocodeResult.confidence,
          geocoding_source: 'smart_batch_geocoding',
          geocoding_address: geocodeResult.address,
          group_geocoding: true
        };
        
        await client.query(metadataQuery, [JSON.stringify(geocodingMetadata), propertyIds]);
      }
      
      await client.query('COMMIT');
      
      console.log(`📍 Updated ${result.rowCount} properties with coordinates`);
      return result.rowCount;
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error bulk updating coordinates:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Legacy method: Process a batch of individual properties
   */
  async processBatch(properties, dryRun = false) {
    const promises = properties.map(property => this.geocodeProperty(property, dryRun));
    await Promise.allSettled(promises);
  }

  /**
   * Fallback method: Geocode individual properties (legacy approach)
   */
  async geocodeIndividually(options = {}) {
    const { batchSize = 50, delayMs = 1000, maxProperties = null, dryRun = false } = options;

    console.log('📍 Using individual property geocoding (fallback mode)...');
    
    // Get properties without coordinates
    const query = `
      SELECT id, reference, city, suburb, urbanization, address, descriptions
      FROM properties 
      WHERE is_active = true 
        AND (latitude IS NULL OR longitude IS NULL)
        AND city IS NOT NULL
      ${maxProperties ? `LIMIT ${maxProperties}` : ''}
    `;

    const result = await this.propertyDb.pool.query(query);
    const properties = result.rows;
    
    this.stats.total = properties.length;
    console.log(`📊 Found ${this.stats.total} properties to geocode individually`);
    
    if (this.stats.total === 0) {
      console.log('✅ All properties already have coordinates!');
      return this.stats;
    }

    // Process in batches
    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);
      console.log(`\n🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(properties.length/batchSize)} (${batch.length} properties)`);
      
      await this.processBatch(batch, dryRun);
      
      // Progress update
      const progress = Math.round((this.stats.processed / this.stats.total) * 100);
      console.log(`📈 Progress: ${this.stats.processed}/${this.stats.total} (${progress}%) - Geocoded: ${this.stats.geocoded}, Failed: ${this.stats.failed}`);
      
      // Delay between batches to avoid rate limiting
      if (i + batchSize < properties.length && delayMs > 0) {
        console.log(`⏳ Waiting ${delayMs}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    this.stats.endTime = Date.now();
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    
    console.log('\n🎉 INDIVIDUAL GEOCODING COMPLETE');
    console.log('================================');
    console.log(`Total processed: ${this.stats.processed}`);
    console.log(`Successfully geocoded: ${this.stats.geocoded}`);
    console.log(`Failed: ${this.stats.failed}`);
    console.log(`Duration: ${duration.toFixed(1)} seconds`);
    console.log(`Rate: ${(this.stats.processed / duration).toFixed(1)} properties/second`);

    return this.stats;
  }

  /**
   * Geocode a single property
   */
  async geocodeProperty(property, dryRun = false) {
    try {
      this.stats.processed++;

      // Build location input from available data
      const locationInputs = [
        property.urbanization,
        property.suburb, 
        property.address,
        property.city
      ].filter(Boolean);

      if (locationInputs.length === 0) {
        console.log(`⚠️  ${property.reference}: No location data available`);
        this.stats.failed++;
        return;
      }

      // OPTIMIZED: Use direct Google Maps geocoding for properties with good location data
      // Only use AI for properties with minimal data (just city)
      const hasSpecificLocation = property.urbanization || property.suburb || property.address;
      
      let locationResult;
      
      if (hasSpecificLocation) {
        // Direct Google Maps geocoding (cheap and fast)
        const locationQuery = locationInputs.join(', ');
        console.log(`🗺️  ${property.reference}: Direct geocoding "${locationQuery}"`);
        
        locationResult = await this.directGeocode(locationQuery);
      } else {
        // AI-enhanced geocoding for properties with only city data
        const locationInput = locationInputs[0];
        console.log(`🤖 ${property.reference}: AI geocoding "${locationInput}"`);
        
        locationResult = await this.locationService.resolveLocationWithLogging(
          locationInput,
          {
            city: property.city,
            propertyData: property,
            batchMode: true
          }
        );
      }

      // ENHANCED: Use intelligent coordinate validation for individual properties
      if (locationResult.coordinates) {
        const shouldSaveDecision = await this.intelligentCoordinates.shouldSaveCoordinates(
          property, 
          locationResult
        );
        
        if (shouldSaveDecision.shouldSave) {
          console.log(`✅ ${property.reference}: INTELLIGENT APPROVAL - ${shouldSaveDecision.reason}`);
          
          if (!dryRun) {
            // Use intelligent coordinate saving
            await this.intelligentCoordinates.saveIntelligentCoordinates(
              property,
              locationResult,
              shouldSaveDecision
            );
          }
          
          this.stats.geocoded++;
        } else {
          console.log(`❌ ${property.reference}: INTELLIGENT REJECTION - ${shouldSaveDecision.reason}`);
          this.stats.failed++;
        }
      } else {
        console.log(`❌ ${property.reference}: No coordinates found`);
        this.stats.failed++;
      }

    } catch (error) {
      console.log(`❌ ${property.reference}: Error - ${error.message}`);
      this.stats.failed++;
    }
  }

  /**
   * Direct OpenCage geocoding with free tier compliance (silent operation)
   */
  async directGeocode(locationQuery) {
    const startTime = Date.now();
    
    try {
      // Check daily quota before making request (silent check)
      const dailyCount = await this.getDailyRequestCount();
      if (dailyCount >= 2500) {
        // Silent fallback to Google Maps when quota exceeded
        return await this.fallbackToGoogleMaps(locationQuery);
      }

      // Import axios here to avoid circular dependencies
      const axios = require('axios');
      const OPENCAGE_API_KEY = process.env.OPENCAGE_API_KEY;
      
      if (!OPENCAGE_API_KEY) {
        // Silent fallback when no OpenCage key
        return await this.fallbackToGoogleMaps(locationQuery);
      }

      // Rate limiting: 1 request per second for free tier (silent)
      await this.enforceRateLimit();

      const response = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
        params: {
          q: locationQuery,
          key: OPENCAGE_API_KEY,
          limit: 1,
          countrycode: 'es', // Spain only for our use case
          language: 'en'
        },
        timeout: 10000
      });

      // Increment daily counter (silent)
      await this.incrementDailyRequestCount();
      
      const responseTime = Date.now() - startTime;

      if (response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0];
        const confidence = (result.confidence || 50) / 100;
        
        // Log successful request for AI learning (silent)
        await this.logRequestForAI(locationQuery, true, responseTime, confidence, 'opencage');
        
        return {
          coordinates: {
            lat: result.geometry.lat,
            lng: result.geometry.lng
          },
          confidence: confidence,
          method: 'opencage_direct',
          address: result.formatted,
          components: result.components
        };
      } else {
        // Log failed request and try Google Maps fallback
        await this.logRequestForAI(locationQuery, false, responseTime, 0, 'opencage', 'no_results');
        return await this.fallbackToGoogleMaps(locationQuery);
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      let errorType = 'unknown_error';
      
      if (error.response?.status === 402) {
        errorType = 'quota_exceeded';
        // Silent fallback when quota exceeded
        await this.logRequestForAI(locationQuery, false, responseTime, 0, 'opencage', errorType);
        return await this.fallbackToGoogleMaps(locationQuery);
      }
      if (error.response?.status === 401) {
        errorType = 'invalid_key';
        // Silent fallback when invalid key
        await this.logRequestForAI(locationQuery, false, responseTime, 0, 'opencage', errorType);
        return await this.fallbackToGoogleMaps(locationQuery);
      }
      
      // Log failed request for AI learning (silent)
      await this.logRequestForAI(locationQuery, false, responseTime, 0, 'opencage', errorType);
      
      // Silent fallback for any other errors
      return await this.fallbackToGoogleMaps(locationQuery);
    }
  }

  /**
   * Silent fallback to Google Maps geocoding
   */
  async fallbackToGoogleMaps(locationQuery) {
    try {
      const axios = require('axios');
      const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
      
      if (!GOOGLE_MAPS_API_KEY) {
        // Return null coordinates if no fallback available
        return {
          coordinates: null,
          confidence: 0,
          method: 'no_geocoding_available',
          error: 'No geocoding service available'
        };
      }

      const startTime = Date.now();
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: locationQuery,
          key: GOOGLE_MAPS_API_KEY,
          region: 'es' // Spain region bias
        },
        timeout: 10000
      });

      const responseTime = Date.now() - startTime;

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        const location = result.geometry.location;
        
        // Log successful fallback request
        await this.logRequestForAI(locationQuery, true, responseTime, 0.9, 'fallback_google');
        
        return {
          coordinates: {
            lat: location.lat,
            lng: location.lng
          },
          confidence: 0.9, // High confidence for Google Maps
          method: 'google_maps_fallback',
          address: result.formatted_address
        };
      } else {
        // Log failed fallback
        await this.logRequestForAI(locationQuery, false, responseTime, 0, 'fallback_google', response.data.status);
        
        return {
          coordinates: null,
          confidence: 0,
          method: 'google_maps_fallback',
          error: response.data.status
        };
      }
      
    } catch (error) {
      // Silent error handling
      return {
        coordinates: null,
        confidence: 0,
        method: 'fallback_failed',
        error: error.message
      };
    }
  }

  /**
   * Silent rate limiting enforcement
   */
  async enforceRateLimit() {
    if (!this.lastRequestTime) {
      this.lastRequestTime = 0;
    }
    
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1100; // 1.1 seconds to be safe
    
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      // Silent wait - no console output
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Silent daily quota checking
   */
  async getDailyRequestCount() {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const result = await this.propertyDb.pool.query(
        'SELECT request_count FROM opencage_daily_quota WHERE date = $1',
        [today]
      );
      
      return result.rows.length > 0 ? result.rows[0].request_count : 0;
    } catch (error) {
      // Table might not exist yet, create it silently
      await this.createQuotaTable();
      return 0;
    }
  }

  /**
   * Silent quota increment
   */
  async incrementDailyRequestCount() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await this.propertyDb.pool.query(`
        INSERT INTO opencage_daily_quota (date, request_count) 
        VALUES ($1, 1)
        ON CONFLICT (date) 
        DO UPDATE SET request_count = opencage_daily_quota.request_count + 1
      `, [today]);
      
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Silent quota table creation
   */
  async createQuotaTable() {
    try {
      await this.propertyDb.pool.query(`
        CREATE TABLE IF NOT EXISTS opencage_daily_quota (
          date DATE PRIMARY KEY,
          request_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Log request data for AI learning and optimization (silent)
   */
  async logRequestForAI(queryText, success, responseTimeMs, confidenceScore = null, method = 'opencage', errorType = null) {
    try {
      // Only log if we have database access
      if (!this.propertyDb?.pool) return;
      
      await this.propertyDb.pool.query(`
        INSERT INTO opencage_request_log 
        (query_text, success, response_time_ms, confidence_score, method, error_type, batch_operation, property_count, cache_hit)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        queryText.substring(0, 500), // Truncate long queries
        success, 
        responseTimeMs, 
        confidenceScore, 
        method, 
        errorType, 
        true, // This is batch operation
        1, // Default property count
        false // Not from cache
      ]);

      // Update hourly tracking
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const hour = now.getHours();

      await this.propertyDb.pool.query(`
        INSERT INTO opencage_hourly_usage (date, hour, request_count, success_count, failure_count, avg_response_time_ms)
        VALUES ($1, $2, 1, $3, $4, $5)
        ON CONFLICT (date, hour) 
        DO UPDATE SET 
          request_count = opencage_hourly_usage.request_count + 1,
          success_count = opencage_hourly_usage.success_count + $3,
          failure_count = opencage_hourly_usage.failure_count + $4,
          avg_response_time_ms = (opencage_hourly_usage.avg_response_time_ms + $5) / 2
      `, [date, hour, success ? 1 : 0, success ? 0 : 1, responseTimeMs || 0]);

    } catch (error) {
      // Silent fail - logging is non-critical for geocoding functionality
    }
  }

  /**
   * Update property with coordinates in database
   */
  async updatePropertyCoordinates(propertyId, latitude, longitude, locationResult) {
    try {
      const updateQuery = `
        UPDATE properties 
        SET 
          latitude = $1,
          longitude = $2,
          geom = ST_SetSRID(ST_Point($2, $1), 4326),
          updated_timestamp = NOW()
        WHERE id = $3
      `;

      await this.propertyDb.pool.query(updateQuery, [latitude, longitude, propertyId]);

      // Optionally store geocoding metadata
      if (locationResult.method) {
        const metadataQuery = `
          UPDATE properties 
          SET raw_data = raw_data || $1
          WHERE id = $2
        `;
        
        const geocodingMetadata = {
          geocoded_at: new Date().toISOString(),
          geocoding_method: locationResult.method,
          geocoding_confidence: locationResult.confidence,
          geocoding_source: 'batch_ai_location_intelligence'
        };

        await this.propertyDb.pool.query(metadataQuery, [JSON.stringify(geocodingMetadata), propertyId]);
      }

    } catch (error) {
      console.error(`Error updating coordinates for property ${propertyId}:`, error);
      throw error;
    }
  }

  /**
   * Get geocoding statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Check how many properties need geocoding
   */
  async checkGeocodingStatus() {
    try {
      const queries = [
        'SELECT COUNT(*) as total FROM properties WHERE is_active = true',
        'SELECT COUNT(*) as with_coords FROM properties WHERE is_active = true AND latitude IS NOT NULL AND longitude IS NOT NULL',
        'SELECT COUNT(*) as need_geocoding FROM properties WHERE is_active = true AND (latitude IS NULL OR longitude IS NULL) AND city IS NOT NULL'
      ];

      const results = await Promise.all(
        queries.map(query => this.propertyDb.pool.query(query))
      );

      const stats = {
        total: parseInt(results[0].rows[0].total),
        withCoordinates: parseInt(results[1].rows[0].with_coords),
        needGeocoding: parseInt(results[2].rows[0].need_geocoding)
      };

      stats.completionRate = stats.total > 0 ? (stats.withCoordinates / stats.total * 100).toFixed(1) : 0;

      console.log('📊 GEOCODING STATUS');
      console.log('==================');
      console.log(`Total active properties: ${stats.total}`);
      console.log(`With coordinates: ${stats.withCoordinates} (${stats.completionRate}%)`);
      console.log(`Need geocoding: ${stats.needGeocoding}`);

      return stats;

    } catch (error) {
      console.error('Error checking geocoding status:', error);
      throw error;
    }
  }
}

module.exports = BatchGeocodingService; 