const NodeCache = require('node-cache');
const AIAnalysisService = require('./aiAnalysisService');
const TavilyResearchService = require('./tavilyResearchService');

class ComparableService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    this.cache = new NodeCache({ stdTTL: 1800 }); // 30 minutes cache
    this.aiAnalysis = new AIAnalysisService();
    this.tavilyResearch = new TavilyResearchService();
  }

  /**
   * Find comparable properties for a given property with enhanced analysis
   */
  async findComparables(sessionId, propertyData) {
    // Check cache first
    const cacheKey = this.generateCacheKey(sessionId, propertyData);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log('✅ Returning cached comparable results for session:', sessionId);
      return cached;
    }

    try {
      console.log('🔍 Finding comparable properties for session:', sessionId);
      
      // Extract search criteria from property data
      const criteria = this.extractSearchCriteria(propertyData);
      
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
      
      // Format results for frontend with 5-factor scoring
      const comparables = this.formatComparables(similarProperties, criteria);
      console.log(`🎯 Formatted ${comparables.length} comparable properties with enhanced scoring`);
      
      // Generate market intelligence analysis
      const marketContext = this.generateMarketInsights(comparables, propertyData);
      console.log(`💹 Generated market context: ${marketContext?.insights?.length || 0} insights`);

      // Generate summary with market context
      const summary = this.generateEnhancedSummary(comparables, criteria, marketContext);

      // Generate enhanced chart data
      const chartData = this.generateChartData(criteria, comparables);

      // Generate AI-powered analysis with market context
      let aiInsights = null;
      try {
        if (process.env.OPENAI_API_KEY && comparables.length > 0) {
          console.log('🤖 Generating AI analysis with market context...');
          aiInsights = await this.aiAnalysis.generatePropertyAnalysis(
            propertyData, 
            { comparables, summary, criteria, marketContext }, 
            chartData
          );
          console.log(`🎯 AI analysis generated with ${aiInsights.confidence}% confidence`);
        }
      } catch (error) {
        console.error('❌ AI analysis failed:', error.message);
      }

      // Generate market research insights
      let marketResearch = null;
      try {
        if (process.env.TAVILY_API_KEY && comparables.length > 0) {
          console.log('📰 Conducting market research...');
          marketResearch = await this.tavilyResearch.generateAreaReport(propertyData);
          console.log('✅ Market research completed for:', marketResearch.location);
        }
      } catch (error) {
        console.error('❌ Market research failed:', error.message);
      }

      const result = {
        comparables,
        summary,
        criteria,
        chartData,
        marketContext, // NEW: Enhanced market intelligence
        aiInsights,
        marketResearch,
        searchRadius: criteria.radiusKm,
        totalFound: similarProperties.length,
        performanceMetrics: {
          databaseQueryTime: Date.now(),
          scoringMethod: '5-factor_weighted',
          knnOptimized: true,
          flexibilityUsed: similarProperties.length < 12
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
   * Extract search criteria from property data with enhanced bathroom support
   */
  extractSearchCriteria(propertyData) {
    // Handle both current format and PropertyList.es format
    let latitude = propertyData.latitude || propertyData.lat;
    let longitude = propertyData.longitude || propertyData.lng;
    
    // ENHANCED: Check for enhanced location from user input
    if (propertyData.resolvedLocation?.enhancedLocation?.coordinates) {
      console.log(`🎯 Using enhanced location coordinates from user input`);
      latitude = propertyData.resolvedLocation.enhancedLocation.coordinates.lat;
      longitude = propertyData.resolvedLocation.enhancedLocation.coordinates.lng;
    } else if (propertyData.resolvedLocation?.coordinates) {
      console.log(`📍 Using resolved location coordinates`);
      latitude = propertyData.resolvedLocation.coordinates.lat;
      longitude = propertyData.resolvedLocation.coordinates.lng;
    }
    
    const buildArea = propertyData.build_size ||          // XML field name (standardized)
                     propertyData.build_square_meters ||   // Legacy frontend compatibility
                     propertyData.build_area ||            // Legacy database compatibility  
                     propertyData.buildArea || 
                     propertyData.size;
    const price = propertyData.price || propertyData.sale_price;
    const bedrooms = propertyData.bedrooms;
    const bathrooms = propertyData.bathrooms; // ENHANCED: Add bathroom support
    const propertyType = propertyData.property_type || propertyData.propertyType;
    const city = propertyData.city;
    const suburb = propertyData.suburb;
    const urbanization = propertyData.urbanization || propertyData.urbanization_name;
    const features = propertyData.features || [];

    return {
      latitude,
      longitude,
      buildArea,
      price,
      bedrooms,
      bathrooms, // NEW: Include bathrooms in criteria
      propertyType,
      city,
      suburb,
      urbanization,
      features: Array.isArray(features) ? features : [],
      additionalInfo: propertyData.additionalInfo || propertyData.userProvidedDetails || '',
      enhancedLocation: propertyData.resolvedLocation?.enhancedLocation || null, // NEW: Enhanced location data
      radiusKm: 10 // 10km search radius for comprehensive coverage
    };
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
    const targetSize = criteria.buildArea || criteria.build_size || criteria.build_area;  // XML field first
    const propertySize = comparable.build_size || comparable.build_area;                 // XML field first
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

    // 3. PRICE SCORE (25% weight) - Price similarity
    const targetPrice = criteria.price;
    const propertyPrice = comparable.sale_price;
    let priceScore = 1;
    let pricePercent = 0;
    
    if (targetPrice && propertyPrice && targetPrice > 0) {
      const priceDiff = Math.abs(targetPrice - propertyPrice) / targetPrice;
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

    // ENHANCED: Calculate feature similarity bonus (up to 5% boost)
    const featureBonus = this.calculateFeatureSimilarity(criteria.features, comparable.features) / 20; // 0-5%

    // WEIGHTED OVERALL SCORE (Real estate industry optimized weights)
    const weights = { 
      distance: 0.30,    // Location is king in real estate
      size: 0.25,        // Size matters significantly
      price: 0.25,       // Price is crucial for comparison
      bedrooms: 0.10,    // Layout factor
      bathrooms: 0.10    // Convenience factor
    };
    
    const totalScore = (distanceScore * weights.distance) + 
                      (sizeScore * weights.size) + 
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
    const targetSet = new Set(targetArray.map(f => f.toLowerCase()));
    const comparableSet = new Set(comparableArray.map(f => f.toLowerCase()));
    
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
   * Format properties for frontend display with enhanced 5-factor scoring
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
        
        // Pricing with enhanced calculations
        price: property.sale_price || property.monthly_price,
        pricePerSqm: this.calculatePricePerSqm(property),
        
        // Size and layout
        buildArea: property.build_area,
        plotArea: property.plot_size,
        terraceArea: property.terrace_area,
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
    const price = property.sale_price || property.monthly_price;
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
   * Safe JSON parsing
   */
  safeParseJson(jsonString, fallback = null) {
    try {
      return JSON.parse(jsonString || 'null') || fallback;
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

    let summary = `Found ${comparables.length} comparable properties`;
    
    if (criteria.latitude && criteria.longitude) {
      summary += ` within ${criteria.radiusKm}km radius`;
    } else if (cities.length === 1) {
      summary += ` in ${cities[0]}`;
    } else if (cities.length > 1) {
      summary += ` across ${cities.length} locations`;
    }
    
    // Use market context for better insights
    if (marketContext) {
      summary += `. Market median: €${marketContext.stats.medianPrice.toLocaleString()}`;
      summary += `, ranging from €${marketContext.stats.minPrice.toLocaleString()} to €${marketContext.stats.maxPrice.toLocaleString()}`;
    summary += `. Average similarity: ${avgSimilarity}%`;
    
      // Add market positioning insight
      if (marketContext.position.marketPosition === 'above_market') {
        summary += `. Property positioned above market median`;
      } else {
        summary += `. Property positioned below market median`;
      }
    } else {
      // Fallback to simple average
      const avgPrice = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);
      summary += `. Average price: €${avgPrice.toLocaleString()}`;
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