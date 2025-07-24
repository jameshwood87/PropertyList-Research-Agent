const { Pool } = require('pg');
const LocationIntelligenceService = require('./locationIntelligenceService');

class AutoReanalysisService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    this.locationService = new LocationIntelligenceService(propertyDatabase);
    
    // Queue for properties needing re-analysis
    this.reanalysisQueue = new Map();
    
    // Tracking metrics
    this.metrics = {
      changesDetected: 0,
      reanalysisTriggered: 0,
      reanalysisCompleted: 0,
      errors: 0
    };
    
    // Start monitoring for changes
    this.startChangeMonitoring();
  }

  /**
   * Start monitoring for property changes
   */
  async startChangeMonitoring() {
    console.log('🔄 Starting automatic re-analysis monitoring...');
    
    // Check for changes every 30 seconds
    setInterval(async () => {
      try {
        await this.detectAndProcessChanges();
      } catch (error) {
        console.error('❌ Error in auto-reanalysis monitoring:', error);
        this.metrics.errors++;
      }
    }, 30000); // 30 seconds
    
    console.log('✅ Auto-reanalysis monitoring started');
  }

  /**
   * Detect properties that have been modified and need re-analysis
   */
  async detectAndProcessChanges() {
    try {
      // Find properties modified in the last 5 minutes that might need re-analysis
      const recentlyModified = await this.propertyDb.query(`
        SELECT 
          id, reference, city, suburb, urbanization, 
          latitude, longitude, condition_rating, descriptions,
          updated_timestamp, last_analysis_timestamp
        FROM properties 
        WHERE is_active = true
          AND updated_timestamp > NOW() - INTERVAL '5 minutes'
          AND (
            -- Properties with significant changes that invalidate analysis
            last_analysis_timestamp IS NULL OR
            last_analysis_timestamp < updated_timestamp OR
            -- Properties missing key analysis fields
            (descriptions IS NOT NULL AND condition_rating IS NULL) OR
            (descriptions IS NOT NULL AND latitude IS NULL) OR
            (descriptions IS NOT NULL AND longitude IS NULL)
          )
        ORDER BY updated_timestamp DESC
      `);

      if (recentlyModified.rows.length > 0) {
        console.log(`🔍 Found ${recentlyModified.rows.length} properties needing re-analysis`);
        
        for (const property of recentlyModified.rows) {
          await this.queueForReanalysis(property);
        }
        
        // Process the queue
        await this.processReanalysisQueue();
      }

    } catch (error) {
      console.error('❌ Error detecting property changes:', error);
      this.metrics.errors++;
    }
  }

  /**
   * Queue a property for re-analysis
   */
  async queueForReanalysis(property) {
    const queueKey = property.reference;
    
    if (!this.reanalysisQueue.has(queueKey)) {
      this.reanalysisQueue.set(queueKey, {
        property: property,
        queuedAt: new Date(),
        priority: this.calculatePriority(property),
        reason: this.getReanalysisReason(property)
      });
      
      this.metrics.changesDetected++;
      console.log(`📋 Queued ${property.reference} for re-analysis: ${this.getReanalysisReason(property)}`);
    }
  }

  /**
   * Calculate priority for re-analysis (higher number = higher priority)
   */
  calculatePriority(property) {
    let priority = 1;
    
    // Higher priority for properties with missing coordinates
    if (!property.latitude || !property.longitude) priority += 3;
    
    // Higher priority for properties with missing condition ratings
    if (!property.condition_rating) priority += 2;
    
    // Higher priority for high-value areas
    const highValueAreas = ['nueva andalucia', 'marbella golden mile', 'puerto banus'];
    if (highValueAreas.some(area => 
      property.suburb?.toLowerCase().includes(area) || 
      property.city?.toLowerCase().includes(area)
    )) {
      priority += 2;
    }
    
    // Higher priority for properties with urbanization (more cacheable)
    if (property.urbanization) priority += 1;
    
    return priority;
  }

  /**
   * Get human-readable reason for re-analysis
   */
  getReanalysisReason(property) {
    const reasons = [];
    
    if (!property.latitude || !property.longitude) {
      reasons.push('missing coordinates');
    }
    
    if (!property.condition_rating && property.descriptions) {
      reasons.push('missing condition analysis');
    }
    
    if (property.last_analysis_timestamp && property.updated_timestamp > property.last_analysis_timestamp) {
      reasons.push('property updated since last analysis');
    }
    
    if (!property.last_analysis_timestamp && property.descriptions) {
      reasons.push('never analyzed');
    }
    
    return reasons.join(', ') || 'general re-analysis needed';
  }

  /**
   * Process the re-analysis queue
   */
  async processReanalysisQueue() {
    if (this.reanalysisQueue.size === 0) return;
    
    console.log(`🔄 Processing ${this.reanalysisQueue.size} properties in re-analysis queue`);
    
    // Sort by priority (highest first)
    const sortedQueue = Array.from(this.reanalysisQueue.entries())
      .sort((a, b) => b[1].priority - a[1].priority);
    
    // Process up to 5 properties at a time to avoid overwhelming the system
    const batchSize = 5;
    const batch = sortedQueue.slice(0, batchSize);
    
    for (const [queueKey, queueItem] of batch) {
      try {
        await this.performReanalysis(queueItem.property, queueItem.reason);
        this.reanalysisQueue.delete(queueKey);
        this.metrics.reanalysisCompleted++;
      } catch (error) {
        console.error(`❌ Error re-analyzing ${queueItem.property.reference}:`, error);
        this.metrics.errors++;
        
        // Remove failed items from queue to prevent infinite retries
        this.reanalysisQueue.delete(queueKey);
      }
    }
  }

  /**
   * Perform actual re-analysis on a property
   */
  async performReanalysis(property, reason) {
    console.log(`🤖 Re-analyzing ${property.reference}: ${reason}`);
    this.metrics.reanalysisTriggered++;
    
    try {
      // Clear any cached data first (force fresh analysis)
      await this.clearPropertyCache(property);
      
      // Run fresh AI analysis - but we'll use location intelligence instead for coordinates
      // First, try to extract location from description using location intelligence
      let enhancedLocation = null;
      const descriptions = property.descriptions || {};
      // FIXED: Use English descriptions only (as per user preference)
      const combinedDesc = descriptions.en || descriptions.english || '';
      
      if (combinedDesc && combinedDesc.length > 20) {
        try {
          const locationResult = await this.locationService.resolveLocation(combinedDesc, {
            city: property.city || 'Marbella',
            suburb: property.suburb,
            propertyData: property
          });
          
          if (locationResult.location) {
            enhancedLocation = locationResult.location;
            console.log(`🎯 Extracted location: "${enhancedLocation}" (confidence: ${locationResult.confidence})`);
          }
        } catch (locationError) {
          console.log(`⚠️ Location extraction failed: ${locationError.message}`);
        }
      }
      
      // Update database with new analysis
      const updates = [];
      const values = [];
      let paramCount = 0;
      
      // Update coordinates if location found and coordinates missing
      if (enhancedLocation && (!property.latitude || !property.longitude)) {
        const coordinates = await this.geocodeLocation(enhancedLocation);
        if (coordinates) {
          updates.push(`latitude = $${++paramCount}`);
          values.push(coordinates.lat);
          updates.push(`longitude = $${++paramCount}`);
          values.push(coordinates.lng);
          updates.push(`geom = ST_SetSRID(ST_Point($${paramCount}, $${paramCount-1}), 4326)`);
        }
      }
      
      // Always update analysis timestamp
      updates.push(`last_analysis_timestamp = NOW()`);
      updates.push(`updated_timestamp = NOW()`);
      
      if (updates.length > 0) {
        values.push(property.reference);
        const query = `
          UPDATE properties 
          SET ${updates.join(', ')}
          WHERE reference = $${values.length}
        `;
        
        await this.propertyDb.query(query, values);
        
        console.log(`✅ ${property.reference} re-analysis complete`);
        
        // Log the re-analysis event
        await this.logReanalysisEvent(property, reason, { enhancedLocation });
      }
      
    } catch (error) {
      console.error(`❌ Re-analysis failed for ${property.reference}:`, error);
      throw error;
    }
  }

  /**
   * Clear cached data for a property to force fresh analysis
   */
  async clearPropertyCache(property) {
    // This would integrate with your caching system
    // For now, just log the intent
    console.log(`🧹 Clearing cache for ${property.reference}`);
  }

  /**
   * Geocode a location (simplified version)
   */
  async geocodeLocation(location) {
    try {
      console.log(`📍 Geocoding: ${location}`);
      
      // Use the actual location intelligence service for geocoding
      const result = await this.locationService.resolveLocation(location, {
        city: 'Marbella',
        province: 'Málaga'
      });
      
      if (result.coordinates && result.confidence >= 0.7) {
        console.log(`✅ Geocoded "${location}" -> ${result.coordinates.lat}, ${result.coordinates.lng} (confidence: ${result.confidence})`);
        return result.coordinates;
      } else {
        console.log(`❌ Low confidence geocoding for "${location}" (confidence: ${result.confidence || 0})`);
        return null;
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  /**
   * Log re-analysis events for tracking and debugging
   */
  async logReanalysisEvent(property, reason, result) {
    try {
      await this.propertyDb.query(`
        INSERT INTO reanalysis_log (
          property_reference, 
          reason, 
          analysis_result, 
          created_at
        ) VALUES ($1, $2, $3, NOW())
      `, [
        property.reference,
        reason,
        JSON.stringify(result)
      ]);
    } catch (error) {
      // Don't fail re-analysis if logging fails
      console.error('Failed to log re-analysis event:', error);
    }
  }

  /**
   * Get current metrics and queue status
   */
  getStatus() {
    return {
      queueSize: this.reanalysisQueue.size,
      metrics: this.metrics,
      nextItems: Array.from(this.reanalysisQueue.values())
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 5)
        .map(item => ({
          reference: item.property.reference,
          reason: item.reason,
          priority: item.priority,
          queuedAt: item.queuedAt
        }))
    };
  }

  /**
   * Manually trigger re-analysis for specific properties
   */
  async triggerReanalysis(propertyReferences) {
    console.log(`🎯 Manual re-analysis triggered for ${propertyReferences.length} properties`);
    
    for (const reference of propertyReferences) {
      const property = await this.propertyDb.query(
        'SELECT * FROM properties WHERE reference = $1 AND is_active = true',
        [reference]
      );
      
      if (property.rows.length > 0) {
        await this.queueForReanalysis(property.rows[0]);
      }
    }
    
    await this.processReanalysisQueue();
  }
}

module.exports = AutoReanalysisService; 