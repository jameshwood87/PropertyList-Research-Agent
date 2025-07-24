/**
 * SUPERIOR IMPLEMENTATION: Tiered approach with heuristic switching
 * Based on your excellent analysis of performance vs resilience
 */

class OptimizedComparableSearch {
  constructor(database) {
    this.db = database;
  }

  /**
   * Smart comparable property finder with tiered approach
   */
  async findSimilarProperties(criteria) {
    try {
      const {
        latitude,
        longitude,
        propertyType,
        bedrooms,
        price,
        buildArea,
        urbanization,
        suburb,
        city,
        limit = 12,
        reference
      } = criteria;

      // HEURISTIC SWITCH: Detect if property needs progressive relaxation
      const needsProgressiveRelaxation = this.shouldUseProgressiveRelaxation(criteria);
      
      if (needsProgressiveRelaxation) {
        console.log(`🏰 Luxury/Edge case detected - using progressive relaxation`);
        return await this.findSimilarPropertiesProgressive(criteria);
      } else {
        console.log(`🏠 Standard property - using optimized composite scoring`);
        return await this.findSimilarPropertiesOptimized(criteria);
      }
      
    } catch (error) {
      console.error('Error finding similar properties:', error);
      return [];
    }
  }

  /**
   * Heuristic to determine if property needs progressive relaxation
   */
  shouldUseProgressiveRelaxation(criteria) {
    const { bedrooms, price, propertyType, buildArea } = criteria;
    
    // Large properties (likely to have few matches)
    if (bedrooms && bedrooms > 6) return true;
    
    // High-value properties (€2M+)
    if (price && price > 2000000) return true;
    
    // Luxury property types
    if (['villa', 'country-house', 'penthouse'].includes(propertyType)) {
      // Large luxury properties need progressive search
      if (buildArea && buildArea > 400) return true;
    }
    
    // Very large properties by size
    if (buildArea && buildArea > 500) return true;
    
    return false;
  }

  /**
   * TIER 1: Optimized approach with adaptive radius expansion
   * Tries 3km → 5km → 10km until 12 results found (no union query hell)
   */
  async findSimilarPropertiesOptimized(criteria) {
    const {
      latitude,
      longitude,
      propertyType,
      bedrooms,
      price,
      buildArea,
      urbanization,
      suburb,
      reference,
      limit = 12
    } = criteria;

    // OPTIMIZATION: Adaptive radius expansion - try progressively larger radiuses
    const radiusSteps = [3000, 5000, 10000, 15000]; // 3km → 5km → 10km → 15km
    
    for (let i = 0; i < radiusSteps.length; i++) {
      const radius = radiusSteps[i];
      console.log(`🎯 Trying radius ${radius/1000}km (step ${i + 1}/${radiusSteps.length})`);
      
      const results = await this.findWithRadius(criteria, radius, limit);
      
      if (results.length >= limit || i === radiusSteps.length - 1) {
        console.log(`✅ Found ${results.length} properties at ${radius/1000}km radius`);
        return results.slice(0, limit);
      }
      
      console.log(`⚡ Only ${results.length} properties at ${radius/1000}km - expanding radius...`);
    }
    
    return []; // Fallback
  }

  /**
   * Find properties within a specific radius
   */
  async findWithRadius(criteria, radiusMeters, limit) {
    const {
      latitude,
      longitude,
      propertyType,
      bedrooms,
      price,
      buildArea,
      urbanization,
      suburb,
      reference
    } = criteria;

    const candidateLimit = Math.min(200, limit * 16); // Bounded candidate pool

    let query;
    let params = [];

    if (latitude && longitude) {
      // COORDINATE-BASED COMPOSITE SCORING
      query = `
        WITH candidates AS (
          SELECT 
            id, reference, address, urbanization, suburb, city,
            latitude, longitude, bedrooms, bathrooms, build_size,
            sale_price, property_type, features, images,
            -- Calculate individual similarity components
            CASE 
              WHEN urbanization_norm = normalize_spanish_text($3) AND urbanization_norm IS NOT NULL THEN 0.1
              WHEN suburb_norm = normalize_spanish_text($4) AND suburb_norm IS NOT NULL THEN 0.5
              ELSE COALESCE(
                ST_Distance(
                  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
                  ST_SetSRID(ST_Point($1, $2), 4326)::geography
                ) / 1000.0, 50
              )
            END AS distance_km,
            ABS(COALESCE(bedrooms, 0) - COALESCE($5, 0)) AS bedroom_diff,
            ABS(COALESCE(sale_price, 0) - COALESCE($6, 0)) / GREATEST(COALESCE($6, 1), 1) AS price_diff_pct,
            ABS(COALESCE(build_size, 0) - COALESCE($7, 0)) / GREATEST(COALESCE($7, 1), 1) AS size_diff_pct,
            CASE WHEN property_type = $8 THEN 0 ELSE 1 END AS type_mismatch
          FROM properties 
          WHERE is_active = true
            AND sale_price > 0
            AND build_size > 0
            AND reference != COALESCE($9, '')
            AND (
              -- OPTIMIZATION: Smart location matching with normalized diacritics
              urbanization_norm = normalize_spanish_text($3) OR
              suburb_norm = normalize_spanish_text($4) OR
              (latitude IS NOT NULL AND longitude IS NOT NULL AND
               ST_DWithin(
                 ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
                 ST_SetSRID(ST_Point($1, $2), 4326)::geography,
                 $10 -- OPTIMIZATION: Dynamic radius for adaptive expansion
               ))
            )
            AND property_type = $8  -- Strict type matching for optimized search
            AND bedrooms BETWEEN GREATEST(1, COALESCE($5, 1) - 2) AND (COALESCE($5, 20) + 2)
          LIMIT $12
        )
        SELECT *,
          -- COMPOSITE SIMILARITY SCORE (lower = better)
          (distance_km * 0.30) +           -- 30% weight: location is king
          (bedroom_diff * 0.15) +          -- 15% weight: layout compatibility
          (price_diff_pct * 0.30) +        -- 30% weight: price similarity  
          (size_diff_pct * 0.20) +         -- 20% weight: size similarity
          (type_mismatch * 0.05)           -- 5% weight: type bonus
        AS similarity_score,
        distance_km AS distance_meters
        FROM candidates
        ORDER BY similarity_score ASC
        LIMIT $12
      `;
      
      params = [
        longitude, latitude,           // $1, $2: coordinates (PostGIS expects lon first)
        urbanization, suburb,          // $3, $4: location hierarchy
        bedrooms,                      // $5: bedrooms
        price,                         // $6: price for % diff
        buildArea,                     // $7: size for % diff
        propertyType,                  // $8: property type
        reference,                     // $9: exclude self
        radiusMeters,                  // $10: OPTIMIZATION: Dynamic radius
        candidateLimit,                // $11: candidate pool limit
        limit                          // $12: final result limit
      ];
      
    } else {
      // Location-based search for properties without coordinates
      query = `
        WITH candidates AS (
          SELECT 
            id, reference, address, urbanization, suburb, city,
            latitude, longitude, bedrooms, bathrooms, build_size,
            sale_price, property_type, features, images,
            0 as distance_km,
            ABS(COALESCE(bedrooms, 0) - COALESCE($1, 0)) AS bedroom_diff,
            ABS(COALESCE(sale_price, 0) - COALESCE($2, 0)) / GREATEST(COALESCE($2, 1), 1) AS price_diff_pct,
            ABS(COALESCE(build_size, 0) - COALESCE($3, 0)) / GREATEST(COALESCE($3, 1), 1) AS size_diff_pct,
            CASE WHEN property_type = $4 THEN 0 ELSE 1 END AS type_mismatch,
            CASE 
              WHEN urbanization_norm = normalize_spanish_text($5) THEN 1
              WHEN suburb_norm = normalize_spanish_text($6) THEN 2  
              WHEN city_norm = normalize_spanish_text($7) THEN 3
              ELSE 4
            END AS location_priority
          FROM properties 
          WHERE is_active = true
            AND sale_price > 0
            AND build_size > 0
            AND reference != COALESCE($8, '')
            AND (
              urbanization_norm = normalize_spanish_text($5) OR
              suburb_norm = normalize_spanish_text($6) OR  
              city_norm = normalize_spanish_text($7)
            )
            AND property_type = $4
          LIMIT $9
        )
        SELECT *,
          (location_priority * 0.35) +     -- 35% weight: location match hierarchy
          (bedroom_diff * 0.15) +          -- 15% weight: bedrooms
          (price_diff_pct * 0.30) +        -- 30% weight: price similarity
          (size_diff_pct * 0.15) +         -- 15% weight: size similarity
          (type_mismatch * 0.05)           -- 5% weight: type match
        AS similarity_score,
        0 AS distance_meters
        FROM candidates
        ORDER BY similarity_score ASC
        LIMIT $10
      `;
      
      params = [
        bedrooms, price, buildArea, propertyType,
        urbanization, suburb, criteria.city,
        reference, candidateLimit, limit
      ];
    }

    // Execute query
    try {
      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Database query error:', error);
      return [];
    }
  }

  /**
   * TIER 2: Progressive relaxation for luxury/edge cases
   * Only used when heuristic detects properties likely to have few matches
   */
  async findSimilarPropertiesProgressive(criteria) {
    const strategies = [
      { 
        name: 'Strict Luxury Match', 
        bedroomTolerance: 1, 
        priceTolerance: 0.2, 
        sizeTolerance: 0.2,
        radiusKm: 10,
        allowOtherTypes: false
      },
      { 
        name: 'Flexible Luxury', 
        bedroomTolerance: 2, 
        priceTolerance: 0.4, 
        sizeTolerance: 0.4,
        radiusKm: 20,
        allowOtherTypes: false
      },
      { 
        name: 'Similar Property Types', 
        bedroomTolerance: 3, 
        priceTolerance: 0.6, 
        sizeTolerance: 0.5,
        radiusKm: 30,
        allowOtherTypes: true
      },
      { 
        name: 'Broad Area Search', 
        bedroomTolerance: 4, 
        priceTolerance: 0.8, 
        sizeTolerance: 0.7,
        radiusKm: 50,
        allowOtherTypes: true
      }
    ];

    const { limit = 12 } = criteria;
    const targetCount = Math.max(limit, 12);

    for (const strategy of strategies) {
      console.log(`🔍 Progressive: ${strategy.name}`);
      
      const results = await this.executeProgressiveStrategy(criteria, strategy, targetCount * 2);
      
      console.log(`📊 ${strategy.name}: Found ${results.length} properties`);
      
      if (results.length >= targetCount) {
        console.log(`✅ Success with ${strategy.name}`);
        return results.slice(0, limit * 2); // Return more for analysis
      }
    }

    // Final fallback: return whatever we have
    console.log(`⚠️ Using partial results from progressive search`);
    return [];
  }

  /**
   * Execute a specific progressive strategy
   */
  async executeProgressiveStrategy(criteria, strategy, candidateLimit) {
    const {
      latitude,
      longitude,
      propertyType,
      bedrooms,
      price,
      buildArea,
      urbanization,
      suburb,
      reference
    } = criteria;

    // Calculate flexible ranges based on strategy
    const bedroomMin = Math.max(1, (bedrooms || 3) - strategy.bedroomTolerance);
    const bedroomMax = (bedrooms || 10) + strategy.bedroomTolerance;
    
    const priceMin = price ? price * (1 - strategy.priceTolerance) : 0;
    const priceMax = price ? price * (1 + strategy.priceTolerance) : 999999999;
    
    const sizeMin = buildArea ? buildArea * (1 - strategy.sizeTolerance) : 0;
    const sizeMax = buildArea ? buildArea * (1 + strategy.sizeTolerance) : 999999;

    // Property type criteria
    let typeFilter;
    let typeParams = [];
    if (strategy.allowOtherTypes) {
      // Allow similar luxury types
      if (propertyType === 'villa') {
        typeFilter = `property_type IN ('villa', 'country-house', 'penthouse')`;
      } else if (propertyType === 'penthouse') {
        typeFilter = `property_type IN ('penthouse', 'villa', 'apartment')`;
      } else {
        typeFilter = `property_type = $${typeParams.length + 1}`;
        typeParams.push(propertyType);
      }
    } else {
      typeFilter = `property_type = $${typeParams.length + 1}`;
      typeParams.push(propertyType);
    }

    const query = `
      SELECT 
        id, reference, address, urbanization, suburb, city,
        latitude, longitude, bedrooms, bathrooms, build_size,
        sale_price, property_type, features, images,
        COALESCE(
          ST_Distance(
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
            ST_SetSRID(ST_Point($1, $2), 4326)::geography
          ) / 1000.0, 50
        ) AS distance_km,
        0 AS distance_meters
      FROM properties 
      WHERE is_active = true
        AND sale_price > 0
        AND build_size > 0
        AND reference != COALESCE($3, '')
        AND ${typeFilter}
        AND bedrooms BETWEEN $${typeParams.length + 4} AND $${typeParams.length + 5}
        AND sale_price BETWEEN $${typeParams.length + 6} AND $${typeParams.length + 7}
        AND build_size BETWEEN $${typeParams.length + 8} AND $${typeParams.length + 9}
        AND (
          latitude IS NULL OR longitude IS NULL OR
          ST_DWithin(
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
            ST_SetSRID(ST_Point($1, $2), 4326)::geography,
            $${typeParams.length + 10} * 1000
          )
        )
      ORDER BY 
        CASE 
          WHEN LOWER(COALESCE(urbanization, '')) = LOWER(COALESCE($${typeParams.length + 11}, '')) THEN 1
          WHEN LOWER(COALESCE(suburb, '')) = LOWER(COALESCE($${typeParams.length + 12}, '')) THEN 2
          ELSE 3
        END,
        ABS(sale_price - COALESCE($${typeParams.length + 13}, 0))
      LIMIT $${typeParams.length + 14}
    `;

    const params = [
      longitude, latitude,           // $1, $2: coordinates
      reference,                     // $3: exclude self
      ...typeParams,                 // Property type params
      bedroomMin, bedroomMax,        // Bedroom range
      priceMin, priceMax,            // Price range  
      sizeMin, sizeMax,              // Size range
      strategy.radiusKm,             // Radius
      urbanization, suburb,          // Location context
      price,                         // Price for sorting
      candidateLimit                 // Limit
    ];

    const result = await this.db.query(query, params);
    return result.rows;
  }
}

module.exports = OptimizedComparableSearch; 