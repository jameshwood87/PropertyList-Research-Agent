const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class PostgresDatabase {
  constructor() {
    this.pool = null;
    this.initialized = false;
  }

  /**
   * Initialize PostgreSQL connection and create schema
   */
  async init() {
    try {
      // Create connection pool
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:dev_password_123@localhost:5433/propertylist_db',
        min: parseInt(process.env.DATABASE_POOL_MIN) || 2,
        max: parseInt(process.env.DATABASE_POOL_MAX) || 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      console.log('PostgreSQL connection established successfully');
      
      // Create extensions and schema
      await this.createExtensions(client);
      await this.createSchema(client);
      await this.createIndexes(client);
      
      client.release();
      
      this.initialized = true;
      console.log('PostgreSQL database initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize PostgreSQL database:', error);
      throw error;
    }
  }

  /**
   * Create required PostgreSQL extensions
   */
  async createExtensions(client) {
    console.log('Creating PostgreSQL extensions...');
    
    // PostGIS for geospatial features
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    
    // pg_trgm for fuzzy text search and trigram similarity
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    
    // fuzzystrmatch for Levenshtein distance calculations
    await client.query('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;');
    
    // unaccent for accent-insensitive text matching
    await client.query('CREATE EXTENSION IF NOT EXISTS unaccent;');
    
    // uuid-ossp for UUID generation
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    
    console.log('PostgreSQL extensions created successfully');
  }

  /**
   * Create database schema
   */
  async createSchema(client) {
    console.log('Creating database schema...');
    
    // Main properties table
    const createPropertiesTable = `
      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        reference TEXT,
        created_at TIMESTAMPTZ,
        last_updated_at TIMESTAMPTZ,
        direct BOOLEAN DEFAULT false,
        
        -- Listing type
        is_sale BOOLEAN DEFAULT false,
        is_short_term BOOLEAN DEFAULT false,
        is_long_term BOOLEAN DEFAULT false,
        
        -- Property details
        property_type TEXT,
        province TEXT,
        city TEXT,
        suburb TEXT,
        urbanization TEXT,
        address TEXT,
        
        -- Geospatial data
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        geohash TEXT,
        geom GEOMETRY(Point, 4326),
        
        -- Size and layout (XML field names exactly)
        plot_size DECIMAL(10, 2),             -- XML field: plot_size
        build_size DECIMAL(10, 2),            -- XML field: build_size  
        terrace_size DECIMAL(10, 2),          -- XML field: terrace_size
        -- Note: Only using fields that actually exist in XML data
        bedrooms SMALLINT,
        bathrooms SMALLINT,
        parking_spaces SMALLINT,
        floor_number SMALLINT,
        
        -- Property characteristics
        orientation TEXT,
        condition_rating TEXT,
        year_built SMALLINT,
        energy_rating TEXT,
        
        -- Pricing
        sale_price DECIMAL(12, 2),
        monthly_price DECIMAL(10, 2),
        weekly_price_from DECIMAL(10, 2),
        weekly_price_to DECIMAL(10, 2),
        
        -- JSON fields
        features JSONB,
        feature_ids JSONB,
        descriptions JSONB,
        images JSONB,
        virtual_tour_url TEXT,
        
        -- Metadata
        last_seen TIMESTAMPTZ DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true,
        raw_data JSONB,
        
        -- Timestamps
        created_timestamp TIMESTAMPTZ DEFAULT NOW(),
        updated_timestamp TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    await client.query(createPropertiesTable);

    // Staging table for XML imports
    const createStagingTable = `
      CREATE TABLE IF NOT EXISTS properties_staging (
        LIKE properties INCLUDING ALL
      );
    `;
    
    await client.query(createStagingTable);

    // Analysis history table for AI learning
    const createAnalysisHistoryTable = `
      CREATE TABLE IF NOT EXISTS analysis_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        session_id TEXT NOT NULL,
        property_data JSONB NOT NULL,
        analysis_results JSONB NOT NULL,
        user_feedback JSONB,
        accuracy_score DECIMAL(5, 2),
        market_conditions JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    await client.query(createAnalysisHistoryTable);

    // Market trends table for progressive learning
    const createMarketTrendsTable = `
      CREATE TABLE IF NOT EXISTS market_trends (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        area TEXT NOT NULL,
        property_type TEXT,
        price_trends JSONB,
        demand_patterns JSONB,
        seasonal_factors JSONB,
        confidence_score DECIMAL(5, 2),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    await client.query(createMarketTrendsTable);

    // Algorithm performance tracking
    const createAlgorithmPerformanceTable = `
      CREATE TABLE IF NOT EXISTS algorithm_performance (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        algorithm_type TEXT NOT NULL,
        version TEXT,
        accuracy_metrics JSONB,
        weight_adjustments JSONB,
        performance_score DECIMAL(5, 2),
        test_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    await client.query(createAlgorithmPerformanceTable);
    
    // Location intelligence tables
    const createUrbanizationKnowledgeTable = `
      CREATE TABLE IF NOT EXISTS urbanization_knowledge (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        name_normalized TEXT NOT NULL,
        city TEXT NOT NULL,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        property_count INTEGER DEFAULT 0,
        aliases TEXT[],
        landmarks TEXT[],
        confidence_score DECIMAL(3, 2) DEFAULT 1.0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(name_normalized, city)
      );
    `;
    
    await client.query(createUrbanizationKnowledgeTable);

    const createLocationResolutionLogTable = `
      CREATE TABLE IF NOT EXISTS location_resolution_log (
        id SERIAL PRIMARY KEY,
        input_text TEXT NOT NULL,
        method TEXT NOT NULL,
        confidence DECIMAL(3, 2),
        result JSONB,
        processing_time_ms INTEGER,
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    await client.query(createLocationResolutionLogTable);
    
    console.log('Database schema created successfully');
  }

  /**
   * Create high-performance indexes
   */
  async createIndexes(client) {
    console.log('Creating database indexes...');
    
    const indexes = [
      // CRITICAL: Enhanced geospatial indexes for KNN optimization
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_geom_gist ON properties USING GIST (geom);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_location ON properties (latitude, longitude);',
      
      // CRITICAL: Core filterable column indexes for performance
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_sale_price ON properties (sale_price) WHERE sale_price > 0;',
              'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_build_size ON properties (build_size) WHERE build_size > 0;',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_bedrooms ON properties (bedrooms) WHERE bedrooms > 0;',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_bathrooms ON properties (bathrooms) WHERE bathrooms > 0;',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_sale_date ON properties (last_updated_at);',
      
      // Location text indexes
      'CREATE INDEX IF NOT EXISTS idx_properties_urbanization ON properties (urbanization);',
      'CREATE INDEX IF NOT EXISTS idx_properties_suburb ON properties (suburb);',
      'CREATE INDEX IF NOT EXISTS idx_properties_city ON properties (city);',
      'CREATE INDEX IF NOT EXISTS idx_properties_province ON properties (province);',
      'CREATE INDEX IF NOT EXISTS idx_properties_property_type ON properties (property_type);',
      
      // JSON feature indexes (GIN)
      'CREATE INDEX IF NOT EXISTS idx_properties_features ON properties USING GIN (features);',
      'CREATE INDEX IF NOT EXISTS idx_properties_feature_ids ON properties USING GIN (feature_ids);',
      
      // Fuzzy text search indexes (trigram)
      'CREATE INDEX IF NOT EXISTS idx_properties_address_trgm ON properties USING GIN (address gin_trgm_ops);',
      'CREATE INDEX IF NOT EXISTS idx_properties_urbanization_trgm ON properties USING GIN (urbanization gin_trgm_ops);',
      'CREATE INDEX IF NOT EXISTS idx_properties_suburb_trgm ON properties USING GIN (suburb gin_trgm_ops);',
      'CREATE INDEX IF NOT EXISTS idx_properties_reference ON properties (reference);',
      
      // Status and timestamp indexes
      'CREATE INDEX IF NOT EXISTS idx_properties_active ON properties (is_active);',
      'CREATE INDEX IF NOT EXISTS idx_properties_updated ON properties (last_updated_at);',
      'CREATE INDEX IF NOT EXISTS idx_properties_listing_type ON properties (is_sale, is_short_term, is_long_term);',
      
      // ENHANCED: Composite indexes for common queries with spatial optimization
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_spatial_active ON properties USING GIST (geom) WHERE is_active = true AND sale_price > 0;',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_location_beds ON properties (urbanization, bedrooms, is_active) WHERE sale_price > 0;',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_city_type ON properties (city, property_type, is_active) WHERE sale_price > 0;',
              'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_price_range ON properties (sale_price, build_size, bedrooms) WHERE is_active = true;',
      
      // Analysis history indexes
      'CREATE INDEX IF NOT EXISTS idx_analysis_history_session ON analysis_history (session_id);',
      'CREATE INDEX IF NOT EXISTS idx_analysis_history_created ON analysis_history (created_at);',
      
      // Market trends indexes
      'CREATE INDEX IF NOT EXISTS idx_market_trends_area ON market_trends (area, property_type);',
      'CREATE INDEX IF NOT EXISTS idx_market_trends_updated ON market_trends (updated_at);',
      
      // Location intelligence indexes
      'CREATE INDEX IF NOT EXISTS idx_urbanization_knowledge_normalized ON urbanization_knowledge (name_normalized);',
      'CREATE INDEX IF NOT EXISTS idx_urbanization_knowledge_city ON urbanization_knowledge (city);',
      'CREATE INDEX IF NOT EXISTS idx_urbanization_knowledge_aliases ON urbanization_knowledge USING GIN (aliases);',
      'CREATE INDEX IF NOT EXISTS idx_location_resolution_log_method ON location_resolution_log (method, created_at);',
      'CREATE INDEX IF NOT EXISTS idx_location_resolution_log_success ON location_resolution_log (success, confidence);',
      
      // Algorithm performance indexes
      'CREATE INDEX IF NOT EXISTS idx_algorithm_performance_type ON algorithm_performance (algorithm_type, version);'
    ];

    for (const indexSQL of indexes) {
      try {
        await client.query(indexSQL);
      } catch (error) {
        console.warn('Index creation warning:', error.message);
      }
    }
    
    console.log('Database indexes created successfully');
  }

  /**
   * Find similar properties using optimized PostGIS KNN queries with progressive relaxation
   */
  async findSimilarProperties(criteria) {
    try {
      const {
        latitude,
        longitude,
        radiusKm = 5,
        propertyType,
        bedrooms,
        minPrice,
        maxPrice,
        minArea,
        maxArea,
        features = [],
        urbanization,
        suburb,
        city,
        limit = 12
      } = criteria;

      let results = [];
      let attempt = 1;
      const maxAttempts = 3;
      const targetCount = limit;

      // Progressive relaxation: try with increasing flexibility until we get enough results
      while (results.length < targetCount && attempt <= maxAttempts) {
        const flexibility = 0.2 * attempt; // 20%, 40%, 60% tolerance
        console.log(`🔍 Attempt ${attempt}: Searching with ${Math.round(flexibility * 100)}% flexibility...`);
        console.log(`🔧 Search criteria:`, {
          latitude: criteria.latitude,
          longitude: criteria.longitude,
          propertyType: criteria.propertyType,
          buildArea: criteria.buildArea,
          bedrooms: criteria.bedrooms,
          price: criteria.price,
          limit: targetCount,
          flexibility: flexibility
        });
        
        results = await this.queryWithFlexibility(criteria, flexibility, 200);
        
        console.log(`📊 Attempt ${attempt}: Found ${results.length} properties from database (up to 200 candidates)`);
        
        // Add debugging for empty results
        if (results.length === 0 && attempt === 1) {
          console.log(`⚠️ No properties found on first attempt. Checking database...`);
          try {
            const totalCount = await this.pool.query('SELECT COUNT(*) as total FROM properties');
            console.log(`📊 Total properties in database: ${totalCount.rows[0]?.total || 0}`);
            
            if (criteria.propertyType) {
              const typeCount = await this.pool.query('SELECT COUNT(*) as total FROM properties WHERE property_type = $1', [criteria.propertyType]);
              console.log(`📊 Properties of type '${criteria.propertyType}': ${typeCount.rows[0]?.total || 0}`);
            }
          } catch (dbError) {
            console.error(`❌ Database check failed:`, dbError.message);
          }
        }
        
        attempt++;
        
        // If we have enough results, break early
        if (results.length >= targetCount) {
          break;
        }
      }

      // Return the best matches, limited to requested count
      return results.slice(0, limit);
      
    } catch (error) {
      console.error('Error finding similar properties:', error);
      return [];
    }
  }

  /**
   * Enhanced query with flexibility and KNN optimization
   */
  async queryWithFlexibility(criteria, flexibility = 0, limit = 24) {
    const {
      latitude,
      longitude,
      radiusKm = 5,
      propertyType,
      bedrooms,
      price,
      minPrice,
      maxPrice,
      minArea,
      maxArea,
      urbanization,
      suburb,
      city,
      reference,
      // CRITICAL: Listing type filtering
      listingType,
      priceField,
      is_sale,
      is_long_term,
      is_short_term
      } = criteria;

      // ENHANCED: Dynamic price column selection based on listing type
      const priceColumn = priceField || 'sale_price';
      const priceCondition = `${priceColumn} > 0`;

      let query;
      let params;

      // CRITICAL FIX: Check if database actually has properties with coordinates
      // If database has no coordinates, always use location-based search
      const hasCoordinateData = await this.checkIfDatabaseHasCoordinates();
      
      if (latitude && longitude && hasCoordinateData) {
      // HYBRID SEARCH: Coordinate-based with location fallback
      // PRIORITY: Same urbanization/suburb > coordinates > other criteria
        query = `
          SELECT 
            id, reference, address, urbanization, suburb, city,
            latitude, longitude, bedrooms, bathrooms, build_size,
            sale_price, monthly_price, weekly_price_from, weekly_price_to,
            property_type, features, images, is_sale, is_long_term, is_short_term,
            -- Distance calculation: favor exact location matches over coordinates
            CASE 
              WHEN LOWER(COALESCE(urbanization, '')) = LOWER(COALESCE($3, '')) AND urbanization IS NOT NULL AND $3 IS NOT NULL THEN 0.1
              WHEN LOWER(COALESCE(suburb, '')) = LOWER(COALESCE($4, '')) AND suburb IS NOT NULL AND $4 IS NOT NULL THEN 0.5
              WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN
                CASE 
                  WHEN geom IS NOT NULL THEN geom <-> ST_SetSRID(ST_Point($1, $2), 4326)
                  ELSE ST_Distance(
                    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
                    ST_SetSRID(ST_Point($1, $2), 4326)
                  ) / 111000
                END
              ELSE 50 -- Large distance for properties without coordinates or location match
            END AS distance_sort,
            CASE 
              WHEN LOWER(COALESCE(urbanization, '')) = LOWER(COALESCE($3, '')) AND urbanization IS NOT NULL AND $3 IS NOT NULL THEN 100
              WHEN LOWER(COALESCE(suburb, '')) = LOWER(COALESCE($4, '')) AND suburb IS NOT NULL AND $4 IS NOT NULL THEN 500
              WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN
                CASE 
                  WHEN geom IS NOT NULL THEN ST_Distance(geom, ST_SetSRID(ST_Point($1, $2), 4326))
                  ELSE ST_Distance(
                    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
                    ST_SetSRID(ST_Point($1, $2), 4326)
                  )
                END
              ELSE 50000 -- 50km for properties without coordinates or location match
            END AS distance_meters
          FROM properties 
          WHERE is_active = true
            AND ${priceCondition}
            AND build_size > 0
            AND reference != $5
            AND is_sale = $6 AND is_long_term = $7 AND is_short_term = $8
        `;
        
      params = [longitude, latitude, urbanization, suburb, reference, is_sale, is_long_term, is_short_term]; // Note: PostGIS expects longitude first
      let paramIndex = 9;
        
      // Enhanced flexible filters
        if (propertyType) {
          query += ` AND property_type = $${paramIndex}`;
          params.push(propertyType);
          paramIndex++;
        }
        
        if (bedrooms) {
        // ENHANCED: Much more flexible bedroom matching for large properties
        let bedroomRange;
        if (bedrooms <= 3) {
          bedroomRange = Math.max(1, Math.floor(flexibility * 2)); // Small: ±1 bedroom
        } else if (bedrooms <= 6) {
          bedroomRange = Math.max(2, 2 + Math.floor(flexibility * 2)); // Medium: ±2-3 bedrooms  
        } else {
          bedroomRange = Math.max(3, 3 + Math.floor(flexibility * 3)); // Large: ±4-5 bedrooms
        }
        
        const minBedrooms = Math.max(1, bedrooms - bedroomRange);
        const maxBedrooms = bedrooms + bedroomRange;
        query += ` AND bedrooms BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(minBedrooms, maxBedrooms);
        paramIndex += 2;
        }
        
      if (minPrice || maxPrice) {
        // ENHANCED: Much more aggressive price flexibility for real estate markets
        let priceFlexibility;
        if (flexibility >= 0.6) {
          // Final attempt: Very aggressive price range (e.g., for luxury markets)
          priceFlexibility = 3.0; // ±300% range to capture different market segments
        } else if (price && price > 1000000) {
          // Luxury market: ±80% is normal due to quality, condition, views differences
          priceFlexibility = 0.8 + (flexibility * 0.2); // 80%, 90%, 100% tolerance
        } else {
          // Standard market: More price-sensitive but still flexible
          priceFlexibility = 0.5 + (flexibility * 1.0); // 50%, 90%, 150% tolerance  
        }
        const flexibleMin = minPrice ? minPrice * (1 - priceFlexibility) : 0;
        const flexibleMax = maxPrice ? maxPrice * (1 + priceFlexibility) : 999999999;
        
        console.log(`💰 Price flexibility: ${Math.round(priceFlexibility * 100)}% (attempt ${Math.round(flexibility * 5 + 1)})`);
        console.log(`💰 Price range: €${Math.round(flexibleMin).toLocaleString()} - €${Math.round(flexibleMax).toLocaleString()}`);
        
        query += ` AND ${priceColumn} BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(flexibleMin, flexibleMax);
        paramIndex += 2;
        }
        
      if (minArea || maxArea) {
        // FLEXIBLE: Size tolerance with progressive relaxation
        const sizeFlexibility = 0.4 + flexibility; // 40%, 60%, 80% tolerance
        const flexibleMinArea = minArea ? minArea * (1 - sizeFlexibility) : 0;
        const flexibleMaxArea = maxArea ? maxArea * (1 + sizeFlexibility) : 999999;
        query += ` AND build_size BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(flexibleMinArea, flexibleMaxArea);
        paramIndex += 2;
        }
        
      // ENHANCED: Expand search radius progressively with location hierarchy fallback
      const expandedRadius = radiusKm + (flexibility * radiusKm * 2); // 5km → 7km → 9km → 11km
      query += ` AND (
        -- Exact location matches (urbanization/suburb) always included regardless of distance
        (LOWER(COALESCE(urbanization, '')) = LOWER(COALESCE($3, '')) AND urbanization IS NOT NULL AND $3 IS NOT NULL) OR
        (LOWER(COALESCE(suburb, '')) = LOWER(COALESCE($4, '')) AND suburb IS NOT NULL AND $4 IS NOT NULL) OR
        -- Coordinate-based distance filtering for properties with coordinates
        (latitude IS NOT NULL AND longitude IS NOT NULL AND (
          (geom IS NOT NULL AND ST_DWithin(geom, ST_SetSRID(ST_Point($1, $2), 4326), $${paramIndex})) OR
          (geom IS NULL AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
            ST_SetSRID(ST_Point($1, $2), 4326),
            $${paramIndex}
          ))
        ))
      )`;
      params.push(expandedRadius * 1000); // Convert to meters
          paramIndex++;
      
      // CRITICAL: Order by distance (with fallback) for optimal performance
      query += ` ORDER BY distance_sort LIMIT $${paramIndex}`;
        params.push(limit);
        
      } else {
      // Location-based query without coordinates (fallback)
      console.log(`📍 Using location-based search (no coordinates in database or search criteria)`);
        query = `
          SELECT 
            id, reference, address, urbanization, suburb, city,
            latitude, longitude, bedrooms, bathrooms, build_size,
            sale_price, monthly_price, weekly_price_from, weekly_price_to,
            property_type, features, images, is_sale, is_long_term, is_short_term,
          0 as distance_sort,
            0 as distance_meters
          FROM properties 
          WHERE is_active = true
          AND ${priceCondition}
          AND reference != $1
          AND is_sale = $2 AND is_long_term = $3 AND is_short_term = $4
        `;
        
        params = [reference, is_sale, is_long_term, is_short_term];
        let paramIndex = 5;
        
            // Prioritize location matching with flexible criteria (accent-tolerant)
        if (urbanization) {
        query += ` AND (urbanization = $${paramIndex} OR LOWER(UNACCENT(urbanization)) = LOWER(UNACCENT($${paramIndex})))`;
          params.push(urbanization);
          paramIndex++;
        } else if (suburb) {
        // ENHANCED: Precise location matching - no more broad fuzzy matching
        if (suburb.toLowerCase().includes('golden mile') && !suburb.toLowerCase().includes('new')) {
          // Searching for "Golden Mile" (Marbella) - exclude "New Golden Mile"
          query += ` AND (
            (suburb = $${paramIndex} 
            OR LOWER(UNACCENT(suburb)) = LOWER(UNACCENT($${paramIndex}))
            OR LOWER(suburb) = 'marbella golden mile'
            OR suburb = 'Marbella Golden Mile')
            AND LOWER(suburb) NOT LIKE '%new golden mile%'
            AND LOWER(suburb) NOT LIKE '%nuevo golden mile%'
          )`;
        } else if (suburb.toLowerCase().includes('new golden mile')) {
          // Searching for "New Golden Mile" (Estepona) - be specific
          query += ` AND (
            suburb = $${paramIndex} 
            OR LOWER(UNACCENT(suburb)) = LOWER(UNACCENT($${paramIndex}))
            OR LOWER(suburb) LIKE '%new golden mile%'
            OR LOWER(suburb) LIKE '%nuevo golden mile%'
          )`;
        } else {
          // Standard precise matching for other areas - no broad fuzzy matching
          query += ` AND (
            suburb = $${paramIndex} 
            OR LOWER(UNACCENT(suburb)) = LOWER(UNACCENT($${paramIndex}))
          )`;
        }
          params.push(suburb);
          paramIndex++;
        } else if (city) {
        // ENHANCED: Expand city search to include nearby areas in final attempts
        if (flexibility >= 0.4) {
          // High flexibility: include nearby cities
          query += ` AND (
            city = $${paramIndex} 
            OR LOWER(UNACCENT(city)) = LOWER(UNACCENT($${paramIndex}))
            OR (city = 'Benahavis' AND $${paramIndex} = 'Marbella')  -- La Quinta is actually in Benahavis
            OR (city = 'Marbella' AND $${paramIndex} = 'Benahavis')  -- Allow reverse lookup
          )`;
        } else {
          query += ` AND (city = $${paramIndex} OR LOWER(UNACCENT(city)) = LOWER(UNACCENT($${paramIndex})))`;
        }
          params.push(city);
          paramIndex++;
        }
        
      // Apply same flexible filters as coordinate-based search
        if (propertyType) {
          query += ` AND property_type = $${paramIndex}`;
          params.push(propertyType);
          paramIndex++;
        }
        
        if (bedrooms) {
        // ENHANCED: Much more flexible bedroom matching for large properties (same as coordinate-based)
        let bedroomRange;
        if (bedrooms <= 3) {
          bedroomRange = Math.max(1, Math.floor(flexibility * 2)); // Small: ±1 bedroom
        } else if (bedrooms <= 6) {
          bedroomRange = Math.max(2, 2 + Math.floor(flexibility * 2)); // Medium: ±2-3 bedrooms  
        } else {
          bedroomRange = Math.max(3, 3 + Math.floor(flexibility * 3)); // Large: ±4-5 bedrooms
        }
        
        const minBedrooms = Math.max(1, bedrooms - bedroomRange);
        const maxBedrooms = bedrooms + bedroomRange;
        query += ` AND bedrooms BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(minBedrooms, maxBedrooms);
        paramIndex += 2;
        }
        
        // ENHANCED: Add same aggressive price flexibility as coordinate-based query
        if (minPrice || maxPrice) {
        // ENHANCED: Much more aggressive price flexibility for real estate markets
        let priceFlexibility;
        if (flexibility >= 0.6) {
          // Final attempt: Very aggressive price range (e.g., for luxury markets)
          priceFlexibility = 3.0; // ±300% range to capture different market segments
        } else if (price && price > 1000000) {
          // Luxury market: ±80% is normal due to quality, condition, views differences
          priceFlexibility = 0.8 + (flexibility * 0.2); // 80%, 90%, 100% tolerance
        } else {
          // Standard market: More price-sensitive but still flexible
          priceFlexibility = 0.5 + (flexibility * 1.0); // 50%, 90%, 150% tolerance  
        }
        const flexibleMin = minPrice ? minPrice * (1 - priceFlexibility) : 0;
        const flexibleMax = maxPrice ? maxPrice * (1 + priceFlexibility) : 999999999;
        
        console.log(`💰 Price flexibility: ${Math.round(priceFlexibility * 100)}% (attempt ${Math.round(flexibility * 5 + 1)})`);
        console.log(`💰 Price range: €${Math.round(flexibleMin).toLocaleString()} - €${Math.round(flexibleMax).toLocaleString()}`);
        
        query += ` AND ${priceColumn} BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(flexibleMin, flexibleMax);
        paramIndex += 2;
        }
        
        query += ` ORDER BY ${priceColumn} ASC, bedrooms ASC LIMIT $${paramIndex}`;
        params.push(limit);
      }

    console.log(`🔎 Executing KNN-optimized query with ${params.length} parameters`);
      const result = await this.pool.query(query, params);
    
      return result.rows;
  }

  /**
   * Check if database has properties with coordinates
   */
  async checkIfDatabaseHasCoordinates() {
    try {
      const result = await this.pool.query(`
        SELECT COUNT(*) as coord_count 
        FROM properties 
        WHERE latitude IS NOT NULL 
          AND longitude IS NOT NULL 
          AND is_active = true 
        LIMIT 1
      `);
      
      const hasCoords = parseInt(result.rows[0]?.coord_count || 0) > 0;
      if (!hasCoords) {
        console.log(`📍 Database has no properties with coordinates - forcing location-based search`);
      }
      return hasCoords;
    } catch (error) {
      console.error('Error checking coordinate availability:', error);
      return false; // Default to location-based search on error
    }
  }

  /**
   * Batch upsert properties using staging table
   */
  async batchUpsertProperties(properties) {
    if (!properties || properties.length === 0) {
      return { inserted: 0, updated: 0 };
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Clear staging table
      await client.query('TRUNCATE properties_staging');
      
      // Insert into staging table
      let inserted = 0;
      const batchSize = 100;
      
      for (let i = 0; i < properties.length; i += batchSize) {
        const batch = properties.slice(i, i + batchSize);
        const values = [];
        const placeholders = [];
        
        batch.forEach((property, index) => {
                      const baseIndex = index * 42; // Updated: 42 values total (40 regular + 2 for geom)
                      const placeholder = `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15}, $${baseIndex + 16}, $${baseIndex + 17}, $${baseIndex + 18}, $${baseIndex + 19}, $${baseIndex + 20}, $${baseIndex + 21}, $${baseIndex + 22}, $${baseIndex + 23}, $${baseIndex + 24}, $${baseIndex + 25}, $${baseIndex + 26}, $${baseIndex + 27}, $${baseIndex + 28}, $${baseIndex + 29}, $${baseIndex + 30}, $${baseIndex + 31}, $${baseIndex + 32}, $${baseIndex + 33}, $${baseIndex + 34}, $${baseIndex + 35}, $${baseIndex + 36}, $${baseIndex + 37}, $${baseIndex + 38}, $${baseIndex + 39}, $${baseIndex + 40}, ST_SetSRID(ST_MakePoint($${baseIndex + 41}, $${baseIndex + 42}), 4326))`;  
          
          placeholders.push(placeholder);
          
          values.push(
            property.id, property.reference, property.created_at, property.last_updated_at, property.direct,
            property.is_sale, property.is_short_term, property.is_long_term,
            property.property_type, property.province, property.city, property.suburb, property.urbanization, property.address,
            property.latitude, property.longitude, property.geohash,
            property.plot_size, property.build_size, property.terrace_size,
            property.bedrooms, property.bathrooms, property.parking_spaces, property.floor_number,
            property.orientation, property.condition_rating, property.year_built, property.energy_rating,
            property.sale_price, property.monthly_price, property.weekly_price_from, property.weekly_price_to,
            property.features, property.feature_ids, property.descriptions, property.images, property.virtual_tour_url,
            property.last_seen, property.is_active, property.raw_data,
            property.longitude, property.latitude // For ST_MakePoint(longitude, latitude) - geom column values
          );
        });

        const insertQuery = `
          INSERT INTO properties_staging (
            id, reference, created_at, last_updated_at, direct,
            is_sale, is_short_term, is_long_term,
            property_type, province, city, suburb, urbanization, address,
            latitude, longitude, geohash,
            plot_size, build_size, terrace_size,
            bedrooms, bathrooms, parking_spaces, floor_number,
            orientation, condition_rating, year_built, energy_rating,
            sale_price, monthly_price, weekly_price_from, weekly_price_to,
            features, feature_ids, descriptions, images, virtual_tour_url,
            last_seen, is_active, raw_data,
            geom
          ) VALUES ${placeholders.join(', ')}
        `;

        await client.query(insertQuery, values);
        inserted += batch.length;
      }

      // Upsert from staging to main table
      const upsertQuery = `
        INSERT INTO properties SELECT * FROM properties_staging
        ON CONFLICT (id) DO UPDATE SET
          reference = EXCLUDED.reference,
          last_updated_at = EXCLUDED.last_updated_at,
          direct = EXCLUDED.direct,
          is_sale = EXCLUDED.is_sale,
          is_short_term = EXCLUDED.is_short_term,
          is_long_term = EXCLUDED.is_long_term,
          property_type = EXCLUDED.property_type,
          province = EXCLUDED.province,
          city = EXCLUDED.city,
          suburb = EXCLUDED.suburb,
          urbanization = EXCLUDED.urbanization,
          address = EXCLUDED.address,
          geom = EXCLUDED.geom,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          geohash = EXCLUDED.geohash,
          plot_size = EXCLUDED.plot_size,
                  build_size = EXCLUDED.build_size,
        terrace_size = EXCLUDED.terrace_size,
          bedrooms = EXCLUDED.bedrooms,
          bathrooms = EXCLUDED.bathrooms,
          parking_spaces = EXCLUDED.parking_spaces,
          floor_number = EXCLUDED.floor_number,
          orientation = EXCLUDED.orientation,
          condition_rating = EXCLUDED.condition_rating,
          year_built = EXCLUDED.year_built,
          energy_rating = EXCLUDED.energy_rating,
          sale_price = EXCLUDED.sale_price,
          monthly_price = EXCLUDED.monthly_price,
          weekly_price_from = EXCLUDED.weekly_price_from,
          weekly_price_to = EXCLUDED.weekly_price_to,
          features = EXCLUDED.features,
          feature_ids = EXCLUDED.feature_ids,
          descriptions = EXCLUDED.descriptions,
          images = EXCLUDED.images,
          virtual_tour_url = EXCLUDED.virtual_tour_url,
          last_seen = EXCLUDED.last_seen,
          is_active = EXCLUDED.is_active,
          raw_data = EXCLUDED.raw_data,
          updated_timestamp = NOW()
      `;

      const upsertResult = await client.query(upsertQuery);
      
      await client.query('COMMIT');
      
      return {
        inserted: inserted,
        updated: upsertResult.rowCount
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in batch upsert:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get database statistics
   */
  async getFeedStats() {
    try {
      const stats = await this.pool.query(`
        SELECT 
          COUNT(*) as total_properties,
          COUNT(*) FILTER (WHERE is_active = true) as active_properties,
          COUNT(*) FILTER (WHERE geom IS NOT NULL) as properties_with_coordinates,
          COUNT(DISTINCT city) as unique_cities,
          COUNT(DISTINCT urbanization) as unique_urbanizations,
          MAX(last_updated_at) as last_update,
          pg_size_pretty(pg_total_relation_size('properties')) as table_size
        FROM properties
      `);
      
      return {
        totalProperties: parseInt(stats.rows[0].total_properties),
        activeProperties: parseInt(stats.rows[0].active_properties),
        propertiesWithCoordinates: parseInt(stats.rows[0].properties_with_coordinates),
        uniqueCities: parseInt(stats.rows[0].unique_cities),
        uniqueUrbanizations: parseInt(stats.rows[0].unique_urbanizations),
        lastUpdate: stats.rows[0].last_update,
        tableSize: stats.rows[0].table_size
      };
    } catch (error) {
      console.error('Error getting feed stats:', error);
      return {
        totalProperties: 0,
        activeProperties: 0,
        propertiesWithCoordinates: 0,
        uniqueCities: 0,
        uniqueUrbanizations: 0,
        lastUpdate: null,
        tableSize: '0 bytes'
      };
    }
  }

  /**
   * Store analysis history for AI learning
   */
  async storeAnalysisHistory(sessionId, propertyData, analysisResults, userFeedback = null) {
    try {
      const query = `
        INSERT INTO analysis_history (session_id, property_data, analysis_results, user_feedback)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `;
      
      const result = await this.pool.query(query, [
        sessionId,
        JSON.stringify(propertyData),
        JSON.stringify(analysisResults),
        userFeedback ? JSON.stringify(userFeedback) : null
      ]);
      
      return result.rows[0].id;
    } catch (error) {
      console.error('Error storing analysis history:', error);
      throw error;
    }
  }

  /**
   * Get a single property by reference
   */
  async getPropertyByReference(reference) {
    try {
      const query = `
        SELECT * FROM properties 
        WHERE reference = $1 
        AND is_active = true
        LIMIT 1
      `;
      
      const result = await this.pool.query(query, [reference]);
      
      if (result.rows.length === 0) {
        console.log(`❌ Property not found: ${reference}`);
        return null;
      }

      const property = result.rows[0];
      console.log(`✅ Property found: ${reference} (${property.property_type} in ${property.city})`);
      
      return property;
    } catch (error) {
      console.error('❌ Error fetching property by reference:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('PostgreSQL database connection closed');
    }
  }

  /**
   * Generic query method for direct SQL execution
   */
  async query(sql, params = []) {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }
    
    try {
      const result = await this.pool.query(sql, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }
}

module.exports = PostgresDatabase;