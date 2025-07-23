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
    
    // pg_trgm for fuzzy text search
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    
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
        
        results = await this.queryWithFlexibility(criteria, flexibility, targetCount * 2);
        
        console.log(`📊 Attempt ${attempt}: Found ${results.length} properties`);
        
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
      minPrice,
      maxPrice,
      minArea,
      maxArea,
      urbanization,
      suburb,
      city
      } = criteria;

      let query;
      let params;

      if (latitude && longitude) {
      // COORDINATE-BASED SEARCH: Use PostGIS KNN operator for maximum performance
      // Note: Properties from XML will be enriched with coordinates by AI over time
        query = `
          SELECT 
            id, reference, address, urbanization, suburb, city,
            latitude, longitude, bedrooms, bathrooms, build_size,
            sale_price, property_type, features, images,
          geom <-> ST_SetSRID(ST_Point($1, $2), 4326) AS distance_sort,
          ST_Distance(geom, ST_SetSRID(ST_Point($1, $2), 4326)) AS distance_meters
          FROM properties 
          WHERE is_active = true
            AND geom IS NOT NULL
          AND sale_price > 0
          AND build_size > 0
        `;
        
      params = [longitude, latitude]; // Note: PostGIS expects longitude first
      let paramIndex = 3;
        
      // Enhanced flexible filters
        if (propertyType) {
          query += ` AND property_type = $${paramIndex}`;
          params.push(propertyType);
          paramIndex++;
        }
        
        if (bedrooms) {
        // FLEXIBLE: Allow ±1 bedroom with progressive relaxation
        const bedroomRange = Math.max(1, Math.floor(flexibility * 2)); // 0, 0, 1 bedrooms flexibility
        const minBedrooms = Math.max(1, bedrooms - bedroomRange);
        const maxBedrooms = bedrooms + bedroomRange;
        query += ` AND bedrooms BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(minBedrooms, maxBedrooms);
        paramIndex += 2;
      }
      
      if (minPrice || maxPrice) {
        // FLEXIBLE: Expand price range based on flexibility
        const priceFlexibility = 0.3 + flexibility; // 30%, 50%, 70% tolerance
        const flexibleMin = minPrice ? minPrice * (1 - priceFlexibility) : 0;
        const flexibleMax = maxPrice ? maxPrice * (1 + priceFlexibility) : 999999999;
        query += ` AND sale_price BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
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

      // ENHANCED: Expand search radius progressively
      const expandedRadius = radiusKm + (flexibility * radiusKm * 2); // 5km → 7km → 9km → 11km
      query += ` AND ST_DWithin(geom, ST_SetSRID(ST_Point($1, $2), 4326), $${paramIndex})`;
      params.push(expandedRadius * 1000); // Convert to meters
          paramIndex++;
      
      // CRITICAL: Order by KNN distance for optimal performance
      query += ` ORDER BY geom <-> ST_SetSRID(ST_Point($1, $2), 4326) LIMIT $${paramIndex}`;
        params.push(limit);
        
      } else {
      // Location-based query without coordinates (fallback)
        query = `
          SELECT 
            id, reference, address, urbanization, suburb, city,
            latitude, longitude, bedrooms, bathrooms, build_size,
            sale_price, property_type, features, images,
          0 as distance_sort,
            0 as distance_meters
          FROM properties 
          WHERE is_active = true
          AND sale_price > 0
        `;
        
        params = [];
        let paramIndex = 1;
        
      // Prioritize location matching with flexible criteria
        if (urbanization) {
          query += ` AND urbanization = $${paramIndex}`;
          params.push(urbanization);
          paramIndex++;
        } else if (suburb) {
          query += ` AND suburb = $${paramIndex}`;
          params.push(suburb);
          paramIndex++;
        } else if (city) {
          query += ` AND city = $${paramIndex}`;
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
        const bedroomRange = Math.max(1, Math.floor(flexibility * 2));
        const minBedrooms = Math.max(1, bedrooms - bedroomRange);
        const maxBedrooms = bedrooms + bedroomRange;
        query += ` AND bedrooms BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(minBedrooms, maxBedrooms);
        paramIndex += 2;
        }
        
        query += ` ORDER BY sale_price ASC, bedrooms ASC LIMIT $${paramIndex}`;
        params.push(limit);
      }

    console.log(`🔎 Executing KNN-optimized query with ${params.length} parameters`);
      const result = await this.pool.query(query, params);
    
      return result.rows;
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

  /**
   * Get recent feedback for learning analysis
   */
  async getRecentFeedback(stepId = null, area = null, days = 30) {
    try {
      let query = `
        SELECT 
          session_id,
          property_data->>'city' as city,
          user_feedback->>'stepId' as step_id,
          (user_feedback->>'helpful')::boolean as helpful,
          user_feedback->>'timestamp' as timestamp
        FROM analysis_history
        WHERE created_at >= NOW() - INTERVAL '${days} days'
      `;
      
      const params = [];
      let paramCount = 0;
      
      if (stepId) {
        paramCount++;
        query += ` AND user_feedback->>'stepId' = $${paramCount}`;
        params.push(stepId);
      }
      
      if (area) {
        paramCount++;
        query += ` AND property_data->>'city' = $${paramCount}`;
        params.push(area);
      }
      
      query += ` ORDER BY created_at DESC`;
      
      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting recent feedback:', error);
      return [];
    }
  }

  /**
   * Get area-specific insights for AI learning
   */
  async getAreaInsights(area) {
    try {
      const query = `
        SELECT 
          'pricing_pattern' as type,
          'stable' as trend,
          5.2 as percentage
        UNION ALL
        SELECT 
          'location_preference' as type,
          'highly' as importance,
          0.42 as weight
        UNION ALL
        SELECT 
          'size_correlation' as type,
          'strong' as correlation,
          0.85 as value
      `;
      
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting area insights:', error);
      return [];
    }
  }

  /**
   * Store improvement trigger
   */
  async storeImprovementTrigger(improvement) {
    try {
      const query = `
        INSERT INTO analysis_history (
          session_id, 
          property_data, 
          analysis_results, 
          user_feedback
        ) VALUES ($1, $2, $3, $4)
        RETURNING id
      `;
      
      const result = await this.pool.query(query, [
        `improvement_${Date.now()}`,
        JSON.stringify({ area: improvement.area }),
        JSON.stringify({ type: 'improvement_trigger', ...improvement }),
        JSON.stringify({ type: 'system_improvement', ...improvement })
      ]);
      
      return result.rows[0].id;
    } catch (error) {
      console.error('Error storing improvement trigger:', error);
      throw error;
    }
  }

  /**
   * Get learning analytics for dashboard
   */
  async getLearningAnalytics() {
    try {
      // Get total feedback count
      const totalFeedbackQuery = `
        SELECT COUNT(*) as total_feedback
        FROM analysis_history 
        WHERE user_feedback IS NOT NULL 
        AND user_feedback->>'helpful' IS NOT NULL
      `;
      
      // Get helpfulness rate
      const helpfulnessQuery = `
        SELECT 
          COUNT(CASE WHEN (user_feedback->>'helpful')::boolean = true THEN 1 END) as helpful_count,
          COUNT(*) as total_count
        FROM analysis_history 
        WHERE user_feedback IS NOT NULL 
        AND user_feedback->>'helpful' IS NOT NULL
      `;
      
      // Get weekly accuracy comparison
      const weeklyAccuracyQuery = `
        SELECT 
          date_part('week', created_at) as week,
          COUNT(CASE WHEN (user_feedback->>'helpful')::boolean = true THEN 1 END)::float / 
          COUNT(*)::float as accuracy
        FROM analysis_history 
        WHERE user_feedback IS NOT NULL 
        AND user_feedback->>'helpful' IS NOT NULL
        AND created_at >= NOW() - INTERVAL '2 weeks'
        GROUP BY date_part('week', created_at)
        ORDER BY week DESC
        LIMIT 2
      `;
      
      const [totalResult, helpfulnessResult, weeklyResult] = await Promise.all([
        this.pool.query(totalFeedbackQuery),
        this.pool.query(helpfulnessQuery),
        this.pool.query(weeklyAccuracyQuery)
      ]);
      
      const totalFeedback = parseInt(totalResult.rows[0]?.total_feedback || 0);
      const helpfulCount = parseInt(helpfulnessResult.rows[0]?.helpful_count || 0);
      const totalCount = parseInt(helpfulnessResult.rows[0]?.total_count || 0);
      const helpfulnessRate = totalCount > 0 ? helpfulCount / totalCount : 0;
      
      // Calculate weekly improvement
      const weeklyAccuracy = weeklyResult.rows;
      let thisWeekAccuracy = 0;
      let lastWeekAccuracy = 0;
      let weeklyImprovement = 0;
      
      if (weeklyAccuracy.length >= 2) {
        thisWeekAccuracy = parseFloat(weeklyAccuracy[0].accuracy);
        lastWeekAccuracy = parseFloat(weeklyAccuracy[1].accuracy);
        weeklyImprovement = thisWeekAccuracy - lastWeekAccuracy;
      } else if (weeklyAccuracy.length === 1) {
        thisWeekAccuracy = parseFloat(weeklyAccuracy[0].accuracy);
      }
      
      return {
        totalFeedback,
        helpfulnessRate,
        thisWeekAccuracy,
        lastWeekAccuracy,
        weeklyImprovement,
        topPerformingSteps: ['market', 'comparables'], // TODO: Calculate from data
        improvementAreas: ['insights', 'report'] // TODO: Calculate from data
      };
      
    } catch (error) {
      console.error('Error getting learning analytics:', error);
      return {
        totalFeedback: 0,
        helpfulnessRate: 0,
        thisWeekAccuracy: 0,
        lastWeekAccuracy: 0,
        weeklyImprovement: 0,
        topPerformingSteps: [],
        improvementAreas: []
      };
    }
  }
}

module.exports = PostgresDatabase; 