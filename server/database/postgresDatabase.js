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
        connectionString: process.env.DATABASE_URL || 'postgres://propertylist:secure_password@localhost:5432/propertylist_db',
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
        
        -- Geospatial data (PostGIS)
        geom GEOMETRY(Point, 4326),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        geohash TEXT,
        
        -- Size and layout
        plot_size DECIMAL(10, 2),
        build_area DECIMAL(10, 2),
        terrace_area DECIMAL(10, 2),
        total_area DECIMAL(10, 2),
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
    
    console.log('Database schema created successfully');
  }

  /**
   * Create high-performance indexes
   */
  async createIndexes(client) {
    console.log('Creating database indexes...');
    
    const indexes = [
      // Geospatial indexes (PostGIS)
      'CREATE INDEX IF NOT EXISTS idx_properties_geom ON properties USING GIST (geom);',
      'CREATE INDEX IF NOT EXISTS idx_properties_location ON properties (latitude, longitude);',
      
      // Location text indexes
      'CREATE INDEX IF NOT EXISTS idx_properties_urbanization ON properties (urbanization);',
      'CREATE INDEX IF NOT EXISTS idx_properties_suburb ON properties (suburb);',
      'CREATE INDEX IF NOT EXISTS idx_properties_city ON properties (city);',
      'CREATE INDEX IF NOT EXISTS idx_properties_province ON properties (province);',
      
      // Property attribute indexes
      'CREATE INDEX IF NOT EXISTS idx_properties_bedrooms ON properties (bedrooms);',
      'CREATE INDEX IF NOT EXISTS idx_properties_bathrooms ON properties (bathrooms);',
      'CREATE INDEX IF NOT EXISTS idx_properties_property_type ON properties (property_type);',
      'CREATE INDEX IF NOT EXISTS idx_properties_price ON properties (sale_price);',
      'CREATE INDEX IF NOT EXISTS idx_properties_build_area ON properties (build_area);',
      
      // JSON feature indexes (GIN)
      'CREATE INDEX IF NOT EXISTS idx_properties_features ON properties USING GIN (features);',
      'CREATE INDEX IF NOT EXISTS idx_properties_feature_ids ON properties USING GIN (feature_ids);',
      
      // Fuzzy text search indexes
      'CREATE INDEX IF NOT EXISTS idx_properties_address_trgm ON properties USING GIN (address gin_trgm_ops);',
      'CREATE INDEX IF NOT EXISTS idx_properties_reference ON properties (reference);',
      
      // Status and timestamp indexes
      'CREATE INDEX IF NOT EXISTS idx_properties_active ON properties (is_active);',
      'CREATE INDEX IF NOT EXISTS idx_properties_updated ON properties (last_updated_at);',
      'CREATE INDEX IF NOT EXISTS idx_properties_listing_type ON properties (is_sale, is_short_term, is_long_term);',
      
      // Composite indexes for common queries
      'CREATE INDEX IF NOT EXISTS idx_properties_location_beds ON properties (urbanization, bedrooms, is_active);',
      'CREATE INDEX IF NOT EXISTS idx_properties_city_type ON properties (city, property_type, is_active);',
      'CREATE INDEX IF NOT EXISTS idx_properties_price_range ON properties (sale_price, build_area, bedrooms);',
      
      // Analysis history indexes
      'CREATE INDEX IF NOT EXISTS idx_analysis_history_session ON analysis_history (session_id);',
      'CREATE INDEX IF NOT EXISTS idx_analysis_history_created ON analysis_history (created_at);',
      
      // Market trends indexes
      'CREATE INDEX IF NOT EXISTS idx_market_trends_area ON market_trends (area, property_type);',
      'CREATE INDEX IF NOT EXISTS idx_market_trends_updated ON market_trends (updated_at);',
      
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
   * Find similar properties using PostGIS spatial queries
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
        limit = 20
      } = criteria;

      let query;
      let params;

      if (latitude && longitude) {
        // Geospatial query using PostGIS
        query = `
          SELECT 
            id, reference, address, urbanization, suburb, city,
            latitude, longitude, bedrooms, bathrooms, build_area,
            sale_price, property_type, features, images,
            ST_Distance(geom, ST_MakePoint($1, $2)::geometry) as distance_meters
          FROM properties 
          WHERE is_active = true
            AND geom IS NOT NULL
            AND ST_DWithin(geom, ST_MakePoint($1, $2)::geometry, $3)
        `;
        
        params = [longitude, latitude, radiusKm * 1000]; // Convert km to meters
        let paramIndex = 4;
        
        // Add filters
        if (propertyType) {
          query += ` AND property_type = $${paramIndex}`;
          params.push(propertyType);
          paramIndex++;
        }
        
        if (bedrooms) {
          query += ` AND bedrooms = $${paramIndex}`;
          params.push(bedrooms);
          paramIndex++;
        }
        
        if (minPrice) {
          query += ` AND sale_price >= $${paramIndex}`;
          params.push(minPrice);
          paramIndex++;
        }
        
        if (maxPrice) {
          query += ` AND sale_price <= $${paramIndex}`;
          params.push(maxPrice);
          paramIndex++;
        }
        
        if (minArea) {
          query += ` AND build_area >= $${paramIndex}`;
          params.push(minArea);
          paramIndex++;
        }
        
        if (maxArea) {
          query += ` AND build_area <= $${paramIndex}`;
          params.push(maxArea);
          paramIndex++;
        }
        
        query += ` ORDER BY distance_meters ASC LIMIT $${paramIndex}`;
        params.push(limit);
        
      } else {
        // Location-based query without coordinates
        query = `
          SELECT 
            id, reference, address, urbanization, suburb, city,
            latitude, longitude, bedrooms, bathrooms, build_area,
            sale_price, property_type, features, images,
            0 as distance_meters
          FROM properties 
          WHERE is_active = true
        `;
        
        params = [];
        let paramIndex = 1;
        
        // Prioritize location matching
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
        
        // Add other filters (same logic as above)
        if (propertyType) {
          query += ` AND property_type = $${paramIndex}`;
          params.push(propertyType);
          paramIndex++;
        }
        
        if (bedrooms) {
          query += ` AND bedrooms = $${paramIndex}`;
          params.push(bedrooms);
          paramIndex++;
        }
        
        query += ` ORDER BY sale_price ASC, bedrooms ASC LIMIT $${paramIndex}`;
        params.push(limit);
      }

      const result = await this.pool.query(query, params);
      return result.rows;
      
    } catch (error) {
      console.error('Error finding similar properties:', error);
      return [];
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
          const baseIndex = index * 35; // Number of columns
          const placeholder = `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14}, ST_SetSRID(ST_MakePoint($${baseIndex + 15}, $${baseIndex + 16}), 4326), $${baseIndex + 17}, $${baseIndex + 18}, $${baseIndex + 19}, $${baseIndex + 20}, $${baseIndex + 21}, $${baseIndex + 22}, $${baseIndex + 23}, $${baseIndex + 24}, $${baseIndex + 25}, $${baseIndex + 26}, $${baseIndex + 27}, $${baseIndex + 28}, $${baseIndex + 29}, $${baseIndex + 30}, $${baseIndex + 31}, $${baseIndex + 32}, $${baseIndex + 33}, $${baseIndex + 34}, $${baseIndex + 35})`;
          
          placeholders.push(placeholder);
          
          values.push(
            property.id, property.reference, property.created_at, property.last_updated_at, property.direct,
            property.is_sale, property.is_short_term, property.is_long_term,
            property.property_type, property.province, property.city, property.suburb, property.urbanization, property.address,
            property.longitude, property.latitude, property.latitude, property.longitude, property.geohash,
            property.plot_size, property.build_area, property.terrace_area, property.total_area,
            property.bedrooms, property.bathrooms, property.parking_spaces, property.floor_number,
            property.orientation, property.condition_rating, property.year_built, property.energy_rating,
            property.sale_price, property.monthly_price, property.weekly_price_from, property.weekly_price_to,
            property.features, property.feature_ids, property.descriptions, property.images, property.virtual_tour_url,
            property.last_seen, property.is_active, property.raw_data
          );
        });

        const insertQuery = `
          INSERT INTO properties_staging (
            id, reference, created_at, last_updated_at, direct,
            is_sale, is_short_term, is_long_term,
            property_type, province, city, suburb, urbanization, address,
            geom, latitude, longitude, geohash,
            plot_size, build_area, terrace_area, total_area,
            bedrooms, bathrooms, parking_spaces, floor_number,
            orientation, condition_rating, year_built, energy_rating,
            sale_price, monthly_price, weekly_price_from, weekly_price_to,
            features, feature_ids, descriptions, images, virtual_tour_url,
            last_seen, is_active, raw_data
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
          build_area = EXCLUDED.build_area,
          terrace_area = EXCLUDED.terrace_area,
          total_area = EXCLUDED.total_area,
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
   * Close database connection
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('PostgreSQL connection pool closed');
    }
  }
}

module.exports = PostgresDatabase; 