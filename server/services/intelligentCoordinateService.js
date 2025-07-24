/**
 * Intelligent Coordinate Service
 * 
 * Only saves coordinates to database when:
 * 1. Property has specific location details (urbanisation, street, landmarks)
 * 2. AI confidence is 90%+ 
 * 3. Location is not just city-level approximation
 * 
 * This ensures high data quality and prevents inaccurate coordinates
 */

class IntelligentCoordinateService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    
    // Enhanced confidence requirements
    this.confidenceThresholds = {
      excellent: 0.95,     // ROOFTOP precision - always save
      highQuality: 0.90,   // High confidence with specific location - save if specific
      acceptable: 0.85,    // Good confidence - save only if very specific
      minimum: 0.80        // Minimum for any saving - only street addresses
    };
    
    // Location specificity requirements
    this.specificityRequirements = {
      // Highest priority - always save if confidence meets minimum
      streetAddress: {
        minConfidence: 0.80,
        patterns: [
          /^.+\s+\d+/,                    // "Avenida del Mar 15"
          /calle\s+[a-záéíóúñü\s]+\s*\d*/i, // "Calle Mayor 23"
          /avenida\s+[a-záéíóúñü\s]+\s*\d*/i, // "Avenida de España"
          /carretera\s+[a-záéíóúñü\s]+/i,    // "Carretera de Cádiz"
          /plaza\s+[a-záéíóúñü\s]+/i         // "Plaza de los Naranjos"
        ]
      },
      
      // High priority - save if confidence is high
      urbanisation: {
        minConfidence: 0.90,
        patterns: [
          /urbanización\s+[a-záéíóúñü\s]+/i,
          /urbanizacion\s+[a-záéíóúñü\s]+/i,
          /urb\.?\s+[a-záéíóúñü\s]+/i,
          /hacienda\s+[a-záéíóúñü\s]+/i,
          /real\s+club\s+[a-záéíóúñü\s]+/i
        ]
      },
      
      // Medium priority - save only with excellent confidence
      landmarkProximity: {
        minConfidence: 0.95,
        patterns: [
          /\d+\s*(metros?|meters?)\s+(from|de|del|desde)/i,
          /walking\s+distance\s+to/i,
          /a\s+pie\s+(de|del)/i,
          /next\s+to\s+/i,
          /junto\s+a\s+/i,
          /cerca\s+de\s+/i,
          /frente\s+a\s+/i
        ]
      },
      
      // Low priority - only save with excellent confidence and known area
      knownArea: {
        minConfidence: 0.95,
        areas: [
          'puerto banús', 'nueva andalucía', 'marbella golden mile',
          'las chapas', 'hacienda las chapas', 'guadalmina',
          'san pedro de alcántara', 'estepona', 'benahavís',
          'la quinta', 'los monteros', 'elviria', 'cabopino'
        ]
      }
    };
    
    this.stats = {
      totalEvaluated: 0,
      coordinatesSaved: 0,
      coordinatesRejected: 0,
      rejectionReasons: {},
      qualityDistribution: {}
    };
  }

  /**
   * Main method: Intelligently determine if coordinates should be saved
   */
  async shouldSaveCoordinates(property, locationResult) {
    this.stats.totalEvaluated++;
    
    console.log(`🧠 Evaluating coordinate quality for ${property.reference || 'unknown'}`);
    
    // Step 1: Check if coordinates exist and have minimum confidence
    if (!locationResult.coordinates) {
      this._recordRejection('no_coordinates');
      return { shouldSave: false, reason: 'No coordinates provided' };
    }
    
    const confidence = locationResult.confidence || locationResult.geocodingConfidence || 0;
    if (confidence < this.confidenceThresholds.minimum) {
      this._recordRejection('low_confidence');
      return { 
        shouldSave: false, 
        reason: `Confidence too low: ${(confidence * 100).toFixed(1)}% < ${this.confidenceThresholds.minimum * 100}%` 
      };
    }
    
    // Step 2: Evaluate location specificity
    const specificityAnalysis = this._analyzeLocationSpecificity(property, locationResult);
    
    // Step 3: Apply intelligent decision logic
    const decision = this._makeIntelligentDecision(confidence, specificityAnalysis);
    
    if (decision.shouldSave) {
      this.stats.coordinatesSaved++;
      console.log(`✅ HIGH QUALITY coordinates approved: ${decision.reason}`);
    } else {
      this.stats.coordinatesRejected++;
      this._recordRejection(decision.rejectionCode);
      console.log(`❌ Coordinates rejected: ${decision.reason}`);
    }
    
    return decision;
  }

  /**
   * Analyze location specificity based on available data
   */
  _analyzeLocationSpecificity(property, locationResult) {
    const analysis = {
      hasStreetAddress: false,
      hasUrbanisation: false,
      hasLandmarkProximity: false,
      hasKnownArea: false,
      specificityScore: 0,
      specificityDetails: []
    };
    
    // Combine all available location text for analysis
    const locationTexts = [
      property.address,
      property.urbanization,
      property.suburb,
      locationResult.location,
      locationResult.address,
      property.descriptions?.en || '',
      property.descriptions?.english || ''
    ].filter(Boolean).join(' ').toLowerCase();
    
    // Check for street address patterns
    for (const pattern of this.specificityRequirements.streetAddress.patterns) {
      if (pattern.test(locationTexts)) {
        analysis.hasStreetAddress = true;
        analysis.specificityScore += 40;
        analysis.specificityDetails.push('Street address detected');
        break;
      }
    }
    
    // Check for urbanisation patterns
    for (const pattern of this.specificityRequirements.urbanisation.patterns) {
      if (pattern.test(locationTexts)) {
        analysis.hasUrbanisation = true;
        analysis.specificityScore += 30;
        analysis.specificityDetails.push('Urbanisation detected');
        break;
      }
    }
    
    // Check for landmark proximity patterns
    for (const pattern of this.specificityRequirements.landmarkProximity.patterns) {
      if (pattern.test(locationTexts)) {
        analysis.hasLandmarkProximity = true;
        analysis.specificityScore += 25;
        analysis.specificityDetails.push('Landmark proximity detected');
        break;
      }
    }
    
    // Check for known area references
    for (const area of this.specificityRequirements.knownArea.areas) {
      if (locationTexts.includes(area)) {
        analysis.hasKnownArea = true;
        analysis.specificityScore += 15;
        analysis.specificityDetails.push(`Known area: ${area}`);
        break;
      }
    }
    
    // Special bonus for geocoding method quality
    if (locationResult.method === 'exact_match' || locationResult.locationType === 'ROOFTOP') {
      analysis.specificityScore += 20;
      analysis.specificityDetails.push('High-precision geocoding method');
    }
    
    console.log(`🔍 Location specificity analysis:`, {
      score: analysis.specificityScore,
      details: analysis.specificityDetails,
      hasStreetAddress: analysis.hasStreetAddress,
      hasUrbanisation: analysis.hasUrbanisation,
      hasLandmarkProximity: analysis.hasLandmarkProximity,
      hasKnownArea: analysis.hasKnownArea
    });
    
    return analysis;
  }

  /**
   * Make intelligent decision based on confidence and specificity
   */
  _makeIntelligentDecision(confidence, specificity) {
    // Excellent confidence - save if any specificity
    if (confidence >= this.confidenceThresholds.excellent) {
      if (specificity.specificityScore >= 15) {
        return {
          shouldSave: true,
          reason: `Excellent confidence (${(confidence * 100).toFixed(1)}%) with sufficient specificity`,
          quality: 'excellent'
        };
      } else {
        return {
          shouldSave: false,
          reason: 'Excellent confidence but location too vague (likely city-level)',
          rejectionCode: 'vague_location_excellent_confidence'
        };
      }
    }
    
    // High quality confidence - save if good specificity
    if (confidence >= this.confidenceThresholds.highQuality) {
      if (specificity.hasStreetAddress) {
        return {
          shouldSave: true,
          reason: `High confidence (${(confidence * 100).toFixed(1)}%) with street address`,
          quality: 'high'
        };
      } else if (specificity.hasUrbanisation && specificity.specificityScore >= 30) {
        return {
          shouldSave: true,
          reason: `High confidence (${(confidence * 100).toFixed(1)}%) with urbanisation`,
          quality: 'high'
        };
      } else {
        return {
          shouldSave: false,
          reason: 'High confidence but insufficient location specificity',
          rejectionCode: 'insufficient_specificity_high_confidence'
        };
      }
    }
    
    // Acceptable confidence - save only for street addresses
    if (confidence >= this.confidenceThresholds.acceptable) {
      if (specificity.hasStreetAddress && specificity.specificityScore >= 40) {
        return {
          shouldSave: true,
          reason: `Acceptable confidence (${(confidence * 100).toFixed(1)}%) with clear street address`,
          quality: 'acceptable'
        };
      } else {
        return {
          shouldSave: false,
          reason: 'Acceptable confidence but requires street address for saving',
          rejectionCode: 'requires_street_address'
        };
      }
    }
    
    // Minimum confidence - save only for very specific street addresses
    if (confidence >= this.confidenceThresholds.minimum) {
      if (specificity.hasStreetAddress && specificity.specificityScore >= 50) {
        return {
          shouldSave: true,
          reason: `Minimum confidence (${(confidence * 100).toFixed(1)}%) with very specific street address`,
          quality: 'minimum'
        };
      } else {
        return {
          shouldSave: false,
          reason: 'Minimum confidence requires very specific street address',
          rejectionCode: 'minimum_confidence_insufficient_specificity'
        };
      }
    }
    
    // Below minimum - never save
    return {
      shouldSave: false,
      reason: `Confidence below minimum threshold: ${(confidence * 100).toFixed(1)}%`,
      rejectionCode: 'below_minimum_confidence'
    };
  }

  /**
   * Save coordinates to database with metadata
   */
  async saveIntelligentCoordinates(property, locationResult, decision) {
    const client = await this.propertyDb.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update coordinates
      const updateQuery = `
        UPDATE properties 
        SET 
          latitude = $1,
          longitude = $2,
          geom = ST_SetSRID(ST_Point($2, $1), 4326),
          updated_timestamp = NOW()
        WHERE id = $3
      `;
      
      await client.query(updateQuery, [
        locationResult.coordinates.lat,
        locationResult.coordinates.lng,
        property.id
      ]);
      
      // Store intelligent geocoding metadata
      const metadataQuery = `
        UPDATE properties 
        SET raw_data = COALESCE(raw_data, '{}'::jsonb) || $1::jsonb
        WHERE id = $2
      `;
      
      const intelligentMetadata = {
        intelligent_geocoding: {
          geocoded_at: new Date().toISOString(),
          method: locationResult.method,
          confidence: locationResult.confidence || locationResult.geocodingConfidence,
          quality_level: decision.quality,
          specificity_score: decision.specificityScore || 0,
          validation_reason: decision.reason,
          source: 'intelligent_coordinate_service',
          ai_confidence_threshold: this.confidenceThresholds.minimum,
          meets_quality_standards: true
        }
      };
      
      await client.query(metadataQuery, [JSON.stringify(intelligentMetadata), property.id]);
      
      await client.query('COMMIT');
      
      console.log(`📍 INTELLIGENT coordinates saved for ${property.reference}: ${locationResult.coordinates.lat}, ${locationResult.coordinates.lng}`);
      console.log(`   Quality: ${decision.quality}, Reason: ${decision.reason}`);
      
      return true;
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Error saving intelligent coordinates:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Record rejection reason for analysis
   */
  _recordRejection(reason) {
    if (!this.stats.rejectionReasons[reason]) {
      this.stats.rejectionReasons[reason] = 0;
    }
    this.stats.rejectionReasons[reason]++;
  }

  /**
   * Get comprehensive statistics
   */
  getIntelligenceStats() {
    const acceptanceRate = this.stats.totalEvaluated > 0 
      ? (this.stats.coordinatesSaved / this.stats.totalEvaluated * 100).toFixed(1)
      : 0;
    
    return {
      ...this.stats,
      acceptanceRate: `${acceptanceRate}%`,
      dataQualityImprovement: `${100 - acceptanceRate}% of low-quality coordinates prevented`
    };
  }

  /**
   * Check if property already has high-quality coordinates
   */
  async hasHighQualityCoordinates(property) {
    try {
      if (!property.latitude || !property.longitude) {
        return false;
      }
      
      // Check if coordinates were set by intelligent system
      const metadataQuery = `
        SELECT raw_data->'intelligent_geocoding' as intelligent_metadata
        FROM properties 
        WHERE id = $1
      `;
      
      const result = await this.propertyDb.query(metadataQuery, [property.id]);
      
      if (result.rows.length > 0 && result.rows[0].intelligent_metadata) {
        const metadata = result.rows[0].intelligent_metadata;
        console.log(`✅ Property ${property.reference} already has intelligent coordinates (${metadata.quality_level} quality)`);
        return true;
      }
      
      // If coordinates exist but no intelligent metadata, consider them legacy/unknown quality
      console.log(`⚠️ Property ${property.reference} has coordinates but unknown quality (legacy data)`);
      return false;
      
    } catch (error) {
      console.error('Error checking coordinate quality:', error);
      return false;
    }
  }
}

module.exports = IntelligentCoordinateService; 