const NodeCache = require('node-cache');
const AIAnalysisService = require('./aiAnalysisService');
const TavilyResearchService = require('./tavilyResearchService');
const LocationIntelligenceService = require('./locationIntelligenceService');

class ComparableService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    this.cache = new NodeCache({ stdTTL: 1800 }); // 30 minutes cache
    this.aiAnalysis = new AIAnalysisService();
    this.tavilyResearch = new TavilyResearchService();
    this.locationIntelligence = new LocationIntelligenceService(propertyDatabase);
    
    // OPTIMIZATION: Session locking to prevent double-analysis
    this.sessionLocks = new Map(); // sessionId -> Promise
    this.resultCache = new NodeCache({ stdTTL: 86400 }); // 24-hour result cache for link sharing
  }

  /**
   * Find comparable properties for a given property with enhanced analysis
   */
  async findComparables(sessionId, propertyData) {
    // OPTIMIZATION: Check result cache first (24-hour TTL for link sharing)
    const resultCacheKey = `result:${sessionId}`;
    const cachedResult = this.resultCache.get(resultCacheKey);
    if (cachedResult) {
      console.log('⚡ Returning 24-hour cached result for session:', sessionId);
      return cachedResult;
    }

    // OPTIMIZATION: Session locking to prevent double-analysis
    if (this.sessionLocks.has(sessionId)) {
      console.log('🔒 Analysis already in progress for session:', sessionId, '- waiting...');
      return await this.sessionLocks.get(sessionId);
    }

    // Create analysis promise and store in lock
    const analysisPromise = this.performAnalysis(sessionId, propertyData);
    this.sessionLocks.set(sessionId, analysisPromise);

    try {
      const result = await analysisPromise;
      
      // OPTIMIZATION: Cache result for 24 hours (perfect for link sharing)
      this.resultCache.set(resultCacheKey, result);
      
      return result;
    } finally {
      // Always clean up the lock
      this.sessionLocks.delete(sessionId);
    }
  }

  /**
   * Perform the actual comparable analysis (separated for locking)
   */
  async performAnalysis(sessionId, propertyData) {
    // Check cache first
    const cacheKey = this.generateCacheKey(sessionId, propertyData);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log('✅ Returning cached comparable results for session:', sessionId);
      return cached;
    }

    try {
      console.log('🔍 Finding comparable properties for session:', sessionId);
      
      // CRITICAL: Ensure property data is properly transformed for compatibility
      // This handles cases where session data has old format (numeric property types)
      const transformedPropertyData = this.ensurePropertyDataCompatibility(propertyData);
      
      // Extract search criteria from transformed property data
      const criteria = this.extractSearchCriteria(transformedPropertyData);
      
      if (!this.isValidCriteria(criteria)) {
        return {
          comparables: [],
          summary: 'Insufficient property data for comparable analysis',
          criteria: criteria,
          marketContext: null
        };
      }

      // Find similar properties using optimized database with KNN
      console.log('📍 Searching with enhanced KNN-optimized queries...');
      const similarProperties = await this.propertyDb.findSimilarProperties(criteria);
      console.log(`📊 Found ${similarProperties.length} similar properties from database`);
      
      // Apply location exclusion filtering to prevent cross-contamination
      const filteredProperties = this.applyLocationExclusions(similarProperties, criteria);
      if (filteredProperties.length !== similarProperties.length) {
        console.log(`🎯 Location exclusion filtering: ${similarProperties.length} → ${filteredProperties.length} properties (excluded ${similarProperties.length - filteredProperties.length} mismatched locations)`);
      }
      
      // Format ALL properties for comprehensive analysis (no limit)
      const allComparables = this.formatComparablesForAnalysis(filteredProperties, criteria);
      console.log(`🎯 Formatted ${allComparables.length} properties for comprehensive market analysis`);
      
      // Generate market intelligence using ALL comparable data
      const marketContext = this.generateMarketInsights(allComparables, transformedPropertyData);
      console.log(`💹 Generated market context: ${marketContext?.insights?.length || 0} insights from ${allComparables.length} properties`);
      
      // Format top 12 properties for frontend display
      const displayComparables = this.selectTopComparablesForDisplay(allComparables, 12);
      console.log(`🎯 Selected top ${displayComparables.length} comparable properties for display`);

      // Generate summary with market context (uses ALL data for accurate market summary)
      const summary = this.generateEnhancedSummary(allComparables, criteria, marketContext);

      // Generate enhanced chart data (uses ALL data for comprehensive market analysis)
      const chartData = this.generateChartData(criteria, allComparables);

      // Generate AI-powered analysis with market context (uses ALL data for analysis)
      let aiInsights = null;
      try {
        if (process.env.OPENAI_API_KEY && allComparables.length > 0) {
          console.log('🤖 Generating AI analysis with comprehensive market data...');
          aiInsights = await this.aiAnalysis.generatePropertyAnalysis(
            transformedPropertyData, 
            { 
              comparables: allComparables,        // AI gets ALL data for analysis
              displayComparables: displayComparables, // Plus top 12 for context
              summary, 
              criteria, 
              marketContext 
            }, 
            chartData
          );
          console.log(`🎯 AI analysis generated with ${aiInsights.confidence}% confidence from ${allComparables.length} properties`);
        }
      } catch (error) {
        console.error('❌ AI analysis failed:', error.message);
      }

      // Generate market research insights
      let marketResearch = null;
      try {
        if (process.env.TAVILY_API_KEY && allComparables.length > 0) {
          console.log('📰 Conducting market research...');
          marketResearch = await this.tavilyResearch.generateAreaReport(transformedPropertyData);
          console.log('✅ Market research completed for:', marketResearch.location);
        }
      } catch (error) {
        console.error('❌ Market research failed:', error.message);
      }

      const result = {
        comparables: displayComparables,  // Frontend gets top 12 for display
        allComparables: allComparables,   // Full dataset available for analysis
        summary,
        criteria,
        chartData,
        marketContext, // Enhanced market intelligence using ALL data
        aiInsights,
        marketResearch,
        searchRadius: criteria.radiusKm,
        totalFound: similarProperties.length,
        displayedCount: displayComparables.length,
        analysisCount: allComparables.length,
        performanceMetrics: {
          databaseQueryTime: Date.now(),
          scoringMethod: '5-factor_weighted',
          knnOptimized: true,
          flexibilityUsed: similarProperties.length < 12,
          progressiveFiltering: allComparables.length > displayComparables.length
        },
        timestamp: new Date().toISOString()
      };

      // Cache results
      this.addToCache(cacheKey, result);
      
      console.log(`✅ Comparable analysis complete: ${result.comparables.length} matches with ${marketContext?.stats?.sampleSize || 0} market insights`);
      return result;
      
    } catch (error) {
      console.error('❌ Error finding comparable properties:', {
        sessionId,
        error: error.message,
        stack: error.stack
      });
      
      return {
        comparables: [],
        summary: 'Error occurred while finding comparable properties',
        criteria: {},
        marketContext: null,
        searchRadius: 0,
        totalFound: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Ensure property data compatibility - handles old format sessions
   * FIXED: Handle both 'type' and 'property_type' fields to match XML standard
   */
  ensurePropertyDataCompatibility(propertyData) {
    if (!propertyData) return propertyData;
    
    // Get property type from either field (prioritize property_type, fallback to type)
    const propertyType = propertyData.property_type || propertyData.type;
    
    // Check if property_type needs transformation (numeric to string) or field standardization
    if (typeof propertyType === 'number' || !propertyData.property_type) {
      console.log(`🔄 Standardizing property type field: ${propertyType} (from ${propertyData.property_type ? 'property_type' : 'type'})`);
      
      // Property type mapping to match database values
      const propertyTypeMappings = {
        0: 'apartment',
        1: 'villa', 
        2: 'townhouse',
        3: 'penthouse',
        4: 'plot',
        5: 'commercial',
        6: 'office',
        7: 'garage',
        8: 'warehouse',
        9: 'country-house'
      };
      
      const transformed = { ...propertyData };
      
      if (typeof propertyType === 'number' && propertyTypeMappings[propertyType]) {
        // Transform numeric to string
        transformed.property_type = propertyTypeMappings[propertyType];
        console.log(`✅ Property type transformed: ${propertyType} → "${transformed.property_type}"`);
      } else if (typeof propertyType === 'string') {
        // Ensure field name is standardized to property_type
        transformed.property_type = propertyType.toLowerCase();
        console.log(`✅ Property type standardized: "${propertyType}" → "${transformed.property_type}"`);
      }
      
      return transformed;
    }
    
    return propertyData;
  }

  /**
   * Extract search criteria from property data with enhanced bathroom support
   */
  extractSearchCriteria(propertyData) {
    // Handle both current format and PropertyList.es format
    let latitude = propertyData.latitude || propertyData.lat;
    let longitude = propertyData.longitude || propertyData.lng;
    
    // PRIORITY: Property's actual location data takes precedence over user input
    // Only use AI-resolved coordinates if property has NO existing coordinates
    if (!latitude || !longitude) {
      // Use resolved location coordinates only when property coordinates are missing
      if (propertyData.resolvedLocation?.coordinates) {
        console.log(`📍 Using resolved location coordinates (property coordinates missing)`);
        latitude = propertyData.resolvedLocation.coordinates.lat;
        longitude = propertyData.resolvedLocation.coordinates.lng;
      } else if (propertyData.resolvedLocation?.enhancedLocation?.coordinates) {
        console.log(`🎯 Using enhanced location coordinates (property coordinates missing)`);
        latitude = propertyData.resolvedLocation.enhancedLocation.coordinates.lat;
        longitude = propertyData.resolvedLocation.enhancedLocation.coordinates.lng;
      }
    } else {
      console.log(`✅ Using property's actual coordinates (${latitude}, ${longitude})`);
    }
    
    // CRITICAL: Detect listing type for proper filtering
    const listingType = this.detectListingType(propertyData);
    console.log(`🏷️ Detected listing type: ${listingType}`);
    
    // ENHANCED: Price field mapping based on listing type
    let price, priceField;
    switch (listingType) {
      case 'sale':
        price = propertyData.sale_price || propertyData.price;
        priceField = 'sale_price';
        break;
      case 'long_term':
        price = propertyData.monthly_price || propertyData.rent_price;
        priceField = 'monthly_price';
        break;
      case 'short_term':
        price = propertyData.weekly_price_from || propertyData.weekly_price_to || propertyData.weekly_price;
        priceField = 'weekly_price_from';
        break;
      default:
        // Fallback to any available price
        price = propertyData.sale_price || propertyData.monthly_price || propertyData.weekly_price_from || propertyData.price;
        priceField = 'sale_price';
        console.warn(`⚠️ Unknown listing type, using fallback price: ${price}`);
    }
    
    const buildArea = propertyData.build_size ||          // XML field name (standardized)
                     propertyData.build_square_meters ||   // Legacy frontend compatibility
                     propertyData.build_area ||            // Legacy database compatibility  
                     propertyData.buildArea || 
                     propertyData.size;
    const bedrooms = propertyData.bedrooms;
    const bathrooms = propertyData.bathrooms; // ENHANCED: Add bathroom support
    const condition = propertyData.condition_rating;
    
    // FIXED: Handle all property type field variations (type, property_type, propertyType)
    let propertyType = propertyData.property_type || propertyData.propertyType || propertyData.type;
    console.log(`🔍 CRITERIA DEBUG - Property type extraction:`);
    console.log(`   propertyData.property_type:`, propertyData.property_type);
    console.log(`   propertyData.propertyType:`, propertyData.propertyType);
    console.log(`   propertyData.type:`, propertyData.type);
    console.log(`   Final propertyType:`, propertyType);
    
    // Transform numeric property type to string if needed (for compatibility with sessions that have 'type' field)
    if (typeof propertyType === 'number') {
      const propertyTypeMappings = {
        0: 'apartment',
        1: 'villa', 
        2: 'townhouse',
        3: 'penthouse',
        4: 'plot',
        5: 'commercial',
        6: 'office',
        7: 'garage',
        8: 'warehouse',
        9: 'country-house'
      };
      
      if (propertyTypeMappings[propertyType]) {
        const originalType = propertyType;
        propertyType = propertyTypeMappings[propertyType];
        console.log(`🔄 Property type transformed in criteria: ${originalType} → "${propertyType}"`);
      }
    }
    
    const city = propertyData.city;
    const suburb = propertyData.suburb;
    const urbanization = propertyData.urbanization || propertyData.urbanization_name;
    const features = propertyData.features || [];

    // ENHANCED: Price ranges adapted for listing type
    let minPrice, maxPrice;
    if (price) {
      switch (listingType) {
        case 'sale':
          // Sale properties: luxury vs standard tolerance
          if (price > 1000000) {
            // Luxury market: ±80% range is normal
            minPrice = price * 0.2;  // 20% of target price
            maxPrice = price * 1.8;  // 180% of target price
          } else {
            // Standard market: ±50% range
            minPrice = price * 0.5;  // 50% of target price  
            maxPrice = price * 1.5;  // 150% of target price
          }
          break;
        case 'long_term':
          // Long-term rentals: ±40% range (more standardized)
          minPrice = price * 0.6;  // 60% of target price
          maxPrice = price * 1.4;  // 140% of target price
          break;
        case 'short_term':
          // Short-term rentals: ±60% range (seasonal variation)
          minPrice = price * 0.4;  // 40% of target price
          maxPrice = price * 1.6;  // 160% of target price
          break;
      }
    }

    console.log(`🔍 FINAL CRITERIA propertyType:`, propertyType);
    console.log(`🏷️ LISTING TYPE: ${listingType} (${priceField})`);
    console.log(`💰 PRICE RANGES: €${minPrice?.toLocaleString()} - €${maxPrice?.toLocaleString()}`);

    return {
      latitude,
      longitude,
      buildArea,
      price,
      minPrice,
      maxPrice,
      bedrooms,
      bathrooms,
      condition,
      propertyType,
      city,
      suburb,
      urbanization,
      reference: propertyData.reference, // CRITICAL: Exclude this property from comparables
      features: Array.isArray(features) ? features : [],
      additionalInfo: propertyData.additionalInfo || propertyData.userProvidedDetails || '',
      enhancedLocation: propertyData.resolvedLocation?.enhancedLocation || null,
      radiusKm: 10, // 10km search radius for comprehensive coverage
      
      // CRITICAL: Listing type filtering
      listingType: listingType,
      priceField: priceField,
      is_sale: listingType === 'sale',
      is_long_term: listingType === 'long_term',
      is_short_term: listingType === 'short_term'
    };
  }

  /**
   * ENHANCED: Get correct price field based on listing type
   */
  getPropertyPrice(property) {
    // Check listing type flags first
    if (property.is_sale) {
      return property.sale_price;
    }
    if (property.is_long_term) {
      return property.monthly_price;
    }
    if (property.is_short_term) {
      return property.weekly_price_from || property.weekly_price_to;
    }
    
    // Fallback: Return first available price
    return property.sale_price || property.monthly_price || property.weekly_price_from || property.weekly_price_to;
  }

  /**
   * ENHANCED: Get listing-type-specific terminology for analysis
   */
  getListingTerminology(listingType) {
    switch (listingType) {
      case 'sale':
        return {
          properties: 'sale properties',
          priceType: 'purchase prices',
          priceUnit: 'sale price',
          marketType: 'sales market',
          analysisType: 'market valuation',
          comparison: 'comparable sales'
        };
      case 'long_term':
        return {
          properties: 'long-term rental properties',
          priceType: 'monthly rental rates',
          priceUnit: 'monthly rent',
          marketType: 'rental market',
          analysisType: 'rental yield analysis',
          comparison: 'comparable rentals'
        };
      case 'short_term':
        return {
          properties: 'short-term rental properties',
          priceType: 'weekly rental rates',
          priceUnit: 'weekly rate',
          marketType: 'holiday rental market',
          analysisType: 'seasonal rental analysis',
          comparison: 'comparable holiday rentals'
        };
      default:
        return {
          properties: 'properties',
          priceType: 'prices',
          priceUnit: 'price',
          marketType: 'market',
          analysisType: 'market analysis',
          comparison: 'comparables'
        };
    }
  }

  /**
   * CRITICAL: Detect listing type from property data
   */
  detectListingType(propertyData) {
    // Check boolean flags first (most reliable)
    if (propertyData.is_sale === true) return 'sale';
    if (propertyData.is_long_term === true) return 'long_term';
    if (propertyData.is_short_term === true) return 'short_term';
    
    // Fallback: Detect by price fields available
    if (propertyData.sale_price && propertyData.sale_price > 0) return 'sale';
    if (propertyData.monthly_price && propertyData.monthly_price > 0) return 'long_term';
    if ((propertyData.weekly_price_from && propertyData.weekly_price_from > 0) || 
        (propertyData.weekly_price_to && propertyData.weekly_price_to > 0)) return 'short_term';
    
    // Final fallback: Check generic price field and make educated guess
    if (propertyData.price && propertyData.price > 0) {
      // Heuristic: Very high prices likely sales, moderate prices likely monthly rentals
      if (propertyData.price > 100000) return 'sale';
      if (propertyData.price > 500 && propertyData.price < 20000) return 'long_term';
      if (propertyData.price < 500) return 'short_term';
    }
    
    console.warn(`⚠️ Could not determine listing type for property ${propertyData.reference}`);
    return 'sale'; // Default fallback
  }

  /**
   * Validate search criteria - supports both coordinate-based and location-based matching
   */
  isValidCriteria(criteria) {
    // Coordinate-based validation (preferred) - ensure both exist
    const hasCoordinates = !!(criteria.latitude && criteria.longitude);
    
    // Location-based validation (fallback) - following old system hierarchy
    const hasLocationData = !!(criteria.urbanization || criteria.suburb || criteria.city);
    
    // Property characteristics validation - require type and at least one size/price metric
    const hasPropertyData = !!(criteria.propertyType &&
                              (criteria.buildArea || criteria.bedrooms || criteria.price));
    
    // Debug logging
    console.log('=== VALIDATION DEBUG ===');
    console.log('hasCoordinates:', hasCoordinates, '(AI will add coordinates later if missing)');
    console.log('hasLocationData:', hasLocationData);
    console.log('hasPropertyData:', hasPropertyData);
    console.log('urbanization:', criteria.urbanization);
    console.log('suburb:', criteria.suburb);
    console.log('city:', criteria.city);
    console.log('propertyType:', criteria.propertyType);
    console.log('buildArea:', criteria.buildArea);
    console.log('bedrooms:', criteria.bedrooms);
    console.log('price:', criteria.price);
    console.log('Validation strategy: Coordinates preferred but location-based search available');
    console.log('Final result:', (hasCoordinates || hasLocationData) && hasPropertyData);
    console.log('========================');
    
    return (hasCoordinates || hasLocationData) && hasPropertyData;
  }

  /**
   * Calculate comprehensive similarity scores using advanced 5-factor weighted algorithm
   * Based on real estate industry best practices with distance as the primary factor
   */
  calculateEnhancedSimilarity(criteria, comparable) {
    // Extract distance from the optimized KNN query result
    const distanceKm = comparable.distance_meters ? 
      (comparable.distance_meters / 1000) : 
      this.calculateFallbackDistance(criteria, comparable);

    // 1. DISTANCE SCORE (30% weight) - Primary factor in real estate
    const maxReasonableDistance = 10; // km
    const distanceScore = Math.min(distanceKm / maxReasonableDistance, 1);
    const distancePercent = Math.max(0, 100 - (distanceScore * 100));

    // 2. SIZE SCORE (25% weight) - Building area similarity
    const targetSize = criteria.buildArea || criteria.build_size;  // XML field name
    const propertySize = comparable.build_size;                    // XML field name
    let sizeScore = 1;
    let sizePercent = 0;
    
    if (targetSize && propertySize && targetSize > 0) {
      const sizeDiff = Math.abs(targetSize - propertySize) / targetSize;
      sizeScore = Math.min(sizeDiff, 1);
      sizePercent = Math.max(0, 100 - (sizeScore * 100));
    } else if (targetSize && propertySize) {
      // Handle edge case where target size might be 0
      sizePercent = targetSize === propertySize ? 100 : 0;
    }

    // 3. PRICE SCORE (25% weight) - Price similarity with condition adjustment
    const targetPrice = criteria.price;
    const propertyPrice = comparable.sale_price;
    let priceScore = 1;
    let pricePercent = 0;
    
    if (targetPrice && propertyPrice && targetPrice > 0) {
      let priceDiff = Math.abs(targetPrice - propertyPrice) / targetPrice;
      
      // REAL ESTATE LOGIC: Adjust price expectations based on condition differences
      const conditionPriceAdjustment = this.calculateConditionPriceAdjustment(criteria.condition, comparable.condition_rating);
      priceDiff = Math.max(0, priceDiff - conditionPriceAdjustment); // Better condition match = lower price diff
      
      priceScore = Math.min(priceDiff, 1);
      pricePercent = Math.max(0, 100 - (priceScore * 100));
    } else if (targetPrice && propertyPrice) {
      // Handle edge case
      pricePercent = targetPrice === propertyPrice ? 100 : 0;
    }

    // 4. BEDROOM SCORE (10% weight) - Layout compatibility
    const bedroomDiff = Math.abs((criteria.bedrooms || 0) - (comparable.bedrooms || 0));
    const maxBedroomDiff = 2;
    const bedroomScore = Math.min(bedroomDiff / maxBedroomDiff, 1);
    const bedroomPercent = Math.max(0, 100 - (bedroomScore * 100));

    // 5. BATHROOM SCORE (10% weight) - NEW: Important for buyers
    const bathroomDiff = Math.abs((criteria.bathrooms || 0) - (comparable.bathrooms || 0));
    const maxBathroomDiff = 2;
    const bathroomScore = Math.min(bathroomDiff / maxBathroomDiff, 1);
    const bathroomPercent = Math.max(0, 100 - (bathroomScore * 100));

    // 6. CONDITION SCORE - NEW: Critical for price understanding
    const conditionScore = this.calculateConditionScore(criteria.condition, comparable.condition_rating, distanceKm);
    const conditionPercent = Math.max(0, 100 - (conditionScore * 100));

    // ENHANCED: Calculate feature similarity bonus (up to 5% boost)
    const featureBonus = this.calculateFeatureSimilarity(criteria.features, comparable.features) / 20; // 0-5%

    // WEIGHTED OVERALL SCORE (Real estate industry best practices with condition)
    const weights = { 
      distance: 0.40,    // Location still KING - slightly reduced for condition
      size: 0.20,        // Size matters for functionality
      condition: 0.20,   // NEW: Condition very important - explains price variation
      price: 0.10,       // Price less important - condition explains variation
      bedrooms: 0.07,    // Layout compatibility
      bathrooms: 0.03    // Nice to have match
    };
    
    const totalScore = (distanceScore * weights.distance) + 
                      (sizeScore * weights.size) + 
                      (conditionScore * weights.condition) +
                      (priceScore * weights.price) + 
                      (bedroomScore * weights.bedrooms) + 
                      (bathroomScore * weights.bathrooms);
    
    // Calculate overall percentage with feature bonus
    const baseOverallPercent = Math.max(0, 100 - (totalScore * 100));
    const overallPercent = Math.min(100, baseOverallPercent + featureBonus);
    
    return {
      totalScore,
      overallPercent: Math.round(overallPercent),
      distancePercent: Math.round(distancePercent),
      sizePercent: Math.round(sizePercent),
      pricePercent: Math.round(pricePercent),
      bedroomPercent: Math.round(bedroomPercent),
      bathroomPercent: Math.round(bathroomPercent), // NEW
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      featureBonus: Math.round(featureBonus * 10) / 10, // NEW
      
      // Legacy compatibility
      distanceScore: totalScore,
      sizeScore: sizeScore,
      priceScore: priceScore,
      bedroomScore: bedroomScore,
      featureScore: this.calculateFeatureSimilarity(criteria.features, comparable.features)
    };
  }

  /**
   * Fallback distance calculation for properties without KNN distance data
   */
  calculateFallbackDistance(criteria, comparable) {
    const { latitude: lat1, longitude: lon1 } = criteria;
    const { latitude: lat2, longitude: lon2 } = comparable;
    
    // If both properties have coordinates, use Haversine formula
    if (lat1 && lon1 && lat2 && lon2) {
      const R = 6371; // Earth's radius in km
      const dLat = this.deg2rad(lat2 - lat1);
      const dLon = this.deg2rad(lon2 - lon1);
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }
    
    // For location-based matching without coordinates, use hierarchy scoring
    const targetLocation = {
      urbanization: criteria.urbanization,
      suburb: criteria.suburb,
      city: criteria.city
    };
    
    const comparableLocation = {
      urbanization: comparable.urbanization,
      suburb: comparable.suburb,
      city: comparable.city
    };
    
    return this.calculateLocationHierarchyDistance(targetLocation, comparableLocation);
  }

  /**
   * Calculate distance using location hierarchy (urbanization > suburb > city)
   */
  calculateLocationHierarchyDistance(targetLocation, comparableLocation) {
    const { urbanization: targetUrb, suburb: targetSub, city: targetCity } = targetLocation;
    const { urbanization: compUrb, suburb: compSub, city: compCity } = comparableLocation;
    
    // Exact urbanization match (best match - equivalent to ~1km distance)
    if (targetUrb && compUrb && targetUrb === compUrb) {
      return 1;
    }
    
    // Same suburb match (good match - equivalent to ~5km distance)
    if (targetSub && compSub && targetSub === compSub) {
      return 5;
    }
    
    // Same city match (acceptable match - equivalent to ~15km distance)
    if (targetCity && compCity && targetCity === compCity) {
      return 15;
    }
    
    // No location match (poor match - equivalent to ~50km distance)
    return 50;
  }

  deg2rad(deg) {
    return deg * (Math.PI/180);
  }

  /**
   * Calculate condition score considering renovation opportunities
   * REAL ESTATE LOGIC: Renovation projects in same location are excellent comparables
   */
  calculateConditionScore(targetCondition, comparableCondition, distanceKm) {
    // If no condition data available, assume neutral
    if (!targetCondition && !comparableCondition) return 0.5;
    if (!targetCondition || !comparableCondition) return 0.7;

    // Define condition hierarchy (higher = better condition)
    const conditionRanking = {
      'new': 5,
      'excellent': 4,
      'very-good': 3,
      'good': 2,
      'needs-renovation': 1,
      'needs-complete-renovation': 0
    };

    const targetRank = conditionRanking[targetCondition] ?? 2; // Default 'good'
    const comparableRank = conditionRanking[comparableCondition] ?? 2;
    
    const conditionDiff = Math.abs(targetRank - comparableRank);
    
    // ENHANCED: Same location renovation projects are VALUABLE comparables
    if (distanceKm <= 2) { // Same urbanization/street
      // Renovation projects show "before improvement" value - very useful!
      if (comparableCondition === 'needs-renovation' || comparableCondition === 'needs-complete-renovation') {
        return 0.1; // Excellent comparable for understanding base value
      }
      // Same condition in same location = perfect match
      if (conditionDiff === 0) return 0.0;
      // Different condition in same location = still very good
      if (conditionDiff <= 2) return 0.2;
    }
    
    // Standard condition scoring (0-1, lower is better)
    return Math.min(conditionDiff / 4, 1);
  }

  /**
   * Calculate price adjustment expectations based on condition differences
   * REAL ESTATE LOGIC: Account for renovation costs in price comparisons
   */
  calculateConditionPriceAdjustment(targetCondition, comparableCondition) {
    if (!targetCondition || !comparableCondition) return 0;

    const conditionValues = {
      'new': 1.0,
      'excellent': 0.95,
      'very-good': 0.90,
      'good': 0.85,
      'needs-renovation': 0.70,  // ~15-30% discount for renovation
      'needs-complete-renovation': 0.50  // ~50% discount for complete renovation
    };

    const targetMultiplier = conditionValues[targetCondition] ?? 0.85;
    const comparableMultiplier = conditionValues[comparableCondition] ?? 0.85;
    
    // If comparable needs renovation and target doesn't, expect lower price
    const adjustmentFactor = Math.abs(targetMultiplier - comparableMultiplier);
    
    // Return reduction in price difference expectation (0-0.3)
    return Math.min(adjustmentFactor * 0.6, 0.3); // Up to 30% price difference is normal
  }

  /**
   * Calculate feature similarity between properties
   */
  calculateFeatureSimilarity(targetFeatures, comparableFeatures) {
    if (!targetFeatures || !comparableFeatures) return 0;
    
    const targetArray = Array.isArray(targetFeatures) ? targetFeatures : 
      this.safeParseJson(targetFeatures, []);
    const comparableArray = Array.isArray(comparableFeatures) ? comparableFeatures :
      this.safeParseJson(comparableFeatures, []);
    
    if (targetArray.length === 0 && comparableArray.length === 0) return 100;
    if (targetArray.length === 0 || comparableArray.length === 0) return 0;
    
    // Calculate Jaccard similarity coefficient
    const targetSet = new Set(targetArray.map(f => typeof f === 'string' ? f.toLowerCase() : String(f).toLowerCase()));
    const comparableSet = new Set(comparableArray.map(f => typeof f === 'string' ? f.toLowerCase() : String(f).toLowerCase()));
    
    const intersection = new Set([...targetSet].filter(x => comparableSet.has(x)));
    const union = new Set([...targetSet, ...comparableSet]);
    
    return Math.round((intersection.size / union.size) * 100);
  }

  /**
   * Generate comprehensive chart data for analysis
   */
  generateChartData(criteria, comparables) {
    const validComparables = comparables.filter(c => c.price && c.price > 0);
    
    if (validComparables.length === 0) {
      return {
        priceComparison: { subject: criteria.price, comparables: [], average: 0 },
        pricePerSqm: { subject: 0, comparables: [] },
        sizeComparison: { subject: criteria.buildArea, comparables: [] },
        marketPosition: { subject: criteria.price, marketRange: { min: 0, max: 0, median: 0 } }
      };
    }

    const prices = validComparables.map(c => c.price);
    const pricesPerSqm = validComparables.map(c => c.pricePerSqm).filter(p => p && p > 0);
    const sizes = validComparables.map(c => c.buildArea).filter(s => s && s > 0);

    return {
      priceComparison: {
        subject: criteria.price,
        comparables: validComparables.map(comp => ({
          price: comp.price,
          address: comp.address,
          distance: comp.distance,
          reference: comp.reference
        })),
        average: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length),
        median: this.calculateMedian(prices),
        min: Math.min(...prices),
        max: Math.max(...prices)
      },
      pricePerSqm: {
        subject: criteria.price / criteria.buildArea,
        comparables: validComparables.map(comp => ({
          pricePerSqm: comp.pricePerSqm,
          address: comp.address,
          reference: comp.reference
        })),
        average: pricesPerSqm.length > 0 ? 
          Math.round(pricesPerSqm.reduce((sum, p) => sum + p, 0) / pricesPerSqm.length) : 0
      },
      sizeComparison: {
        subject: criteria.buildArea,
        comparables: validComparables.map(comp => ({
          size: comp.buildArea,
          address: comp.address,
          reference: comp.reference
        })),
        average: sizes.length > 0 ? 
          Math.round(sizes.reduce((sum, s) => sum + s, 0) / sizes.length) : 0
      },
      marketPosition: {
        subject: criteria.price,
        marketRange: {
          min: Math.min(...prices),
          max: Math.max(...prices),
          median: this.calculateMedian(prices)
        },
        percentile: this.calculatePercentile(criteria.price, prices)
      },
      similarityDistribution: {
        scores: validComparables.map(comp => ({
          address: comp.address,
          overallPercent: comp.overallPercent,
          distancePercent: comp.distancePercent,
          sizePercent: comp.sizePercent,
          pricePercent: comp.pricePercent,
          reference: comp.reference
        }))
      }
    };
  }

  /**
   * Calculate median value
   */
  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? 
      Math.round((sorted[mid - 1] + sorted[mid]) / 2) : 
      sorted[mid];
  }

  /**
   * Calculate percentile position
   */
  calculatePercentile(value, values) {
    if (!value || values.length === 0) return 50;
    
    const sorted = [...values].sort((a, b) => a - b);
    const rank = sorted.filter(v => v <= value).length;
    return Math.round((rank / sorted.length) * 100);
  }

  /**
   * Format ALL properties for comprehensive market analysis (no limit)
   */
  formatComparablesForAnalysis(properties, criteria) {
    return properties.map(property => {
      // Parse JSON fields
      const features = this.safeParseJson(property.features, []);
      const images = this.safeParseJson(property.images, []);
      const descriptions = this.safeParseJson(property.descriptions, {});

      // Calculate enhanced 5-factor similarity scores
      const similarityScores = this.calculateEnhancedSimilarity(criteria, property);

      return {
        id: property.id,
        reference: property.reference,
        address: this.formatAddress(property),
        city: property.city,
        suburb: property.suburb,
        urbanization: property.urbanization,
        propertyType: property.property_type,
        
        // ENHANCED: Dynamic pricing based on listing type
        price: this.getPropertyPrice(property),
        pricePerSqm: this.calculatePricePerSqm(property),
        
        // Size and layout
        buildArea: property.build_size,
        plotArea: property.plot_size,
        terraceArea: property.terrace_size,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        
        // Features and characteristics
        features,
        images,
        descriptions,
        condition: property.condition_rating,
        orientation: property.orientation,
        energyRating: property.energy_rating,
        yearBuilt: property.year_built,
        
        // Location data
        latitude: property.latitude,
        longitude: property.longitude,
        
        // ENHANCED: 5-Factor Similarity Scores
        overallPercent: similarityScores.overallPercent,
        distancePercent: similarityScores.distancePercent,
        sizePercent: similarityScores.sizePercent,
        pricePercent: similarityScores.pricePercent,
        bedroomPercent: similarityScores.bedroomPercent,
        bathroomPercent: similarityScores.bathroomPercent,
        distanceKm: similarityScores.distanceKm,
        featureBonus: similarityScores.featureBonus,
        
        // Legacy compatibility
        similarityScore: 1 - similarityScores.totalScore,
        distanceScore: similarityScores.distanceScore,
        sizeScore: similarityScores.sizeScore,
        priceScore: similarityScores.priceScore,
        bedroomScore: similarityScores.bedroomScore,
        featureScore: similarityScores.featureScore,
        distance: similarityScores.distanceKm,
        
        // Metadata
        lastUpdated: property.last_updated_at,
        listingType: this.getListingType(property)
      };
    })
    .sort((a, b) => b.overallPercent - a.overallPercent); // Sort by best overall match first (NO SLICE)
  }

  /**
   * Select top comparable properties for display with progressive filtering
   */
  selectTopComparablesForDisplay(allComparables, maxCount = 12) {
    // If we have enough good matches, use the top ones
    if (allComparables.length >= maxCount) {
      return allComparables.slice(0, maxCount);
    }
    
    // If we have fewer than maxCount, use progressive filtering to try to get 12
    const expandedSearch = this.expandSearchCriteria(allComparables, maxCount);
    if (expandedSearch.length >= maxCount) {
      return expandedSearch.slice(0, maxCount);
    }
    
    // Return what we have (could be less than 12)
    return allComparables;
  }

  /**
   * Expand search criteria if we don't have enough properties (progressive filtering)
   */
  expandSearchCriteria(comparables, targetCount) {
    // For now, just return what we have
    // Future enhancement: Could relax criteria (wider radius, more property types, etc.)
    return comparables;
  }

  /**
   * Format properties for frontend display with enhanced 5-factor scoring (LEGACY - kept for compatibility)
   */
  formatComparables(properties, criteria) {
    return properties.map(property => {
      // Parse JSON fields
      const features = this.safeParseJson(property.features, []);
      const images = this.safeParseJson(property.images, []);
      const descriptions = this.safeParseJson(property.descriptions, {});

      // Calculate enhanced 5-factor similarity scores
      const similarityScores = this.calculateEnhancedSimilarity(criteria, property);

      return {
        id: property.id,
        reference: property.reference,
        address: this.formatAddress(property),
        city: property.city,
        suburb: property.suburb,
        urbanization: property.urbanization,
        propertyType: property.property_type,
        
        // ENHANCED: Dynamic pricing based on listing type
        price: this.getPropertyPrice(property),
        pricePerSqm: this.calculatePricePerSqm(property),
        
        // Size and layout
        buildArea: property.build_size,
        plotArea: property.plot_size,
        terraceArea: property.terrace_size,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        
        // Features and characteristics
        features,
        images,
        descriptions,
        condition: property.condition_rating,
        orientation: property.orientation,
        energyRating: property.energy_rating,
        yearBuilt: property.year_built,
        
        // Location data
        latitude: property.latitude,
        longitude: property.longitude,
        
        // ENHANCED: 5-Factor Similarity Scores
        overallPercent: similarityScores.overallPercent,
        distancePercent: similarityScores.distancePercent,
        sizePercent: similarityScores.sizePercent,
        pricePercent: similarityScores.pricePercent,
        bedroomPercent: similarityScores.bedroomPercent,
        bathroomPercent: similarityScores.bathroomPercent, // NEW
        distanceKm: similarityScores.distanceKm,
        featureBonus: similarityScores.featureBonus, // NEW
        
        // Legacy compatibility
        similarityScore: 1 - similarityScores.totalScore, // Inverted for compatibility
        distanceScore: similarityScores.distanceScore,
        sizeScore: similarityScores.sizeScore,
        priceScore: similarityScores.priceScore,
        bedroomScore: similarityScores.bedroomScore,
        featureScore: similarityScores.featureScore,
        distance: similarityScores.distanceKm,
        
        // Metadata
        lastUpdated: property.last_updated_at,
        listingType: this.getListingType(property)
      };
    })
    .sort((a, b) => b.overallPercent - a.overallPercent) // Sort by best overall match first
    .slice(0, 12); // Top 12 results for optimal user experience
  }

  /**
   * Format address for display
   */
  formatAddress(property) {
    if (property.address) {
      return property.address;
    }

    const components = [];
    if (property.urbanization) components.push(property.urbanization);
    if (property.suburb && property.suburb !== property.urbanization) {
      components.push(property.suburb);
    }
    if (property.city) components.push(property.city);
    
    return components.join(', ') || 'Address not available';
  }

  /**
   * Calculate price per square meter
   */
  calculatePricePerSqm(property) {
    const price = this.getPropertyPrice(property);
    const area = property.build_area;
    
    if (price && area && area > 0) {
      return Math.round(price / area);
    }
    
    return null;
  }

  /**
   * Get listing type
   */
  getListingType(property) {
    if (property.is_sale) return 'sale';
    if (property.is_long_term) return 'long_term_rental';
    if (property.is_short_term) return 'short_term_rental';
    return 'unknown';
  }

  /**
   * Safe JSON parsing - handles both JSON strings and already-parsed JSONB objects
   */
  safeParseJson(jsonData, fallback = null) {
    try {
      // If it's already an object/array (JSONB from PostgreSQL), return it directly
      if (typeof jsonData === 'object' && jsonData !== null) {
        return jsonData;
      }
      
      // If it's a string, parse it
      if (typeof jsonData === 'string') {
        return JSON.parse(jsonData || 'null') || fallback;
      }
      
      // For any other type, return fallback
      return fallback;
    } catch (e) {
      return fallback;
    }
  }

  /**
   * Generate enhanced summary with market context
   */
  generateEnhancedSummary(comparables, criteria, marketContext) {
    if (comparables.length === 0) {
      return `No comparable properties found within ${criteria.radiusKm}km radius.`;
    }

    const prices = comparables
      .map(c => c.price)
      .filter(p => p && p > 0)
      .sort((a, b) => a - b);

    if (prices.length === 0) {
      return `Found ${comparables.length} properties but no pricing data available.`;
    }

    const cities = [...new Set(comparables.map(c => c.city).filter(city => city))];
    const avgSimilarity = Math.round(
      comparables.reduce((sum, c) => sum + c.overallPercent, 0) / comparables.length
    );

    // ENHANCED: Listing-type-specific terminology
    const listingTerms = this.getListingTerminology(criteria.listingType);
    let summary = `Found ${comparables.length} comparable ${listingTerms.properties}`;
    
    if (criteria.latitude && criteria.longitude) {
      summary += ` within ${criteria.radiusKm}km radius`;
    } else if (cities.length === 1) {
      summary += ` in ${cities[0]}`;
    } else if (cities.length > 1) {
      summary += ` across ${cities.length} locations`;
    }
    
    // Use market context for better insights
    if (marketContext) {
      summary += `. Market median ${listingTerms.priceUnit}: €${marketContext.stats.medianPrice.toLocaleString()}`;
      summary += `, ranging from €${marketContext.stats.minPrice.toLocaleString()} to €${marketContext.stats.maxPrice.toLocaleString()}`;
    summary += `. Average similarity: ${avgSimilarity}%`;
    
      // Add market positioning insight
      if (marketContext.position.marketPosition === 'above_market') {
        summary += `. Property positioned above ${listingTerms.marketType} median`;
      } else {
        summary += `. Property positioned below ${listingTerms.marketType} median`;
      }
    } else {
      // Fallback to simple average
      const avgPrice = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);
      summary += `. Average ${listingTerms.priceUnit}: €${avgPrice.toLocaleString()}`;
      summary += `, ranging from €${prices[0].toLocaleString()} to €${prices[prices.length - 1].toLocaleString()}`;
      summary += `. Average similarity: ${avgSimilarity}%`;
    }

    return summary;
  }

  /**
   * Generate market intelligence insights with median-based analysis
   */
  generateMarketInsights(comparables, subjectProperty) {
    if (!comparables || comparables.length === 0) return null;

    // Price analysis
    const prices = comparables.map(c => c.price).filter(p => p && p > 0);
    const pricesPerSqm = comparables.map(c => c.pricePerSqm).filter(p => p && p > 0);
    
    if (prices.length === 0) return null;

    // Market statistics (median-focused for outlier resistance)
    const stats = {
      avgPrice: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length),
      medianPrice: this.calculateMedian(prices),
      avgPricePerSqm: pricesPerSqm.length > 0 ? 
        Math.round(pricesPerSqm.reduce((sum, p) => sum + p, 0) / pricesPerSqm.length) : 0,
      medianPricePerSqm: pricesPerSqm.length > 0 ? this.calculateMedian(pricesPerSqm) : 0,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      priceRange: Math.max(...prices) - Math.min(...prices),
      sampleSize: comparables.length
    };

    // Subject property market position
    const subjectPrice = subjectProperty.price || subjectProperty.sale_price;
    const subjectPricePerSqm = subjectProperty.pricePerSqm || 
      (subjectProperty.build_area ? Math.round(subjectPrice / subjectProperty.build_area) : null);
    
    const position = {
      vsAverage: subjectPrice / stats.avgPrice,
      vsMedian: subjectPrice / stats.medianPrice,
      percentile: this.calculatePercentile(subjectPrice, prices),
      marketPosition: subjectPrice > stats.medianPrice ? 'above_market' : 'below_market',
      pricePerSqmVsMarket: subjectPricePerSqm && stats.medianPricePerSqm ? 
        subjectPricePerSqm / stats.medianPricePerSqm : null
    };

    // Generate professional insights
    const insights = [];
    
    // Price positioning insights
    if (position.vsMedian > 1.2) {
      insights.push(`Property is priced ${Math.round((position.vsMedian - 1) * 100)}% above market median, indicating premium positioning`);
    } else if (position.vsMedian < 0.8) {
      insights.push(`Property is priced ${Math.round((1 - position.vsMedian) * 100)}% below market median, representing potential value`);
    } else {
      insights.push('Property is competitively priced within the median market range');
    }

    // Percentile insights
    if (position.percentile >= 80) {
      insights.push(`Property ranks in the top ${100 - position.percentile}% of comparable properties by price`);
    } else if (position.percentile <= 20) {
      insights.push(`Property ranks in the bottom ${position.percentile}% of comparable properties by price`);
    }

    // Market coverage insights
    if (comparables.length >= 10) {
      insights.push(`Analysis based on robust sample of ${comparables.length} comparable properties`);
    } else {
      insights.push(`Limited market data: analysis based on ${comparables.length} properties`);
    }

    // Price per m² insights
    if (position.pricePerSqmVsMarket) {
      if (position.pricePerSqmVsMarket > 1.15) {
        insights.push(`Price per m² is ${Math.round((position.pricePerSqmVsMarket - 1) * 100)}% above market average`);
      } else if (position.pricePerSqmVsMarket < 0.85) {
        insights.push(`Price per m² is ${Math.round((1 - position.pricePerSqmVsMarket) * 100)}% below market average`);
      }
    }

    return {
      stats,
      position,
      insights,
      comparableCount: comparables.length,
      priceDistribution: this.analyzePriceDistribution(prices, subjectPrice),
      marketVolatility: this.calculateMarketVolatility(prices),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Analyze price distribution for histogram visualization
   */
  analyzePriceDistribution(prices, subjectPrice) {
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const min = sortedPrices[0];
    const max = sortedPrices[sortedPrices.length - 1];
    const range = max - min;
    
    // Create 8 buckets for distribution
    const buckets = 8;
    const bucketSize = range / buckets;
    const histogram = Array(buckets).fill(0);
    let subjectBucket = -1;
    
    prices.forEach(price => {
      const bucket = Math.min(Math.floor((price - min) / bucketSize), buckets - 1);
      histogram[bucket]++;
    });
    
    // Find subject property bucket
    if (subjectPrice) {
      subjectBucket = Math.min(Math.floor((subjectPrice - min) / bucketSize), buckets - 1);
    }
    
    return {
      histogram,
      subjectBucket,
      bucketSize: Math.round(bucketSize),
      min: Math.round(min),
      max: Math.round(max),
      labels: histogram.map((_, i) => {
        const start = Math.round(min + (i * bucketSize));
        const end = Math.round(min + ((i + 1) * bucketSize));
        return `€${start.toLocaleString()}-${end.toLocaleString()}`;
      })
    };
  }

  /**
   * Calculate market volatility score
   */
  calculateMarketVolatility(prices) {
    if (prices.length < 3) return 'insufficient_data';
    
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / mean;
    
    if (coefficientOfVariation < 0.15) return 'low';
    if (coefficientOfVariation < 0.30) return 'moderate';
    return 'high';
  }

  /**
   * Apply location exclusion filtering to prevent cross-contamination
   * Specifically prevents "New Golden Mile" appearing when searching for "Golden Mile"
   */
  applyLocationExclusions(properties, criteria) {
    const searchLocation = criteria.suburb || criteria.urbanization || '';
    
    if (!searchLocation) {
      return properties; // No location-based filtering needed
    }
    
    return properties.filter(property => {
      const propertyLocation = property.suburb || property.urbanization || '';
      
      // Use location intelligence to check if this property should be excluded
      const shouldExclude = this.locationIntelligence.shouldExcludeLocation(searchLocation, propertyLocation);
      
      if (shouldExclude) {
        console.log(`❌ Excluding "${propertyLocation}" when searching for "${searchLocation}"`);
        return false;
      }
      
      return true;
    });
  }

  /**
   * Generate cache key for session/property combination
   */
  generateCacheKey(sessionId, propertyData) {
    const keyData = {
      sessionId,
      reference: propertyData.reference,
      price: propertyData.price,
      bedrooms: propertyData.bedrooms,
      buildArea: propertyData.build_square_meters || propertyData.build_area
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64').slice(0, 32);
  }

  /**
   * Get result from cache
   */
  getFromCache(key) {
    return this.cache.get(key);
  }

  /**
   * Add result to cache
   */
  addToCache(key, result) {
    this.cache.set(key, result);
  }

  /**
   * Clear all cached results
   */
  clearCache() {
    this.cache.flushAll();
    console.log('Comparable properties cache cleared');
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    const stats = this.cache.getStats();
    return {
      keys: this.cache.keys().length,
      hits: stats.hits,
      misses: stats.misses,
      ksize: stats.ksize,
      vsize: stats.vsize
    };
  }
}

module.exports = ComparableService; 