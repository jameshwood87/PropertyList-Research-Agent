const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const RBush = require('rbush');

class PropertyDatabase {
  constructor() {
    this.dbPath = path.join(__dirname, 'properties.db');
    this.db = null;
    this.spatialIndex = new RBush();
    this.initialized = false;
  }

  /**
   * Initialize database and create tables
   */
  async init() {
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Open database connection
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 10000');

      // Create properties table with updated schema
      this.createTables();
      
      // Load spatial index
      this.loadSpatialIndex();
      
      this.initialized = true;
      console.log('Property database initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize property database:', error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  createTables() {
    const createPropertiesTable = `
      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        reference TEXT UNIQUE,
        created_at TEXT,
        last_updated_at TEXT,
        direct BOOLEAN,
        
        -- Listing type
        is_sale BOOLEAN,
        is_short_term BOOLEAN,
        is_long_term BOOLEAN,
        
        -- Property details
        property_type TEXT,
        province TEXT,
        city TEXT,
        suburb TEXT,
        urbanization TEXT,
        address TEXT,
        
        -- Location
        latitude REAL,
        longitude REAL,
        geohash TEXT,
        
        -- Size and layout
        plot_size REAL,
        build_area REAL,
        terrace_area REAL,
        total_area REAL,
        bedrooms INTEGER,
        bathrooms REAL,
        parking_spaces INTEGER,
        floor_number INTEGER,
        
        -- Property characteristics
        orientation TEXT,
        condition_rating TEXT,
        year_built INTEGER,
        energy_rating TEXT,
        
        -- Pricing
        sale_price REAL,
        monthly_price REAL,
        weekly_price_from REAL,
        weekly_price_to REAL,
        
        -- JSON fields
        features TEXT,
        feature_ids TEXT,
        descriptions TEXT,
        images TEXT,
        virtual_tour_url TEXT,
        
        -- Metadata
        last_seen TEXT,
        is_active BOOLEAN DEFAULT 1,
        raw_data TEXT
      )
    `;

    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_properties_reference ON properties(reference)',
      'CREATE INDEX IF NOT EXISTS idx_properties_geohash ON properties(geohash)',
      'CREATE INDEX IF NOT EXISTS idx_properties_location ON properties(latitude, longitude)',
      'CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type)',
      'CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(sale_price)',
      'CREATE INDEX IF NOT EXISTS idx_properties_bedrooms ON properties(bedrooms)',
      'CREATE INDEX IF NOT EXISTS idx_properties_area ON properties(build_area)',
      'CREATE INDEX IF NOT EXISTS idx_properties_active ON properties(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_properties_last_seen ON properties(last_seen)'
    ];

    this.db.exec(createPropertiesTable);
    
    for (const indexSql of createIndexes) {
      this.db.exec(indexSql);
    }
  }

  /**
   * Load spatial index from database
   */
  loadSpatialIndex() {
    console.log('Loading spatial index into memory...');
    
    const stmt = this.db.prepare(`
      SELECT id, latitude, longitude, build_area, sale_price, bedrooms, property_type
      FROM properties 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND is_active = 1
    `);
    
    const properties = stmt.all();
    
    // Clear existing index
    this.spatialIndex.clear();
    
    // Add properties to spatial index
    const items = properties.map(prop => ({
      minX: prop.longitude,
      minY: prop.latitude,
      maxX: prop.longitude,
      maxY: prop.latitude,
      id: prop.id,
      build_area: prop.build_area,
      sale_price: prop.sale_price,
      bedrooms: prop.bedrooms,
      property_type: prop.property_type
    }));
    
    this.spatialIndex.load(items);
    
    console.log(`Spatial index loaded: ${properties.length} properties indexed`);
  }

  /**
   * Batch upsert properties
   */
  batchUpsertProperties(properties) {
    if (!properties || properties.length === 0) {
      return 0;
    }

    const upsertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO properties (
        id, reference, created_at, last_updated_at, direct,
        is_sale, is_short_term, is_long_term,
        property_type, province, city, suburb, urbanization, address,
        latitude, longitude, geohash,
        plot_size, build_area, terrace_area, total_area,
        bedrooms, bathrooms, parking_spaces, floor_number,
        orientation, condition_rating, year_built, energy_rating,
        sale_price, monthly_price, weekly_price_from, weekly_price_to,
        features, feature_ids, descriptions, images, virtual_tour_url,
        last_seen, is_active, raw_data
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    const transaction = this.db.transaction((properties) => {
      let processed = 0;
      
      for (const property of properties) {
        try {
          upsertStmt.run(
            property.id, property.reference, property.created_at, property.last_updated_at, property.direct,
            property.is_sale, property.is_short_term, property.is_long_term,
            property.property_type, property.province, property.city, property.suburb, property.urbanization, property.address,
            property.latitude, property.longitude, property.geohash,
            property.plot_size, property.build_area, property.terrace_area, property.total_area,
            property.bedrooms, property.bathrooms, property.parking_spaces, property.floor_number,
            property.orientation, property.condition_rating, property.year_built, property.energy_rating,
            property.sale_price, property.monthly_price, property.weekly_price_from, property.weekly_price_to,
            property.features, property.feature_ids, property.descriptions, property.images, property.virtual_tour_url,
            property.last_seen, property.is_active, property.raw_data
          );
          processed++;
        } catch (error) {
          console.error('Failed to upsert property:', {
            id: property.id,
            reference: property.reference,
            error: error.message
          });
        }
      }
      
      return processed;
    });

    const result = transaction(properties);
    
    // Reload spatial index after batch update
    this.loadSpatialIndex();
    
    return result;
  }

  /**
   * Find similar properties using spatial and feature matching
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

      // Start with spatial search if coordinates available
      let candidateIds = new Set();
      
      if (latitude && longitude) {
        // Convert radius to degrees (rough approximation)
        const radiusDeg = radiusKm / 111; // 1 degree ≈ 111km
        
        const spatialResults = this.spatialIndex.search({
          minX: longitude - radiusDeg,
          minY: latitude - radiusDeg,
          maxX: longitude + radiusDeg,
          maxY: latitude + radiusDeg
        });
        
        spatialResults.forEach(result => candidateIds.add(result.id));
      }

      // Build SQL query for detailed filtering
      let sql = `
        SELECT *, 
               CASE 
                 WHEN latitude IS NOT NULL AND longitude IS NOT NULL 
                 THEN (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * 
                      cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude))))
                 ELSE 999999 
               END as distance
        FROM properties 
        WHERE is_active = 1
      `;
      
      const params = [latitude || 0, longitude || 0, latitude || 0];

      // Add location-based filters when coordinates are not available
      if (!latitude || !longitude) {
        // Priority hierarchy: urbanization > suburb > city (as per old system)
        if (urbanization) {
          sql += ` AND urbanization = ?`;
          params.push(urbanization);
        } else if (suburb) {
          sql += ` AND suburb = ?`;
          params.push(suburb);
        } else if (city) {
          sql += ` AND city = ?`;
          params.push(city);
        }
      }

      // Add filters
      if (candidateIds.size > 0) {
        const placeholders = Array(candidateIds.size).fill('?').join(',');
        sql += ` AND id IN (${placeholders})`;
        params.push(...Array.from(candidateIds));
      }
      
      if (propertyType) {
        sql += ` AND property_type = ?`;
        params.push(propertyType);
      }
      
      if (bedrooms) {
        sql += ` AND bedrooms BETWEEN ? AND ?`;
        params.push(Math.max(1, bedrooms - 1), bedrooms + 1);
      }
      
      if (minPrice || maxPrice) {
        sql += ` AND sale_price BETWEEN ? AND ?`;
        params.push(minPrice || 0, maxPrice || 999999999);
      }
      
      if (minArea || maxArea) {
        sql += ` AND build_area BETWEEN ? AND ?`;
        params.push(minArea || 0, maxArea || 999999);
      }

      if (latitude && longitude) {
        sql += ` AND distance <= ?`;
        params.push(radiusKm);
      }

      // Order by distance for coordinate-based search, or by price for location-based
      if (latitude && longitude) {
        sql += ` ORDER BY distance ASC, sale_price ASC LIMIT ?`;
      } else {
        sql += ` ORDER BY sale_price ASC, bedrooms ASC LIMIT ?`;
      }
      params.push(limit);

      const stmt = this.db.prepare(sql);
      const results = stmt.all(...params);

      return results;

    } catch (error) {
      console.error('Error finding similar properties:', error);
      return [];
    }
  }

  /**
   * Get feed statistics
   */
  getFeedStats() {
    try {
      const totalStmt = this.db.prepare('SELECT COUNT(*) as total FROM properties WHERE is_active = 1');
      const total = totalStmt.get().total;

      const typeStmt = this.db.prepare(`
        SELECT property_type, COUNT(*) as count 
        FROM properties 
        WHERE is_active = 1 
        GROUP BY property_type 
        ORDER BY count DESC
      `);
      const byType = typeStmt.all();

      const priceStmt = this.db.prepare(`
        SELECT 
          AVG(sale_price) as avg_price,
          MIN(sale_price) as min_price,
          MAX(sale_price) as max_price
        FROM properties 
        WHERE is_active = 1 AND sale_price > 0
      `);
      const priceStats = priceStmt.get();

      return {
        total,
        byType,
        priceStats,
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error getting feed stats:', error);
      return {
        total: 0,
        byType: [],
        priceStats: {},
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = PropertyDatabase; 