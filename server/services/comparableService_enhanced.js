class ComparableService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    this.resultCache = new Map(); // sessionId -> cached results
    this.cacheMaxAge = 30 * 60 * 1000; // 30 minutes
    this.cacheMaxSize = 100;
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
      
      // Format results for frontend with enhanced scoring
      const comparables = this.formatComparables(similarProperties, criteria);
      
      // Generate chart data
      const chartData = this.generateChartData(criteria, comparables, criteria);
      
      // Generate enhanced summary
      const summary = this.generateSummary(comparables, criteria);
      
      const result = {
        comparables,
        summary,
        criteria,
        chartData,
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
        error: error.message
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
      features: Array.isArray(features) ? features : [],
      radiusKm: 10 // 10km search radius for 5000 properties
    };
  }

  /**
   * Validate search criteria
   */
  isValidCriteria(criteria) {
    return criteria.latitude && 
           criteria.longitude && 
           criteria.propertyType &&
           (criteria.buildArea || criteria.bedrooms || criteria.price);
  }

  /**
   * Calculate comprehensive similarity scores using weighted algorithm from old system
   */
  calculateEnhancedSimilarity(criteria, comparable) {
    // Calculate distance using Haversine formula
    const distance = this.calculateDistance(
      criteria.latitude, criteria.longitude,
      comparable.latitude, comparable.longitude
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
   * Calculate distance using Haversine formula (from old system)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999999; // Very high distance for missing coordinates
    
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
    .slice(0, 12); // Limit to top 12 matches
  }
