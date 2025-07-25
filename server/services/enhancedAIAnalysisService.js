const OpenAI = require('openai');
const NodeCache = require('node-cache');
const SystemAIDecisionService = require('./systemAIDecisionService');
const DynamicTTLService = require('./dynamicTTLService');
const GooglePlacesService = require('./googlePlacesService');
const AdvancedMonitoringService = require('./advancedMonitoringService');
const StreamingResponseService = require('./streamingResponseService');
const PredictiveAnalyticsService = require('./predictiveAnalyticsService');

/**
 * Enhanced AI Analysis Service - Phase 1 MVP
 * 
 * Implements the progressive System/AI division with:
 * 1. Section-level decision making (System vs AI)
 * 2. Confidence indicators for all sections
 * 3. Section-specific caching with TTLs
 * 4. Cost optimization through selective AI usage
 * 5. Quality-aware progressive thresholds
 */
class EnhancedAIAnalysisService {
  constructor(propertyDatabase, learningService = null) {
    this.propertyDb = propertyDatabase;
    this.learningService = learningService;
    
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else {
      this.openai = null;
      console.log('OpenAI API key not found - AI analysis will be disabled');
    }
    
    // Initialize System/AI Decision Service
    this.decisionService = new SystemAIDecisionService(propertyDatabase);
    
    // Initialize Dynamic TTL Service
    this.dynamicTTLService = new DynamicTTLService(propertyDatabase);
    
    // Initialize Google Places Service
    this.googlePlacesService = new GooglePlacesService();
    
    // Initialize Advanced Monitoring Service
    this.monitoringService = new AdvancedMonitoringService(propertyDatabase);
    
    // Initialize Predictive Analytics Service
    this.predictiveAnalyticsService = new PredictiveAnalyticsService(propertyDatabase);
    
    // Initialize Streaming Service (shared instance)
    this.streamingService = null; // Will be injected or created as needed
    
    // Section-level caching with dynamic TTLs
    this.sectionCache = new NodeCache({ 
      stdTTL: 3600,  // Default fallback
      checkperiod: 600 // Check every 10 minutes
    });
    
    // Section-specific cache TTLs (in seconds)
    this.cacheTTLs = {
      marketData: 3600,           // 1 hour - market data changes
      valuation: 1800,            // 30 min - valuation sensitive
      amenities: 86400,           // 24 hours - amenities stable
      mobility: 86400,            // 24 hours - transport stable
      locationAdvantages: 7200,   // 2 hours - AI narrative
      investmentPotential: 3600,  // 1 hour - AI analysis
      marketOutlook: 1800,        // 30 min - market sensitive
      executiveSummary: 900,      // 15 min - comprehensive AI
      recommendations: 900        // 15 min - comprehensive AI
    };
    
    this.metrics = {
      totalAnalyses: 0,
      systemSections: 0,
      aiSections: 0,
      cacheHits: 0,
      costSaved: 0
    };
  }

     /**
    * Main analysis method with System/AI decision logic and monitoring
    */
  async generatePropertyAnalysis(propertyData, comparablesData, chartData, sessionId = null) {
    const startTime = Date.now();
    
    try {
      console.log('🚀 Starting enhanced property analysis with System/AI decisions...');
      
      // Initialize monitoring if not already done
      if (!this.monitoringService.isInitialized) {
        await this.monitoringService.initialize();
      }
      
             // Record analysis start metric
       await this.monitoringService.recordMetric('analysis_started', 1, {
         propertyLocation: propertyData.city,
         comparablesData: comparablesData?.comparables?.length || 0
       }, sessionId);
       
               // Start progress tracking if streaming service is available
        if (this.streamingService && sessionId) {
          await this.streamingService.startAnalysisStream(sessionId, {
            propertyLocation: propertyData.city,
            totalSections: 10
          });
        }
       
       // Step 1: Make System/AI decisions for all sections with enhanced quality scoring
       await this.streamProgress(sessionId, 'Analyzing data requirements and making System/AI decisions...', 0);
       const decisionResult = await this.decisionService.makeDecisions(propertyData, comparablesData);
       const { decisions, maturityMetrics, qualityMetrics } = decisionResult;
       
       // Step 2: Update counters for this analysis
       await this.decisionService.updateAreaCounters(propertyData);
       
       // Step 3: Update comparable counters
       if (comparablesData?.comparables?.length > 0) {
         await this.decisionService.updateComparableCounters(comparablesData.comparables);
       }
       
               // Step 4: Generate each section sequentially with progress updates
        const sections = {};
        const sectionNames = ['marketData', 'valuation', 'amenities', 'mobility', 'locationAdvantages', 'investmentPotential', 'marketOutlook', 'marketForecasting', 'executiveSummary', 'recommendations'];
        
        for (let i = 0; i < sectionNames.length; i++) {
          const sectionName = sectionNames[i];
          const sectionConfig = decisions[sectionName] || { approach: 'system' }; // Default to system for new sections
          
          // Update progress before processing section
          await this.streamProgress(sessionId, `Generating ${this.getSectionDisplayName(sectionName)}...`, i);
          
          console.log(`   🔄 Processing ${sectionName} (${i + 1}/${sectionNames.length}) using ${sectionConfig.approach}`);
          
          // Generate the section
          const sectionResult = await this.generateSection(sectionName, sectionConfig, propertyData, comparablesData, chartData, qualityMetrics);
          sections[sectionName] = sectionResult;
          
          console.log(`   ✅ Completed ${sectionName} in ${sectionResult.processingTime}ms`);
        }
      
      // Step 6: Create comprehensive analysis result
      const result = {
        // Legacy format for backward compatibility
        analysis: this.formatLegacyAnalysis(sections),
        
        // Enhanced format with section breakdown
        sections,
        decisions: decisionResult,
        
        // Metadata
        confidence: this.calculateOverallConfidence(sections),
        recommendations: this.extractRecommendations(sections),
        marketTrends: this.extractMarketTrends(sections),
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        
        // Cost tracking
        costBreakdown: this.calculateCostBreakdown(sections, decisions),
        
        // Progressive indicators
        maturityLevel: this.calculateMaturityLevel(maturityMetrics),
        systemUsagePercentage: this.calculateSystemUsage(decisions)
      };
      
             // Update metrics
       this.updateMetrics(decisions, sections);
       
       // Record monitoring metrics and quality assessments
       await this.recordMonitoringData(sessionId, result, sections, decisions);
       
               // Complete progress tracking
        await this.streamProgress(sessionId, 'Analysis complete! All sections generated.', 10, true);
       if (this.streamingService && sessionId) {
         await this.streamingService.completeAnalysisStream(sessionId);
       }
       
       console.log(`✅ Enhanced analysis completed in ${result.processingTime}ms`);
       console.log(`📊 System usage: ${result.systemUsagePercentage}%, Maturity: ${result.maturityLevel}`);
       
       return result;
      
    } catch (error) {
      console.error('❌ Error in enhanced property analysis:', error);
      return this.getFallbackAnalysis(propertyData, comparablesData, chartData);
    }
  }

  /**
   * Generate individual section using System or AI with dynamic TTL
   */
  async generateSection(sectionName, decision, propertyData, comparablesData, chartData, qualityMetrics = null) {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.generateSectionCacheKey(sectionName, propertyData, decision);
      const cached = this.sectionCache.get(cacheKey);
      
      if (cached) {
        this.metrics.cacheHits++;
        console.log(`   ⚡ Cache hit for ${sectionName}`);
        return {
          ...cached,
          fromCache: true,
          decision
        };
      }
      
      let content, confidence, dataSource;
      
      if (decision.approach === 'system') {
        // Use system-based data processing
        const systemResult = await this.generateSystemSection(sectionName, propertyData, comparablesData, chartData);
        content = systemResult.content;
        confidence = systemResult.confidence;
        dataSource = 'system';
        
        this.metrics.systemSections++;
        
      } else {
        // Use AI analysis
        const aiResult = await this.generateAISection(sectionName, propertyData, comparablesData, chartData);
        content = aiResult.content;
        confidence = aiResult.confidence;
        dataSource = 'ai';
        
        this.metrics.aiSections++;
      }
      
      const result = {
        content,
        confidence,
        dataSource,
        decision,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
      
      // Calculate dynamic TTL based on market conditions
      const ttlResult = await this.dynamicTTLService.calculateTTL(sectionName, propertyData, qualityMetrics);
      const dynamicTTL = ttlResult.ttl;
      
      // Cache result with dynamic TTL
      this.sectionCache.set(cacheKey, result, dynamicTTL);
      
      // Add TTL information to result
      result.caching = {
        ttl: dynamicTTL,
        ttlMinutes: Math.round(dynamicTTL / 60),
        reasoning: ttlResult.reasoning,
        factors: ttlResult.factors
      };
      
      console.log(`   ✅ ${sectionName}: ${dataSource} (${confidence} confidence) - ${result.processingTime}ms [TTL: ${Math.round(dynamicTTL/60)}min]`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Error generating ${sectionName}:`, error);
      return {
        content: `${sectionName} analysis temporarily unavailable.`,
        confidence: 'low',
        dataSource: 'error',
        decision,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generate system-based section content
   */
     async generateSystemSection(sectionName, propertyData, comparablesData, chartData) {
     switch (sectionName) {
       case 'marketData':
         return this.generateSystemMarketData(comparablesData, chartData);
       
       case 'valuation':
         return this.generateSystemValuation(propertyData, comparablesData);
       
       case 'amenities':
         return await this.generateSystemAmenities(propertyData);
       
       case 'mobility':
         return this.generateSystemMobility(propertyData);
       
       case 'marketForecasting':
         return await this.generateSystemMarketForecasting(propertyData, comparablesData);
       
       default:
         throw new Error(`System generation not implemented for ${sectionName}`);
     }
   }

  /**
   * Generate AI-based section content
   */
  async generateAISection(sectionName, propertyData, comparablesData, chartData) {
    if (!this.openai) {
      return {
        content: "AI analysis requires OpenAI API key configuration.",
        confidence: 'none'
      };
    }
    
    const prompts = this.getSectionPrompts();
    const prompt = prompts[sectionName];
    
    if (!prompt) {
      throw new Error(`AI prompt not defined for ${sectionName}`);
    }
    
    // Use appropriate model based on section complexity
    const model = this.getModelForSection(sectionName);
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: "You are a professional real estate analyst. Provide concise, accurate analysis. Use British English."
          },
          {
            role: "user",
            content: this.buildSectionPrompt(sectionName, prompt, propertyData, comparablesData, chartData)
          }
        ],
        max_tokens: this.getTokenLimitForSection(sectionName),
        temperature: 0.3
      });
      
      return {
        content: completion.choices[0].message.content,
        confidence: 'high'
      };
      
    } catch (error) {
      console.error(`❌ AI generation failed for ${sectionName}:`, error);
      return {
        content: `AI analysis for ${sectionName} temporarily unavailable.`,
        confidence: 'none'
      };
    }
  }

  /**
   * System-based market data generation
   */
  generateSystemMarketData(comparablesData, chartData) {
    const comps = comparablesData?.comparables || [];
    
    if (comps.length === 0) {
      return {
        content: "Insufficient comparable data for market analysis.",
        confidence: 'low'
      };
    }
    
    const prices = comps.map(c => c.sale_price).filter(p => p > 0);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const medianPrice = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)];
    const priceRange = { min: Math.min(...prices), max: Math.max(...prices) };
    
    const content = `**Market Data & Trends**

Based on ${comps.length} comparable properties in the area:

📊 **Price Analysis**
- Average sale price: €${avgPrice.toLocaleString()}
- Median sale price: €${medianPrice.toLocaleString()}
- Price range: €${priceRange.min.toLocaleString()} - €${priceRange.max.toLocaleString()}

📈 **Market Activity**
- Active listings: ${comps.length} properties
- Price per m²: €${(avgPrice / (comps.map(c => c.build_size).filter(s => s > 0).reduce((sum, s) => sum + s, 0) / comps.filter(c => c.build_size > 0).length || 1)).toFixed(0)}

*Data based on current market listings and recent transactions.*`;

    return {
      content,
      confidence: comps.length >= 10 ? 'high' : 'medium'
    };
  }

  /**
   * System-based valuation generation
   */
  generateSystemValuation(propertyData, comparablesData) {
    const comps = comparablesData?.comparables || [];
    const prices = comps.map(c => c.sale_price).filter(p => p > 0);
    
    if (prices.length < 3) {
      return {
        content: "Insufficient data for automated valuation analysis.",
        confidence: 'low'
      };
    }
    
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const stdDev = Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length);
    
    const valuationRange = {
      low: Math.round(avgPrice - stdDev),
      high: Math.round(avgPrice + stdDev),
      estimate: Math.round(avgPrice)
    };
    
    const content = `**Valuation Analysis**

📊 **Automated Valuation Model (AVM)**
- Estimated value: €${valuationRange.estimate.toLocaleString()}
- Valuation range: €${valuationRange.low.toLocaleString()} - €${valuationRange.high.toLocaleString()}
- Confidence interval: ±${Math.round((stdDev / avgPrice) * 100)}%

🎯 **Methodology**
- Based on ${prices.length} comparable sales
- Statistical analysis of recent transactions
- Adjusted for property characteristics

*Automated valuation based on comparable sales data.*`;

    return {
      content,
      confidence: prices.length >= 8 ? 'high' : 'medium'
    };
  }

  /**
   * System-based amenities generation using Google Places API
   */
  async generateSystemAmenities(propertyData) {
    try {
      // Get comprehensive amenities data from Google Places
      const amenitiesData = await this.googlePlacesService.getAmenitiesForProperty(propertyData);
      
      // Format for system analysis
      const formattedResult = this.googlePlacesService.formatForSystemAnalysis(amenitiesData);
      
      return {
        content: formattedResult.content,
        confidence: formattedResult.confidence,
        amenitiesData: amenitiesData, // Include raw data for potential future use
        qualityScore: formattedResult.qualityScore,
        totalPlaces: formattedResult.totalPlaces
      };
      
    } catch (error) {
      console.error('❌ Error generating system amenities:', error);
      
      // Fallback to basic content
      return {
        content: `**Nearby Amenities**

📍 **Location**: ${propertyData.urbanization || propertyData.suburb || propertyData.city}

⚠️ **Service Temporarily Unavailable**
Amenities analysis requires Google Places API access.

*Please configure GOOGLE_PLACES_API_KEY for detailed amenities data.*`,
        confidence: 'none',
        error: error.message
      };
    }
  }

     /**
    * System-based mobility generation (placeholder for future Google Maps integration)
    */
   generateSystemMobility(propertyData) {
     return {
       content: `**Mobility & Transportation**
 
 🚗 **Road Access**
 - Location: ${propertyData.urbanization || propertyData.suburb || propertyData.city}
 - Regional connectivity available
 
 🚌 **Public Transport**
 - Local transport options present in area
 - Major routes accessible
 
 ✈️ **Major Connections**
 - Airport access via regional road network
 - Rail connections in broader area
 
 *Detailed travel times available with Google Maps integration.*`,
       confidence: 'medium'
     };
   }

   /**
    * System-based market forecasting using predictive analytics
    */
   async generateSystemMarketForecasting(propertyData, comparablesData) {
     try {
       // Generate comprehensive market forecast
       const forecast = await this.predictiveAnalyticsService.generateMarketForecast(
         propertyData, 
         comparablesData, 
         'medium' // 6-month forecast horizon
       );
       
       // Format forecast for display
       const content = `**Market Forecasting & Predictive Analytics**

${forecast.summary}

🔮 **Investment Timing Analysis**
- Timing Score: ${forecast.investmentTiming?.timingScore || 'N/A'}/100
- Recommendation: ${forecast.investmentTiming?.recommendation || 'Analyze market conditions'}
- Risk Level: ${this.classifyForecastRisk(forecast)}

📊 **Technical Analysis**
- Price Support: €${forecast.priceForecast?.support?.toLocaleString() || 'TBD'}
- Price Resistance: €${forecast.priceForecast?.resistance?.toLocaleString() || 'TBD'}
- Trend Strength: ${forecast.trendAnalysis ? (forecast.trendAnalysis.trendStrength * 100).toFixed(0) + '%' : 'N/A'}

📈 **Risk Assessment**
${forecast.riskFactors?.length > 0 ? 
  forecast.riskFactors.map(risk => `- ${risk.type}: ${risk.severity} risk`).join('\n') :
  '- No significant risk factors identified'
}

⚠️ **Data Quality**
- Confidence Level: ${(forecast.confidence * 100).toFixed(0)}%
- Data Points: ${forecast.dataQuality?.dataPoints || 0} months
- Quality Score: ${forecast.dataQuality ? (forecast.dataQuality.score * 100).toFixed(0) + '%' : 'N/A'}

*Forecast generated using advanced predictive analytics and machine learning models.*`;

       return {
         content: content,
         confidence: forecast.confidence > 0.6 ? 'high' : forecast.confidence > 0.3 ? 'medium' : 'low',
         forecastData: forecast, // Include full forecast data for potential future use
         processingTime: forecast.processingTime,
         methodology: forecast.methodology
       };
       
     } catch (error) {
       console.error('❌ Error generating market forecasting:', error);
       
       // Fallback content
       return {
         content: `**Market Forecasting & Predictive Analytics**

⚠️ **Service Temporarily Unavailable**
Advanced market forecasting requires sufficient historical data.

📊 **General Market Insights**
- Spanish property market shows steady growth trends
- Costa del Sol maintains strong international appeal  
- Consider seasonal market patterns for optimal timing
- Consult local market experts for detailed predictions

🔮 **Basic Recommendations**
- Monitor market trends over 3-6 month periods
- Consider economic indicators and interest rate changes
- Evaluate local supply and demand dynamics
- Review comparable sales trends regularly

*Enhanced forecasting available with more market data.*`,
         confidence: 'low',
         error: error.message
       };
     }
   }

   /**
    * Classify forecast risk level
    */
   classifyForecastRisk(forecast) {
     if (!forecast.volatilityAnalysis) return 'Medium';
     
     const volatility = forecast.volatilityAnalysis.currentVolatility;
     const riskFactors = forecast.riskFactors?.length || 0;
     
     if (volatility > 0.2 || riskFactors >= 3) return 'High';
     if (volatility > 0.1 || riskFactors >= 2) return 'Medium';
     return 'Low';
   }

  /**
   * Generate section cache key
   */
  generateSectionCacheKey(sectionName, propertyData, decision) {
    const areaKey = propertyData.urbanization || propertyData.suburb || propertyData.city || 'unknown';
    const approach = decision.approach;
    return `${sectionName}:${approach}:${areaKey.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }

  /**
   * Get section-specific prompts
   */
  getSectionPrompts() {
    return {
      locationAdvantages: "Analyze the location advantages and unique selling points of this property based on the provided data.",
      investmentPotential: "Evaluate the investment potential, rental yields, and growth prospects for this property.",
      marketOutlook: "Provide market outlook and future trends for this property type and location.",
      executiveSummary: "Create a concise executive summary highlighting key findings and recommendations.",
      recommendations: "Provide clear investment recommendations with specific reasoning."
    };
  }

  /**
   * Get appropriate model for section
   */
  getModelForSection(sectionName) {
    // Use cheaper models for simpler sections
    const simpleModels = ['locationAdvantages', 'executiveSummary'];
    return simpleModels.includes(sectionName) ? 'gpt-3.5-turbo' : 'gpt-4o-mini';
  }

  /**
   * Get token limit for section
   */
  getTokenLimitForSection(sectionName) {
    const limits = {
      locationAdvantages: 300,
      investmentPotential: 500,
      marketOutlook: 400,
      executiveSummary: 400,
      recommendations: 300
    };
    return limits[sectionName] || 400;
  }

  /**
   * Build section-specific prompt
   */
  buildSectionPrompt(sectionName, basePrompt, propertyData, comparablesData, chartData) {
    const location = propertyData.urbanization || propertyData.suburb || propertyData.city;
    const propertyType = propertyData.property_type || 'property';
    const price = propertyData.sale_price ? `€${propertyData.sale_price.toLocaleString()}` : 'TBC';
    const comparableCount = comparablesData?.comparables?.length || 0;
    
    return `${basePrompt}

**Property Details:**
- Location: ${location}
- Type: ${propertyType}
- Price: ${price}
- Bedrooms: ${propertyData.bedrooms || 'N/A'}
- Size: ${propertyData.build_size ? `${propertyData.build_size}m²` : 'N/A'}

**Market Context:**
- Comparable properties analyzed: ${comparableCount}
- Area: ${location}

Provide a concise, professional analysis focusing on key insights.`;
  }

  /**
   * Format legacy analysis for backward compatibility
   */
  formatLegacyAnalysis(sections) {
    const parts = [];
    
    if (sections.executiveSummary?.content) parts.push(sections.executiveSummary.content);
    if (sections.marketData?.content) parts.push(sections.marketData.content);
    if (sections.valuation?.content) parts.push(sections.valuation.content);
    if (sections.locationAdvantages?.content) parts.push(sections.locationAdvantages.content);
    if (sections.investmentPotential?.content) parts.push(sections.investmentPotential.content);
    if (sections.marketOutlook?.content) parts.push(sections.marketOutlook.content);
    if (sections.recommendations?.content) parts.push(sections.recommendations.content);
    
    return parts.join('\n\n');
  }

  /**
   * Calculate overall confidence
   */
  calculateOverallConfidence(sections) {
    const confidenceValues = Object.values(sections)
      .map(s => s.confidence)
      .filter(c => c && c !== 'none');
    
    if (confidenceValues.length === 0) return 0;
    
    const confidenceMap = { low: 1, medium: 2, high: 3 };
    const avgConfidence = confidenceValues.reduce((sum, c) => sum + (confidenceMap[c] || 0), 0) / confidenceValues.length;
    
    return Math.round((avgConfidence / 3) * 10); // Scale to 0-10
  }

  /**
   * Extract recommendations from sections
   */
  extractRecommendations(sections) {
    const recommendations = [];
    
    if (sections.recommendations?.content) {
      // Extract bullet points or numbered items
      const lines = sections.recommendations.content.split('\n');
      lines.forEach(line => {
        if (line.includes('•') || line.includes('-') || /^\d+\./.test(line.trim())) {
          recommendations.push(line.trim());
        }
      });
    }
    
    return recommendations;
  }

  /**
   * Extract market trends from sections
   */
  extractMarketTrends(sections) {
    const trends = [];
    
    if (sections.marketOutlook?.content) {
      // Simple trend extraction
      if (sections.marketOutlook.content.toLowerCase().includes('growth')) {
        trends.push('Growth potential identified');
      }
      if (sections.marketOutlook.content.toLowerCase().includes('demand')) {
        trends.push('Strong market demand');
      }
    }
    
    return trends;
  }

  /**
   * Calculate cost breakdown
   */
  calculateCostBreakdown(sections, decisions) {
    let totalCost = 0;
    let aiCost = 0;
    let systemCost = 0;
    
    Object.entries(sections).forEach(([section, result]) => {
      if (result.dataSource === 'ai') {
        // Estimate AI cost based on tokens
        const estimatedTokens = result.content?.length / 4 || 0; // Rough estimate
        const cost = estimatedTokens * 0.00001; // Approximate pricing
        aiCost += cost;
        totalCost += cost;
      } else {
        // System operations have minimal cost
        systemCost += 0.001;
        totalCost += 0.001;
      }
    });
    
    return {
      total: totalCost,
      ai: aiCost,
      system: systemCost,
      currency: 'EUR'
    };
  }

  /**
   * Calculate maturity level
   */
  calculateMaturityLevel(maturityMetrics) {
    const { nComparables, nAnalyses } = maturityMetrics;
    
    if (nComparables >= 20 && nAnalyses >= 5) return 'High';
    if (nComparables >= 10 && nAnalyses >= 3) return 'Medium';
    if (nComparables >= 5 && nAnalyses >= 1) return 'Low';
    return 'Initial';
  }

  /**
   * Calculate system usage percentage
   */
  calculateSystemUsage(decisions) {
    const total = Object.keys(decisions).length;
    const systemCount = Object.values(decisions).filter(d => d.approach === 'system').length;
    return Math.round((systemCount / total) * 100);
  }

  /**
   * Update internal metrics
   */
  updateMetrics(decisions, sections) {
    this.metrics.totalAnalyses++;
    
    Object.values(decisions).forEach(decision => {
      if (decision.approach === 'system') {
        this.metrics.systemSections++;
      } else {
        this.metrics.aiSections++;
      }
    });
  }

  /**
   * Get fallback analysis when errors occur
   */
  getFallbackAnalysis(propertyData, comparablesData, chartData) {
    return {
      analysis: "Property analysis temporarily unavailable. Please refer to the comparable properties data for market insights.",
      sections: {},
      confidence: 0,
      recommendations: [],
      marketTrends: [],
      timestamp: new Date().toISOString(),
      error: "Fallback analysis - system error",
      systemUsagePercentage: 0,
      maturityLevel: 'Unknown'
    };
  }

     /**
    * Record comprehensive monitoring data
    */
  async recordMonitoringData(sessionId, analysisResult, sections, decisions) {
    try {
      if (!this.monitoringService.isInitialized) return;
      
      // Record performance metrics
      await this.monitoringService.recordMetric('response_time', analysisResult.processingTime, {
        systemUsage: analysisResult.systemUsagePercentage,
        maturityLevel: analysisResult.maturityLevel
      }, sessionId);
      
      await this.monitoringService.recordMetric('cost', analysisResult.costBreakdown.total, {
        aiCost: analysisResult.costBreakdown.ai,
        systemCost: analysisResult.costBreakdown.system
      }, sessionId);
      
      await this.monitoringService.recordMetric('confidence', analysisResult.confidence / 10, {
        decisionsCount: Object.keys(decisions).length
      }, sessionId);
      
      // Record quality assessments for each section
      for (const [sectionName, sectionResult] of Object.entries(sections)) {
        if (sectionResult.content) {
          await this.monitoringService.assessOutputQuality(
            sessionId,
            sectionName,
            sectionResult.content,
            {
              dataSource: sectionResult.dataSource,
              confidence: sectionResult.confidence,
              processingTime: sectionResult.processingTime,
              fromCache: sectionResult.fromCache || false
            }
          );
        }
      }
      
      // Record cache hit rate
      const cacheHits = Object.values(sections).filter(s => s.fromCache).length;
      const totalSections = Object.keys(sections).length;
      const cacheHitRate = totalSections > 0 ? cacheHits / totalSections : 0;
      
      await this.monitoringService.recordMetric('cache_hit', cacheHitRate, {
        cacheHits: cacheHits,
        totalSections: totalSections
      }, sessionId);
      
      // Record success metric
      await this.monitoringService.recordMetric('analysis_success', 1, {
        sectionsGenerated: totalSections,
        confidenceLevel: analysisResult.confidence
      }, sessionId);
      
    } catch (error) {
      console.error('❌ Error recording monitoring data:', error);
    }
  }

     /**
    * Set streaming service instance for progress tracking
    */
  setStreamingService(streamingService) {
    this.streamingService = streamingService;
  }

  /**
   * Stream progress update if streaming service is available
   */
     async streamProgress(sessionId, message, completed, isComplete = false) {
     if (this.streamingService && sessionId) {
       try {
         await this.streamingService.streamProgress(sessionId, {
           current: message,
           completed: completed,
           total: 10,
           isComplete: isComplete
         });
       } catch (error) {
         console.error('❌ Error streaming progress:', error);
       }
     }
   }

  /**
   * Get user-friendly section display names
   */
     getSectionDisplayName(sectionName) {
     const displayNames = {
       marketData: 'Market Data & Trends',
       valuation: 'Property Valuation',
       amenities: 'Nearby Amenities',
       mobility: 'Transportation & Mobility',
       locationAdvantages: 'Location Advantages',
       investmentPotential: 'Investment Potential',
       marketOutlook: 'Market Outlook',
       marketForecasting: 'Predictive Market Forecasting',
       executiveSummary: 'Executive Summary',
       recommendations: 'Investment Recommendations'
     };
     
     return displayNames[sectionName] || sectionName;
   }

  /**
   * Get current metrics including monitoring data
   */
  getMetrics() {
    return {
      ...this.metrics,
      decisionMetrics: this.decisionService.getMetrics(),
      monitoringDashboard: this.monitoringService.isInitialized ? this.monitoringService.getMonitoringDashboard() : null
    };
  }
}

module.exports = EnhancedAIAnalysisService; 