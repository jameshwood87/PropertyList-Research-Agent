/**
 * Context Awareness Service - Phase 1 Enhancement
 * 
 * Provides intelligent business logic and environmental context
 * to enhance optimization decisions without external AI costs.
 * 
 * Features:
 * - Time-based optimization (weekends, peak hours, seasons)
 * - Load-based adaptation (system performance, database load)
 * - Error-rate monitoring and conservative adjustments
 * - User behavior pattern recognition
 * - Budget and cost management logic
 */

class ContextAwarenessService {
  constructor(propertyDatabase, monitoringService) {
    this.propertyDb = propertyDatabase;
    this.monitoringService = monitoringService;
    
    // Context tracking
    this.currentContext = {
      timeContext: {},
      systemContext: {},
      userContext: {},
      businessContext: {}
    };
    
    // Smart heuristics configuration
    this.heuristics = {
      timeBasedRules: {
        weekendSpeedBoost: { enabled: true, speedWeight: 0.3 },
        peakHourQuality: { enabled: true, qualityWeight: 0.5 },
        lateNightCostSaving: { enabled: true, costWeight: 0.4 },
        monthEndBudgetControl: { enabled: true, costWeight: 0.5 }
      },
      
      loadBasedRules: {
        highLoadSpeedPriority: { enabled: true, threshold: 80, speedWeight: 0.4 },
        lowLoadQualityBoost: { enabled: true, threshold: 30, qualityWeight: 0.5 },
        databaseStressReduction: { enabled: true, threshold: 85, speedWeight: 0.35 }
      },
      
      errorBasedRules: {
        highErrorConservative: { enabled: true, threshold: 0.05, confidenceBoost: 0.98 },
        recentFailuresCaution: { enabled: true, lookbackHours: 2, confidenceBoost: 0.96 },
        stabilityMaintenance: { enabled: true, threshold: 0.95, confidenceBoost: 0.97 }
      },
      
      userBasedRules: {
        premiumUserQuality: { enabled: true, qualityBoost: 0.1 },
        highVolumeEfficiency: { enabled: true, threshold: 50, speedWeight: 0.3 },
        newUserExperience: { enabled: true, qualityWeight: 0.45 }
      }
    };
    
    // Performance metrics
    this.metrics = {
      heuristicsApplied: 0,
      contextSwitches: 0,
      optimizationImprovements: 0,
      lastContextUpdate: null
    };
    
    // Historical context data
    this.contextHistory = [];
    this.maxHistorySize = 1000;
    
    // Initialize context analysis
    this.initializeContextAnalysis();
  }

  /**
   * Initialize context analysis and start monitoring
   */
  async initializeContextAnalysis() {
    console.log('🧠 Initializing Context Awareness Service...');
    
    // Update context immediately
    await this.updateCurrentContext();
    
    // Set up periodic context updates (every 5 minutes)
    setInterval(async () => {
      await this.updateCurrentContext();
    }, 5 * 60 * 1000);
    
    // Set up hourly context analysis
    setInterval(async () => {
      await this.analyzeContextPatterns();
    }, 60 * 60 * 1000);
    
    console.log('✅ Context Awareness Service initialized');
  }

  /**
   * Update current context with fresh data
   */
  async updateCurrentContext() {
    try {
      const now = new Date();
      
      // Time context
      this.currentContext.timeContext = {
        hour: now.getHours(),
        dayOfWeek: now.getDay(), // 0 = Sunday, 6 = Saturday
        dayOfMonth: now.getDate(),
        month: now.getMonth() + 1,
        isWeekend: now.getDay() === 0 || now.getDay() === 6,
        isPeakHours: this.isPeakHours(now.getHours()),
        isLateNight: now.getHours() >= 22 || now.getHours() <= 6,
        isMonthEnd: now.getDate() >= 25,
        quarter: Math.ceil((now.getMonth() + 1) / 3)
      };
      
      // System context
      this.currentContext.systemContext = await this.getSystemContext();
      
      // User context
      this.currentContext.userContext = await this.getUserContext();
      
      // Business context
      this.currentContext.businessContext = await this.getBusinessContext();
      
      // Store in history
      this.contextHistory.push({
        timestamp: now,
        context: { ...this.currentContext }
      });
      
      // Limit history size
      if (this.contextHistory.length > this.maxHistorySize) {
        this.contextHistory = this.contextHistory.slice(-this.maxHistorySize);
      }
      
      this.metrics.lastContextUpdate = now.toISOString();
      
    } catch (error) {
      console.error('❌ Error updating context:', error);
    }
  }

  /**
   * Get system performance context
   */
  async getSystemContext() {
    try {
      const systemMetrics = await this.monitoringService.getCurrentMetrics();
      
      return {
        cpuLoad: systemMetrics.cpuUsage || 0,
        memoryUsage: systemMetrics.memoryUsage || 0,
        databaseLoad: await this.getDatabaseLoad(),
        errorRate: systemMetrics.errorRate || 0,
        responseTime: systemMetrics.avgResponseTime || 0,
        activeConnections: systemMetrics.activeConnections || 0,
        cacheHitRate: systemMetrics.cacheHitRate || 0
      };
    } catch (error) {
      console.error('Error getting system context:', error);
      return {
        cpuLoad: 0,
        memoryUsage: 0,
        databaseLoad: 0,
        errorRate: 0,
        responseTime: 0,
        activeConnections: 0,
        cacheHitRate: 0
      };
    }
  }

  /**
   * Get user behavior context
   */
  async getUserContext() {
    try {
      const endTime = Date.now();
      const startTime = endTime - (60 * 60 * 1000); // Last hour
      
      const userQuery = `
        SELECT 
          COUNT(*) as total_analyses,
          COUNT(DISTINCT session_id) as unique_sessions,
          AVG(response_time_ms) as avg_response_time,
          SUM(CASE WHEN approach_used = 'ai' THEN 1 ELSE 0 END) as ai_usage,
          SUM(CASE WHEN approach_used = 'system' THEN 1 ELSE 0 END) as system_usage
        FROM analysis_sections 
        WHERE created_at >= $1
      `;
      
      const result = await this.propertyDb.pool.query(userQuery, [new Date(startTime)]);
      const data = result.rows[0];
      
      return {
        hourlyVolume: parseInt(data.total_analyses) || 0,
        uniqueSessions: parseInt(data.unique_sessions) || 0,
        avgResponseTime: parseFloat(data.avg_response_time) || 0,
        aiUsageRatio: data.total_analyses > 0 ? parseInt(data.ai_usage) / parseInt(data.total_analyses) : 0,
        systemUsageRatio: data.total_analyses > 0 ? parseInt(data.system_usage) / parseInt(data.total_analyses) : 0,
        isHighVolume: parseInt(data.total_analyses) > 50,
        isLowVolume: parseInt(data.total_analyses) < 10
      };
    } catch (error) {
      console.error('Error getting user context:', error);
      return {
        hourlyVolume: 0,
        uniqueSessions: 0,
        avgResponseTime: 0,
        aiUsageRatio: 0,
        systemUsageRatio: 0,
        isHighVolume: false,
        isLowVolume: true
      };
    }
  }

  /**
   * Get business context (costs, budgets, performance)
   */
  async getBusinessContext() {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const costQuery = `
        SELECT 
          SUM(cost_usd) as monthly_cost,
          COUNT(*) as monthly_analyses,
          AVG(cost_usd) as avg_cost_per_analysis
        FROM analysis_sections 
        WHERE created_at >= $1
      `;
      
      const result = await this.propertyDb.pool.query(costQuery, [monthStart]);
      const data = result.rows[0];
      
      const monthlyCost = parseFloat(data.monthly_cost) || 0;
      const monthlyAnalyses = parseInt(data.monthly_analyses) || 0;
      
      return {
        monthlyCostSpent: monthlyCost,
        monthlyAnalyses: monthlyAnalyses,
        avgCostPerAnalysis: parseFloat(data.avg_cost_per_analysis) || 0,
        dayOfMonth: now.getDate(),
        daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
        budgetBurnRate: this.calculateBudgetBurnRate(monthlyCost, now.getDate()),
        isNearMonthEnd: now.getDate() >= 25,
        costTrend: await this.getCostTrend()
      };
    } catch (error) {
      console.error('Error getting business context:', error);
      return {
        monthlyCostSpent: 0,
        monthlyAnalyses: 0,
        avgCostPerAnalysis: 0,
        dayOfMonth: 1,
        daysInMonth: 30,
        budgetBurnRate: 0,
        isNearMonthEnd: false,
        costTrend: 'stable'
      };
    }
  }

  /**
   * Generate smart optimization adjustments based on context
   */
  generateContextualOptimizations(baseOptimizationTargets) {
    const adjustedTargets = { ...baseOptimizationTargets };
    const appliedHeuristics = [];
    
    // Time-based adjustments
    appliedHeuristics.push(...this.applyTimeBasedHeuristics(adjustedTargets));
    
    // Load-based adjustments
    appliedHeuristics.push(...this.applyLoadBasedHeuristics(adjustedTargets));
    
    // Error-based adjustments
    appliedHeuristics.push(...this.applyErrorBasedHeuristics(adjustedTargets));
    
    // User-based adjustments
    appliedHeuristics.push(...this.applyUserBasedHeuristics(adjustedTargets));
    
    // Business-based adjustments
    appliedHeuristics.push(...this.applyBusinessBasedHeuristics(adjustedTargets));
    
    this.metrics.heuristicsApplied += appliedHeuristics.length;
    
    return {
      optimizationTargets: adjustedTargets,
      appliedHeuristics: appliedHeuristics,
      contextSnapshot: { ...this.currentContext }
    };
  }

  /**
   * Apply time-based heuristics
   */
  applyTimeBasedHeuristics(targets) {
    const applied = [];
    const timeCtx = this.currentContext.timeContext;
    
    // Weekend speed boost
    if (this.heuristics.timeBasedRules.weekendSpeedBoost.enabled && timeCtx.isWeekend) {
      targets.speedImprovement = Math.max(targets.speedImprovement, 
        this.heuristics.timeBasedRules.weekendSpeedBoost.speedWeight);
      applied.push('weekend_speed_boost');
    }
    
    // Peak hours quality
    if (this.heuristics.timeBasedRules.peakHourQuality.enabled && timeCtx.isPeakHours) {
      targets.qualityMaintenance = Math.max(targets.qualityMaintenance,
        this.heuristics.timeBasedRules.peakHourQuality.qualityWeight);
      applied.push('peak_hour_quality');
    }
    
    // Late night cost saving
    if (this.heuristics.timeBasedRules.lateNightCostSaving.enabled && timeCtx.isLateNight) {
      targets.costReduction = Math.max(targets.costReduction,
        this.heuristics.timeBasedRules.lateNightCostSaving.costWeight);
      applied.push('late_night_cost_saving');
    }
    
    // Month-end budget control
    if (this.heuristics.timeBasedRules.monthEndBudgetControl.enabled && timeCtx.isMonthEnd) {
      targets.costReduction = Math.max(targets.costReduction,
        this.heuristics.timeBasedRules.monthEndBudgetControl.costWeight);
      applied.push('month_end_budget_control');
    }
    
    return applied;
  }

  /**
   * Apply load-based heuristics
   */
  applyLoadBasedHeuristics(targets) {
    const applied = [];
    const sysCtx = this.currentContext.systemContext;
    
    // High load speed priority
    if (this.heuristics.loadBasedRules.highLoadSpeedPriority.enabled && 
        sysCtx.cpuLoad > this.heuristics.loadBasedRules.highLoadSpeedPriority.threshold) {
      targets.speedImprovement = Math.max(targets.speedImprovement,
        this.heuristics.loadBasedRules.highLoadSpeedPriority.speedWeight);
      applied.push('high_load_speed_priority');
    }
    
    // Low load quality boost
    if (this.heuristics.loadBasedRules.lowLoadQualityBoost.enabled &&
        sysCtx.cpuLoad < this.heuristics.loadBasedRules.lowLoadQualityBoost.threshold) {
      targets.qualityMaintenance = Math.max(targets.qualityMaintenance,
        this.heuristics.loadBasedRules.lowLoadQualityBoost.qualityWeight);
      applied.push('low_load_quality_boost');
    }
    
    // Database stress reduction
    if (this.heuristics.loadBasedRules.databaseStressReduction.enabled &&
        sysCtx.databaseLoad > this.heuristics.loadBasedRules.databaseStressReduction.threshold) {
      targets.speedImprovement = Math.max(targets.speedImprovement,
        this.heuristics.loadBasedRules.databaseStressReduction.speedWeight);
      applied.push('database_stress_reduction');
    }
    
    return applied;
  }

  /**
   * Apply error-based heuristics
   */
  applyErrorBasedHeuristics(targets) {
    const applied = [];
    const sysCtx = this.currentContext.systemContext;
    
    // High error rate conservative approach
    if (this.heuristics.errorBasedRules.highErrorConservative.enabled &&
        sysCtx.errorRate > this.heuristics.errorBasedRules.highErrorConservative.threshold) {
      // This will be used by the calling service to increase confidence thresholds
      applied.push('high_error_conservative');
    }
    
    // Recent failures caution
    const recentErrors = this.getRecentErrorCount(
      this.heuristics.errorBasedRules.recentFailuresCaution.lookbackHours
    );
    if (this.heuristics.errorBasedRules.recentFailuresCaution.enabled && recentErrors > 5) {
      applied.push('recent_failures_caution');
    }
    
    return applied;
  }

  /**
   * Apply user-based heuristics
   */
  applyUserBasedHeuristics(targets) {
    const applied = [];
    const userCtx = this.currentContext.userContext;
    
    // High volume efficiency
    if (this.heuristics.userBasedRules.highVolumeEfficiency.enabled && userCtx.isHighVolume) {
      targets.speedImprovement = Math.max(targets.speedImprovement,
        this.heuristics.userBasedRules.highVolumeEfficiency.speedWeight);
      applied.push('high_volume_efficiency');
    }
    
    // Low volume quality focus
    if (userCtx.isLowVolume) {
      targets.qualityMaintenance = Math.max(targets.qualityMaintenance, 0.5);
      applied.push('low_volume_quality_focus');
    }
    
    return applied;
  }

  /**
   * Apply business-based heuristics
   */
  applyBusinessBasedHeuristics(targets) {
    const applied = [];
    const bizCtx = this.currentContext.businessContext;
    
    // Budget burn rate control
    if (bizCtx.budgetBurnRate > 1.2) { // Spending 20% faster than expected
      targets.costReduction = Math.max(targets.costReduction, 0.5);
      applied.push('budget_burn_control');
    }
    
    // Cost trend management
    if (bizCtx.costTrend === 'increasing') {
      targets.costReduction = Math.max(targets.costReduction, 0.4);
      applied.push('cost_trend_management');
    }
    
    return applied;
  }

  /**
   * Get confidence threshold adjustments based on context
   */
  getConfidenceThresholdAdjustments() {
    const adjustments = {};
    const sysCtx = this.currentContext.systemContext;
    
    // Error-based adjustments
    if (sysCtx.errorRate > this.heuristics.errorBasedRules.highErrorConservative.threshold) {
      adjustments.confidenceThreshold = this.heuristics.errorBasedRules.highErrorConservative.confidenceBoost;
      adjustments.reason = 'high_error_rate';
    }
    
    const recentErrors = this.getRecentErrorCount(2);
    if (recentErrors > 5) {
      adjustments.confidenceThreshold = Math.max(
        adjustments.confidenceThreshold || 0,
        this.heuristics.errorBasedRules.recentFailuresCaution.confidenceBoost
      );
      adjustments.reason = 'recent_failures';
    }
    
    return adjustments;
  }

  // Helper methods
  isPeakHours(hour) {
    // Business hours: 9 AM - 5 PM weekdays, 10 AM - 6 PM weekends
    const isWeekday = this.currentContext.timeContext.dayOfWeek >= 1 && 
                     this.currentContext.timeContext.dayOfWeek <= 5;
    
    if (isWeekday) {
      return hour >= 9 && hour <= 17;
    } else {
      return hour >= 10 && hour <= 18;
    }
  }

  async getDatabaseLoad() {
    try {
      const result = await this.propertyDb.pool.query('SELECT COUNT(*) FROM pg_stat_activity WHERE state = $1', ['active']);
      const activeConnections = parseInt(result.rows[0].count);
      // Rough estimate: >20 active connections = high load
      return Math.min(100, (activeConnections / 20) * 100);
    } catch (error) {
      return 0;
    }
  }

  calculateBudgetBurnRate(spentSoFar, dayOfMonth) {
    const daysInMonth = this.currentContext.businessContext.daysInMonth || 30;
    const expectedSpendRate = dayOfMonth / daysInMonth;
    const actualSpendRate = spentSoFar / (this.estimateMonthlyBudget() || 1);
    return actualSpendRate / expectedSpendRate;
  }

  estimateMonthlyBudget() {
    // Estimate based on historical spending - simplified for now
    return 100; // £100 monthly budget estimate
  }

  async getCostTrend() {
    try {
      const last7Days = `
        SELECT DATE(created_at) as date, SUM(cost_usd) as daily_cost 
        FROM analysis_sections 
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at) 
        ORDER BY date
      `;
      
      const result = await this.propertyDb.pool.query(last7Days);
      const costs = result.rows.map(row => parseFloat(row.daily_cost));
      
      if (costs.length < 3) return 'stable';
      
      const recentAvg = costs.slice(-3).reduce((sum, cost) => sum + cost, 0) / 3;
      const olderAvg = costs.slice(0, -3).reduce((sum, cost) => sum + cost, 0) / (costs.length - 3);
      
      if (recentAvg > olderAvg * 1.2) return 'increasing';
      if (recentAvg < olderAvg * 0.8) return 'decreasing';
      return 'stable';
    } catch (error) {
      return 'stable';
    }
  }

  getRecentErrorCount(hours) {
    // Simplified - would query actual error logs
    return Math.floor(Math.random() * 10); // Mock implementation
  }

  async analyzeContextPatterns() {
    // Analyze patterns in context history for learning
    console.log('🔍 Analyzing context patterns...');
    
    if (this.contextHistory.length < 10) return;
    
    // Find patterns in optimization effectiveness by context
    // This could be expanded to learn which heuristics work best when
    
    this.metrics.contextSwitches++;
  }

  /**
   * Get context awareness status and metrics
   */
  getContextStatus() {
    return {
      currentContext: this.currentContext,
      heuristics: this.heuristics,
      metrics: this.metrics,
      lastUpdate: this.metrics.lastContextUpdate,
      historySize: this.contextHistory.length
    };
  }

  /**
   * Update heuristic configuration
   */
  updateHeuristics(newHeuristics) {
    this.heuristics = { ...this.heuristics, ...newHeuristics };
    console.log('✅ Context heuristics updated');
  }
}

module.exports = ContextAwarenessService; 