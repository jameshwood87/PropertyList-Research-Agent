/**
 * Auto-Optimization Service - Phase 3 Final Enhancement
 * 
 * Implements self-tuning algorithms for:
 * 1. System/AI decision thresholds optimization
 * 2. Model selection and token limit tuning
 * 3. Cache TTL optimization
 * 4. Quality threshold adjustments
 * 5. Cost vs. quality balance optimization
 * 6. A/B testing for threshold variants
 * 7. Performance-based parameter tuning
 */

class AutoOptimizationService {
  constructor(propertyDatabase, monitoringService, systemAIDecisionService) {
    this.propertyDb = propertyDatabase;
    this.monitoringService = monitoringService;
    this.systemAIDecisionService = systemAIDecisionService;
    
    // Initialize Context Awareness Service (Phase 1 Enhancement)
    const ContextAwarenessService = require('./contextAwarenessService');
    this.contextService = new ContextAwarenessService(propertyDatabase, monitoringService);
    
    // Initialize Local ML Service (Phase 2 Enhancement)
    const LocalMLService = require('./localMLService');
    this.mlService = new LocalMLService(propertyDatabase);
    
    // Initialize Advanced Analytics Service (Phase 3 Enhancement)
    const AdvancedAnalyticsService = require('./advancedAnalyticsService');
    this.analyticsService = new AdvancedAnalyticsService(propertyDatabase);
    
    // Current optimization parameters
    this.currentThresholds = {
      marketData: { nComparables: 20, nAnalyses: 5, qualityScore: 0.7 },
      valuation: { nComparables: 12, nAnalyses: 3, qualityScore: 0.6 },
      amenities: { nComparables: 8, nAnalyses: 3, qualityScore: 0.5 },
      mobility: { nComparables: 6, nAnalyses: 2, qualityScore: 0.5 },
      locationAdvantages: { nComparables: 10, nAnalyses: 4, qualityScore: 0.6 },
      investmentPotential: { nComparables: 15, nAnalyses: 5, qualityScore: 0.7 },
      marketOutlook: { nComparables: 18, nAnalyses: 6, qualityScore: 0.7 },
      marketForecasting: { nComparables: 25, nAnalyses: 8, qualityScore: 0.8 }
    };
    
    // Optimization targets and weights
    this.optimizationTargets = {
      costReduction: 0.3,        // Weight for cost optimization
      qualityMaintenance: 0.4,   // Weight for quality preservation
      speedImprovement: 0.2,     // Weight for response time
      userSatisfaction: 0.1      // Weight for user satisfaction metrics
    };
    
    // Performance tracking
    this.performanceHistory = {
      thresholdChanges: [],
      costSavings: [],
      qualityMetrics: [],
      responseTimeChanges: [],
      abTestResults: []
    };
    
    // Auto-tuning configuration
    this.autoTuningConfig = {
      enabled: true,
      analysisWindow: 7 * 24 * 60 * 60 * 1000, // 7 days
      minSampleSize: 50,         // Minimum analyses before tuning
      maxThresholdChange: 0.2,   // Maximum 20% change per iteration
      tuningInterval: 24 * 60 * 60 * 1000, // Daily tuning
      confidenceThreshold: 0.95,  // 95% confidence for changes
      rollbackThreshold: 0.1      // Rollback if performance drops 10%
    };
    
    // A/B testing for threshold optimization
    this.abTestVariants = new Map();
    this.abTestResults = new Map();
    
    // Optimization algorithms
    this.algorithms = {
      bayesianOptimization: new BayesianOptimizer(),
      geneticAlgorithm: new GeneticOptimizer(),
      gradientDescent: new GradientDescentOptimizer(),
      reinforcementLearning: new RLOptimizer()
    };
    
    // Learning parameters
    this.learningRate = 0.01;
    this.momentum = 0.9;
    this.adaptiveThresholds = true;
    
    // Metrics for optimization
    this.metrics = {
      totalOptimizations: 0,
      successfulOptimizations: 0,
      averageCostReduction: 0,
      averageQualityMaintained: 0,
      lastOptimization: null,
      optimizationHistory: []
    };
    
    // Start optimization scheduler
    this.startOptimizationScheduler();
  }

  /**
   * Start the automatic optimization scheduler
   */
  startOptimizationScheduler() {
    if (!this.autoTuningConfig.enabled) return;
    
    console.log('🔧 Starting auto-optimization scheduler...');
    
    setInterval(async () => {
      try {
        await this.runOptimizationCycle();
      } catch (error) {
        console.error('❌ Auto-optimization cycle error:', error);
      }
    }, this.autoTuningConfig.tuningInterval);
    
    // Initial optimization after 5 minutes
    setTimeout(() => {
      this.runOptimizationCycle().catch(console.error);
    }, 5 * 60 * 1000);
  }

  /**
   * Run a complete optimization cycle
   */
  async runOptimizationCycle() {
    console.log('🔧 Running auto-optimization cycle...');
    
    try {
      // Step 1: Collect performance data
      const performanceData = await this.collectPerformanceData();
      
      // Step 2: Analyze current thresholds effectiveness
      const thresholdAnalysis = await this.analyzeThresholdEffectiveness(performanceData);
      
      // Step 3: Generate optimization recommendations
      const recommendations = await this.generateOptimizationRecommendations(thresholdAnalysis);
      
      // Step 4: A/B test promising changes
      if (recommendations.length > 0) {
        await this.createABTestsForRecommendations(recommendations);
      }
      
      // Step 5: Apply validated optimizations
      const appliedOptimizations = await this.applyValidatedOptimizations();
      
      // Step 6: Update learning models
      await this.updateLearningModels(performanceData, appliedOptimizations);
      
      // Step 7: Record optimization results
      await this.recordOptimizationResults(appliedOptimizations);
      
      console.log(`✅ Optimization cycle complete. Applied ${appliedOptimizations.length} optimizations.`);
      
    } catch (error) {
      console.error('❌ Optimization cycle failed:', error);
      await this.handleOptimizationFailure(error);
    }
  }

  /**
   * Collect performance data for optimization analysis
   */
  async collectPerformanceData() {
    const endTime = Date.now();
    const startTime = endTime - this.autoTuningConfig.analysisWindow;
    
    // Get monitoring data
    const monitoringData = await this.monitoringService.getMetricsInRange(startTime, endTime);
    
    // Get section-wise performance
    const sectionPerformance = await this.analyzeSectionPerformance(startTime, endTime);
    
    // Get cost data
    const costData = await this.analyzeCostMetrics(startTime, endTime);
    
    // Get quality metrics
    const qualityData = await this.analyzeQualityMetrics(startTime, endTime);
    
    return {
      monitoring: monitoringData,
      sections: sectionPerformance,
      costs: costData,
      quality: qualityData,
      timeRange: { startTime, endTime },
      sampleSize: monitoringData.totalAnalyses
    };
  }

  /**
   * Analyze threshold effectiveness across all sections
   */
  async analyzeThresholdEffectiveness(performanceData) {
    console.log('🔍 Analyzing threshold effectiveness...');
    
    const analysis = {
      sections: {},
      overall: {
        totalCostSavings: 0,
        qualityMaintained: 0,
        speedImprovement: 0,
        confidence: 0
      }
    };
    
    // Analyze each section's performance
    for (const [sectionName, sectionData] of Object.entries(performanceData.sections)) {
      if (sectionData.error) {
        analysis.sections[sectionName] = { error: sectionData.error };
        continue;
      }
      
      const effectiveness = await this.calculateThresholdEffectiveness(
        sectionName, 
        sectionData.performance,
        sectionData.thresholds
      );
      
      analysis.sections[sectionName] = {
        thresholds: sectionData.thresholds,
        effectiveness: effectiveness,
        recommendations: this.generateThresholdRecommendations(effectiveness)
      };
    }
    
    // Calculate overall metrics
    analysis.overall = this.calculateOverallEffectiveness(analysis.sections);
    
    return analysis;
  }

  /**
   * Calculate threshold effectiveness for a specific section
   */
  async calculateThresholdEffectiveness(sectionName, performanceData, currentThresholds) {
    const systemData = performanceData.find(p => p.approach_used === 'system');
    const aiData = performanceData.find(p => p.approach_used === 'ai');
    
    if (!systemData || !aiData) {
      return {
        effectiveness: 0,
        reason: 'insufficient_data',
        sampleSize: performanceData.reduce((sum, p) => sum + parseInt(p.sample_count), 0)
      };
    }
    
    // Calculate effectiveness metrics
    const costEfficiency = this.calculateCostEfficiency(systemData, aiData);
    const qualityRatio = parseFloat(systemData.avg_confidence) / parseFloat(aiData.avg_confidence);
    const speedRatio = parseFloat(aiData.avg_response_time) / parseFloat(systemData.avg_response_time);
    const satisfactionRatio = parseFloat(systemData.avg_satisfaction) / parseFloat(aiData.avg_satisfaction);
    
    // Calculate weighted effectiveness score
    const effectiveness = (
      costEfficiency * this.optimizationTargets.costReduction +
      qualityRatio * this.optimizationTargets.qualityMaintenance +
      (1 / speedRatio) * this.optimizationTargets.speedImprovement +
      satisfactionRatio * this.optimizationTargets.userSatisfaction
    );
    
    return {
      effectiveness: effectiveness,
      costEfficiency: costEfficiency,
      qualityRatio: qualityRatio,
      speedRatio: speedRatio,
      satisfactionRatio: satisfactionRatio,
      sampleSize: parseInt(systemData.sample_count) + parseInt(aiData.sample_count),
      thresholds: currentThresholds,
      confidence: this.calculateConfidence(systemData, aiData)
    };
  }

  /**
   * Generate threshold recommendations based on effectiveness
   * Enhanced with Phase 1 Context-Aware Smart Heuristics
   */
  generateThresholdRecommendations(effectiveness) {
    const recommendations = [];
    
    // Generate base recommendations based on effectiveness
    this.generateBaseRecommendations(effectiveness, recommendations);
    
    // Apply Phase 1 Enhancement: Context-Aware Smart Heuristics
    const contextualOptimization = this.contextService.generateContextualOptimizations(this.optimizationTargets);
    
    // Apply contextual adjustments to recommendations
    this.applyContextualAdjustments(recommendations, contextualOptimization);
    
    // Apply Phase 2 Enhancement: ML-based predictions and recommendations
    const mlRecommendations = this.mlService.getMLRecommendations();
    recommendations.push(...mlRecommendations);
    
    // Apply Phase 3 Enhancement: Advanced analytics insights and recommendations
    const seasonalRecommendations = this.analyticsService.getSeasonalRecommendations();
    recommendations.push(...seasonalRecommendations);
    
    // Apply confidence threshold adjustments
    const confidenceAdjustments = this.contextService.getConfidenceThresholdAdjustments();
    
    return {
      recommendations: recommendations,
      confidence: effectiveness.confidence,
      effectiveness: effectiveness.effectiveness,
      contextualOptimization: {
        appliedHeuristics: contextualOptimization.appliedHeuristics,
        optimizationTargets: contextualOptimization.optimizationTargets,
        confidenceAdjustments: confidenceAdjustments
      },
      mlPredictions: {
        usageForecast: this.mlService.predictUsage(1),
        performanceForecast: this.mlService.predictPerformance(this.currentThresholds.marketData),
        errorProbability: this.mlService.predictErrorProbability('system', 1500, 0.7),
        mlRecommendations: mlRecommendations,
        mlStatus: this.mlService.getMLStatus()
      },
      advancedAnalytics: {
        trendForecasts: this.analyticsService.getTrendForecasts(24),
        correlationInsights: this.analyticsService.getCorrelationInsights(),
        seasonalRecommendations: seasonalRecommendations,
        analyticsReport: this.analyticsService.getAnalyticsReport(),
        analyticsStatus: this.analyticsService.getStatus()
      }
    };
  }

  /**
   * Generate base recommendations without context (Phase 1 Enhancement Helper)
   */
  generateBaseRecommendations(effectiveness, recommendations) {
    if (effectiveness.effectiveness < 0.6) {
      // Poor effectiveness - need significant changes
      if (effectiveness.qualityRatio < 0.7) {
        recommendations.push({
          type: 'raise_threshold',
          priority: 'high',
          reason: 'Quality significantly below acceptable levels',
          expectedImprovement: { quality: +30, cost: +25, speed: -15 }
        });
      } else if (effectiveness.costEfficiency < 0.4) {
        recommendations.push({
          type: 'lower_threshold',
          priority: 'medium',
          reason: 'Cost efficiency poor, system approach underutilized',
          expectedImprovement: { quality: -10, cost: -40, speed: +20 }
        });
      }
    } else if (effectiveness.effectiveness > 0.85) {
      // High effectiveness - fine-tune for optimization
      if (effectiveness.speedRatio > 2.0) {
        recommendations.push({
          type: 'optimize_system',
          priority: 'low',
          reason: 'System approach much slower but quality good',
          expectedImprovement: { quality: +5, cost: -5, speed: +25 }
        });
      }
    }
  }

  /**
   * Apply contextual adjustments to recommendations (Phase 1 Enhancement)
   */
  applyContextualAdjustments(recommendations, contextualOptimization) {
    const appliedHeuristics = contextualOptimization.appliedHeuristics;
    const targets = contextualOptimization.optimizationTargets;
    
    // Time-based adjustments
    if (appliedHeuristics.includes('weekend_speed_boost')) {
      recommendations.push({
        type: 'speed_optimization',
        priority: 'medium',
        reason: 'Weekend traffic detected - prioritising speed',
        context: 'weekend_speed_boost',
        expectedImprovement: { quality: -5, cost: 0, speed: +30 }
      });
    }
    
    if (appliedHeuristics.includes('peak_hour_quality')) {
      recommendations.push({
        type: 'quality_boost',
        priority: 'high',
        reason: 'Peak hours detected - prioritising quality',
        context: 'peak_hour_quality',
        expectedImprovement: { quality: +25, cost: +15, speed: -10 }
      });
    }
    
    if (appliedHeuristics.includes('late_night_cost_saving')) {
      recommendations.push({
        type: 'cost_optimization',
        priority: 'medium',
        reason: 'Late night period - aggressive cost saving',
        context: 'late_night_cost_saving',
        expectedImprovement: { quality: -10, cost: -35, speed: +15 }
      });
    }
    
    if (appliedHeuristics.includes('month_end_budget_control')) {
      recommendations.push({
        type: 'budget_control',
        priority: 'high',
        reason: 'Month-end budget control - minimising costs',
        context: 'month_end_budget_control',
        expectedImprovement: { quality: -15, cost: -40, speed: +20 }
      });
    }
    
    // Load-based adjustments
    if (appliedHeuristics.includes('high_load_speed_priority')) {
      recommendations.push({
        type: 'load_optimization',
        priority: 'high',
        reason: 'High system load detected - prioritising speed',
        context: 'high_load_speed_priority',
        expectedImprovement: { quality: -10, cost: +5, speed: +35 }
      });
    }
    
    if (appliedHeuristics.includes('low_load_quality_boost')) {
      recommendations.push({
        type: 'quality_enhancement',
        priority: 'low',
        reason: 'Low system load - opportunity for quality boost',
        context: 'low_load_quality_boost',
        expectedImprovement: { quality: +20, cost: +10, speed: -5 }
      });
    }
    
    if (appliedHeuristics.includes('database_stress_reduction')) {
      recommendations.push({
        type: 'database_optimization',
        priority: 'high',
        reason: 'Database stress detected - reducing load',
        context: 'database_stress_reduction',
        expectedImprovement: { quality: -5, cost: -10, speed: +25 }
      });
    }
    
    // Error-based adjustments
    if (appliedHeuristics.includes('high_error_conservative')) {
      recommendations.push({
        type: 'conservative_approach',
        priority: 'critical',
        reason: 'High error rate - applying conservative thresholds',
        context: 'high_error_conservative',
        expectedImprovement: { quality: +20, cost: +20, speed: -10 }
      });
    }
    
    if (appliedHeuristics.includes('recent_failures_caution')) {
      recommendations.push({
        type: 'failure_mitigation',
        priority: 'high',
        reason: 'Recent failures detected - increasing caution',
        context: 'recent_failures_caution',
        expectedImprovement: { quality: +15, cost: +15, speed: -5 }
      });
    }
    
    // User behavior adjustments
    if (appliedHeuristics.includes('high_volume_efficiency')) {
      recommendations.push({
        type: 'volume_optimization',
        priority: 'medium',
        reason: 'High traffic volume - optimising for efficiency',
        context: 'high_volume_efficiency',
        expectedImprovement: { quality: -5, cost: -15, speed: +25 }
      });
    }
    
    if (appliedHeuristics.includes('low_volume_quality_focus')) {
      recommendations.push({
        type: 'quality_maximization',
        priority: 'low',
        reason: 'Low traffic volume - maximising quality',
        context: 'low_volume_quality_focus',
        expectedImprovement: { quality: +30, cost: +20, speed: -10 }
      });
    }
    
    // Business context adjustments
    if (appliedHeuristics.includes('budget_burn_control')) {
      recommendations.push({
        type: 'budget_management',
        priority: 'critical',
        reason: 'Budget burn rate exceeds target - emergency cost control',
        context: 'budget_burn_control',
        expectedImprovement: { quality: -20, cost: -50, speed: +15 }
      });
    }
    
    if (appliedHeuristics.includes('cost_trend_management')) {
      recommendations.push({
        type: 'trend_correction',
        priority: 'high',
        reason: 'Increasing cost trend detected - corrective action',
        context: 'cost_trend_management',
        expectedImprovement: { quality: -10, cost: -30, speed: +10 }
      });
    }
    
    console.log(`🧠 Applied ${appliedHeuristics.length} contextual heuristics:`, appliedHeuristics);
  }

  /**
   * Calculate cost efficiency between system and AI approaches
   */
  calculateCostEfficiency(systemData, aiData) {
    const systemCost = parseFloat(systemData.avg_cost);
    const aiCost = parseFloat(aiData.avg_cost);
    const systemQuality = parseFloat(systemData.avg_confidence);
    const aiQuality = parseFloat(aiData.avg_confidence);
    
    // Cost efficiency = (quality_ratio) / (cost_ratio)
    const costRatio = systemCost / aiCost;
    const qualityRatio = systemQuality / aiQuality;
    
    return qualityRatio / costRatio;
  }

  /**
   * Calculate overall effectiveness across all sections
   */
  calculateOverallEffectiveness(sections) {
    const validSections = Object.values(sections).filter(s => !s.error && s.effectiveness);
    
    if (validSections.length === 0) {
      return { totalCostSavings: 0, qualityMaintained: 0, speedImprovement: 0, confidence: 0 };
    }
    
    const avgEffectiveness = validSections.reduce((sum, s) => sum + s.effectiveness.effectiveness, 0) / validSections.length;
    const avgCostEfficiency = validSections.reduce((sum, s) => sum + s.effectiveness.costEfficiency, 0) / validSections.length;
    const avgQuality = validSections.reduce((sum, s) => sum + s.effectiveness.qualityRatio, 0) / validSections.length;
    const avgSpeed = validSections.reduce((sum, s) => sum + (1 / s.effectiveness.speedRatio), 0) / validSections.length;
    const avgConfidence = validSections.reduce((sum, s) => sum + s.effectiveness.confidence, 0) / validSections.length;
    
    return {
      totalCostSavings: (1 - avgCostEfficiency) * 100,
      qualityMaintained: avgQuality * 100,
      speedImprovement: avgSpeed * 100,
      confidence: avgConfidence,
      overallEffectiveness: avgEffectiveness
    };
  }

  /**
   * Calculate confidence in threshold effectiveness analysis
   */
  calculateConfidence(systemData, aiData) {
    const sampleSize = parseInt(systemData.sample_count) + parseInt(aiData.sample_count);
    const minSampleSize = this.autoTuningConfig.minSampleSize;
    
    if (sampleSize < minSampleSize) {
      return 0.1;
    }
    
    // Base confidence on sample size and performance stability
    const sampleConfidence = Math.min(sampleSize / (minSampleSize * 2), 1.0);
    const performanceVariability = this.calculatePerformanceVariability(systemData, aiData);
    
    return sampleConfidence * (1 - performanceVariability);
  }

  /**
   * Calculate performance variability (lower is better)
   */
  calculatePerformanceVariability(systemData, aiData) {
    // Simple variability calculation based on satisfaction and confidence
    const systemSatisfaction = parseFloat(systemData.avg_satisfaction) || 0;
    const aiSatisfaction = parseFloat(aiData.avg_satisfaction) || 0;
    const systemConfidence = parseFloat(systemData.avg_confidence) || 0;
    const aiConfidence = parseFloat(aiData.avg_confidence) || 0;
    
    const satisfactionVariability = Math.abs(systemSatisfaction - aiSatisfaction) / 5; // Scale to 0-1
    const confidenceVariability = Math.abs(systemConfidence - aiConfidence) / 100; // Scale to 0-1
    
    return (satisfactionVariability + confidenceVariability) / 2;
  }

  /**
   * Analyze section-wise performance
   */
  async analyzeSectionPerformance(startTime, endTime) {
    const sectionPerformance = {};
    
    for (const [sectionName, thresholds] of Object.entries(this.currentThresholds)) {
      try {
        // Query database for section performance
        const query = `
          SELECT 
            approach_used,
            AVG(response_time_ms) as avg_response_time,
            AVG(cost_usd) as avg_cost,
            AVG(confidence_score) as avg_confidence,
            COUNT(*) as sample_count,
            AVG(user_satisfaction) as avg_satisfaction
          FROM analysis_sections 
          WHERE section_name = $1 
            AND created_at >= $2 
            AND created_at <= $3
          GROUP BY approach_used
        `;
        
        const result = await this.propertyDb.pool.query(query, [
          sectionName,
          new Date(startTime),
          new Date(endTime)
        ]);
        
        sectionPerformance[sectionName] = {
          thresholds: thresholds,
          performance: result.rows,
          recommendations: this.analyzeSystemVsAIPerformance(result.rows)
        };
        
      } catch (error) {
        console.error(`❌ Error analyzing ${sectionName} performance:`, error);
        sectionPerformance[sectionName] = { error: error.message };
      }
    }
    
    return sectionPerformance;
  }

  /**
   * Analyze System vs AI performance for a section
   */
  analyzeSystemVsAIPerformance(performanceData) {
    const systemData = performanceData.find(p => p.approach_used === 'system');
    const aiData = performanceData.find(p => p.approach_used === 'ai');
    
    if (!systemData || !aiData) {
      return { recommendation: 'insufficient_data' };
    }
    
    // Calculate performance ratios
    const costRatio = parseFloat(systemData.avg_cost) / parseFloat(aiData.avg_cost);
    const qualityRatio = parseFloat(systemData.avg_confidence) / parseFloat(aiData.avg_confidence);
    const speedRatio = parseFloat(aiData.avg_response_time) / parseFloat(systemData.avg_response_time);
    
    // Generate recommendations
    const recommendations = [];
    
    if (costRatio < 0.5 && qualityRatio > 0.85) {
      recommendations.push({
        type: 'lower_threshold',
        reason: 'System approach provides significant cost savings with minimal quality loss',
        impact: { cost: -30, quality: -5, speed: +15 }
      });
    }
    
    if (qualityRatio < 0.7) {
      recommendations.push({
        type: 'raise_threshold',
        reason: 'System approach quality significantly below AI',
        impact: { cost: +20, quality: +25, speed: -10 }
      });
    }
    
    if (speedRatio > 2.0 && qualityRatio > 0.9) {
      recommendations.push({
        type: 'optimize_system',
        reason: 'System approach much slower but quality is good',
        impact: { cost: 0, quality: 0, speed: +30 }
      });
    }
    
    return {
      ratios: { cost: costRatio, quality: qualityRatio, speed: speedRatio },
      recommendations,
      confidence: this.calculateRecommendationConfidence(systemData, aiData)
    };
  }

  /**
   * Generate optimization recommendations based on analysis
   */
  async generateOptimizationRecommendations(thresholdAnalysis) {
    const recommendations = [];
    
    for (const [sectionName, analysis] of Object.entries(thresholdAnalysis.sections)) {
      if (analysis.error || !analysis.recommendations?.recommendations) continue;
      
      const sectionRecommendations = analysis.recommendations.recommendations;
      const confidence = analysis.recommendations.confidence;
      
      if (confidence < this.autoTuningConfig.confidenceThreshold) continue;
      
      for (const rec of sectionRecommendations) {
        recommendations.push({
          section: sectionName,
          type: rec.type,
          reason: rec.reason,
          impact: rec.impact,
          confidence: confidence,
          currentThresholds: analysis.thresholds,
          suggestedThresholds: this.calculateNewThresholds(analysis.thresholds, rec)
        });
      }
    }
    
    // Prioritize recommendations by impact and confidence
    return recommendations.sort((a, b) => {
      const scoreA = this.calculateRecommendationScore(a);
      const scoreB = this.calculateRecommendationScore(b);
      return scoreB - scoreA;
    });
  }

  /**
   * Calculate new thresholds based on recommendations
   */
  calculateNewThresholds(currentThresholds, recommendation) {
    const newThresholds = { ...currentThresholds };
    const maxChange = this.autoTuningConfig.maxThresholdChange;
    
    switch (recommendation.type) {
      case 'lower_threshold':
        newThresholds.nComparables = Math.max(
          Math.floor(currentThresholds.nComparables * (1 - maxChange)),
          5 // Minimum threshold
        );
        newThresholds.qualityScore = Math.max(
          currentThresholds.qualityScore - (maxChange * 0.5),
          0.3 // Minimum quality score
        );
        break;
        
      case 'raise_threshold':
        newThresholds.nComparables = Math.floor(
          currentThresholds.nComparables * (1 + maxChange)
        );
        newThresholds.qualityScore = Math.min(
          currentThresholds.qualityScore + (maxChange * 0.5),
          1.0 // Maximum quality score
        );
        break;
        
      case 'optimize_system':
        // Focus on nAnalyses threshold for system optimization
        newThresholds.nAnalyses = Math.max(
          Math.floor(currentThresholds.nAnalyses * (1 - maxChange)),
          1 // Minimum analyses
        );
        break;
    }
    
    return newThresholds;
  }

  /**
   * Create A/B tests for promising recommendations
   */
  async createABTestsForRecommendations(recommendations) {
    const topRecommendations = recommendations.slice(0, 3); // Test top 3 recommendations
    
    for (const rec of topRecommendations) {
      const testName = `threshold_optimization_${rec.section}_${Date.now()}`;
      
      try {
        await this.monitoringService.createABTest(
          testName,
          `Auto-optimization test for ${rec.section}: ${rec.reason}`,
          {
            control: { thresholds: rec.currentThresholds },
            variant: { thresholds: rec.suggestedThresholds }
          },
          { control: 0.8, variant: 0.2 } // 80/20 split for safety
        );
        
        console.log(`🧪 Created A/B test: ${testName}`);
        
      } catch (error) {
        console.error(`❌ Failed to create A/B test for ${rec.section}:`, error);
      }
    }
  }

  /**
   * Apply validated optimizations
   */
  async applyValidatedOptimizations() {
    const appliedOptimizations = [];
    
    // Get A/B test results
    const abTests = await this.monitoringService.getCompletedABTests();
    
    for (const test of abTests) {
      const analysis = this.monitoringService.analyzeABTest(test.name);
      
      if (analysis.winner === 'variant' && analysis.confidence > 0.95) {
        // Apply the winning variant
        const sectionName = this.extractSectionFromTestName(test.name);
        const newThresholds = test.variants.variant.thresholds;
        
        // Update thresholds
        this.currentThresholds[sectionName] = newThresholds;
        
        // Update SystemAIDecisionService
        await this.systemAIDecisionService.updateThresholds(sectionName, newThresholds);
        
        appliedOptimizations.push({
          section: sectionName,
          oldThresholds: test.variants.control.thresholds,
          newThresholds: newThresholds,
          improvement: analysis.improvement,
          confidence: analysis.confidence,
          testName: test.name
        });
        
        console.log(`✅ Applied optimization for ${sectionName}:`, newThresholds);
      }
    }
    
    return appliedOptimizations;
  }

  /**
   * Update learning models with new data
   */
  async updateLearningModels(performanceData, appliedOptimizations) {
    // Update Bayesian optimizer
    this.algorithms.bayesianOptimization.updateWithResults(
      appliedOptimizations.map(opt => ({
        parameters: opt.newThresholds,
        objective: this.calculateObjectiveValue(opt.improvement)
      }))
    );
    
    // Update reinforcement learning model
    this.algorithms.reinforcementLearning.updatePolicy(
      performanceData,
      appliedOptimizations
    );
    
    // Update adaptive learning rate
    this.updateLearningRate(appliedOptimizations);
  }

  /**
   * Calculate recommendation score for prioritization
   */
  calculateRecommendationScore(recommendation) {
    const impact = recommendation.impact;
    const confidence = recommendation.confidence;
    
    // Weighted score based on optimization targets
    const score = (
      (-impact.cost * this.optimizationTargets.costReduction) +
      (impact.quality * this.optimizationTargets.qualityMaintenance) +
      (impact.speed * this.optimizationTargets.speedImprovement)
    ) * confidence;
    
    return score;
  }

  /**
   * Calculate recommendation confidence
   */
  calculateRecommendationConfidence(systemData, aiData) {
    const sampleSize = parseInt(systemData.sample_count) + parseInt(aiData.sample_count);
    const minSampleSize = this.autoTuningConfig.minSampleSize;
    
    if (sampleSize < minSampleSize) {
      return 0.1; // Low confidence for small samples
    }
    
    // Base confidence on sample size and performance difference
    const sampleConfidence = Math.min(sampleSize / (minSampleSize * 2), 1.0);
    const performanceDifference = Math.abs(
      parseFloat(systemData.avg_confidence) - parseFloat(aiData.avg_confidence)
    );
    
    return sampleConfidence * Math.min(performanceDifference * 2, 1.0);
  }

  /**
   * Analyze cost metrics
   */
  async analyzeCostMetrics(startTime, endTime) {
    try {
      const query = `
        SELECT 
          section_name,
          approach_used,
          SUM(cost_usd) as total_cost,
          AVG(cost_usd) as avg_cost,
          COUNT(*) as count
        FROM analysis_sections 
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY section_name, approach_used
      `;
      
      const result = await this.propertyDb.pool.query(query, [
        new Date(startTime),
        new Date(endTime)
      ]);
      
      return result.rows;
    } catch (error) {
      console.error('❌ Error analyzing cost metrics:', error);
      return [];
    }
  }

  /**
   * Analyze quality metrics
   */
  async analyzeQualityMetrics(startTime, endTime) {
    try {
      const query = `
        SELECT 
          section_name,
          approach_used,
          AVG(confidence_score) as avg_confidence,
          AVG(user_satisfaction) as avg_satisfaction,
          COUNT(*) as count
        FROM analysis_sections 
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY section_name, approach_used
      `;
      
      const result = await this.propertyDb.pool.query(query, [
        new Date(startTime),
        new Date(endTime)
      ]);
      
      return result.rows;
    } catch (error) {
      console.error('❌ Error analyzing quality metrics:', error);
      return [];
    }
  }

  /**
   * Record optimization results
   */
  async recordOptimizationResults(appliedOptimizations) {
    this.metrics.totalOptimizations += appliedOptimizations.length;
    this.metrics.successfulOptimizations += appliedOptimizations.filter(
      opt => opt.improvement > 0
    ).length;
    this.metrics.lastOptimization = new Date().toISOString();
    
    // Store in performance history
    this.performanceHistory.thresholdChanges.push({
      timestamp: Date.now(),
      optimizations: appliedOptimizations
    });
    
    // Calculate average improvements
    if (appliedOptimizations.length > 0) {
      const avgCostReduction = appliedOptimizations.reduce(
        (sum, opt) => sum + (opt.improvement.cost || 0), 0
      ) / appliedOptimizations.length;
      
      this.metrics.averageCostReduction = 
        (this.metrics.averageCostReduction + avgCostReduction) / 2;
    }
    
    // Save to database
    try {
      await this.saveOptimizationResults(appliedOptimizations);
    } catch (error) {
      console.error('❌ Error saving optimization results:', error);
    }
  }

  /**
   * Save optimization results to database
   */
  async saveOptimizationResults(optimizations) {
    for (const opt of optimizations) {
      const query = `
        INSERT INTO optimization_history (
          section_name, old_thresholds, new_thresholds, 
          improvement_metrics, confidence, applied_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      await this.propertyDb.pool.query(query, [
        opt.section,
        JSON.stringify(opt.oldThresholds),
        JSON.stringify(opt.newThresholds),
        JSON.stringify(opt.improvement),
        opt.confidence,
        new Date()
      ]);
    }
  }

  /**
   * Handle optimization failure
   */
  async handleOptimizationFailure(error) {
    console.error('🚨 Optimization failure detected:', error.message);
    
    // Implement rollback mechanism if needed
    if (error.message.includes('performance_degradation')) {
      await this.rollbackLastOptimization();
    }
    
    // Alert monitoring system
    await this.monitoringService.triggerAlert(
      'optimization_failure',
      'high',
      `Auto-optimization failed: ${error.message}`,
      { error: error.stack }
    );
  }

  /**
   * Get current optimization status
   */
  getOptimizationStatus() {
    return {
      enabled: this.autoTuningConfig.enabled,
      currentThresholds: this.currentThresholds,
      metrics: this.metrics,
      performanceHistory: this.performanceHistory,
      activeABTests: Array.from(this.abTestVariants.keys()),
      lastOptimization: this.metrics.lastOptimization,
      optimizationTargets: this.optimizationTargets
    };
  }

  /**
   * Manually trigger optimization
   */
  async triggerOptimization() {
    console.log('🔧 Manually triggering optimization cycle...');
    return await this.runOptimizationCycle();
  }

  /**
   * Update optimization configuration
   */
  updateConfiguration(newConfig) {
    this.autoTuningConfig = { ...this.autoTuningConfig, ...newConfig };
    this.optimizationTargets = { ...this.optimizationTargets, ...newConfig.targets };
    console.log('✅ Auto-optimization configuration updated');
  }

  // Helper methods
  extractSectionFromTestName(testName) {
    const match = testName.match(/threshold_optimization_(\w+)_/);
    return match ? match[1] : 'unknown';
  }

  calculateObjectiveValue(improvement) {
    return (
      (-improvement.cost * this.optimizationTargets.costReduction) +
      (improvement.quality * this.optimizationTargets.qualityMaintenance) +
      (improvement.speed * this.optimizationTargets.speedImprovement)
    );
  }

  updateLearningRate(optimizations) {
    const successRate = optimizations.filter(opt => opt.improvement > 0).length / 
                       Math.max(optimizations.length, 1);
    
    if (successRate > 0.8) {
      this.learningRate *= 1.05; // Increase learning rate
    } else if (successRate < 0.3) {
      this.learningRate *= 0.95; // Decrease learning rate
    }
    
    this.learningRate = Math.max(0.001, Math.min(0.1, this.learningRate));
  }

  async rollbackLastOptimization() {
    console.log('🔄 Rolling back last optimization...');
    
    try {
      // Find the most recent optimization that hasn't been rolled back
      const query = `
        SELECT * FROM optimization_history 
        WHERE rolled_back_at IS NULL 
        ORDER BY applied_at DESC 
        LIMIT 1
      `;
      
      const result = await this.propertyDb.pool.query(query);
      
      if (result.rows.length === 0) {
        console.log('⚠️ No optimizations found to rollback');
        return false;
      }
      
      const optimization = result.rows[0];
      const sectionName = optimization.section_name;
      const oldThresholds = optimization.old_thresholds;
      
      // Restore old thresholds
      this.currentThresholds[sectionName] = oldThresholds;
      
      // Update SystemAIDecisionService
      await this.systemAIDecisionService.updateThresholds(sectionName, oldThresholds);
      
      // Mark as rolled back in database
      const updateQuery = `
        UPDATE optimization_history 
        SET rolled_back_at = NOW(), 
            rollback_reason = $1 
        WHERE id = $2
      `;
      
      await this.propertyDb.pool.query(updateQuery, [
        'Performance degradation detected',
        optimization.id
      ]);
      
      console.log(`✅ Rolled back optimization for ${sectionName}`);
      
      // Update performance metrics
      this.metrics.totalOptimizations--;
      
      // Alert monitoring system
      await this.monitoringService.triggerAlert(
        'optimization_rollback',
        'medium',
        `Rolled back optimization for ${sectionName}`,
        { 
          oldThresholds: optimization.new_thresholds,
          restoredThresholds: oldThresholds,
          optimizationId: optimization.id
        }
      );
      
      return true;
      
    } catch (error) {
      console.error('❌ Error rolling back optimization:', error);
      return false;
    }
  }

  /**
   * Automatically detect and rollback poor performing optimizations
   */
  async detectAndRollbackPoorOptimizations() {
    console.log('🔍 Detecting poor performing optimizations...');
    
    try {
      // Get recent optimizations (last 7 days)
      const query = `
        SELECT 
          oh.*,
          tp.cost_efficiency_score,
          tp.success_rate,
          tp.user_satisfaction_avg
        FROM optimization_history oh
        LEFT JOIN threshold_performance tp ON (
          oh.section_name = tp.section_name 
          AND tp.performance_period @> NOW()::timestamptz
        )
        WHERE oh.applied_at >= NOW() - INTERVAL '7 days'
          AND oh.rolled_back_at IS NULL
        ORDER BY oh.applied_at DESC
      `;
      
      const result = await this.propertyDb.pool.query(query);
      
      let rolledBackCount = 0;
      
      for (const optimization of result.rows) {
        const shouldRollback = this.shouldRollbackOptimization(optimization);
        
        if (shouldRollback.rollback) {
          console.log(`🔄 Auto-rolling back optimization for ${optimization.section_name}: ${shouldRollback.reason}`);
          
          // Restore old thresholds
          this.currentThresholds[optimization.section_name] = optimization.old_thresholds;
          
          // Update SystemAIDecisionService
          await this.systemAIDecisionService.updateThresholds(
            optimization.section_name, 
            optimization.old_thresholds
          );
          
          // Mark as rolled back
          const updateQuery = `
            UPDATE optimization_history 
            SET rolled_back_at = NOW(), 
                rollback_reason = $1 
            WHERE id = $2
          `;
          
          await this.propertyDb.pool.query(updateQuery, [
            shouldRollback.reason,
            optimization.id
          ]);
          
          rolledBackCount++;
        }
      }
      
      if (rolledBackCount > 0) {
        console.log(`✅ Auto-rolled back ${rolledBackCount} poor performing optimizations`);
        
        // Alert monitoring system
        await this.monitoringService.triggerAlert(
          'auto_rollback_performed',
          'medium',
          `Auto-rolled back ${rolledBackCount} optimizations due to performance degradation`,
          { rolledBackCount }
        );
      }
      
      return rolledBackCount;
      
    } catch (error) {
      console.error('❌ Error detecting poor optimizations:', error);
      return 0;
    }
  }

  /**
   * Determine if an optimization should be rolled back
   */
  shouldRollbackOptimization(optimization) {
    // Check performance metrics
    const costEfficiency = optimization.cost_efficiency_score || 0;
    const successRate = optimization.success_rate || 0;
    const userSatisfaction = optimization.user_satisfaction_avg || 0;
    
    // Rollback thresholds
    const rollbackThreshold = this.autoTuningConfig.rollbackThreshold;
    
    // Cost efficiency degradation
    if (costEfficiency < (1 - rollbackThreshold)) {
      return {
        rollback: true,
        reason: `Cost efficiency degraded to ${(costEfficiency * 100).toFixed(1)}%`
      };
    }
    
    // Success rate degradation
    if (successRate < (1 - rollbackThreshold)) {
      return {
        rollback: true,
        reason: `Success rate degraded to ${(successRate * 100).toFixed(1)}%`
      };
    }
    
    // User satisfaction degradation
    if (userSatisfaction < (5 * (1 - rollbackThreshold))) {
      return {
        rollback: true,
        reason: `User satisfaction degraded to ${userSatisfaction.toFixed(1)}/5`
      };
    }
    
    return { rollback: false };
  }

  /**
   * Use advanced algorithms for threshold optimization
   */
  async optimizeWithAdvancedAlgorithms(performanceData) {
    console.log('🧠 Running advanced algorithm optimization...');
    
    const bounds = this.generateParameterBounds();
    const objectiveFunc = this.createObjectiveFunction(performanceData);
    const currentParams = this.thresholdsToParameters(this.currentThresholds);
    
    const results = [];
    
    try {
      // Bayesian Optimization
      console.log('📊 Running Bayesian optimization...');
      const bayesianSuggestion = this.algorithms.bayesianOptimization.suggestNext(currentParams, bounds);
      const bayesianObjective = objectiveFunc(bayesianSuggestion);
      results.push({
        algorithm: 'bayesian',
        parameters: bayesianSuggestion,
        objective: bayesianObjective
      });
      
      // Genetic Algorithm
      console.log('🧬 Running genetic algorithm...');
      const geneticBest = this.algorithms.geneticAlgorithm.evolvePopulation(currentParams, objectiveFunc, bounds);
      const geneticObjective = objectiveFunc(geneticBest);
      results.push({
        algorithm: 'genetic',
        parameters: geneticBest,
        objective: geneticObjective
      });
      
      // Gradient Descent
      console.log('📈 Running gradient descent...');
      const gradients = this.algorithms.gradientDescent.estimateGradients(currentParams, objectiveFunc, bounds);
      const gradientParams = this.algorithms.gradientDescent.updateWeights(gradients, currentParams);
      const gradientObjective = objectiveFunc(gradientParams);
      results.push({
        algorithm: 'gradient',
        parameters: gradientParams,
        objective: gradientObjective
      });
      
      // Select best result
      results.sort((a, b) => b.objective - a.objective);
      const bestResult = results[0];
      
      console.log(`✅ Best algorithm: ${bestResult.algorithm} with objective: ${bestResult.objective.toFixed(4)}`);
      
      // Update algorithms with results
      this.algorithms.bayesianOptimization.updateWithResults(results.map(r => ({
        parameters: r.parameters,
        objective: r.objective
      })));
      
      return bestResult;
      
    } catch (error) {
      console.error('❌ Error in advanced algorithm optimization:', error);
      return null;
    }
  }

  /**
   * Generate parameter bounds for optimization algorithms
   */
  generateParameterBounds() {
    const bounds = {};
    
    for (const [sectionName, thresholds] of Object.entries(this.currentThresholds)) {
      bounds[`${sectionName}_nComparables`] = {
        min: Math.max(5, Math.floor(thresholds.nComparables * 0.5)),
        max: Math.floor(thresholds.nComparables * 2)
      };
      
      bounds[`${sectionName}_nAnalyses`] = {
        min: Math.max(1, Math.floor(thresholds.nAnalyses * 0.5)),
        max: Math.floor(thresholds.nAnalyses * 2)
      };
      
      bounds[`${sectionName}_qualityScore`] = {
        min: Math.max(0.1, thresholds.qualityScore * 0.7),
        max: Math.min(1.0, thresholds.qualityScore * 1.3)
      };
    }
    
    return bounds;
  }

  /**
   * Convert flat parameters back to threshold structure
   */
  parametersToThresholds(parameters) {
    const thresholds = {};
    
    for (const [paramKey, value] of Object.entries(parameters)) {
      const [sectionName, paramType] = paramKey.split('_');
      
      if (!thresholds[sectionName]) {
        thresholds[sectionName] = { ...this.currentThresholds[sectionName] };
      }
      
      switch (paramType) {
        case 'nComparables':
          thresholds[sectionName].nComparables = Math.round(value);
          break;
        case 'nAnalyses':
          thresholds[sectionName].nAnalyses = Math.round(value);
          break;
        case 'qualityScore':
          thresholds[sectionName].qualityScore = value;
          break;
      }
    }
    
    return thresholds;
  }

  /**
   * Convert thresholds to flat parameter structure
   */
  thresholdsToParameters(thresholds) {
    const parameters = {};
    
    for (const [sectionName, sectionThresholds] of Object.entries(thresholds)) {
      parameters[`${sectionName}_nComparables`] = sectionThresholds.nComparables;
      parameters[`${sectionName}_nAnalyses`] = sectionThresholds.nAnalyses;
      parameters[`${sectionName}_qualityScore`] = sectionThresholds.qualityScore;
    }
    
    return parameters;
  }

  /**
   * Objective function for optimization algorithms
   */
  createObjectiveFunction(performanceData) {
    return (parameters) => {
      const thresholds = this.parametersToThresholds(parameters);
      let totalObjective = 0;
      let sectionCount = 0;
      
      for (const [sectionName, sectionThresholds] of Object.entries(thresholds)) {
        const sectionData = performanceData.sections[sectionName];
        if (!sectionData || sectionData.error) continue;
        
        // Estimate performance with new thresholds
        const estimatedPerformance = this.estimatePerformanceWithThresholds(
          sectionData.performance,
          sectionThresholds
        );
        
        // Calculate objective based on optimization targets
        const objective = (
          estimatedPerformance.costReduction * this.optimizationTargets.costReduction +
          estimatedPerformance.qualityMaintenance * this.optimizationTargets.qualityMaintenance +
          estimatedPerformance.speedImprovement * this.optimizationTargets.speedImprovement +
          estimatedPerformance.userSatisfaction * this.optimizationTargets.userSatisfaction
        );
        
        totalObjective += objective;
        sectionCount++;
      }
      
      return sectionCount > 0 ? totalObjective / sectionCount : 0;
    };
  }

  /**
   * Estimate performance impact of threshold changes
   */
  estimatePerformanceWithThresholds(performanceData, newThresholds) {
    const systemData = performanceData.find(p => p.approach_used === 'system');
    const aiData = performanceData.find(p => p.approach_used === 'ai');
    
    if (!systemData || !aiData) {
      return { costReduction: 0, qualityMaintenance: 0, speedImprovement: 0, userSatisfaction: 0 };
    }
    
    // Simple heuristic estimation based on threshold changes
    const currentThresholds = this.currentThresholds;
    const comparablesRatio = newThresholds.nComparables / currentThresholds.nComparables || 1;
    const qualityRatio = newThresholds.qualityScore / currentThresholds.qualityScore || 1;
    
    // Estimate system vs AI usage based on new thresholds
    const systemUsage = Math.min(1.0, 1.0 / comparablesRatio);
    const aiUsage = 1 - systemUsage;
    
    // Weighted performance estimates
    const estimatedCost = (
      systemUsage * parseFloat(systemData.avg_cost) +
      aiUsage * parseFloat(aiData.avg_cost)
    );
    
    const estimatedQuality = (
      systemUsage * parseFloat(systemData.avg_confidence) * qualityRatio +
      aiUsage * parseFloat(aiData.avg_confidence)
    );
    
    const estimatedSpeed = (
      systemUsage * parseFloat(systemData.avg_response_time) +
      aiUsage * parseFloat(aiData.avg_response_time)
    );
    
    const estimatedSatisfaction = (
      systemUsage * parseFloat(systemData.avg_satisfaction) +
      aiUsage * parseFloat(aiData.avg_satisfaction)
    );
    
    // Convert to improvement metrics (normalized 0-1)
    const baseCost = parseFloat(aiData.avg_cost);
    const baseQuality = parseFloat(aiData.avg_confidence);
    const baseSpeed = parseFloat(aiData.avg_response_time);
    const baseSatisfaction = parseFloat(aiData.avg_satisfaction);
    
    return {
      costReduction: Math.max(0, Math.min(1, (baseCost - estimatedCost) / baseCost)),
      qualityMaintenance: Math.max(0, Math.min(1, estimatedQuality / baseQuality)),
      speedImprovement: Math.max(0, Math.min(1, (baseSpeed - estimatedSpeed) / baseSpeed)),
      userSatisfaction: Math.max(0, Math.min(1, estimatedSatisfaction / baseSatisfaction))
    };
  }
}

// Advanced optimization algorithm implementations
class BayesianOptimizer {
  constructor() {
    this.observations = [];
    this.acquisitionFunction = 'expected_improvement';
    this.kernel = 'rbf'; // Radial basis function
    this.alpha = 1e-6;
    this.lengthScale = 1.0;
  }

  updateWithResults(results) {
    console.log('📊 Updating Bayesian optimizer with results:', results.length);
    
    for (const result of results) {
      this.observations.push({
        parameters: result.parameters,
        objective: result.objective,
        timestamp: Date.now()
      });
    }
    
    // Keep only recent observations (last 1000)
    if (this.observations.length > 1000) {
      this.observations = this.observations.slice(-1000);
    }
    
    this.updateHyperparameters();
  }

  suggestNext(currentParams, bounds) {
    if (this.observations.length < 3) {
      // Random exploration for initial points
      return this.randomSample(bounds);
    }
    
    // Use acquisition function to suggest next parameters
    return this.optimizeAcquisition(currentParams, bounds);
  }

  updateHyperparameters() {
    // Simple hyperparameter tuning based on recent performance
    const recentObs = this.observations.slice(-50);
    const variance = this.calculateVariance(recentObs.map(o => o.objective));
    
    // Adjust length scale based on objective variance
    this.lengthScale = Math.max(0.1, Math.min(2.0, 1.0 / Math.sqrt(variance + 1e-6)));
  }

  optimizeAcquisition(currentParams, bounds) {
    // Simple acquisition optimization using expected improvement
    let bestParams = currentParams;
    let bestAcquisition = -Infinity;
    
    // Sample multiple candidates
    for (let i = 0; i < 100; i++) {
      const candidate = this.randomSample(bounds);
      const acquisition = this.expectedImprovement(candidate);
      
      if (acquisition > bestAcquisition) {
        bestAcquisition = acquisition;
        bestParams = candidate;
      }
    }
    
    return bestParams;
  }

  expectedImprovement(params) {
    if (this.observations.length === 0) return 1.0;
    
    const mu = this.predictMean(params);
    const sigma = this.predictStd(params);
    const fBest = Math.max(...this.observations.map(o => o.objective));
    
    if (sigma < 1e-6) return 0;
    
    const z = (mu - fBest) / sigma;
    const ei = (mu - fBest) * this.normalCDF(z) + sigma * this.normalPDF(z);
    
    return ei;
  }

  predictMean(params) {
    // Simple kernel regression for mean prediction
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const obs of this.observations) {
      const weight = this.kernelFunction(params, obs.parameters);
      weightedSum += weight * obs.objective;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  predictStd(params) {
    // Estimate uncertainty based on distance to nearest observations
    let minDistance = Infinity;
    
    for (const obs of this.observations) {
      const distance = this.paramDistance(params, obs.parameters);
      minDistance = Math.min(minDistance, distance);
    }
    
    return Math.exp(-minDistance / this.lengthScale);
  }

  kernelFunction(params1, params2) {
    const distance = this.paramDistance(params1, params2);
    return Math.exp(-0.5 * Math.pow(distance / this.lengthScale, 2));
  }

  paramDistance(params1, params2) {
    let sum = 0;
    for (const key in params1) {
      if (params2[key] !== undefined) {
        sum += Math.pow(params1[key] - params2[key], 2);
      }
    }
    return Math.sqrt(sum);
  }

  randomSample(bounds) {
    const params = {};
    for (const [key, range] of Object.entries(bounds)) {
      params[key] = range.min + Math.random() * (range.max - range.min);
    }
    return params;
  }

  calculateVariance(values) {
    if (values.length < 2) return 1.0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
    return variance;
  }

  normalCDF(x) {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  normalPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  erf(x) {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
  }
}

class GeneticOptimizer {
  constructor() {
    this.populationSize = 20;
    this.mutationRate = 0.1;
    this.crossoverRate = 0.7;
    this.eliteSize = 4;
    this.generation = 0;
    this.population = [];
    this.fitnessHistory = [];
  }

  evolvePopulation(currentParams, objectiveFunc, bounds) {
    console.log('🧬 Evolving optimization population, generation:', this.generation);
    
    // Initialize population if empty
    if (this.population.length === 0) {
      this.initializePopulation(currentParams, bounds);
    }
    
    // Evaluate fitness
    const fitness = this.population.map(individual => ({
      individual: individual,
      fitness: objectiveFunc(individual)
    }));
    
    // Sort by fitness (descending)
    fitness.sort((a, b) => b.fitness - a.fitness);
    
    // Track best fitness
    this.fitnessHistory.push(fitness[0].fitness);
    
    // Create new generation
    const newPopulation = [];
    
    // Elitism - keep best individuals
    for (let i = 0; i < this.eliteSize; i++) {
      newPopulation.push(fitness[i].individual);
    }
    
    // Generate offspring
    while (newPopulation.length < this.populationSize) {
      const parent1 = this.tournamentSelection(fitness);
      const parent2 = this.tournamentSelection(fitness);
      
      let offspring;
      if (Math.random() < this.crossoverRate) {
        offspring = this.crossover(parent1, parent2, bounds);
      } else {
        offspring = Math.random() < 0.5 ? parent1 : parent2;
      }
      
      if (Math.random() < this.mutationRate) {
        offspring = this.mutate(offspring, bounds);
      }
      
      newPopulation.push(offspring);
    }
    
    this.population = newPopulation;
    this.generation++;
    
    return fitness[0].individual; // Return best individual
  }

  initializePopulation(currentParams, bounds) {
    this.population = [];
    
    // Add current parameters to population
    this.population.push(currentParams);
    
    // Generate random individuals
    for (let i = 1; i < this.populationSize; i++) {
      const individual = {};
      for (const [key, range] of Object.entries(bounds)) {
        individual[key] = range.min + Math.random() * (range.max - range.min);
      }
      this.population.push(individual);
    }
  }

  tournamentSelection(fitness, tournamentSize = 3) {
    const tournament = [];
    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * fitness.length);
      tournament.push(fitness[idx]);
    }
    
    // Return best from tournament
    tournament.sort((a, b) => b.fitness - a.fitness);
    return tournament[0].individual;
  }

  crossover(parent1, parent2, bounds) {
    const offspring = {};
    
    for (const key in parent1) {
      if (Math.random() < 0.5) {
        offspring[key] = parent1[key];
      } else {
        offspring[key] = parent2[key];
      }
      
      // Ensure within bounds
      const range = bounds[key];
      if (range) {
        offspring[key] = Math.max(range.min, Math.min(range.max, offspring[key]));
      }
    }
    
    return offspring;
  }

  mutate(individual, bounds) {
    const mutated = { ...individual };
    
    for (const key in mutated) {
      if (Math.random() < this.mutationRate) {
        const range = bounds[key];
        if (range) {
          // Gaussian mutation
          const std = (range.max - range.min) * 0.1;
          const mutation = this.gaussianRandom(0, std);
          mutated[key] = Math.max(range.min, Math.min(range.max, mutated[key] + mutation));
        }
      }
    }
    
    return mutated;
  }

  gaussianRandom(mean = 0, std = 1) {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * std + mean;
  }
}

class GradientDescentOptimizer {
  constructor() {
    this.learningRate = 0.01;
    this.momentum = 0.9;
    this.velocity = {};
    this.history = [];
    this.adaptiveLR = true;
  }

  updateWeights(gradients, currentParams, objectiveHistory = []) {
    console.log('📈 Updating optimization weights');
    
    // Adaptive learning rate
    if (this.adaptiveLR && objectiveHistory.length > 1) {
      this.adaptLearningRate(objectiveHistory);
    }
    
    const updatedParams = {};
    
    for (const [param, gradient] of Object.entries(gradients)) {
      // Initialize velocity if not exists
      if (!this.velocity[param]) {
        this.velocity[param] = 0;
      }
      
      // Momentum update
      this.velocity[param] = this.momentum * this.velocity[param] - this.learningRate * gradient;
      
      // Parameter update
      updatedParams[param] = currentParams[param] + this.velocity[param];
    }
    
    this.history.push({
      params: updatedParams,
      gradients: gradients,
      learningRate: this.learningRate,
      timestamp: Date.now()
    });
    
    // Keep history limited
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
    
    return updatedParams;
  }

  estimateGradients(currentParams, objectiveFunc, bounds) {
    const gradients = {};
    const epsilon = 1e-6;
    const baseObjective = objectiveFunc(currentParams);
    
    for (const [param, value] of Object.entries(currentParams)) {
      const perturbedParams = { ...currentParams };
      perturbedParams[param] = value + epsilon;
      
      // Ensure within bounds
      const range = bounds[param];
      if (range) {
        perturbedParams[param] = Math.max(range.min, Math.min(range.max, perturbedParams[param]));
      }
      
      const perturbedObjective = objectiveFunc(perturbedParams);
      gradients[param] = (perturbedObjective - baseObjective) / epsilon;
    }
    
    return gradients;
  }

  adaptLearningRate(objectiveHistory) {
    if (objectiveHistory.length < 3) return;
    
    const recent = objectiveHistory.slice(-3);
    const isImproving = recent[2] > recent[1] && recent[1] > recent[0];
    const isWorsening = recent[2] < recent[1] && recent[1] < recent[0];
    
    if (isImproving) {
      this.learningRate *= 1.05; // Increase learning rate
    } else if (isWorsening) {
      this.learningRate *= 0.95; // Decrease learning rate
    }
    
    // Clamp learning rate
    this.learningRate = Math.max(0.001, Math.min(0.1, this.learningRate));
  }

  reset() {
    this.velocity = {};
    this.history = [];
    this.learningRate = 0.01;
  }
}

class RLOptimizer {
  constructor() {
    this.qTable = new Map();
    this.learningRate = 0.1;
    this.discountFactor = 0.9;
    this.epsilon = 0.1; // Exploration rate
    this.episodeCount = 0;
    this.stateHistory = [];
    this.actionHistory = [];
    this.rewardHistory = [];
  }

  updatePolicy(state, action, reward, nextState = null) {
    console.log('🤖 Updating RL policy');
    
    const stateKey = this.stateToKey(state);
    const actionKey = this.actionToKey(action);
    
    // Initialize Q-value if not exists
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map());
    }
    
    const stateActions = this.qTable.get(stateKey);
    if (!stateActions.has(actionKey)) {
      stateActions.set(actionKey, 0);
    }
    
    // Q-learning update
    let maxNextQ = 0;
    if (nextState) {
      const nextStateKey = this.stateToKey(nextState);
      if (this.qTable.has(nextStateKey)) {
        const nextStateActions = this.qTable.get(nextStateKey);
        maxNextQ = Math.max(...Array.from(nextStateActions.values()));
      }
    }
    
    const currentQ = stateActions.get(actionKey);
    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);
    stateActions.set(actionKey, newQ);
    
    // Update histories
    this.stateHistory.push(state);
    this.actionHistory.push(action);
    this.rewardHistory.push(reward);
    
    // Limit history size
    if (this.stateHistory.length > 1000) {
      this.stateHistory = this.stateHistory.slice(-1000);
      this.actionHistory = this.actionHistory.slice(-1000);
      this.rewardHistory = this.rewardHistory.slice(-1000);
    }
    
    this.episodeCount++;
    
    // Decay exploration rate
    this.epsilon = Math.max(0.01, this.epsilon * 0.999);
  }

  selectAction(state, possibleActions) {
    const stateKey = this.stateToKey(state);
    
    // Epsilon-greedy action selection
    if (Math.random() < this.epsilon || !this.qTable.has(stateKey)) {
      // Explore: random action
      return possibleActions[Math.floor(Math.random() * possibleActions.length)];
    }
    
    // Exploit: best action
    const stateActions = this.qTable.get(stateKey);
    let bestAction = possibleActions[0];
    let bestQ = -Infinity;
    
    for (const action of possibleActions) {
      const actionKey = this.actionToKey(action);
      const q = stateActions.get(actionKey) || 0;
      if (q > bestQ) {
        bestQ = q;
        bestAction = action;
      }
    }
    
    return bestAction;
  }

  stateToKey(state) {
    // Convert state object to string key
    const keys = Object.keys(state).sort();
    return keys.map(key => `${key}:${state[key].toFixed(3)}`).join('|');
  }

  actionToKey(action) {
    // Convert action object to string key
    if (typeof action === 'string') return action;
    const keys = Object.keys(action).sort();
    return keys.map(key => `${key}:${action[key]}`).join('|');
  }

  getPerformanceMetrics() {
    return {
      episodeCount: this.episodeCount,
      qTableSize: this.qTable.size,
      epsilon: this.epsilon,
      averageReward: this.rewardHistory.length > 0 ? 
        this.rewardHistory.reduce((sum, r) => sum + r, 0) / this.rewardHistory.length : 0,
      recentReward: this.rewardHistory.slice(-10).reduce((sum, r) => sum + r, 0) / Math.min(10, this.rewardHistory.length)
    };
  }
}

module.exports = AutoOptimizationService; 