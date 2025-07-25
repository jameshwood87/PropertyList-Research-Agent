/**
 * Dynamic TTL Service - Phase 2
 * 
 * Adjusts cache expiration times based on:
 * 1. Market Volatility - Price variance and transaction velocity
 * 2. Demand Patterns - Seasonal trends and search frequency
 * 3. Data Freshness Requirements - Section-specific sensitivity
 * 4. Area Activity Level - How active the market is in specific locations
 */
class DynamicTTLService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    
    // Base TTLs for different section types (in seconds)
    this.baseTTLs = {
      // Market-sensitive sections (need fresh data)
      marketData: 3600,       // 1 hour base
      valuation: 1800,        // 30 min base
      marketOutlook: 1800,    // 30 min base
      
      // Stable sections (less frequent updates)
      amenities: 86400,       // 24 hours base
      mobility: 86400,        // 24 hours base
      
      // AI narrative sections (medium sensitivity)
      locationAdvantages: 7200,   // 2 hours base
      investmentPotential: 3600,  // 1 hour base
      executiveSummary: 900,      // 15 min base
      recommendations: 900        // 15 min base
    };
    
    // Volatility multipliers
    this.volatilityMultipliers = {
      low: 2.0,       // Stable market - extend TTL
      medium: 1.0,    // Normal market - use base TTL
      high: 0.5,      // Volatile market - reduce TTL
      extreme: 0.25   // Very volatile - very short TTL
    };
    
    // Demand pattern multipliers
    this.demandMultipliers = {
      peak: 0.7,      // High demand - fresher data needed
      normal: 1.0,    // Normal demand - base TTL
      low: 1.5        // Low demand - can use older data
    };
    
    // Cache for volatility calculations (avoid repeated DB queries)
    this.volatilityCache = new Map();
    this.volatilityCacheTTL = 3600; // 1 hour
  }

  /**
   * Calculate dynamic TTL for a specific section and area
   */
  async calculateTTL(sectionName, propertyData, qualityMetrics = null) {
    try {
      // Get base TTL for the section
      const baseTTL = this.baseTTLs[sectionName] || 3600;
      
      // Calculate market volatility for the area
      const volatility = await this.calculateMarketVolatility(propertyData);
      
      // Calculate demand patterns
      const demandPattern = await this.calculateDemandPattern(propertyData);
      
      // Calculate area activity level
      const activityLevel = await this.calculateAreaActivity(propertyData);
      
      // Calculate quality-based adjustment
      const qualityAdjustment = this.calculateQualityAdjustment(qualityMetrics);
      
      // Apply all multipliers
      let dynamicTTL = baseTTL 
        * this.volatilityMultipliers[volatility.level]
        * this.demandMultipliers[demandPattern.level]
        * activityLevel.multiplier
        * qualityAdjustment;
      
      // Apply section-specific rules
      dynamicTTL = this.applySectionRules(sectionName, dynamicTTL, volatility, demandPattern);
      
      // Ensure TTL is within reasonable bounds
      dynamicTTL = Math.max(300, Math.min(dynamicTTL, 604800)); // 5 min to 1 week
      
      return {
        ttl: Math.round(dynamicTTL),
        factors: {
          base: baseTTL,
          volatility: volatility,
          demand: demandPattern,
          activity: activityLevel,
          quality: qualityAdjustment,
          final: dynamicTTL
        },
        reasoning: this.generateTTLReasoning(sectionName, volatility, demandPattern, activityLevel)
      };
      
    } catch (error) {
      console.error('❌ Error calculating dynamic TTL:', error);
      // Fallback to base TTL
      return {
        ttl: this.baseTTLs[sectionName] || 3600,
        factors: { fallback: true },
        reasoning: 'Using fallback TTL due to calculation error'
      };
    }
  }

  /**
   * Calculate market volatility based on recent price movements
   */
  async calculateMarketVolatility(propertyData) {
    const areaKey = this.generateAreaKey(propertyData);
    
    // Check cache first
    if (this.volatilityCache.has(areaKey)) {
      const cached = this.volatilityCache.get(areaKey);
      if (Date.now() - cached.timestamp < this.volatilityCacheTTL * 1000) {
        return cached.data;
      }
    }
    
    try {
      // Query recent price data for the area (last 90 days)
      const recentSales = await this.getRecentSalesData(propertyData, 90);
      
      if (recentSales.length < 5) {
        // Insufficient data - assume medium volatility
        const result = { level: 'medium', score: 0.5, reason: 'Insufficient recent sales data' };
        this.cacheVolatility(areaKey, result);
        return result;
      }
      
      // Calculate price variance
      const prices = recentSales.map(sale => sale.sale_price);
      const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = stdDev / avgPrice;
      
      // Calculate transaction velocity (sales per week)
      const weeksInPeriod = 12; // ~90 days / 7
      const transactionVelocity = recentSales.length / weeksInPeriod;
      
      // Determine volatility level
      let level, score;
      
      if (coefficientOfVariation > 0.25 || transactionVelocity > 10) {
        level = 'extreme';
        score = Math.min(0.9, coefficientOfVariation * 2 + transactionVelocity * 0.05);
      } else if (coefficientOfVariation > 0.15 || transactionVelocity > 5) {
        level = 'high';
        score = Math.min(0.7, coefficientOfVariation * 1.5 + transactionVelocity * 0.04);
      } else if (coefficientOfVariation > 0.08 || transactionVelocity > 2) {
        level = 'medium';
        score = Math.min(0.5, coefficientOfVariation * 1.2 + transactionVelocity * 0.03);
      } else {
        level = 'low';
        score = Math.min(0.3, coefficientOfVariation + transactionVelocity * 0.02);
      }
      
      const result = {
        level,
        score,
        metrics: {
          coefficientOfVariation: Math.round(coefficientOfVariation * 1000) / 1000,
          transactionVelocity: Math.round(transactionVelocity * 10) / 10,
          avgPrice: Math.round(avgPrice),
          sampleSize: recentSales.length
        },
        reason: `${level} volatility based on ${recentSales.length} recent sales`
      };
      
      this.cacheVolatility(areaKey, result);
      return result;
      
    } catch (error) {
      console.error('❌ Error calculating market volatility:', error);
      const fallback = { level: 'medium', score: 0.5, reason: 'Error calculating volatility' };
      this.cacheVolatility(areaKey, fallback);
      return fallback;
    }
  }

  /**
   * Calculate demand patterns based on search frequency and seasonal trends
   */
  async calculateDemandPattern(propertyData) {
    try {
      // Get analysis frequency for this area (last 30 days)
      const recentAnalyses = await this.getRecentAnalysisCount(propertyData, 30);
      
      // Check for seasonal patterns (simplified)
      const currentMonth = new Date().getMonth();
      const peakMonths = [2, 3, 4, 8, 9]; // March, April, May, September, October
      const isSeasonalPeak = peakMonths.includes(currentMonth);
      
      // Calculate demand level
      let level, multiplier;
      
      if (recentAnalyses > 20 || isSeasonalPeak) {
        level = 'peak';
        multiplier = this.demandMultipliers.peak;
      } else if (recentAnalyses > 5) {
        level = 'normal';
        multiplier = this.demandMultipliers.normal;
      } else {
        level = 'low';
        multiplier = this.demandMultipliers.low;
      }
      
      return {
        level,
        multiplier,
        metrics: {
          recentAnalyses,
          isSeasonalPeak,
          currentMonth: currentMonth + 1
        },
        reason: `${level} demand based on ${recentAnalyses} recent analyses${isSeasonalPeak ? ' (seasonal peak)' : ''}`
      };
      
    } catch (error) {
      console.error('❌ Error calculating demand pattern:', error);
      return {
        level: 'normal',
        multiplier: 1.0,
        reason: 'Error calculating demand - using normal level'
      };
    }
  }

  /**
   * Calculate area activity level
   */
  async calculateAreaActivity(propertyData) {
    try {
      // Get property count and recent updates for the area
      const areaMetrics = await this.getAreaActivityMetrics(propertyData);
      
      let multiplier;
      let level;
      
      if (areaMetrics.activeProperties > 100 && areaMetrics.recentUpdates > 20) {
        level = 'very_active';
        multiplier = 0.8; // Reduce TTL for very active areas
      } else if (areaMetrics.activeProperties > 50 && areaMetrics.recentUpdates > 10) {
        level = 'active';
        multiplier = 0.9; // Slightly reduce TTL
      } else if (areaMetrics.activeProperties > 20 && areaMetrics.recentUpdates > 5) {
        level = 'moderate';
        multiplier = 1.0; // Normal TTL
      } else {
        level = 'quiet';
        multiplier = 1.2; // Extend TTL for quiet areas
      }
      
      return {
        level,
        multiplier,
        metrics: areaMetrics,
        reason: `${level} area with ${areaMetrics.activeProperties} properties, ${areaMetrics.recentUpdates} recent updates`
      };
      
    } catch (error) {
      console.error('❌ Error calculating area activity:', error);
      return {
        level: 'moderate',
        multiplier: 1.0,
        reason: 'Error calculating activity - using normal level'
      };
    }
  }

  /**
   * Calculate quality-based TTL adjustment
   */
  calculateQualityAdjustment(qualityMetrics) {
    if (!qualityMetrics || !qualityMetrics.enhanced) {
      return 1.0; // No adjustment if no enhanced quality data
    }
    
    const qualityScore = qualityMetrics.score;
    
    // High quality data can be cached longer
    if (qualityScore >= 0.8) return 1.3;      // Extend TTL by 30%
    if (qualityScore >= 0.6) return 1.1;      // Extend TTL by 10%
    if (qualityScore >= 0.4) return 1.0;      // Normal TTL
    
    return 0.8; // Reduce TTL for poor quality data
  }

  /**
   * Apply section-specific TTL rules
   */
  applySectionRules(sectionName, calculatedTTL, volatility, demandPattern) {
    switch (sectionName) {
      case 'marketData':
        // Market data is very sensitive to volatility
        if (volatility.level === 'extreme') return Math.min(calculatedTTL, 900); // Max 15 min
        if (volatility.level === 'high') return Math.min(calculatedTTL, 1800); // Max 30 min
        break;
        
      case 'valuation':
        // Valuation needs fresh data in volatile markets
        if (volatility.level === 'extreme') return Math.min(calculatedTTL, 600); // Max 10 min
        break;
        
      case 'amenities':
      case 'mobility':
        // Infrastructure rarely changes - can have longer TTL
        return Math.max(calculatedTTL, 43200); // Min 12 hours
        
      case 'executiveSummary':
      case 'recommendations':
        // AI narratives should be fresh in high-demand periods
        if (demandPattern.level === 'peak') return Math.min(calculatedTTL, 1800); // Max 30 min
        break;
    }
    
    return calculatedTTL;
  }

  /**
   * Generate reasoning for TTL calculation
   */
  generateTTLReasoning(sectionName, volatility, demandPattern, activityLevel) {
    const factors = [];
    
    if (volatility.level === 'extreme' || volatility.level === 'high') {
      factors.push(`${volatility.level} market volatility requires fresh data`);
    }
    
    if (demandPattern.level === 'peak') {
      factors.push('peak demand period needs current information');
    }
    
    if (activityLevel.level === 'very_active') {
      factors.push('very active market area with frequent updates');
    }
    
    if (factors.length === 0) {
      return `Standard TTL for ${sectionName} based on stable market conditions`;
    }
    
    return `Adjusted TTL for ${sectionName}: ${factors.join(', ')}`;
  }

  /**
   * Get recent sales data for volatility calculation
   */
  async getRecentSalesData(propertyData, daysBack) {
    if (!this.propertyDb) return [];
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      
      const query = `
        SELECT sale_price, last_updated_at 
        FROM properties 
        WHERE city = $1 
          AND sale_price > 0 
          AND last_updated_at >= $2
        ORDER BY last_updated_at DESC
        LIMIT 100
      `;
      
      const result = await this.propertyDb.query(query, [
        propertyData.city,
        cutoffDate.toISOString()
      ]);
      
      return result.rows || [];
      
    } catch (error) {
      console.error('❌ Error fetching recent sales data:', error);
      return [];
    }
  }

  /**
   * Get recent analysis count for demand calculation
   */
  async getRecentAnalysisCount(propertyData, daysBack) {
    if (!this.propertyDb) return 0;
    
    try {
      const areaKey = this.generateAreaKey(propertyData);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      
      const query = `
        SELECT n_analyses 
        FROM area_data_maturity 
        WHERE area_key = $1 
          AND last_analysis_run >= $2
      `;
      
      const result = await this.propertyDb.query(query, [areaKey, cutoffDate.toISOString()]);
      
      return result.rows.length > 0 ? result.rows[0].n_analyses : 0;
      
    } catch (error) {
      console.error('❌ Error fetching recent analysis count:', error);
      return 0;
    }
  }

  /**
   * Get area activity metrics
   */
  async getAreaActivityMetrics(propertyData) {
    if (!this.propertyDb) {
      return { activeProperties: 0, recentUpdates: 0 };
    }
    
    try {
      const city = propertyData.city;
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30); // Last 30 days
      
      const query = `
        SELECT 
          COUNT(*) as active_properties,
          COUNT(CASE WHEN last_updated_at >= $2 THEN 1 END) as recent_updates
        FROM properties 
        WHERE city = $1 AND is_active = true
      `;
      
      const result = await this.propertyDb.query(query, [city, recentDate.toISOString()]);
      
      if (result.rows.length > 0) {
        return {
          activeProperties: parseInt(result.rows[0].active_properties) || 0,
          recentUpdates: parseInt(result.rows[0].recent_updates) || 0
        };
      }
      
      return { activeProperties: 0, recentUpdates: 0 };
      
    } catch (error) {
      console.error('❌ Error fetching area activity metrics:', error);
      return { activeProperties: 0, recentUpdates: 0 };
    }
  }

  /**
   * Generate area key for caching
   */
  generateAreaKey(propertyData) {
    return (propertyData.urbanization || propertyData.suburb || propertyData.city || 'unknown')
      .toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  /**
   * Cache volatility calculation
   */
  cacheVolatility(areaKey, data) {
    this.volatilityCache.set(areaKey, {
      data,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries periodically
    if (this.volatilityCache.size > 100) {
      const cutoff = Date.now() - this.volatilityCacheTTL * 1000;
      for (const [key, value] of this.volatilityCache.entries()) {
        if (value.timestamp < cutoff) {
          this.volatilityCache.delete(key);
        }
      }
    }
  }

  /**
   * Get TTL for multiple sections at once
   */
  async calculateMultipleTTLs(sections, propertyData, qualityMetrics = null) {
    const ttlResults = {};
    
    for (const sectionName of sections) {
      ttlResults[sectionName] = await this.calculateTTL(sectionName, propertyData, qualityMetrics);
    }
    
    return ttlResults;
  }

  /**
   * Get TTL summary for reporting
   */
  getTTLSummary(ttlResult) {
    return {
      ttl: ttlResult.ttl,
      ttlMinutes: Math.round(ttlResult.ttl / 60),
      volatility: ttlResult.factors.volatility?.level || 'unknown',
      demand: ttlResult.factors.demand?.level || 'unknown',
      activity: ttlResult.factors.activity?.level || 'unknown',
      reasoning: ttlResult.reasoning
    };
  }
}

module.exports = DynamicTTLService; 