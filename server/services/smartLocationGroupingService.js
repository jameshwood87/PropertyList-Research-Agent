const NodeCache = require('node-cache');

class SmartLocationGroupingService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    this.cache = new NodeCache({ stdTTL: 7200 }); // 2 hour cache
    
    // Confidence thresholds for grouping
    this.thresholds = {
      trigram_exact: 1.0,        // Perfect trigram match
      trigram_high: 0.9,         // High similarity (likely same location)
      trigram_medium: 0.7,       // Medium similarity (possible variations)
      levenshtein_max: 3,        // Maximum character differences for fuzzy match
      group_min_size: 2          // Minimum properties to form a group
    };
    
    // Statistics tracking
    this.stats = {
      totalProperties: 0,
      uniqueGroups: 0,
      fuzzyMerges: 0,
      singletonGroups: 0,
      multiPropertyGroups: 0,
      costSavings: 0
    };
  }

  /**
   * Main method: Group all properties by smart location analysis
   */
  async createLocationGroups() {
    console.log('🧠 SMART LOCATION GROUPING');
    console.log('==========================');

    try {
      // Step 1: Extract and normalize all location data
      const properties = await this.extractLocationData();
      console.log(`📊 Processing ${properties.length} properties`);
      
      // Step 2: Create initial groups by exact location keys
      const initialGroups = await this.createInitialGroups(properties);
      console.log(`🏗️ Created ${initialGroups.length} initial groups`);
      
      // Step 3: Apply fuzzy deduplication to merge similar groups
      const mergedGroups = await this.applyFuzzyDeduplication(initialGroups);
      console.log(`🔗 Merged to ${mergedGroups.length} final groups`);
      
      // Step 4: Validate and optimize groups
      const optimizedGroups = await this.optimizeGroups(mergedGroups);
      console.log(`⚡ Optimized to ${optimizedGroups.length} geocoding groups`);
      
      // Step 5: Generate statistics and cost analysis
      const analysis = await this.generateAnalysis(optimizedGroups, properties.length);
      
      return {
        groups: optimizedGroups,
        analysis: analysis,
        stats: this.stats
      };

    } catch (error) {
      console.error('❌ Smart grouping failed:', error);
      throw error;
    }
  }

  /**
   * Extract and normalize location data from all properties
   */
  async extractLocationData() {
    const query = `
      SELECT 
        id,
        reference,
        TRIM(urbanization) as urbanization,
        TRIM(suburb) as suburb,
        TRIM(city) as city,
        TRIM(address) as address,
        latitude,
        longitude
      FROM properties 
      WHERE is_active = true
      ORDER BY id
    `;
    
    const result = await this.propertyDb.pool.query(query);
    return result.rows.map(row => ({
      ...row,
      // Create normalized location components
      urbanization_norm: this.normalizeLocationName(row.urbanization),
      suburb_norm: this.normalizeLocationName(row.suburb),
      city_norm: this.normalizeLocationName(row.city),
      address_norm: this.normalizeLocationName(row.address)
    }));
  }

  /**
   * Normalize location names for consistent grouping
   */
  normalizeLocationName(name) {
    if (!name) return '';
    
    return name.toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')              // Collapse whitespace
      .replace(/[^\w\s\-áéíóúñü]/g, '')  // Remove special chars, keep Spanish accents
      .replace(/\b(el|la|los|las|de|del|y)\b/g, '') // Remove common Spanish articles
      .trim();
  }

  /**
   * Create initial groups based on location hierarchy
   */
  async createInitialGroups(properties) {
    const groups = new Map();
    
    for (const property of properties) {
      // Create hierarchical location key
      const locationKey = this.createLocationKey(property);
      
      if (!groups.has(locationKey)) {
        groups.set(locationKey, {
          key: locationKey,
          properties: [],
          representative: null,
          locationData: this.extractLocationFromProperty(property),
          tier: this.determineLocationTier(property)
        });
      }
      
      groups.get(locationKey).properties.push(property);
    }
    
    // Set representative property for each group (property with most complete data)
    for (const group of groups.values()) {
      group.representative = this.selectBestRepresentative(group.properties);
    }
    
    return Array.from(groups.values());
  }

  /**
   * Create location key using hierarchy: urbanization > suburb > city
   */
  createLocationKey(property) {
    const parts = [];
    
    // Tier 1: Urbanization (most specific)
    if (property.urbanization_norm) {
      parts.push(`urb:${property.urbanization_norm}`);
    }
    
    // Tier 2: Suburb (medium specificity)
    if (property.suburb_norm) {
      parts.push(`sub:${property.suburb_norm}`);
    }
    
    // Tier 3: City (least specific)
    if (property.city_norm) {
      parts.push(`city:${property.city_norm}`);
    }
    
    return parts.join('||') || 'unknown';
  }

  /**
   * Determine the specificity tier of a location
   */
  determineLocationTier(property) {
    if (property.urbanization_norm) return 1; // Most specific
    if (property.suburb_norm) return 2;       // Medium specific
    if (property.city_norm) return 3;         // Least specific
    return 4; // Unknown
  }

  /**
   * Extract structured location data from property
   */
  extractLocationFromProperty(property) {
    return {
      urbanization: property.urbanization,
      suburb: property.suburb,
      city: property.city,
      address: property.address,
      coordinates: property.latitude && property.longitude ? {
        lat: parseFloat(property.latitude),
        lng: parseFloat(property.longitude)
      } : null
    };
  }

  /**
   * Select the best representative property from a group
   */
  selectBestRepresentative(properties) {
    // Score properties by data completeness
    return properties.reduce((best, current) => {
      const currentScore = this.calculateCompletenessScore(current);
      const bestScore = this.calculateCompletenessScore(best);
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Calculate data completeness score for property selection
   */
  calculateCompletenessScore(property) {
    let score = 0;
    if (property.urbanization) score += 4;  // Most valuable
    if (property.address) score += 3;       // Very valuable  
    if (property.suburb) score += 2;        // Valuable
    if (property.city) score += 1;          // Basic
    if (property.latitude && property.longitude) score += 2; // Bonus for coordinates
    return score;
  }

  /**
   * Apply fuzzy deduplication to merge similar groups
   */
  async applyFuzzyDeduplication(groups) {
    console.log('🔍 Applying fuzzy deduplication...');
    
    const mergedGroups = [];
    const processed = new Set();
    
    for (let i = 0; i < groups.length; i++) {
      if (processed.has(i)) continue;
      
      const currentGroup = groups[i];
      const mergeTargets = [];
      
      // Find similar groups to merge
      for (let j = i + 1; j < groups.length; j++) {
        if (processed.has(j)) continue;
        
        const otherGroup = groups[j];
        
        // Only merge groups from same city (safety check)
        if (!this.isSameCity(currentGroup, otherGroup)) continue;
        
        // Check if groups should be merged based on similarity
        if (await this.shouldMergeGroups(currentGroup, otherGroup)) {
          mergeTargets.push(j);
          processed.add(j);
          this.stats.fuzzyMerges++;
        }
      }
      
      // Merge current group with targets
      const mergedGroup = await this.mergeGroups([currentGroup, ...mergeTargets.map(idx => groups[idx])]);
      mergedGroups.push(mergedGroup);
      processed.add(i);
    }
    
    console.log(`✅ Fuzzy deduplication complete: ${this.stats.fuzzyMerges} merges performed`);
    return mergedGroups;
  }

  /**
   * Check if two groups are from the same city
   */
  isSameCity(group1, group2) {
    const city1 = group1.locationData.city?.toLowerCase();
    const city2 = group2.locationData.city?.toLowerCase();
    return city1 && city2 && city1 === city2;
  }

  /**
   * Determine if two groups should be merged based on similarity
   */
  async shouldMergeGroups(group1, group2) {
    // Only merge groups of same tier for safety
    if (group1.tier !== group2.tier) return false;
    
    // Extract primary location names for comparison
    const name1 = this.getPrimaryLocationName(group1);
    const name2 = this.getPrimaryLocationName(group2);
    
    if (!name1 || !name2) return false;
    
    // Check trigram similarity
    const similarity = await this.calculateTrigramSimilarity(name1, name2);
    if (similarity >= this.thresholds.trigram_high) {
      console.log(`🔗 High similarity: "${name1}" ↔ "${name2}" (${(similarity * 100).toFixed(1)}%)`);
      return true;
    }
    
    // Check Levenshtein distance for shorter strings
    if (name1.length <= 15 || name2.length <= 15) {
      const distance = this.calculateLevenshteinDistance(name1, name2);
      if (distance <= this.thresholds.levenshtein_max) {
        console.log(`🔗 Close distance: "${name1}" ↔ "${name2}" (distance: ${distance})`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get the primary location name from a group (urbanization > suburb > city)
   */
  getPrimaryLocationName(group) {
    const loc = group.locationData;
    return this.normalizeLocationName(loc.urbanization || loc.suburb || loc.city);
  }

  /**
   * Calculate trigram similarity using PostgreSQL
   */
  async calculateTrigramSimilarity(name1, name2) {
    try {
      const result = await this.propertyDb.pool.query(
        'SELECT similarity($1, $2) as sim_score',
        [name1, name2]
      );
      return parseFloat(result.rows[0].sim_score);
    } catch (error) {
      console.warn('Trigram similarity calculation failed, using fallback');
      return 0;
    }
  }

  /**
   * Calculate Levenshtein distance manually as fallback
   */
  calculateLevenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Merge multiple groups into one
   */
  async mergeGroups(groups) {
    const allProperties = groups.flatMap(g => g.properties);
    const bestRepresentative = this.selectBestRepresentative(allProperties);
    
    return {
      key: groups[0].key, // Use first group's key
      properties: allProperties,
      representative: bestRepresentative,
      locationData: this.extractLocationFromProperty(bestRepresentative),
      tier: Math.min(...groups.map(g => g.tier)), // Use best tier
      mergedFrom: groups.length > 1 ? groups.map(g => g.key) : undefined
    };
  }

  /**
   * Optimize groups for geocoding efficiency
   */
  async optimizeGroups(groups) {
    console.log('⚡ Optimizing groups for geocoding...');
    
    const optimized = [];
    
    for (const group of groups) {
      // Skip tiny groups if they have very incomplete data
      if (group.properties.length === 1 && group.tier >= 3) {
        // For singleton groups with only city data, consider merging with larger city group
        const cityGroup = optimized.find(g => 
          g.locationData.city === group.locationData.city && 
          g.tier === 3 && 
          g.properties.length > 5
        );
        
        if (cityGroup) {
          cityGroup.properties.push(...group.properties);
          continue;
        }
      }
      
      optimized.push(group);
    }
    
    console.log(`✅ Optimization complete: ${groups.length} → ${optimized.length} groups`);
    return optimized;
  }

  /**
   * Generate analysis and statistics
   */
  async generateAnalysis(groups, totalProperties) {
    this.stats.totalProperties = totalProperties;
    this.stats.uniqueGroups = groups.length;
    this.stats.singletonGroups = groups.filter(g => g.properties.length === 1).length;
    this.stats.multiPropertyGroups = groups.length - this.stats.singletonGroups;
    
    // Cost calculation
    const googleMapsPrice = 0.005; // $5 per 1000 requests
    const originalCost = totalProperties * googleMapsPrice;
    const optimizedCost = groups.length * googleMapsPrice;
    this.stats.costSavings = originalCost - optimizedCost;
    
    const groupSizes = groups.map(g => g.properties.length).sort((a, b) => b - a);
    
    return {
      totalProperties: totalProperties,
      totalGroups: groups.length,
      costReduction: {
        original: originalCost,
        optimized: optimizedCost,
        savings: this.stats.costSavings,
        percentage: ((this.stats.costSavings / originalCost) * 100).toFixed(1)
      },
      groupDistribution: {
        singletons: this.stats.singletonGroups,
        multiProperty: this.stats.multiPropertyGroups,
        largestGroup: groupSizes[0] || 0,
        averageSize: (totalProperties / groups.length).toFixed(1)
      },
      topGroups: groups
        .sort((a, b) => b.properties.length - a.properties.length)
        .slice(0, 10)
        .map(g => ({
          key: g.key,
          propertyCount: g.properties.length,
          location: this.formatLocationDisplay(g.locationData),
          tier: g.tier,
          representative: g.representative.reference
        }))
    };
  }

  /**
   * Format location data for display
   */
  formatLocationDisplay(locationData) {
    const parts = [
      locationData.urbanization,
      locationData.suburb,
      locationData.city
    ].filter(Boolean);
    
    return parts.join(', ') || 'Unknown location';
  }

  /**
   * Get groups ready for geocoding
   */
  async getGeocodingQueue(groups) {
    return groups.map(group => ({
      groupKey: group.key,
      propertyCount: group.properties.length,
      propertyIds: group.properties.map(p => p.id),
      representative: group.representative,
      locationQuery: this.buildLocationQuery(group.locationData),
      tier: group.tier,
      priority: this.calculateGeocodingPriority(group)
    })).sort((a, b) => b.priority - a.priority); // High priority first
  }

  /**
   * Build optimized location query for geocoding
   */
  buildLocationQuery(locationData) {
    const parts = [
      locationData.urbanization,
      locationData.suburb,
      locationData.address,
      locationData.city
    ].filter(Boolean);
    
    return parts.join(', ') + ', Spain';
  }

  /**
   * Calculate geocoding priority (high property count = high priority)
   */
  calculateGeocodingPriority(group) {
    let priority = group.properties.length; // Base on property count
    
    // Bonus for better location data
    if (group.locationData.urbanization) priority += 10;
    if (group.locationData.address) priority += 5;
    
    // Bonus for already having coordinates (validation)
    if (group.locationData.coordinates) priority += 20;
    
    return priority;
  }
}

module.exports = SmartLocationGroupingService; 