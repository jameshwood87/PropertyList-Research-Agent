const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const PostgresDatabase = require('../database/postgresDatabase');
const RedisCache = require('./redisCache');

class MigrationService {
  constructor() {
    this.sqliteDb = null;
    this.postgresDb = new PostgresDatabase();
    this.redisCache = new RedisCache();
    this.migrationState = {
      phase: 'not_started', // not_started, in_progress, completed, failed
      totalRecords: 0,
      migratedRecords: 0,
      errors: [],
      startTime: null,
      endTime: null
    };
  }

  /**
   * Initialize migration service
   */
  async init() {
    try {
      console.log('🔄 Initializing migration service...');
      
      // Initialize PostgreSQL connection
      await this.postgresDb.init();
      
      // Initialize Redis cache (optional)
      await this.redisCache.init();
      
      console.log('✅ Migration service initialized');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize migration service:', error);
      this.migrationState.phase = 'failed';
      this.migrationState.errors.push(error.message);
      return false;
    }
  }

  /**
   * Check if SQLite database exists and has data
   */
  checkSQLiteDatabase() {
    const sqlitePath = process.env.DATABASE_PATH || 'server/database/properties.db';
    
    if (!fs.existsSync(sqlitePath)) {
      console.log('ℹ️  No SQLite database found - starting fresh with PostgreSQL');
      return { exists: false, records: 0 };
    }

    try {
      this.sqliteDb = new Database(sqlitePath, { readonly: true });
      
      const countResult = this.sqliteDb.prepare('SELECT COUNT(*) as count FROM properties').get();
      const recordCount = countResult.count;
      
      console.log(`📊 Found SQLite database with ${recordCount} records`);
      
      return { exists: true, records: recordCount };
      
    } catch (error) {
      console.error('Error checking SQLite database:', error);
      return { exists: false, records: 0, error: error.message };
    }
  }

  /**
   * Perform complete migration from SQLite to PostgreSQL
   */
  async performMigration() {
    console.log('🚀 Starting database migration from SQLite to PostgreSQL...');
    
    this.migrationState.phase = 'in_progress';
    this.migrationState.startTime = new Date();
    this.migrationState.errors = [];

    try {
      // Check SQLite database
      const sqliteCheck = this.checkSQLiteDatabase();
      if (!sqliteCheck.exists) {
        console.log('✅ No migration needed - starting with clean PostgreSQL database');
        this.migrationState.phase = 'completed';
        return { success: true, message: 'No migration needed' };
      }

      this.migrationState.totalRecords = sqliteCheck.records;
      
      // Migrate properties data
      await this.migrateProperties();
      
      // Clear any existing cache
      await this.redisCache.clearPattern('*');
      
      this.migrationState.phase = 'completed';
      this.migrationState.endTime = new Date();
      
      const duration = (this.migrationState.endTime - this.migrationState.startTime) / 1000;
      
      console.log('🎉 Migration completed successfully!');
      console.log(`📊 Migrated ${this.migrationState.migratedRecords} records in ${duration}s`);
      
      return {
        success: true,
        message: 'Migration completed successfully',
        stats: {
          totalRecords: this.migrationState.totalRecords,
          migratedRecords: this.migrationState.migratedRecords,
          duration: `${duration}s`,
          errors: this.migrationState.errors.length
        }
      };
      
    } catch (error) {
      this.migrationState.phase = 'failed';
      this.migrationState.endTime = new Date();
      this.migrationState.errors.push(error.message);
      
      console.error('❌ Migration failed:', error);
      
      return {
        success: false,
        message: 'Migration failed',
        error: error.message,
        stats: this.migrationState
      };
    } finally {
      if (this.sqliteDb) {
        this.sqliteDb.close();
      }
    }
  }

  /**
   * Migrate properties from SQLite to PostgreSQL
   */
  async migrateProperties() {
    console.log('📦 Migrating properties data...');
    
    if (!this.sqliteDb) {
      throw new Error('SQLite database not initialized');
    }

    // Get all properties from SQLite
    const sqliteProperties = this.sqliteDb.prepare('SELECT * FROM properties').all();
    
    if (sqliteProperties.length === 0) {
      console.log('ℹ️  No properties to migrate');
      return;
    }

    console.log(`📊 Found ${sqliteProperties.length} properties to migrate`);
    
    // Transform SQLite data to PostgreSQL format
    const postgresProperties = sqliteProperties.map(prop => this.transformProperty(prop));
    
    // Batch insert into PostgreSQL
    const batchSize = 100;
    let migrated = 0;
    
    for (let i = 0; i < postgresProperties.length; i += batchSize) {
      const batch = postgresProperties.slice(i, i + batchSize);
      
      try {
        const result = await this.postgresDb.batchUpsertProperties(batch);
        migrated += result.inserted + result.updated;
        
        console.log(`✅ Migrated batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(postgresProperties.length/batchSize)} (${migrated}/${postgresProperties.length})`);
        
      } catch (error) {
        console.error(`❌ Error migrating batch starting at ${i}:`, error.message);
        this.migrationState.errors.push(`Batch ${i}: ${error.message}`);
      }
    }
    
    this.migrationState.migratedRecords = migrated;
    console.log(`✅ Migrated ${migrated}/${postgresProperties.length} properties`);
  }

  /**
   * Transform SQLite property to PostgreSQL format
   */
  transformProperty(sqliteProp) {
    try {
      // Parse JSON fields safely
      const parseJSON = (field) => {
        if (!field) return null;
        try {
          return typeof field === 'string' ? JSON.parse(field) : field;
        } catch {
          return null;
        }
      };

      // Create PostgreSQL-compatible property object
      return {
        id: sqliteProp.id || `legacy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        reference: sqliteProp.reference || sqliteProp.id,
        created_at: sqliteProp.created_at || new Date().toISOString(),
        last_updated_at: sqliteProp.last_updated_at || new Date().toISOString(),
        direct: sqliteProp.direct || false,
        
        // Listing type
        is_sale: sqliteProp.is_sale !== undefined ? sqliteProp.is_sale : true,
        is_short_term: sqliteProp.is_short_term || false,
        is_long_term: sqliteProp.is_long_term || false,
        
        // Property details
        property_type: sqliteProp.property_type || sqliteProp.type,
        province: sqliteProp.province,
        city: sqliteProp.city,
        suburb: sqliteProp.suburb,
        urbanization: sqliteProp.urbanization || sqliteProp.urbanisation,
        address: sqliteProp.address,
        
        // Geospatial data
        latitude: sqliteProp.latitude || sqliteProp.lat || null,
        longitude: sqliteProp.longitude || sqliteProp.lng || null,
        geohash: sqliteProp.geohash || null,
        
        // Size and layout
        plot_size: sqliteProp.plot_size || null,
        build_area: sqliteProp.build_area || sqliteProp.build_square_meters || null,
        terrace_area: sqliteProp.terrace_area || null,
        total_area: sqliteProp.total_area || null,
        bedrooms: sqliteProp.bedrooms || null,
        bathrooms: sqliteProp.bathrooms || null,
        parking_spaces: sqliteProp.parking_spaces || null,
        floor_number: sqliteProp.floor_number || null,
        
        // Property characteristics
        orientation: sqliteProp.orientation || null,
        condition_rating: sqliteProp.condition_rating || null,
        year_built: sqliteProp.year_built || null,
        energy_rating: sqliteProp.energy_rating || null,
        
        // Pricing
        sale_price: sqliteProp.sale_price || sqliteProp.price || null,
        monthly_price: sqliteProp.monthly_price || null,
        weekly_price_from: sqliteProp.weekly_price_from || null,
        weekly_price_to: sqliteProp.weekly_price_to || null,
        
        // JSON fields
        features: parseJSON(sqliteProp.features),
        feature_ids: parseJSON(sqliteProp.feature_ids),
        descriptions: parseJSON(sqliteProp.descriptions),
        images: parseJSON(sqliteProp.images),
        virtual_tour_url: sqliteProp.virtual_tour_url || null,
        
        // Metadata
        last_seen: sqliteProp.last_seen || new Date().toISOString(),
        is_active: sqliteProp.is_active !== undefined ? sqliteProp.is_active : true,
        raw_data: parseJSON(sqliteProp.raw_data)
      };
      
    } catch (error) {
      console.error('Error transforming property:', error);
      this.migrationState.errors.push(`Transform error for property ${sqliteProp.id}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get migration status
   */
  getMigrationStatus() {
    return {
      ...this.migrationState,
      progress: this.migrationState.totalRecords > 0 
        ? Math.round((this.migrationState.migratedRecords / this.migrationState.totalRecords) * 100)
        : 0
    };
  }

  /**
   * Backup SQLite database before migration
   */
  backupSQLiteDatabase() {
    const sqlitePath = process.env.DATABASE_PATH || 'server/database/properties.db';
    
    if (!fs.existsSync(sqlitePath)) {
      return { success: false, message: 'No SQLite database to backup' };
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${sqlitePath}.backup-${timestamp}`;
      
      fs.copyFileSync(sqlitePath, backupPath);
      
      console.log(`✅ SQLite database backed up to: ${backupPath}`);
      
      return {
        success: true,
        message: 'Database backed up successfully',
        backupPath: backupPath
      };
      
    } catch (error) {
      console.error('Error backing up SQLite database:', error);
      return {
        success: false,
        message: 'Backup failed',
        error: error.message
      };
    }
  }

  /**
   * Validate migration by comparing record counts
   */
  async validateMigration() {
    try {
      const sqliteCheck = this.checkSQLiteDatabase();
      if (!sqliteCheck.exists) {
        return { valid: true, message: 'No SQLite database to validate against' };
      }

      const postgresStats = await this.postgresDb.getFeedStats();
      
      const isValid = postgresStats.totalProperties >= sqliteCheck.records * 0.95; // Allow 5% tolerance
      
      return {
        valid: isValid,
        sqliteRecords: sqliteCheck.records,
        postgresRecords: postgresStats.totalProperties,
        message: isValid 
          ? 'Migration validation passed'
          : `Migration validation failed: Expected ~${sqliteCheck.records} records, found ${postgresStats.totalProperties}`
      };
      
    } catch (error) {
      return {
        valid: false,
        message: 'Validation failed',
        error: error.message
      };
    }
  }

  /**
   * Clean up old SQLite database after successful migration
   */
  cleanupSQLiteDatabase() {
    const sqlitePath = process.env.DATABASE_PATH || 'server/database/properties.db';
    
    if (!fs.existsSync(sqlitePath)) {
      return { success: true, message: 'No SQLite database to clean up' };
    }

    try {
      // Create a final backup before deletion
      const backup = this.backupSQLiteDatabase();
      if (!backup.success) {
        return { success: false, message: 'Failed to create final backup before cleanup' };
      }

      // Move to archive folder instead of deleting
      const archiveDir = path.join(path.dirname(sqlitePath), 'archive');
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivePath = path.join(archiveDir, `properties-migrated-${timestamp}.db`);
      
      fs.renameSync(sqlitePath, archivePath);
      
      console.log(`✅ SQLite database archived to: ${archivePath}`);
      
      return {
        success: true,
        message: 'SQLite database archived successfully',
        archivePath: archivePath
      };
      
    } catch (error) {
      console.error('Error cleaning up SQLite database:', error);
      return {
        success: false,
        message: 'Cleanup failed',
        error: error.message
      };
    }
  }

  /**
   * Close database connections
   */
  async close() {
    if (this.sqliteDb) {
      this.sqliteDb.close();
    }
    
    if (this.postgresDb) {
      await this.postgresDb.close();
    }
    
    if (this.redisCache) {
      await this.redisCache.close();
    }
  }
}

module.exports = MigrationService; 