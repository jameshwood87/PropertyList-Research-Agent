const axios = require('axios');

/**
 * Google Places Service - Phase 2
 * 
 * Provides system-based amenities data using Google Places API:
 * 1. Essential Services (schools, hospitals, pharmacies)
 * 2. Shopping & Dining (supermarkets, restaurants, shopping centers)
 * 3. Transportation (bus stops, train stations, airports)
 * 4. Recreation & Culture (parks, gyms, museums)
 * 5. Distance calculations and travel times
 */
class GooglePlacesService {
  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/place';
    
    // Cache for places data (reduces API calls)
    this.placesCache = new Map();
    this.cacheTTL = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    // Place types categorized by importance
    this.placeCategories = {
      essential: {
        schools: ['school', 'primary_school', 'secondary_school', 'university'],
        healthcare: ['hospital', 'doctor', 'pharmacy', 'dentist'],
        safety: ['police', 'fire_station'],
        basic_services: ['bank', 'post_office', 'gas_station']
      },
      shopping: {
        groceries: ['supermarket', 'grocery_or_supermarket'],
        shopping: ['shopping_mall', 'department_store', 'clothing_store'],
        dining: ['restaurant', 'meal_takeaway', 'cafe', 'bakery']
      },
      transportation: {
        public_transport: ['bus_station', 'subway_station', 'train_station', 'transit_station'],
        airports: ['airport'],
        parking: ['parking']
      },
      recreation: {
        fitness: ['gym', 'spa'],
        entertainment: ['movie_theater', 'museum', 'amusement_park'],
        outdoor: ['park', 'zoo', 'aquarium'],
        sports: ['stadium', 'bowling_alley']
      }
    };
    
    // Search radii for different place types (in meters)
    this.searchRadii = {
      essential: 2000,     // 2km for essential services
      shopping: 1500,      // 1.5km for shopping
      transportation: 5000, // 5km for transport hubs
      recreation: 3000     // 3km for recreation
    };
    
    this.metrics = {
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    };
  }

  /**
   * Get comprehensive amenities data for a property location
   */
  async getAmenitiesForProperty(propertyData) {
    if (!this.apiKey) {
      return this.createFallbackAmenities(propertyData);
    }

    const { latitude, longitude } = propertyData;
    if (!latitude || !longitude) {
      return this.createFallbackAmenities(propertyData);
    }

    try {
      console.log(`🏪 Fetching amenities for location: ${latitude}, ${longitude}`);
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(latitude, longitude);
      
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        console.log('   ⚡ Using cached amenities data');
        return cached;
      }
      
      this.metrics.cacheMisses++;
      
      // Search for places in all categories
      const [essential, shopping, transportation, recreation] = await Promise.all([
        this.searchCategoryPlaces(latitude, longitude, 'essential'),
        this.searchCategoryPlaces(latitude, longitude, 'shopping'),
        this.searchCategoryPlaces(latitude, longitude, 'transportation'),
        this.searchCategoryPlaces(latitude, longitude, 'recreation')
      ]);
      
      // Process and format results
      const amenitiesData = {
        location: {
          latitude,
          longitude,
          address: this.formatLocation(propertyData)
        },
        categories: {
          essential,
          shopping,
          transportation,
          recreation
        },
        summary: this.generateAmenitiesSummary({ essential, shopping, transportation, recreation }),
        quality: this.calculateAmenitiesQuality({ essential, shopping, transportation, recreation }),
        lastUpdated: new Date().toISOString(),
        dataSource: 'Google Places API'
      };
      
      // Cache the results
      this.cacheResults(cacheKey, amenitiesData);
      
      console.log(`   ✅ Found amenities: ${amenitiesData.summary.totalPlaces} places in 4 categories`);
      
      return amenitiesData;
      
    } catch (error) {
      console.error('❌ Error fetching amenities from Google Places:', error.message);
      this.metrics.errors++;
      return this.createFallbackAmenities(propertyData);
    }
  }

  /**
   * Search for places in a specific category
   */
  async searchCategoryPlaces(latitude, longitude, categoryName) {
    const category = this.placeCategories[categoryName];
    const radius = this.searchRadii[categoryName];
    
    const categoryResults = {};
    
    for (const [subcategory, placeTypes] of Object.entries(category)) {
      try {
        // Find the best place types for this subcategory
        const places = await this.findBestPlaces(latitude, longitude, placeTypes, radius, 5);
        categoryResults[subcategory] = places;
        
      } catch (error) {
        console.warn(`⚠️ Error searching ${subcategory}:`, error.message);
        categoryResults[subcategory] = [];
      }
    }
    
    return categoryResults;
  }

  /**
   * Find the best places for given types
   */
  async findBestPlaces(latitude, longitude, placeTypes, radius, maxResults = 5) {
    // Try each place type until we get good results
    for (const placeType of placeTypes) {
      try {
        const places = await this.searchNearbyPlaces(latitude, longitude, placeType, radius);
        
        if (places.length > 0) {
          // Sort by rating and proximity, return top results
          const sortedPlaces = places
            .sort((a, b) => {
              // Prioritize rating first, then proximity
              const ratingDiff = (b.rating || 0) - (a.rating || 0);
              if (Math.abs(ratingDiff) > 0.5) return ratingDiff;
              return a.distance - b.distance;
            })
            .slice(0, maxResults);
          
          return sortedPlaces;
        }
      } catch (error) {
        console.warn(`⚠️ Error searching place type ${placeType}:`, error.message);
      }
    }
    
    return [];
  }

  /**
   * Search nearby places using Google Places API
   */
  async searchNearbyPlaces(latitude, longitude, placeType, radius) {
    const url = `${this.baseUrl}/nearbysearch/json`;
    
    const params = {
      location: `${latitude},${longitude}`,
      radius: radius,
      type: placeType,
      key: this.apiKey
    };
    
    this.metrics.apiCalls++;
    
    const response = await axios.get(url, { 
      params,
      timeout: 10000 // 10 second timeout
    });
    
    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API error: ${response.data.status}`);
    }
    
    const places = (response.data.results || []).map(place => this.formatPlace(place, latitude, longitude));
    
    return places;
  }

  /**
   * Format place data from Google Places API
   */
  formatPlace(place, originLat, originLng) {
    const distance = this.calculateDistance(
      originLat, originLng,
      place.geometry.location.lat, place.geometry.location.lng
    );
    
    return {
      name: place.name,
      address: place.vicinity || place.formatted_address,
      rating: place.rating || null,
      userRatingsTotal: place.user_ratings_total || 0,
      priceLevel: place.price_level || null,
      types: place.types || [],
      distance: Math.round(distance * 1000), // Convert to meters
      walkingTime: this.estimateWalkingTime(distance),
      location: {
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng
      },
      placeId: place.place_id,
      isOpen: place.opening_hours?.open_now || null
    };
  }

  /**
   * Generate amenities summary
   */
  generateAmenitiesSummary(categories) {
    let totalPlaces = 0;
    const categoryStats = {};
    
    for (const [categoryName, subcategories] of Object.entries(categories)) {
      let categoryCount = 0;
      
      for (const [subcategoryName, places] of Object.entries(subcategories)) {
        categoryCount += places.length;
        totalPlaces += places.length;
      }
      
      categoryStats[categoryName] = {
        count: categoryCount,
        subcategories: Object.keys(subcategories).length
      };
    }
    
    return {
      totalPlaces,
      categories: categoryStats,
      insights: this.generateAmenitiesInsights(categories, categoryStats)
    };
  }

  /**
   * Calculate amenities quality score
   */
  calculateAmenitiesQuality(categories) {
    let totalScore = 0;
    let weights = 0;
    
    // Essential services have highest weight
    const essentialScore = this.calculateCategoryScore(categories.essential);
    totalScore += essentialScore * 0.4;
    weights += 0.4;
    
    // Shopping is important
    const shoppingScore = this.calculateCategoryScore(categories.shopping);
    totalScore += shoppingScore * 0.25;
    weights += 0.25;
    
    // Transportation accessibility
    const transportScore = this.calculateCategoryScore(categories.transportation);
    totalScore += transportScore * 0.2;
    weights += 0.2;
    
    // Recreation is nice to have
    const recreationScore = this.calculateCategoryScore(categories.recreation);
    totalScore += recreationScore * 0.15;
    weights += 0.15;
    
    const overallScore = weights > 0 ? totalScore / weights : 0;
    
    return {
      overall: Math.round(overallScore * 100) / 100,
      breakdown: {
        essential: essentialScore,
        shopping: shoppingScore,
        transportation: transportScore,
        recreation: recreationScore
      },
      level: this.getQualityLevel(overallScore)
    };
  }

  /**
   * Calculate score for a category
   */
  calculateCategoryScore(category) {
    let totalScore = 0;
    let subcategoryCount = 0;
    
    for (const [subcategoryName, places] of Object.entries(category)) {
      if (places.length > 0) {
        // Score based on availability, distance, and ratings
        const avgDistance = places.reduce((sum, p) => sum + p.distance, 0) / places.length;
        const avgRating = places.reduce((sum, p) => sum + (p.rating || 3), 0) / places.length;
        
        // Distance factor (closer is better)
        const distanceFactor = Math.max(0.1, 1 - (avgDistance / 2000)); // 2km reference
        
        // Rating factor (higher is better)
        const ratingFactor = avgRating / 5;
        
        // Availability factor (more options is better)
        const availabilityFactor = Math.min(1, places.length / 3);
        
        const subcategoryScore = (distanceFactor * 0.4 + ratingFactor * 0.3 + availabilityFactor * 0.3);
        totalScore += subcategoryScore;
      }
      subcategoryCount++;
    }
    
    return subcategoryCount > 0 ? totalScore / subcategoryCount : 0;
  }

  /**
   * Get quality level description
   */
  getQualityLevel(score) {
    if (score >= 0.8) return 'excellent';
    if (score >= 0.6) return 'good';
    if (score >= 0.4) return 'fair';
    return 'limited';
  }

  /**
   * Generate amenities insights
   */
  generateAmenitiesInsights(categories, categoryStats) {
    const insights = [];
    
    // Check essential services coverage
    const essentialCount = categoryStats.essential.count;
    if (essentialCount >= 10) {
      insights.push('Excellent access to essential services');
    } else if (essentialCount >= 5) {
      insights.push('Good access to essential services');
    } else {
      insights.push('Limited essential services nearby');
    }
    
    // Check shopping options
    const shoppingCount = categoryStats.shopping.count;
    if (shoppingCount >= 8) {
      insights.push('Great shopping and dining options');
    } else if (shoppingCount >= 4) {
      insights.push('Adequate shopping facilities');
    }
    
    // Check transportation
    const transportCount = categoryStats.transportation.count;
    if (transportCount >= 3) {
      insights.push('Well-connected transportation');
    } else if (transportCount >= 1) {
      insights.push('Basic transportation access');
    } else {
      insights.push('Limited public transport');
    }
    
    return insights;
  }

  /**
   * Calculate distance using Haversine formula
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Estimate walking time in minutes
   */
  estimateWalkingTime(distanceKm) {
    const walkingSpeedKmH = 5; // Average walking speed
    const timeMinutes = (distanceKm / walkingSpeedKmH) * 60;
    return Math.round(timeMinutes);
  }

  /**
   * Format location for display
   */
  formatLocation(propertyData) {
    const parts = [];
    if (propertyData.urbanization) parts.push(propertyData.urbanization);
    if (propertyData.suburb) parts.push(propertyData.suburb);
    if (propertyData.city) parts.push(propertyData.city);
    return parts.join(', ') || 'Location';
  }

  /**
   * Generate cache key for location
   */
  generateCacheKey(latitude, longitude) {
    // Round to 3 decimal places for reasonable cache granularity (~100m)
    const lat = Math.round(latitude * 1000) / 1000;
    const lng = Math.round(longitude * 1000) / 1000;
    return `amenities:${lat}:${lng}`;
  }

  /**
   * Get data from cache
   */
  getFromCache(cacheKey) {
    if (this.placesCache.has(cacheKey)) {
      const cached = this.placesCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      } else {
        this.placesCache.delete(cacheKey);
      }
    }
    return null;
  }

  /**
   * Cache results
   */
  cacheResults(cacheKey, data) {
    this.placesCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    if (this.placesCache.size > 1000) {
      const cutoff = Date.now() - this.cacheTTL;
      for (const [key, value] of this.placesCache.entries()) {
        if (value.timestamp < cutoff) {
          this.placesCache.delete(key);
        }
      }
    }
  }

  /**
   * Create fallback amenities when API is unavailable
   */
  createFallbackAmenities(propertyData) {
    return {
      location: {
        latitude: propertyData.latitude || null,
        longitude: propertyData.longitude || null,
        address: this.formatLocation(propertyData)
      },
      categories: {
        essential: { schools: [], healthcare: [], safety: [], basic_services: [] },
        shopping: { groceries: [], shopping: [], dining: [] },
        transportation: { public_transport: [], airports: [], parking: [] },
        recreation: { fitness: [], entertainment: [], outdoor: [], sports: [] }
      },
      summary: {
        totalPlaces: 0,
        categories: {},
        insights: ['Amenities data requires Google Places API configuration']
      },
      quality: {
        overall: 0,
        breakdown: { essential: 0, shopping: 0, transportation: 0, recreation: 0 },
        level: 'unavailable'
      },
      lastUpdated: new Date().toISOString(),
      dataSource: 'Fallback (API not configured)',
      fallback: true
    };
  }

  /**
   * Generate system-based amenities content for analysis
   */
  formatForSystemAnalysis(amenitiesData) {
    if (amenitiesData.fallback) {
      return {
        content: `**Nearby Amenities**

📍 **Location**: ${amenitiesData.location.address}

🔧 **Configuration Required**
Google Places API integration required for detailed amenities analysis.

*Configure GOOGLE_PLACES_API_KEY to enable comprehensive amenities data.*`,
        confidence: 'none'
      };
    }

    const { categories, summary, quality } = amenitiesData;
    const insights = summary.insights.join('\n- ');
    
    return {
      content: `**Nearby Amenities**

📍 **Location**: ${amenitiesData.location.address}

🏥 **Essential Services** (${categories.essential.schools.length + categories.essential.healthcare.length + categories.essential.safety.length + categories.essential.basic_services.length} places)
- Schools: ${categories.essential.schools.length} found
- Healthcare: ${categories.essential.healthcare.length} facilities
- Safety & Services: ${categories.essential.safety.length + categories.essential.basic_services.length} locations

🛒 **Shopping & Dining** (${categories.shopping.groceries.length + categories.shopping.shopping.length + categories.shopping.dining.length} places)
- Groceries: ${categories.shopping.groceries.length} supermarkets
- Shopping: ${categories.shopping.shopping.length} retail locations  
- Dining: ${categories.shopping.dining.length} restaurants & cafes

🚌 **Transportation** (${categories.transportation.public_transport.length + categories.transportation.airports.length} hubs)
- Public Transport: ${categories.transportation.public_transport.length} stops/stations
- Airport Access: ${categories.transportation.airports.length > 0 ? 'Available' : 'Not nearby'}

🎯 **Recreation** (${categories.recreation.fitness.length + categories.recreation.entertainment.length + categories.recreation.outdoor.length} venues)
- Fitness: ${categories.recreation.fitness.length} gyms/spas
- Entertainment: ${categories.recreation.entertainment.length + categories.recreation.outdoor.length} venues

📊 **Amenities Quality**: ${quality.level.toUpperCase()} (${Math.round(quality.overall * 100)}%)

**Key Insights:**
- ${insights}

*Data from Google Places API - ${summary.totalPlaces} total locations analyzed*`,
      confidence: this.getConfidenceFromQuality(quality.overall),
      qualityScore: quality.overall,
      totalPlaces: summary.totalPlaces
    };
  }

  /**
   * Get confidence level from quality score
   */
  getConfidenceFromQuality(qualityScore) {
    if (qualityScore >= 0.7) return 'high';
    if (qualityScore >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.placesCache.size,
      cacheHitRate: this.metrics.cacheHits + this.metrics.cacheMisses > 0 ? 
        Math.round((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100) : 0
    };
  }
}

module.exports = GooglePlacesService; 