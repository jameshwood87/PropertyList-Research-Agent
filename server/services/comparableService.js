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
   * Find comparable properties for a given property
   */
  async findComparables(sessionId, propertyData) {
    // Check cache first
    const cacheKey = this.generateCacheKey(sessionId, propertyData);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log('Returning cached comparable results for session:', sessionId);
      return cached;
    }

    try {
      console.log('Finding comparable properties for session:', sessionId);
      
      // Extract search criteria from property data
      const criteria = this.extractSearchCriteria(propertyData);
      
      if (!this.isValidCriteria(criteria)) {
        return {
          comparables: [],
          summary: 'Insufficient property data for comparable analysis',
          criteria: criteria
        };
      }

      // Find similar properties using optimized database
      const similarProperties = await this.propertyDb.findSimilarProperties(criteria);
      
      // Format results for frontend
      const comparables = this.formatComparables(similarProperties, criteria);
      
      // Generate summary
      const summary = this.generateSummary(comparables, criteria);

      // Generate chart data
      const chartData = this.generateChartData(criteria, comparables);

      // Generate AI-powered analysis
      let aiInsights = null;
      try {
        if (process.env.OPENAI_API_KEY && comparables.length > 0) {
          console.log('Generating AI analysis for session:', sessionId);
          aiInsights = await this.aiAnalysis.generatePropertyAnalysis(
            propertyData, 
            { comparables, summary, criteria }, 
            chartData
          );
          console.log(`AI analysis generated with ${aiInsights.confidence}% confidence`);
        }
      } catch (error) {
        console.error('AI analysis failed:', error.message);
      }

      // Generate market research insights
      let marketResearch = null;
      try {
        if (process.env.TAVILY_API_KEY && comparables.length > 0) {
          console.log('Conducting market research for session:', sessionId);
          marketResearch = await this.tavilyResearch.generateAreaReport(propertyData);
          console.log('Market research completed for:', marketResearch.location);
        }
      } catch (error) {
        console.error('Market research failed:', error.message);
      }

      const result = {
        comparables,
        summary,
        criteria,
        chartData,
        aiInsights,
        marketResearch,
        searchRadius: criteria.radiusKm,
        totalFound: similarProperties.length,
        timestamp: new Date().toISOString()
      };

      // Cache results
      this.addToCache(cacheKey, result);
      
      console.log(`Found ${comparables.length} comparable properties for session ${sessionId}`);
      return result;
      
    } catch (error) {
      console.error('Error finding comparable properties:', {
        sessionId,
        error: error.message,
        stack: error.stack
      });
      
      return {
        comparables: [],
        summary: 'Error occurred while finding comparable properties',
        criteria: {},
        searchRadius: 0,
        totalFound: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Extract search criteria from property data
   */
  extractSearchCriteria(propertyData) {
    // Handle both current format and PropertyList.es format
    const latitude = propertyData.latitude || propertyData.lat;
    const longitude = propertyData.longitude || propertyData.lng;
    const buildArea = propertyData.build_square_meters || 
                     propertyData.build_area || 
                     propertyData.buildArea || 
                     propertyData.size;
    const price = propertyData.price || propertyData.sale_price;
    const bedrooms = propertyData.bedrooms;
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
      propertyType,
      city,
      suburb,
      urbanization,
      features: Array.isArray(features) ? features : [],
      additionalInfo: propertyData.additionalInfo || propertyData.userProvidedDetails || '',
      radiusKm: 10 // 10km search radius for 5000 properties
    };
  }

  /**
   * Validate search criteria - supports both coordinate-based and location-based matching
   */
  isValidCriteria(criteria) {
    // Coordinate-based validation (preferred)
    const hasCoordinates = criteria.latitude && criteria.longitude;
    
    // Location-based validation (fallback) - following old system hierarchy
    const hasLocationData = criteria.urbanization || criteria.suburb || criteria.city;
    
    // Property characteristics validation
    const hasPropertyData = criteria.propertyType &&
                           (criteria.buildArea || criteria.bedrooms || criteria.price);
    
    // Debug logging
    console.log('=== VALIDATION DEBUG ===');
    console.log('hasCoordinates:', hasCoordinates);
    console.log('hasLocationData:', hasLocationData);
    console.log('hasPropertyData:', hasPropertyData);
    console.log('urbanization:', criteria.urbanization);
    console.log('suburb:', criteria.suburb);
    console.log('city:', criteria.city);
    console.log('propertyType:', criteria.propertyType);
    console.log('buildArea:', criteria.buildArea);
    console.log('bedrooms:', criteria.bedrooms);
    console.log('price:', criteria.price);
    console.log('Final result:', (hasCoordinates || hasLocationData) && hasPropertyData);
    console.log('========================');
    
    return (hasCoordinates || hasLocationData) && hasPropertyData;
  }

  /**
   * Calculate comprehensive similarity scores using weighted algorithm from old system
   */
  calculateEnhancedSimilarity(criteria, comparable) {
    // Prepare location objects for distance calculation
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

    // Calculate distance using enhanced method
    const distance = this.calculateDistance(
      criteria.latitude, criteria.longitude,
      comparable.latitude, comparable.longitude,
      targetLocation, comparableLocation
    );
    
    // Calculate size difference (percentage)
    const sizeDiff = criteria.buildArea && comparable.build_area ? 
      Math.abs(comparable.build_area - criteria.buildArea) / criteria.buildArea : 0;
    
    // Calculate price difference (percentage)
    const price = comparable.sale_price || comparable.monthly_price;
    const priceDiff = criteria.price && price ? 
      Math.abs(price - criteria.price) / criteria.price : 0;
    
    // Calculate bedroom difference (absolute)
    const bedroomDiff = criteria.bedrooms && comparable.bedrooms ? 
      Math.abs(comparable.bedrooms - criteria.bedrooms) : 0;
    
    // Calculate feature similarity
    const featureScore = this.calculateFeatureSimilarity(criteria.features, comparable.features);
    
    // Weighted similarity score (lower is better) - using old system weights
    const totalScore = (distance * 0.4) + (sizeDiff * 0.3) + (priceDiff * 0.2) + (bedroomDiff * 0.1);
    
    return {
      totalScore: totalScore,
      distanceScore: distance,
      sizeScore: sizeDiff,
      priceScore: priceDiff,
      bedroomScore: bedroomDiff,
      featureScore: featureScore,
      // Convert to percentage scores for easier interpretation
      distancePercent: Math.round((1 / (1 + distance)) * 100),
      sizePercent: Math.round((1 / (1 + sizeDiff)) * 100),
      pricePercent: Math.round((1 / (1 + priceDiff)) * 100),
      bedroomPercent: bedroomDiff === 0 ? 100 : Math.round((1 / (1 + bedroomDiff)) * 100),
      overallPercent: Math.round((1 / (1 + totalScore)) * 100)
    };
  }

  /**
   * Calculate distance using Haversine formula or location hierarchy scoring
   */
  calculateDistance(lat1, lon1, lat2, lon2, targetLocation = {}, comparableLocation = {}) {
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
    // Lower scores = better match (same as distance in km)
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
   * Format properties for frontend display with enhanced scoring
   */
  formatComparables(properties, criteria) {
    return properties.map(property => {
      // Parse JSON fields
      const features = this.safeParseJson(property.features, []);
      const images = this.safeParseJson(property.images, []);
      const descriptions = this.safeParseJson(property.descriptions, {});

      // Calculate enhanced similarity scores
      const similarityScores = this.calculateEnhancedSimilarity(criteria, property);

      return {
        id: property.id,
        reference: property.reference,
        address: this.formatAddress(property),
        city: property.city,
        suburb: property.suburb,
        propertyType: property.property_type,
        
        // Pricing
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
        
        // Location and similarity
        latitude: property.latitude,
        longitude: property.longitude,
        distance: similarityScores.distanceScore,
        
        // Enhanced similarity scores
        similarityScore: similarityScores.totalScore,
        distanceScore: similarityScores.distanceScore,
        sizeScore: similarityScores.sizeScore,
        priceScore: similarityScores.priceScore,
        bedroomScore: similarityScores.bedroomScore,
        featureScore: similarityScores.featureScore,
        
        // Percentage scores for easy interpretation
        distancePercent: similarityScores.distancePercent,
        sizePercent: similarityScores.sizePercent,
        pricePercent: similarityScores.pricePercent,
        bedroomPercent: similarityScores.bedroomPercent,
        overallPercent: similarityScores.overallPercent,
        
        // Metadata
        lastUpdated: property.last_updated_at,
        listingType: this.getListingType(property)
      };
    })
    .sort((a, b) => a.similarityScore - b.similarityScore) // Sort by best match first
    .slice(0, 10); // Limit to top 10 matches
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
   * Generate summary of comparable analysis
   */
  generateSummary(comparables, criteria) {
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

    const avgPrice = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);
    const minPrice = prices[0];
    const maxPrice = prices[prices.length - 1];

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
    
    summary += `. Average price: €${avgPrice.toLocaleString()}, ranging from €${minPrice.toLocaleString()} to €${maxPrice.toLocaleString()}`;
    summary += `. Average similarity: ${avgSimilarity}%`;
    
    if (criteria.price) {
      const position = this.calculatePercentile(criteria.price, prices);
      if (position <= 25) {
        summary += `. Property is priced in the lower quartile of the market.`;
      } else if (position <= 75) {
        summary += `. Property is priced in the middle range of the market.`;
      } else {
        summary += `. Property is priced in the upper quartile of the market.`;
      }
    }

    return summary;
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