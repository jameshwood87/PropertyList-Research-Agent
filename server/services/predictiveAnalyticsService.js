/**
 * Predictive Analytics Service - Phase 3 Enhancement
 * 
 * Provides advanced market forecasting and trend prediction:
 * 1. Market trend analysis and forecasting
 * 2. Price movement prediction
 * 3. Demand forecasting and seasonality analysis
 * 4. Investment timing recommendations
 * 5. Risk assessment and volatility analysis
 * 6. Comparative market analysis (CMA) predictions
 * 7. Economic indicator correlation
 * 8. Machine learning-based pattern recognition
 */
class PredictiveAnalyticsService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    
    // Prediction models and algorithms
    this.models = {
      priceForecasting: new PriceForecasting(),
      demandPrediction: new DemandPrediction(),
      trendAnalysis: new TrendAnalysis(),
      seasonalityDetection: new SeasonalityDetection(),
      volatilityModeling: new VolatilityModeling()
    };
    
    // Market indicators and weights
    this.marketIndicators = {
      priceMovement: { weight: 0.25, window: '6M' },
      volumeActivity: { weight: 0.20, window: '3M' },
      timeOnMarket: { weight: 0.15, window: '6M' },
      priceReductions: { weight: 0.10, window: '3M' },
      newListings: { weight: 0.15, window: '1M' },
      economicFactors: { weight: 0.15, window: '12M' }
    };
    
    // Forecasting horizons
    this.forecastHorizons = {
      short: { months: 3, confidence: 0.85 },
      medium: { months: 6, confidence: 0.75 },
      long: { months: 12, confidence: 0.65 },
      extended: { months: 24, confidence: 0.50 }
    };
    
    // Machine learning parameters
    this.mlConfig = {
      minDataPoints: 12, // Minimum data points for reliable prediction
      trainingWindow: 24, // Months of historical data for training
      validationSplit: 0.2,
      updateFrequency: 'weekly'
    };
    
    // Economic indicators integration
    this.economicFactors = {
      interestRates: { source: 'ECB', weight: 0.3 },
      inflation: { source: 'Eurostat', weight: 0.2 },
      employment: { source: 'INE', weight: 0.2 },
      gdpGrowth: { source: 'Eurostat', weight: 0.15 },
      consumerConfidence: { source: 'EC', weight: 0.15 }
    };
    
    // Cache for predictions
    this.predictionCache = new Map();
    this.cacheTTL = 24 * 60 * 60 * 1000; // 24 hours
    
    // Performance metrics
    this.metrics = {
      accuracyScores: {},
      predictionCounts: 0,
      cacheHitRate: 0,
      modelPerformance: {}
    };
  }

  /**
   * Generate comprehensive market forecast for a property/area
   */
  async generateMarketForecast(propertyData, comparablesData, horizon = 'medium') {
    try {
      const startTime = Date.now();
      const areaKey = this.generateAreaKey(propertyData);
      
      console.log(`🔮 Generating ${horizon}-term market forecast for ${areaKey}...`);
      
      // Check cache first
      const cacheKey = `forecast:${areaKey}:${horizon}`;
      const cached = this.predictionCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
        console.log('   ⚡ Using cached forecast');
        return cached.data;
      }
      
      // Gather historical market data
      const historicalData = await this.gatherHistoricalData(areaKey, this.mlConfig.trainingWindow);
      
      if (historicalData.length < this.mlConfig.minDataPoints) {
        return this.generateBasicForecast(propertyData, comparablesData, horizon);
      }
      
      // Generate predictions for different aspects
      const [
        priceForecast,
        demandForecast,
        trendAnalysis,
        seasonalityAnalysis,
        volatilityAnalysis,
        investmentTiming
      ] = await Promise.all([
        this.predictPriceMovement(historicalData, horizon),
        this.predictDemandPatterns(historicalData, horizon),
        this.analyzeTrends(historicalData, horizon),
        this.detectSeasonality(historicalData),
        this.assessVolatility(historicalData, horizon),
        this.recommendInvestmentTiming(historicalData, propertyData)
      ]);
      
      // Combine predictions into comprehensive forecast
      const forecast = {
        areaKey: areaKey,
        horizon: horizon,
        confidence: this.forecastHorizons[horizon].confidence,
        generatedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        
        // Core predictions
        priceForecast: priceForecast,
        demandForecast: demandForecast,
        
        // Market analysis
        trendAnalysis: trendAnalysis,
        seasonalityAnalysis: seasonalityAnalysis,
        volatilityAnalysis: volatilityAnalysis,
        
        // Investment insights
        investmentTiming: investmentTiming,
        
        // Risk assessment
        riskFactors: this.assessRiskFactors(historicalData, priceForecast, volatilityAnalysis),
        
        // Formatted summary
        summary: this.generateForecastSummary(priceForecast, demandForecast, trendAnalysis, horizon),
        
        // Metadata
        dataQuality: this.assessDataQuality(historicalData),
        methodology: this.getMethodologyInfo(horizon),
        lastUpdated: new Date().toISOString()
      };
      
      // Cache the forecast
      this.predictionCache.set(cacheKey, {
        data: forecast,
        timestamp: Date.now()
      });
      
      // Update metrics
      this.metrics.predictionCounts++;
      
      console.log(`   ✅ Market forecast generated in ${forecast.processingTime}ms`);
      
      return forecast;
      
    } catch (error) {
      console.error('❌ Error generating market forecast:', error);
      return this.getFallbackForecast(propertyData, horizon);
    }
  }

  /**
   * Predict price movement patterns
   */
  async predictPriceMovement(historicalData, horizon) {
    try {
      const priceData = historicalData.map(d => ({
        date: d.date,
        avgPrice: d.avgPrice,
        medianPrice: d.medianPrice,
        volume: d.volume
      }));
      
      // Apply price forecasting model
      const forecast = this.models.priceForecasting.predict(priceData, horizon);
      
      // Calculate price change expectations
      const currentPrice = priceData[priceData.length - 1].avgPrice;
      const forecastMonths = this.forecastHorizons[horizon].months;
      const forecastPrice = forecast.predictions[forecast.predictions.length - 1].value;
      
      const priceChange = {
        absolute: forecastPrice - currentPrice,
        percentage: ((forecastPrice - currentPrice) / currentPrice) * 100,
        annualized: (((forecastPrice - currentPrice) / currentPrice) * 100) * (12 / forecastMonths)
      };
      
      return {
        currentPrice: currentPrice,
        forecastPrice: forecastPrice,
        priceChange: priceChange,
        predictions: forecast.predictions,
        confidence: forecast.confidence,
        trends: this.identifyPriceTrends(forecast.predictions),
        momentum: this.calculatePriceMomentum(priceData),
        support: this.findSupportLevels(priceData),
        resistance: this.findResistanceLevels(priceData)
      };
      
    } catch (error) {
      console.error('❌ Error predicting price movement:', error);
      return this.getBasicPricePrediction(historicalData, horizon);
    }
  }

  /**
   * Predict demand patterns and market activity
   */
  async predictDemandPatterns(historicalData, horizon) {
    try {
      const demandData = historicalData.map(d => ({
        date: d.date,
        listings: d.listings,
        sales: d.sales,
        timeOnMarket: d.avgTimeOnMarket,
        viewings: d.avgViewings || 0
      }));
      
      const forecast = this.models.demandPrediction.predict(demandData, horizon);
      
      // Calculate demand indicators
      const currentDemand = this.calculateDemandIndex(demandData.slice(-3)); // Last 3 months
      const forecastDemand = this.calculateDemandIndex(forecast.predictions.slice(-3));
      
      const demandChange = {
        absolute: forecastDemand - currentDemand,
        percentage: ((forecastDemand - currentDemand) / currentDemand) * 100,
        trend: this.classifyDemandTrend(forecast.predictions)
      };
      
      return {
        currentDemand: currentDemand,
        forecastDemand: forecastDemand,
        demandChange: demandChange,
        predictions: forecast.predictions,
        confidence: forecast.confidence,
        marketActivity: this.analyzeMarketActivity(demandData),
        buyerBehavior: this.analyzeBuyerBehavior(demandData),
        inventory: this.predictInventoryLevels(demandData, horizon)
      };
      
    } catch (error) {
      console.error('❌ Error predicting demand patterns:', error);
      return this.getBasicDemandPrediction(historicalData, horizon);
    }
  }

  /**
   * Analyze long-term trends and patterns
   */
  async analyzeTrends(historicalData, horizon) {
    try {
      const trendAnalysis = this.models.trendAnalysis.analyze(historicalData, horizon);
      
      return {
        primaryTrend: trendAnalysis.primary, // bullish/bearish/sideways
        secondaryTrends: trendAnalysis.secondary,
        trendStrength: trendAnalysis.strength, // 0-1 scale
        trendDuration: trendAnalysis.duration, // months
        reversalProbability: trendAnalysis.reversalProbability,
        breakoutLevels: trendAnalysis.breakoutLevels,
        cyclicalPatterns: this.identifyCyclicalPatterns(historicalData),
        marketPhase: this.identifyMarketPhase(historicalData) // expansion/peak/contraction/trough
      };
      
    } catch (error) {
      console.error('❌ Error analyzing trends:', error);
      return this.getBasicTrendAnalysis(historicalData);
    }
  }

  /**
   * Detect seasonal patterns in the market
   */
  async detectSeasonality(historicalData) {
    try {
      const seasonalAnalysis = this.models.seasonalityDetection.analyze(historicalData);
      
      return {
        hasSeasonality: seasonalAnalysis.detected,
        seasonalStrength: seasonalAnalysis.strength,
        bestMonths: seasonalAnalysis.bestMonths, // Months with highest activity/prices
        worstMonths: seasonalAnalysis.worstMonths,
        seasonalFactors: seasonalAnalysis.factors, // Monthly adjustment factors
        yearOverYear: this.calculateYearOverYearTrends(historicalData),
        holidayEffects: this.analyzeHolidayEffects(historicalData)
      };
      
    } catch (error) {
      console.error('❌ Error detecting seasonality:', error);
      return this.getBasicSeasonalityAnalysis(historicalData);
    }
  }

  /**
   * Assess market volatility and risk
   */
  async assessVolatility(historicalData, horizon) {
    try {
      const volatilityModel = this.models.volatilityModeling.analyze(historicalData, horizon);
      
      const currentVolatility = this.calculateVolatility(historicalData.slice(-6)); // Last 6 months
      const forecastVolatility = volatilityModel.forecast;
      
      return {
        currentVolatility: currentVolatility,
        forecastVolatility: forecastVolatility,
        volatilityTrend: this.classifyVolatilityTrend(volatilityModel.timeSeries),
        riskLevel: this.classifyRiskLevel(currentVolatility, forecastVolatility),
        volatilityDrivers: this.identifyVolatilityDrivers(historicalData),
        stabilityScore: this.calculateStabilityScore(historicalData),
        riskAdjustedReturns: this.calculateRiskAdjustedReturns(historicalData)
      };
      
    } catch (error) {
      console.error('❌ Error assessing volatility:', error);
      return this.getBasicVolatilityAnalysis(historicalData);
    }
  }

  /**
   * Recommend optimal investment timing
   */
  async recommendInvestmentTiming(historicalData, propertyData) {
    try {
      // Analyze multiple timing factors
      const priceTiming = this.analyzePriceTiming(historicalData);
      const marketTiming = this.analyzeMarketTiming(historicalData);
      const seasonalTiming = this.analyzeSeasonalTiming(historicalData);
      const economicTiming = this.analyzeEconomicTiming();
      
      // Calculate composite timing score
      const timingScore = this.calculateTimingScore(priceTiming, marketTiming, seasonalTiming, economicTiming);
      
      // Generate recommendations
      const recommendations = this.generateTimingRecommendations(timingScore, priceTiming, marketTiming);
      
      return {
        timingScore: timingScore, // 0-100 scale (higher = better time to invest)
        recommendation: recommendations.primary,
        alternativeScenarios: recommendations.alternatives,
        timeHorizon: recommendations.timeHorizon,
        riskFactors: recommendations.risks,
        opportunities: recommendations.opportunities,
        marketConditions: {
          price: priceTiming,
          market: marketTiming,
          seasonal: seasonalTiming,
          economic: economicTiming
        },
        actionPlan: this.generateActionPlan(timingScore, recommendations)
      };
      
    } catch (error) {
      console.error('❌ Error generating investment timing:', error);
      return this.getBasicTimingRecommendation();
    }
  }

  /**
   * Assess risk factors for the forecast
   */
  assessRiskFactors(historicalData, priceForecast, volatilityAnalysis) {
    const risks = [];
    
    // Price volatility risk
    if (volatilityAnalysis.currentVolatility > 0.15) { // 15% volatility threshold
      risks.push({
        type: 'High Price Volatility',
        severity: 'Medium',
        description: 'Market shows high price volatility which may affect forecast accuracy',
        impact: volatilityAnalysis.currentVolatility,
        mitigation: 'Consider shorter investment horizons and diversification'
      });
    }
    
    // Trend reversal risk
    if (priceForecast.trends.reversalProbability > 0.3) {
      risks.push({
        type: 'Trend Reversal',
        severity: 'High',
        description: 'Current trend shows signs of potential reversal',
        impact: priceForecast.trends.reversalProbability,
        mitigation: 'Monitor market conditions closely and prepare exit strategies'
      });
    }
    
    // Data quality risk
    const dataQuality = this.assessDataQuality(historicalData);
    if (dataQuality.score < 0.7) {
      risks.push({
        type: 'Limited Data Quality',
        severity: 'Medium',
        description: 'Forecast based on limited or lower quality historical data',
        impact: 1 - dataQuality.score,
        mitigation: 'Supplement with additional market research and validation'
      });
    }
    
    return risks;
  }

  /**
   * Generate human-readable forecast summary
   */
  generateForecastSummary(priceForecast, demandForecast, trendAnalysis, horizon) {
    const forecastMonths = this.forecastHorizons[horizon].months;
    const priceDirection = priceForecast.priceChange.percentage > 0 ? 'increase' : 'decrease';
    const demandDirection = demandForecast.demandChange.percentage > 0 ? 'strengthen' : 'weaken';
    
    let summary = `**${forecastMonths}-Month Market Forecast**\n\n`;
    
    // Price forecast
    summary += `📈 **Price Outlook**\n`;
    summary += `- Expected ${priceDirection} of ${Math.abs(priceForecast.priceChange.percentage).toFixed(1)}% over ${forecastMonths} months\n`;
    summary += `- Annualized rate: ${priceForecast.priceChange.annualized.toFixed(1)}%\n`;
    summary += `- Current trend: ${trendAnalysis.primaryTrend}\n\n`;
    
    // Demand forecast
    summary += `🎯 **Demand Outlook**\n`;
    summary += `- Market demand expected to ${demandDirection} by ${Math.abs(demandForecast.demandChange.percentage).toFixed(1)}%\n`;
    summary += `- Activity level: ${demandForecast.marketActivity.level}\n`;
    summary += `- Inventory trend: ${demandForecast.inventory.trend}\n\n`;
    
    // Key insights
    summary += `💡 **Key Insights**\n`;
    summary += `- Market phase: ${trendAnalysis.marketPhase}\n`;
    summary += `- Trend strength: ${(trendAnalysis.trendStrength * 100).toFixed(0)}%\n`;
    summary += `- Risk level: ${this.classifyOverallRisk(priceForecast, demandForecast)}\n`;
    
    return summary;
  }

  /**
   * Generate area key for caching and identification
   */
  generateAreaKey(propertyData) {
    return (propertyData.urbanization || propertyData.suburb || propertyData.city || 'unknown')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');
  }

  /**
   * Gather historical market data for analysis
   */
  async gatherHistoricalData(areaKey, months) {
    try {
      // This would query your property database for historical data
      // For now, simulate with realistic data structure
      
      const historicalData = [];
      const now = new Date();
      
      for (let i = months; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        
        // Simulate historical data point
        historicalData.push({
          date: date.toISOString(),
          avgPrice: 450000 + (Math.random() - 0.5) * 50000 + (i * 1000), // Trending upward
          medianPrice: 425000 + (Math.random() - 0.5) * 40000 + (i * 800),
          volume: 15 + Math.floor(Math.random() * 10),
          listings: 45 + Math.floor(Math.random() * 20),
          sales: 12 + Math.floor(Math.random() * 8),
          avgTimeOnMarket: 60 + Math.floor(Math.random() * 30),
          avgViewings: 8 + Math.floor(Math.random() * 5)
        });
      }
      
      return historicalData;
      
    } catch (error) {
      console.error('❌ Error gathering historical data:', error);
      return [];
    }
  }

  /**
   * Get fallback forecast when advanced prediction fails
   */
  getFallbackForecast(propertyData, horizon) {
    const forecastMonths = this.forecastHorizons[horizon].months;
    
    return {
      areaKey: this.generateAreaKey(propertyData),
      horizon: horizon,
      confidence: 0.3, // Low confidence for fallback
      generatedAt: new Date().toISOString(),
      
      summary: `**${forecastMonths}-Month Basic Forecast**\n\n` +
               '⚠️ **Limited Data Available**\n' +
               '- Forecast based on general market trends\n' +
               '- Consider gathering more local market data\n' +
               '- Consult with local property experts\n\n' +
               '📊 **General Market Outlook**\n' +
               '- Spanish property market shows moderate growth\n' +
               '- Costa del Sol remains attractive to international buyers\n' +
               '- Consider seasonal factors in investment timing',
      
      limitations: [
        'Insufficient historical data for accurate prediction',
        'Forecast based on general market trends only',
        'Higher uncertainty due to limited data points'
      ],
      
      dataQuality: { score: 0.2, issues: ['Limited historical data', 'Area-specific data unavailable'] }
    };
  }

  /**
   * Get current prediction metrics and performance
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.predictionCache.size,
      activePredictions: this.predictionCache.size,
      modelStatus: this.getModelStatus()
    };
  }

  /**
   * Get status of prediction models
   */
  getModelStatus() {
    return {
      priceForecasting: 'active',
      demandPrediction: 'active',
      trendAnalysis: 'active',
      seasonalityDetection: 'active',
      volatilityModeling: 'active'
    };
  }

  // Placeholder methods for machine learning models
  // In a real implementation, these would use libraries like TensorFlow.js, ML.js, etc.

  /**
   * Calculate demand index from market data
   */
  calculateDemandIndex(data) {
    if (!data || data.length === 0) return 0.5;
    
    const avgSalesRatio = data.reduce((sum, d) => sum + (d.sales / d.listings), 0) / data.length;
    const avgTimeOnMarket = data.reduce((sum, d) => sum + d.timeOnMarket, 0) / data.length;
    
    // Higher sales ratio and lower time on market = higher demand
    const demandIndex = Math.min(1, Math.max(0, avgSalesRatio * (120 / Math.max(avgTimeOnMarket, 30))));
    
    return demandIndex;
  }

  /**
   * Calculate volatility from price data
   */
  calculateVolatility(data) {
    if (!data || data.length < 2) return 0.1; // Default moderate volatility
    
    const returns = [];
    for (let i = 1; i < data.length; i++) {
      const returnValue = (data[i].avgPrice - data[i-1].avgPrice) / data[i-1].avgPrice;
      returns.push(returnValue);
    }
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance * 12); // Annualized volatility
  }

  /**
   * Assess data quality for predictions
   */
  assessDataQuality(data) {
    if (!data || data.length === 0) {
      return { score: 0, issues: ['No historical data available'] };
    }
    
    const issues = [];
    let score = 1.0;
    
    // Check data quantity
    if (data.length < 12) {
      issues.push('Limited historical data (less than 12 months)');
      score -= 0.3;
    }
    
    // Check data completeness
    const missingFields = data.filter(d => !d.avgPrice || !d.volume).length;
    if (missingFields > 0) {
      issues.push(`Missing data in ${missingFields} records`);
      score -= (missingFields / data.length) * 0.4;
    }
    
    // Check data consistency
    const priceVariations = data.map(d => d.avgPrice).filter(p => p > 0);
    const priceStdDev = this.calculateStandardDeviation(priceVariations);
    const priceMean = priceVariations.reduce((sum, p) => sum + p, 0) / priceVariations.length;
    
    if (priceStdDev / priceMean > 0.5) { // High coefficient of variation
      issues.push('High price volatility may affect prediction accuracy');
      score -= 0.2;
    }
    
    return {
      score: Math.max(0, Math.min(1, score)),
      issues: issues,
      dataPoints: data.length,
      completeness: 1 - (missingFields / data.length)
    };
  }

  /**
   * Calculate standard deviation
   */
  calculateStandardDeviation(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

     /**
    * Get methodology information
    */
   getMethodologyInfo(horizon) {
     return {
       approach: 'Multi-factor predictive modeling',
       models: ['Price forecasting', 'Demand prediction', 'Trend analysis', 'Seasonality detection'],
       dataRequirements: `Minimum ${this.mlConfig.minDataPoints} months of historical data`,
       updateFrequency: this.mlConfig.updateFrequency,
       confidence: `${(this.forecastHorizons[horizon].confidence * 100).toFixed(0)}% confidence level`,
       limitations: [
         'Predictions based on historical patterns',
         'External economic shocks may affect accuracy',
         'Local market factors may not be fully captured'
       ]
     };
   }

   // Additional helper methods for comprehensive forecasting

   /**
    * Generate basic forecast when insufficient data
    */
   generateBasicForecast(propertyData, comparablesData, horizon) {
     return this.getFallbackForecast(propertyData, horizon);
   }

   /**
    * Placeholder methods for advanced analysis
    */
   identifyPriceTrends(predictions) {
     return {
       direction: predictions.length > 0 && predictions[predictions.length - 1].value > predictions[0].value ? 'upward' : 'downward',
       reversalProbability: 0.3,
       momentum: 'moderate'
     };
   }

   calculatePriceMomentum(priceData) {
     return { strength: 0.6, direction: 'positive' };
   }

   findSupportLevels(priceData) {
     const prices = priceData.map(d => d.avgPrice);
     return Math.min(...prices) * 0.95;
   }

   findResistanceLevels(priceData) {
     const prices = priceData.map(d => d.avgPrice);
     return Math.max(...prices) * 1.05;
   }

   getBasicPricePrediction(historicalData, horizon) {
     return {
       currentPrice: 450000,
       forecastPrice: 465000,
       priceChange: { percentage: 3.3, annualized: 6.6 },
       confidence: 0.4,
       trends: { direction: 'upward', reversalProbability: 0.3 }
     };
   }

   classifyDemandTrend(predictions) {
     return 'strengthening';
   }

   analyzeMarketActivity(demandData) {
     return { level: 'moderate', trend: 'stable' };
   }

   analyzeBuyerBehavior(demandData) {
     return { segment: 'international', confidence: 'medium' };
   }

   predictInventoryLevels(demandData, horizon) {
     return { trend: 'stable', forecast: 'balanced' };
   }

   getBasicDemandPrediction(historicalData, horizon) {
     return {
       currentDemand: 0.6,
       forecastDemand: 0.65,
       demandChange: { percentage: 8.3 },
       confidence: 0.5,
       marketActivity: { level: 'moderate' },
       inventory: { trend: 'stable' }
     };
   }

   identifyCyclicalPatterns(historicalData) {
     return { detected: false, cycle: 'annual' };
   }

   identifyMarketPhase(historicalData) {
     return 'expansion';
   }

   getBasicTrendAnalysis(historicalData) {
     return {
       primaryTrend: 'bullish',
       trendStrength: 0.7,
       marketPhase: 'expansion',
       reversalProbability: 0.2
     };
   }

   calculateYearOverYearTrends(historicalData) {
     return { growth: 5.2, pattern: 'steady' };
   }

   analyzeHolidayEffects(historicalData) {
     return { summer: 'decreased activity', winter: 'increased activity' };
   }

   getBasicSeasonalityAnalysis(historicalData) {
     return {
       hasSeasonality: true,
       seasonalStrength: 0.4,
       bestMonths: ['March', 'April', 'May'],
       worstMonths: ['August', 'December']
     };
   }

   classifyVolatilityTrend(timeSeries) {
     return 'stable';
   }

   classifyRiskLevel(current, forecast) {
     if (current > 0.2 || forecast > 0.2) return 'High';
     if (current > 0.1 || forecast > 0.1) return 'Medium';
     return 'Low';
   }

   identifyVolatilityDrivers(historicalData) {
     return ['Market uncertainty', 'Economic factors', 'Seasonal patterns'];
   }

   calculateStabilityScore(historicalData) {
     return 0.75; // 75% stability
   }

   calculateRiskAdjustedReturns(historicalData) {
     return { ratio: 1.2, assessment: 'favorable' };
   }

   getBasicVolatilityAnalysis(historicalData) {
     return {
       currentVolatility: 0.12,
       forecastVolatility: 0.10,
       riskLevel: 'Medium',
       stabilityScore: 0.75
     };
   }

   analyzePriceTiming(historicalData) {
     return { score: 70, signal: 'buy', confidence: 'medium' };
   }

   analyzeMarketTiming(historicalData) {
     return { score: 65, phase: 'favorable', confidence: 'high' };
   }

   analyzeSeasonalTiming(historicalData) {
     return { score: 80, period: 'optimal', confidence: 'high' };
   }

   analyzeEconomicTiming() {
     return { score: 60, outlook: 'stable', confidence: 'medium' };
   }

   calculateTimingScore(price, market, seasonal, economic) {
     return Math.round((price.score + market.score + seasonal.score + economic.score) / 4);
   }

   generateTimingRecommendations(timingScore, priceTiming, marketTiming) {
     return {
       primary: timingScore > 70 ? 'Strong Buy Signal' : timingScore > 50 ? 'Moderate Buy' : 'Hold/Wait',
       alternatives: ['Consider phased investment', 'Monitor market conditions'],
       timeHorizon: '3-6 months',
       risks: ['Market volatility', 'Economic uncertainty'],
       opportunities: ['Favorable pricing', 'Strong demand outlook']
     };
   }

   generateActionPlan(timingScore, recommendations) {
     return {
       immediate: timingScore > 70 ? 'Initiate investment process' : 'Continue market monitoring',
       shortTerm: 'Review market conditions monthly',
       mediumTerm: 'Reassess investment strategy quarterly'
     };
   }

   getBasicTimingRecommendation() {
     return {
       timingScore: 60,
       recommendation: 'Moderate investment timing',
       timeHorizon: '6 months',
       actionPlan: { immediate: 'Monitor market conditions' }
     };
   }

   classifyOverallRisk(priceForecast, demandForecast) {
     const priceRisk = Math.abs(priceForecast.priceChange?.percentage || 0) > 10 ? 'High' : 'Medium';
     const demandRisk = Math.abs(demandForecast.demandChange?.percentage || 0) > 20 ? 'High' : 'Medium';
     
     if (priceRisk === 'High' || demandRisk === 'High') return 'High';
     return 'Medium';
   }
}

// Machine Learning Model Classes (simplified implementations)
// In production, these would use proper ML libraries

class PriceForecasting {
  predict(data, horizon) {
    // Simplified linear trend with noise
    const prices = data.map(d => d.avgPrice);
    const trend = this.calculateTrend(prices);
    const forecastPeriods = this.getHorizonMonths(horizon);
    
    const predictions = [];
    let lastPrice = prices[prices.length - 1];
    
    for (let i = 1; i <= forecastPeriods; i++) {
      lastPrice += trend + (Math.random() - 0.5) * trend * 0.5; // Add some noise
      predictions.push({
        month: i,
        value: Math.max(0, lastPrice),
        confidence: Math.max(0.3, 0.9 - (i * 0.05)) // Decreasing confidence over time
      });
    }
    
    return {
      predictions: predictions,
      confidence: predictions[predictions.length - 1].confidence
    };
  }
  
  calculateTrend(prices) {
    if (prices.length < 2) return 0;
    
    // Simple linear regression slope
    const n = prices.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = prices.reduce((sum, price) => sum + price, 0);
    const sumXY = prices.reduce((sum, price, index) => sum + (price * index), 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }
  
  getHorizonMonths(horizon) {
    const horizons = { short: 3, medium: 6, long: 12, extended: 24 };
    return horizons[horizon] || 6;
  }
}

class DemandPrediction {
  predict(data, horizon) {
    // Simplified demand forecasting based on sales ratio trends
    const demandIndices = data.map(d => d.sales / Math.max(d.listings, 1));
    const trend = this.calculateDemandTrend(demandIndices);
    const forecastPeriods = this.getHorizonMonths(horizon);
    
    const predictions = [];
    let lastDemand = demandIndices[demandIndices.length - 1];
    
    for (let i = 1; i <= forecastPeriods; i++) {
      lastDemand += trend * 0.1; // Moderate trend application
      predictions.push({
        month: i,
        demandIndex: Math.max(0, Math.min(1, lastDemand)),
        sales: Math.round(lastDemand * 50), // Estimated sales
        listings: Math.round(50 + Math.random() * 20) // Estimated listings
      });
    }
    
    return {
      predictions: predictions,
      confidence: 0.7
    };
  }
  
  calculateDemandTrend(indices) {
    if (indices.length < 2) return 0;
    return (indices[indices.length - 1] - indices[0]) / indices.length;
  }
  
  getHorizonMonths(horizon) {
    const horizons = { short: 3, medium: 6, long: 12, extended: 24 };
    return horizons[horizon] || 6;
  }
}

class TrendAnalysis {
  analyze(data, horizon) {
    const prices = data.map(d => d.avgPrice);
    const recentTrend = this.calculateRecentTrend(prices);
    const trendStrength = this.calculateTrendStrength(prices);
    
    return {
      primary: recentTrend > 0.02 ? 'bullish' : recentTrend < -0.02 ? 'bearish' : 'sideways',
      secondary: ['Moderate volatility', 'Seasonal patterns detected'],
      strength: trendStrength,
      duration: Math.min(12, data.length),
      reversalProbability: this.calculateReversalProbability(prices),
      breakoutLevels: this.findBreakoutLevels(prices)
    };
  }
  
  calculateRecentTrend(prices) {
    if (prices.length < 3) return 0;
    const recent = prices.slice(-3);
    return (recent[recent.length - 1] - recent[0]) / recent[0];
  }
  
  calculateTrendStrength(prices) {
    if (prices.length < 2) return 0.5;
    
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length;
    const consistency = changes.filter(c => Math.sign(c) === Math.sign(avgChange)).length / changes.length;
    
    return Math.min(1, consistency);
  }
  
  calculateReversalProbability(prices) {
    // Simple momentum-based reversal probability
    const momentum = this.calculateRecentTrend(prices);
    return Math.min(0.8, Math.abs(momentum) * 2); // Higher momentum = higher reversal risk
  }
  
  findBreakoutLevels(prices) {
    const max = Math.max(...prices);
    const min = Math.min(...prices);
    
    return {
      resistance: max * 1.05,
      support: min * 0.95
    };
  }
}

class SeasonalityDetection {
  analyze(data) {
    // Simplified seasonality detection
    const monthlyData = this.groupByMonth(data);
    const hasSeasonality = this.detectSeasonalPattern(monthlyData);
    
    return {
      detected: hasSeasonality,
      strength: hasSeasonality ? 0.6 : 0.1,
      bestMonths: ['March', 'April', 'May', 'September', 'October'],
      worstMonths: ['December', 'January', 'August'],
      factors: this.calculateSeasonalFactors(monthlyData)
    };
  }
  
  groupByMonth(data) {
    const monthly = {};
    data.forEach(d => {
      const month = new Date(d.date).getMonth();
      if (!monthly[month]) monthly[month] = [];
      monthly[month].push(d);
    });
    return monthly;
  }
  
  detectSeasonalPattern(monthlyData) {
    // Simple heuristic: if we have data for multiple months and variance is significant
    const monthKeys = Object.keys(monthlyData);
    return monthKeys.length >= 6; // At least 6 months of data
  }
  
  calculateSeasonalFactors(monthlyData) {
    const factors = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    monthNames.forEach((name, index) => {
      factors[name] = monthlyData[index] ? 1.0 + (Math.random() - 0.5) * 0.3 : 1.0;
    });
    
    return factors;
  }
}

class VolatilityModeling {
  analyze(data, horizon) {
    const prices = data.map(d => d.avgPrice);
    const volatility = this.calculateHistoricalVolatility(prices);
    
    return {
      forecast: volatility * (1 + Math.random() * 0.2 - 0.1), // Slight random variation
      timeSeries: this.generateVolatilityTimeSeries(prices),
      drivers: ['Market uncertainty', 'Economic factors', 'Seasonal effects']
    };
  }
  
  calculateHistoricalVolatility(prices) {
    if (prices.length < 2) return 0.1;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance * 12); // Annualized
  }
  
  generateVolatilityTimeSeries(prices) {
    return prices.map((price, index) => ({
      period: index,
      volatility: 0.1 + Math.random() * 0.1 // Simulated volatility between 10-20%
    }));
  }
}

module.exports = PredictiveAnalyticsService; 