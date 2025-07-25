const NodeCache = require('node-cache');
const EnhancedQualityMetricsService = require('./enhancedQualityMetricsService');

/**
 * System/AI Decision Service - Phase 2 Enhanced
 * 
 * Implements progressive data maturity logic to decide whether each analysis section
 * should use System (automated data processing) or AI (LLM analysis) based on:
 * 
 * 1. Data quantity thresholds (nComparables, nAnalyses)
 * 2. Data quality scoring (recency, proximity, similarity)
 * 3. Section-specific requirements
 * 4. Cost optimization goals
 */
class SystemAIDecisionService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    
    // Initialize enhanced quality metrics service
    this.qualityMetricsService = new EnhancedQualityMetricsService();
    
    // Cache decision results for 1 hour to avoid repeated DB queries
    this.cache = new NodeCache({ stdTTL: 3600 });
    
    // Progressive thresholds for each section
    this.thresholds = {
      // Market Data & Trends - requires most data for accuracy
      marketData: { 
        nComparables: 20, 
        nAnalyses: 5,
        qualityScore: 0.7 
      },
      
      // Valuation Analysis - needs good comparable data
      valuation: { 
        nComparables: 12, 
        nAnalyses: 3,
        qualityScore: 0.6 
      },
      
      // Nearby Amenities - benefits from repeated area analysis
      amenities: { 
        nComparables: 5, 
        nAnalyses: 3,
        qualityScore: 0.5 
      },
      
      // Mobility & Transportation - simple area analysis
      mobility: { 
        nComparables: 3, 
        nAnalyses: 2,
        qualityScore: 0.5 
      },
      
      // Always AI sections (narrative/interpretation required)
      locationAdvantages: { ai: true },
      investmentPotential: { ai: true },
      marketOutlook: { ai: true },
      executiveSummary: { ai: true },
      recommendations: { ai: true }
    };
    
    this.metrics = {
      decisions: 0,
      systemUsage: 0,
      aiUsage: 0,
      cacheHits: 0
    };
  }

  /**
   * Main decision method - determines System vs AI for each section
   */
  async makeDecisions(propertyData, comparablesData = null) {
    const startTime = Date.now();
    
    try {
      // Generate area keys for cache/database lookup
      const areaKeys = this.generateAreaKeys(propertyData);
      
      // Check cache first
      const cacheKey = `decisions:${areaKeys.primary}`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }
      
      // Get data maturity metrics from database
      const maturityMetrics = await this.getAreaMaturityMetrics(areaKeys);
      
      // Calculate enhanced quality scores with comparables data
      const qualityMetrics = await this.calculateQualityMetrics(propertyData, maturityMetrics, comparablesData);
      
      // Make decisions for each section
      const decisions = {};
      for (const [section, config] of Object.entries(this.thresholds)) {
        decisions[section] = this.decideSectionApproach(section, config, maturityMetrics, qualityMetrics);
      }
      
      // Add metadata
      const result = {
        decisions,
        maturityMetrics,
        qualityMetrics,
        areaKeys,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };
      
      // Cache result
      this.cache.set(cacheKey, result);
      
      // Update metrics
      this.metrics.decisions++;
      Object.values(decisions).forEach(decision => {
        if (decision.approach === 'system') this.metrics.systemUsage++;
        else this.metrics.aiUsage++;
      });
      
      console.log(`📊 System/AI decisions made for ${areaKeys.primary}: ${Object.values(decisions).filter(d => d.approach === 'system').length} system, ${Object.values(decisions).filter(d => d.approach === 'ai').length} AI`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error making System/AI decisions:', error);
      // Fallback to AI for all sections
      return this.getFallbackDecisions(propertyData);
    }
  }

  /**
   * Generate hierarchical area keys for lookup
   */
  generateAreaKeys(propertyData) {
    const normalize = (str) => str ? str.toLowerCase().replace(/[^a-z0-9]/g, '_') : null;
    
    return {
      urbanization: normalize(propertyData.urbanization),
      suburb: normalize(propertyData.suburb), 
      city: normalize(propertyData.city),
      primary: normalize(propertyData.urbanization || propertyData.suburb || propertyData.city || 'unknown')
    };
  }

  /**
   * Get area data maturity metrics from database
   */
  async getAreaMaturityMetrics(areaKeys) {
    if (!this.propertyDb) {
      return { nComparables: 0, nAnalyses: 0, hasData: false };
    }
    
    try {
      // Try primary area key first, fallback to broader areas
      const keyPriority = [areaKeys.primary, areaKeys.suburb, areaKeys.city].filter(Boolean);
      
      for (const areaKey of keyPriority) {
        const result = await this.propertyDb.query(
          'SELECT * FROM area_data_maturity WHERE area_key = $1',
          [areaKey]
        );
        
        if (result.rows.length > 0) {
          const row = result.rows[0];
          return {
            areaKey,
            nComparables: row.n_comparables || 0,
            nAnalyses: row.n_analyses || 0,
            qualityMetrics: row.quality_metrics || {},
            lastUpdated: row.updated_at,
            hasData: true
          };
        }
      }
      
      // No data found
      return { 
        areaKey: areaKeys.primary,
        nComparables: 0, 
        nAnalyses: 0, 
        hasData: false 
      };
      
    } catch (error) {
      console.error('❌ Error fetching maturity metrics:', error);
      return { nComparables: 0, nAnalyses: 0, hasData: false };
    }
  }

  /**
   * Calculate enhanced data quality metrics using sophisticated algorithms
   */
  async calculateQualityMetrics(propertyData, maturityMetrics, comparablesData = null) {
    // Phase 2: Enhanced quality scoring with recency, proximity, similarity
    
    // Basic property data completeness (fallback if no comparables)
    const hasLocation = !!(propertyData.latitude && propertyData.longitude);
    const hasBasicData = !!(propertyData.bedrooms && propertyData.sale_price);
    const hasDetailedData = !!(propertyData.build_size && propertyData.property_type);
    const basicCompleteness = (hasLocation + hasBasicData + hasDetailedData) / 3;
    
    // If we have comparables data, use enhanced quality scoring
    if (comparablesData?.comparables?.length > 0) {
      const enhancedQuality = await this.qualityMetricsService.calculateQualityScore(
        propertyData, 
        comparablesData.comparables, 
        maturityMetrics
      );
      
      return {
        score: enhancedQuality.overallScore,
        enhanced: true,
        breakdown: enhancedQuality.breakdown,
        details: enhancedQuality.details,
        recommendation: enhancedQuality.recommendation,
        maturityBonus: enhancedQuality.maturityBonus,
        // Legacy fields for backward compatibility
        hasLocation,
        hasBasicData,
        hasDetailedData,
        dataCompleteness: basicCompleteness,
        // Enhanced metrics
        averageDistance: enhancedQuality.details.averageDistance,
        averageAge: enhancedQuality.details.averageAge,
        qualityDistribution: enhancedQuality.details.qualityDistribution
      };
    }
    
    // Fallback to basic scoring if no comparables available
    const basicScore = 
      0.4 * (maturityMetrics.nComparables / 20) +
      0.3 * (hasLocation ? 1 : 0) +
      0.2 * (hasBasicData ? 1 : 0) +
      0.1 * (hasDetailedData ? 1 : 0);
    
    return {
      score: Math.min(basicScore, 1.0),
      enhanced: false,
      hasLocation,
      hasBasicData,
      hasDetailedData,
      dataCompleteness: basicCompleteness,
      fallback: 'No comparables data available for enhanced scoring'
    };
  }

  /**
   * Decide approach for a specific section
   */
  decideSectionApproach(section, config, maturityMetrics, qualityMetrics) {
    // Always AI sections
    if (config.ai === true) {
      return {
        approach: 'ai',
        reason: 'Always requires AI narrative/interpretation',
        confidence: 'high'
      };
    }
    
    // Check progressive thresholds
    const meetsQuantity = maturityMetrics.nComparables >= config.nComparables;
    const meetsAnalyses = maturityMetrics.nAnalyses >= config.nAnalyses;
    const meetsQuality = qualityMetrics.score >= config.qualityScore;
    
    if (meetsQuantity && meetsAnalyses && meetsQuality) {
      return {
        approach: 'system',
        reason: `Sufficient data: ${maturityMetrics.nComparables} comps, ${maturityMetrics.nAnalyses} analyses, ${(qualityMetrics.score * 100).toFixed(0)}% quality`,
        confidence: qualityMetrics.score > 0.8 ? 'high' : 'medium'
      };
    }
    
    // Fallback to AI
    const missing = [];
    if (!meetsQuantity) missing.push(`need ${config.nComparables} comps (have ${maturityMetrics.nComparables})`);
    if (!meetsAnalyses) missing.push(`need ${config.nAnalyses} analyses (have ${maturityMetrics.nAnalyses})`);
    if (!meetsQuality) missing.push(`need ${(config.qualityScore * 100)}% quality (have ${(qualityMetrics.score * 100).toFixed(0)}%)`);
    
    return {
      approach: 'ai',
      reason: `Insufficient data: ${missing.join(', ')}`,
      confidence: maturityMetrics.nComparables > 0 ? 'medium' : 'low'
    };
  }

  /**
   * Update area counters after analysis
   */
  async updateAreaCounters(propertyData, analysisType = 'analysis') {
    if (!this.propertyDb) return;
    
    try {
      const areaKeys = this.generateAreaKeys(propertyData);
      const areaKey = areaKeys.primary;
      const areaName = propertyData.urbanization || propertyData.suburb || propertyData.city || 'unknown';
      const areaType = propertyData.urbanization ? 'urbanization' : 
                      propertyData.suburb ? 'suburb' : 'city';
      
      // Upsert area maturity record
      await this.propertyDb.query(`
        INSERT INTO area_data_maturity (area_key, area_type, area_name, n_analyses, last_analysis_run)
        VALUES ($1, $2, $3, 1, NOW())
        ON CONFLICT (area_key)
        DO UPDATE SET 
          n_analyses = area_data_maturity.n_analyses + 1,
          last_analysis_run = NOW(),
          updated_at = NOW()
      `, [areaKey, areaType, areaName]);
      
      // Clear cache for this area
      this.cache.del(`decisions:${areaKey}`);
      
      console.log(`📈 Updated area counters for ${areaName} (${analysisType})`);
      
    } catch (error) {
      console.error('❌ Error updating area counters:', error);
    }
  }

  /**
   * Update comparable counters
   */
  async updateComparableCounters(comparables) {
    if (!this.propertyDb || !comparables?.length) return;
    
    try {
      // Group comparables by area
      const areaGroups = new Map();
      
      for (const comp of comparables) {
        const areaKeys = this.generateAreaKeys(comp);
        const areaKey = areaKeys.primary;
        if (!areaGroups.has(areaKey)) {
          areaGroups.set(areaKey, {
            areaKey,
            areaName: comp.urbanization || comp.suburb || comp.city || 'unknown',
            areaType: comp.urbanization ? 'urbanization' : comp.suburb ? 'suburb' : 'city',
            count: 0
          });
        }
        areaGroups.get(areaKey).count++;
      }
      
      // Update counters for each area
      for (const [areaKey, group] of areaGroups) {
        await this.propertyDb.query(`
          INSERT INTO area_data_maturity (area_key, area_type, area_name, n_comparables, last_comparable_added)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (area_key)
          DO UPDATE SET 
            n_comparables = GREATEST(area_data_maturity.n_comparables, $4),
            last_comparable_added = NOW(),
            updated_at = NOW()
        `, [areaKey, group.areaType, group.areaName, group.count]);
        
        // Clear cache for this area
        this.cache.del(`decisions:${areaKey}`);
      }
      
      console.log(`📊 Updated comparable counters for ${areaGroups.size} areas`);
      
    } catch (error) {
      console.error('❌ Error updating comparable counters:', error);
    }
  }

  /**
   * Get fallback decisions (all AI) when errors occur
   */
  getFallbackDecisions(propertyData) {
    const decisions = {};
    for (const section of Object.keys(this.thresholds)) {
      decisions[section] = {
        approach: 'ai',
        reason: 'Fallback due to system error',
        confidence: 'low'
      };
    }
    
    return {
      decisions,
      maturityMetrics: { nComparables: 0, nAnalyses: 0, hasData: false },
      qualityMetrics: { score: 0 },
      areaKeys: this.generateAreaKeys(propertyData),
      fallback: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      systemPercentage: this.metrics.decisions > 0 ? 
        Math.round((this.metrics.systemUsage / this.metrics.decisions) * 100) : 0
    };
  }
}

module.exports = SystemAIDecisionService; 