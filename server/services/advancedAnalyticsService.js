/**
 * Advanced Analytics Service - Phase 3 Enhancement
 * 
 * Implements sophisticated analytics for deep business insights
 * and proactive optimization without external AI costs.
 * 
 * Features:
 * - Time Series Analysis: Seasonal patterns and forecasting
 * - Anomaly Detection: Unusual behavior identification
 * - Correlation Analysis: Find relationships between metrics
 * - Trend Detection: Long-term pattern recognition
 * - Predictive Alerts: Proactive issue detection
 * - Zero External Dependencies: All analytics run locally
 */

class AdvancedAnalyticsService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    
    // Analytics engines
    this.analytics = {
      timeSeriesAnalyzer: new TimeSeriesAnalyzer(),
      anomalyDetector: new AnomalyDetector(),
      correlationFinder: new CorrelationAnalysis(),
      trendDetector: new TrendDetector()
    };
    
    // Historical data for analysis
    this.analyticsData = {
      timeSeries: [],
      metrics: [],
      events: [],
      patterns: []
    };
    
    // Analysis results and insights
    this.insights = {
      seasonalPatterns: [],
      anomalies: [],
      correlations: [],
      trends: [],
      alerts: []
    };
    
    // Configuration
    this.config = {
      analysisWindow: 30 * 24 * 60 * 60 * 1000, // 30 days
      alertThresholds: {
        costSpike: 1.5,        // 50% increase
        qualityDrop: 0.8,      // 20% decrease
        errorIncrease: 2.0,    // 100% increase
        responseTimeSpike: 2.0 // 100% increase
      },
      seasonalityPeriods: [24, 168, 720], // Hourly, weekly, monthly patterns
      trendConfidence: 0.7,
      anomalyThreshold: 2.5 // Standard deviations
    };
    
    // Performance metrics
    this.metrics = {
      analysesPerformed: 0,
      anomaliesDetected: 0,
      trendsIdentified: 0,
      alertsGenerated: 0,
      lastAnalysis: null
    };
    
    this.isInitialized = false;
    this.initializeAnalytics();
  }

  /**
   * Initialize analytics service
   */
  async initializeAnalytics() {
    console.log('📊 Initializing Advanced Analytics Service...');
    
    try {
      // Load historical data
      await this.loadAnalyticsData();
      
      // Perform initial analysis
      await this.performFullAnalysis();
      
      // Start periodic analysis
      this.startPeriodicAnalysis();
      
      this.isInitialized = true;
      console.log('✅ Advanced Analytics Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Advanced Analytics Service:', error);
    }
  }

  /**
   * Load historical data for analytics
   */
  async loadAnalyticsData() {
    try {
      console.log('📈 Loading analytics data...');
      
      // Load time series data
      this.analyticsData.timeSeries = await this.loadTimeSeriesData();
      
      // Load performance metrics
      this.analyticsData.metrics = await this.loadMetricsData();
      
      // Load system events
      this.analyticsData.events = await this.loadEventData();
      
      console.log(`✅ Loaded analytics data: ${this.analyticsData.timeSeries.length} time series, ${this.analyticsData.metrics.length} metrics`);
    } catch (error) {
      console.error('❌ Error loading analytics data:', error);
    }
  }

  /**
   * Load time series data
   */
  async loadTimeSeriesData() {
    const query = `
      SELECT 
        DATE_TRUNC('hour', created_at) as timestamp,
        COUNT(*) as analysis_count,
        AVG(cost_usd) as avg_cost,
        AVG(confidence_score) as avg_quality,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN approach_used = 'ai' THEN 1 ELSE 0 END) as ai_count,
        SUM(CASE WHEN approach_used = 'system' THEN 1 ELSE 0 END) as system_count
      FROM analysis_sections 
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY timestamp
    `;
    
    const result = await this.propertyDb.pool.query(query);
    
    return result.rows.map(row => ({
      timestamp: new Date(row.timestamp),
      analysisCount: parseInt(row.analysis_count),
      avgCost: parseFloat(row.avg_cost) || 0,
      avgQuality: parseFloat(row.avg_quality) || 0,
      avgResponseTime: parseFloat(row.avg_response_time) || 0,
      aiUsageRatio: parseInt(row.ai_count) / parseInt(row.analysis_count),
      systemUsageRatio: parseInt(row.system_count) / parseInt(row.analysis_count)
    }));
  }

  /**
   * Load metrics data
   */
  async loadMetricsData() {
    const query = `
      SELECT 
        section_name,
        threshold_config,
        avg_cost,
        avg_quality,
        avg_response_time,
        success_rate,
        cost_efficiency_score,
        created_at
      FROM threshold_performance 
      WHERE created_at >= NOW() - INTERVAL '30 days'
      ORDER BY created_at
    `;
    
    const result = await this.propertyDb.pool.query(query);
    
    return result.rows.map(row => ({
      section: row.section_name,
      thresholds: JSON.parse(row.threshold_config),
      cost: parseFloat(row.avg_cost),
      quality: parseFloat(row.avg_quality),
      responseTime: parseFloat(row.avg_response_time),
      successRate: parseFloat(row.success_rate),
      efficiency: parseFloat(row.cost_efficiency_score),
      timestamp: new Date(row.created_at)
    }));
  }

  /**
   * Load system events
   */
  async loadEventData() {
    const query = `
      SELECT 
        old_thresholds,
        new_thresholds,
        improvement_metrics,
        confidence,
        optimization_type,
        applied_at,
        rolled_back_at
      FROM optimization_history 
      WHERE applied_at >= NOW() - INTERVAL '30 days'
      ORDER BY applied_at
    `;
    
    const result = await this.propertyDb.pool.query(query);
    
    return result.rows.map(row => ({
      type: 'optimization',
      oldThresholds: JSON.parse(row.old_thresholds),
      newThresholds: JSON.parse(row.new_thresholds),
      metrics: JSON.parse(row.improvement_metrics),
      confidence: parseFloat(row.confidence),
      optimizationType: row.optimization_type,
      timestamp: new Date(row.applied_at),
      wasRolledBack: !!row.rolled_back_at
    }));
  }

  /**
   * Perform comprehensive analysis
   */
  async performFullAnalysis() {
    console.log('🔬 Performing comprehensive analytics...');
    
    try {
      // Time series analysis
      this.insights.seasonalPatterns = this.analytics.timeSeriesAnalyzer.findSeasonalPatterns(
        this.analyticsData.timeSeries
      );
      
      // Anomaly detection
      this.insights.anomalies = this.analytics.anomalyDetector.detectAnomalies(
        this.analyticsData.timeSeries
      );
      
      // Correlation analysis
      this.insights.correlations = this.analytics.correlationFinder.findCorrelations(
        this.analyticsData.metrics
      );
      
      // Trend detection
      this.insights.trends = this.analytics.trendDetector.identifyTrends(
        this.analyticsData.timeSeries
      );
      
      // Generate alerts
      this.insights.alerts = this.generateIntelligentAlerts();
      
      this.metrics.analysesPerformed++;
      this.metrics.lastAnalysis = new Date().toISOString();
      
      console.log(`✅ Analysis complete: ${this.insights.seasonalPatterns.length} patterns, ${this.insights.anomalies.length} anomalies, ${this.insights.trends.length} trends`);
    } catch (error) {
      console.error('❌ Error performing analysis:', error);
    }
  }

  /**
   * Generate intelligent alerts based on analysis
   */
  generateIntelligentAlerts() {
    const alerts = [];
    
    // Cost spike alerts
    const recentCostTrend = this.insights.trends.find(t => t.metric === 'avgCost');
    if (recentCostTrend && recentCostTrend.trend === 'increasing' && recentCostTrend.strength > 0.7) {
      alerts.push({
        type: 'cost_spike',
        severity: 'high',
        message: `Cost trend increasing rapidly: ${(recentCostTrend.change * 100).toFixed(1)}% over ${recentCostTrend.period} hours`,
        recommendation: 'Review AI usage patterns and consider threshold adjustments',
        confidence: recentCostTrend.strength
      });
    }
    
    // Quality degradation alerts
    const qualityTrend = this.insights.trends.find(t => t.metric === 'avgQuality');
    if (qualityTrend && qualityTrend.trend === 'decreasing' && qualityTrend.strength > 0.6) {
      alerts.push({
        type: 'quality_degradation',
        severity: 'medium',
        message: `Quality declining: ${(Math.abs(qualityTrend.change) * 100).toFixed(1)}% drop over ${qualityTrend.period} hours`,
        recommendation: 'Consider increasing quality thresholds or switching to AI approach',
        confidence: qualityTrend.strength
      });
    }
    
    // Anomaly alerts
    const recentAnomalies = this.insights.anomalies.filter(a => 
      new Date(a.timestamp) > new Date(Date.now() - 2 * 60 * 60 * 1000) // Last 2 hours
    );
    
    if (recentAnomalies.length > 3) {
      alerts.push({
        type: 'system_instability',
        severity: 'critical',
        message: `${recentAnomalies.length} anomalies detected in last 2 hours`,
        recommendation: 'System may be unstable - investigate immediately',
        confidence: 0.9
      });
    }
    
    // Seasonal opportunity alerts
    const currentHour = new Date().getHours();
    const lowUsagePattern = this.insights.seasonalPatterns.find(p => 
      p.pattern === 'low_usage' && 
      p.timeOfDay === currentHour
    );
    
    if (lowUsagePattern) {
      alerts.push({
        type: 'optimization_opportunity',
        severity: 'low',
        message: `Low usage period detected - opportunity for quality optimization`,
        recommendation: 'Consider temporarily increasing quality thresholds',
        confidence: lowUsagePattern.confidence
      });
    }
    
    // Correlation insights
    const strongCorrelations = this.insights.correlations.filter(c => Math.abs(c.correlation) > 0.8);
    for (const correlation of strongCorrelations) {
      if (correlation.metric1 === 'cost' && correlation.metric2 === 'responseTime' && correlation.correlation > 0.8) {
        alerts.push({
          type: 'performance_insight',
          severity: 'info',
          message: `Strong correlation detected: Higher costs correlate with faster response times (${(correlation.correlation * 100).toFixed(1)}%)`,
          recommendation: 'Cost-speed trade-off is working as expected',
          confidence: correlation.significance
        });
      }
    }
    
    this.metrics.alertsGenerated += alerts.length;
    return alerts;
  }

  /**
   * Get seasonal recommendations
   */
  getSeasonalRecommendations() {
    const recommendations = [];
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();
    
    // Find relevant seasonal patterns
    const relevantPatterns = this.insights.seasonalPatterns.filter(pattern => {
      if (pattern.type === 'hourly') return pattern.hour === currentHour;
      if (pattern.type === 'daily') return pattern.dayOfWeek === currentDay;
      return pattern.type === 'weekly';
    });
    
    for (const pattern of relevantPatterns) {
      if (pattern.pattern === 'high_usage') {
        recommendations.push({
          type: 'seasonal_preparation',
          priority: 'medium',
          reason: `Historical data shows high usage at this time (${pattern.confidence * 100}% confidence)`,
          action: 'Optimize for speed and efficiency',
          expectedIncrease: `${pattern.avgIncrease}% more analyses expected`
        });
      } else if (pattern.pattern === 'low_usage') {
        recommendations.push({
          type: 'seasonal_opportunity',
          priority: 'low',
          reason: `Historical data shows low usage at this time (${pattern.confidence * 100}% confidence)`,
          action: 'Opportunity for quality enhancement',
          expectedDecrease: `${pattern.avgDecrease}% fewer analyses expected`
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Get correlation insights
   */
  getCorrelationInsights() {
    const insights = [];
    
    const strongCorrelations = this.insights.correlations.filter(c => 
      Math.abs(c.correlation) > 0.7 && c.significance > 0.05
    );
    
    for (const corr of strongCorrelations) {
      let interpretation = '';
      
      if (corr.metric1 === 'cost' && corr.metric2 === 'quality') {
        if (corr.correlation > 0) {
          interpretation = 'Higher costs lead to better quality - AI investment is working';
        } else {
          interpretation = 'Cost and quality are inversely related - system efficiency is high';
        }
      } else if (corr.metric1 === 'responseTime' && corr.metric2 === 'quality') {
        if (corr.correlation > 0) {
          interpretation = 'Longer processing time correlates with better quality';
        } else {
          interpretation = 'Faster responses maintain quality - system is well optimized';
        }
      }
      
      insights.push({
        metrics: `${corr.metric1} vs ${corr.metric2}`,
        correlation: corr.correlation,
        strength: Math.abs(corr.correlation) > 0.9 ? 'very strong' : 'strong',
        interpretation: interpretation,
        confidence: corr.significance
      });
    }
    
    return insights;
  }

  /**
   * Get trend forecasts
   */
  getTrendForecasts(hoursAhead = 24) {
    const forecasts = [];
    
    for (const trend of this.insights.trends) {
      if (trend.strength > 0.6) {
        const currentValue = trend.currentValue;
        const ratePerHour = trend.changeRate;
        const forecastValue = currentValue + (ratePerHour * hoursAhead);
        
        forecasts.push({
          metric: trend.metric,
          current: currentValue,
          forecast: forecastValue,
          change: ((forecastValue - currentValue) / currentValue * 100),
          confidence: trend.strength,
          trend: trend.trend,
          hoursAhead: hoursAhead
        });
      }
    }
    
    return forecasts;
  }

  /**
   * Start periodic analysis
   */
  startPeriodicAnalysis() {
    // Full analysis every 6 hours
    setInterval(async () => {
      console.log('🔄 Performing periodic analytics update...');
      await this.loadAnalyticsData();
      await this.performFullAnalysis();
    }, 6 * 60 * 60 * 1000);
    
    // Alert check every hour
    setInterval(async () => {
      const newAlerts = this.generateIntelligentAlerts();
      const criticalAlerts = newAlerts.filter(a => a.severity === 'critical');
      
      if (criticalAlerts.length > 0) {
        console.warn('🚨 Critical alerts detected:', criticalAlerts);
      }
    }, 60 * 60 * 1000);
  }

  /**
   * Get comprehensive analytics report
   */
  getAnalyticsReport() {
    return {
      summary: {
        totalAnalyses: this.metrics.analysesPerformed,
        anomaliesDetected: this.metrics.anomaliesDetected,
        trendsIdentified: this.metrics.trendsIdentified,
        activeAlerts: this.insights.alerts.length,
        lastAnalysis: this.metrics.lastAnalysis
      },
      insights: {
        seasonalPatterns: this.insights.seasonalPatterns,
        trends: this.insights.trends,
        correlations: this.getCorrelationInsights(),
        anomalies: this.insights.anomalies.slice(-10) // Last 10 anomalies
      },
      forecasts: this.getTrendForecasts(24),
      recommendations: this.getSeasonalRecommendations(),
      alerts: this.insights.alerts
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      metrics: this.metrics,
      dataSize: {
        timeSeries: this.analyticsData.timeSeries.length,
        metrics: this.analyticsData.metrics.length,
        events: this.analyticsData.events.length
      },
      insights: {
        patterns: this.insights.seasonalPatterns.length,
        anomalies: this.insights.anomalies.length,
        correlations: this.insights.correlations.length,
        trends: this.insights.trends.length,
        alerts: this.insights.alerts.length
      }
    };
  }
}

// Time Series Analysis Engine
class TimeSeriesAnalyzer {
  findSeasonalPatterns(timeSeriesData) {
    const patterns = [];
    
    // Hourly patterns
    const hourlyPattern = this.analyzeHourlyPatterns(timeSeriesData);
    patterns.push(...hourlyPattern);
    
    // Daily patterns
    const dailyPattern = this.analyzeDailyPatterns(timeSeriesData);
    patterns.push(...dailyPattern);
    
    // Weekly patterns
    const weeklyPattern = this.analyzeWeeklyPatterns(timeSeriesData);
    patterns.push(...weeklyPattern);
    
    return patterns;
  }

  analyzeHourlyPatterns(data) {
    const hourlyStats = {};
    
    // Group by hour
    for (const point of data) {
      const hour = point.timestamp.getHours();
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { analysisCount: [], avgCost: [], avgQuality: [] };
      }
      hourlyStats[hour].analysisCount.push(point.analysisCount);
      hourlyStats[hour].avgCost.push(point.avgCost);
      hourlyStats[hour].avgQuality.push(point.avgQuality);
    }
    
    const patterns = [];
    const overallAvg = this.calculateAverage(data.map(d => d.analysisCount));
    
    for (const [hour, stats] of Object.entries(hourlyStats)) {
      const avgAnalyses = this.calculateAverage(stats.analysisCount);
      const variance = this.calculateVariance(stats.analysisCount);
      
      if (avgAnalyses > overallAvg * 1.3) {
        patterns.push({
          type: 'hourly',
          hour: parseInt(hour),
          pattern: 'high_usage',
          avgIncrease: ((avgAnalyses / overallAvg - 1) * 100).toFixed(1),
          confidence: Math.min(0.95, 1 - (variance / (avgAnalyses || 1)))
        });
      } else if (avgAnalyses < overallAvg * 0.7) {
        patterns.push({
          type: 'hourly',
          hour: parseInt(hour),
          pattern: 'low_usage',
          avgDecrease: ((1 - avgAnalyses / overallAvg) * 100).toFixed(1),
          confidence: Math.min(0.95, 1 - (variance / (avgAnalyses || 1)))
        });
      }
    }
    
    return patterns;
  }

  analyzeDailyPatterns(data) {
    const dailyStats = {};
    
    // Group by day of week
    for (const point of data) {
      const day = point.timestamp.getDay();
      if (!dailyStats[day]) {
        dailyStats[day] = { analysisCount: [], avgCost: [] };
      }
      dailyStats[day].analysisCount.push(point.analysisCount);
      dailyStats[day].avgCost.push(point.avgCost);
    }
    
    const patterns = [];
    const overallAvg = this.calculateAverage(data.map(d => d.analysisCount));
    
    for (const [day, stats] of Object.entries(dailyStats)) {
      const avgAnalyses = this.calculateAverage(stats.analysisCount);
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      if (avgAnalyses > overallAvg * 1.2) {
        patterns.push({
          type: 'daily',
          dayOfWeek: parseInt(day),
          dayName: dayNames[day],
          pattern: 'high_usage',
          avgIncrease: ((avgAnalyses / overallAvg - 1) * 100).toFixed(1),
          confidence: 0.8
        });
      }
    }
    
    return patterns;
  }

  analyzeWeeklyPatterns(data) {
    // Simplified weekly pattern detection
    const weekdays = data.filter(d => d.timestamp.getDay() >= 1 && d.timestamp.getDay() <= 5);
    const weekends = data.filter(d => d.timestamp.getDay() === 0 || d.timestamp.getDay() === 6);
    
    const weekdayAvg = this.calculateAverage(weekdays.map(d => d.analysisCount));
    const weekendAvg = this.calculateAverage(weekends.map(d => d.analysisCount));
    
    const patterns = [];
    
    if (weekendAvg < weekdayAvg * 0.8) {
      patterns.push({
        type: 'weekly',
        pattern: 'weekend_low_usage',
        weekdayAvg: weekdayAvg.toFixed(1),
        weekendAvg: weekendAvg.toFixed(1),
        reduction: (((weekdayAvg - weekendAvg) / weekdayAvg) * 100).toFixed(1),
        confidence: 0.85
      });
    }
    
    return patterns;
  }

  calculateAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + (val || 0), 0) / values.length;
  }

  calculateVariance(values) {
    if (values.length === 0) return 0;
    const avg = this.calculateAverage(values);
    return values.reduce((sum, val) => sum + Math.pow((val || 0) - avg, 2), 0) / values.length;
  }
}

// Anomaly Detection Engine
class AnomalyDetector {
  detectAnomalies(timeSeriesData, threshold = 2.5) {
    const anomalies = [];
    
    // Detect anomalies in each metric
    const metrics = ['analysisCount', 'avgCost', 'avgQuality', 'avgResponseTime'];
    
    for (const metric of metrics) {
      const values = timeSeriesData.map(d => d[metric] || 0);
      const metricAnomalies = this.detectMetricAnomalies(values, timeSeriesData, metric, threshold);
      anomalies.push(...metricAnomalies);
    }
    
    return anomalies.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  detectMetricAnomalies(values, timeSeriesData, metricName, threshold) {
    const anomalies = [];
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    
    for (let i = 0; i < values.length; i++) {
      const zScore = Math.abs((values[i] - mean) / stdDev);
      
      if (zScore > threshold) {
        anomalies.push({
          timestamp: timeSeriesData[i].timestamp,
          metric: metricName,
          value: values[i],
          expectedValue: mean,
          zScore: zScore.toFixed(2),
          severity: zScore > 3 ? 'high' : 'medium',
          description: `${metricName} anomaly: ${values[i].toFixed(2)} (expected: ${mean.toFixed(2)})`
        });
      }
    }
    
    return anomalies;
  }
}

// Correlation Analysis Engine
class CorrelationAnalysis {
  findCorrelations(metricsData) {
    const correlations = [];
    const metrics = ['cost', 'quality', 'responseTime', 'efficiency'];
    
    // Calculate correlations between all metric pairs
    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        const metric1 = metrics[i];
        const metric2 = metrics[j];
        
        const values1 = metricsData.map(d => d[metric1]).filter(v => v !== undefined);
        const values2 = metricsData.map(d => d[metric2]).filter(v => v !== undefined);
        
        if (values1.length > 10 && values2.length > 10) {
          const correlation = this.calculateCorrelation(values1, values2);
          
          if (Math.abs(correlation) > 0.3) { // Only significant correlations
            correlations.push({
              metric1: metric1,
              metric2: metric2,
              correlation: correlation,
              strength: this.getCorrelationStrength(correlation),
              significance: this.calculateSignificance(correlation, values1.length)
            });
          }
        }
      }
    }
    
    return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }

  calculateCorrelation(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    
    const sumX = x.slice(0, n).reduce((sum, val) => sum + val, 0);
    const sumY = y.slice(0, n).reduce((sum, val) => sum + val, 0);
    const sumXY = x.slice(0, n).reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.slice(0, n).reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.slice(0, n).reduce((sum, val) => sum + val * val, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  getCorrelationStrength(correlation) {
    const abs = Math.abs(correlation);
    if (abs > 0.9) return 'very strong';
    if (abs > 0.7) return 'strong';
    if (abs > 0.5) return 'moderate';
    if (abs > 0.3) return 'weak';
    return 'very weak';
  }

  calculateSignificance(correlation, sampleSize) {
    // Simplified significance calculation
    const tStat = correlation * Math.sqrt((sampleSize - 2) / (1 - correlation * correlation));
    return Math.abs(tStat) > 2.0 ? 0.95 : 0.7; // Simplified p-value approximation
  }
}

// Trend Detection Engine
class TrendDetector {
  identifyTrends(timeSeriesData) {
    const trends = [];
    const metrics = ['analysisCount', 'avgCost', 'avgQuality', 'avgResponseTime'];
    
    for (const metric of metrics) {
      const trend = this.detectTrend(timeSeriesData, metric);
      if (trend) {
        trends.push(trend);
      }
    }
    
    return trends;
  }

  detectTrend(data, metricName) {
    const values = data.map(d => d[metricName] || 0);
    const timestamps = data.map(d => d.timestamp.getTime());
    
    if (values.length < 5) return null;
    
    // Simple linear regression to detect trend
    const n = values.length;
    const sumX = timestamps.reduce((sum, t) => sum + t, 0);
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = timestamps.reduce((sum, t, i) => sum + t * values[i], 0);
    const sumX2 = timestamps.reduce((sum, t) => sum + t * t, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared for trend strength
    const meanY = sumY / n;
    const ssTotal = values.reduce((sum, v) => sum + Math.pow(v - meanY, 2), 0);
    const ssResidual = values.reduce((sum, v, i) => {
      const predicted = slope * timestamps[i] + intercept;
      return sum + Math.pow(v - predicted, 2);
    }, 0);
    
    const rSquared = 1 - (ssResidual / ssTotal);
    
    if (rSquared > 0.3) { // Significant trend
      const hourlySlope = slope * (60 * 60 * 1000); // Convert to per-hour rate
      
      return {
        metric: metricName,
        trend: slope > 0 ? 'increasing' : 'decreasing',
        strength: rSquared,
        changeRate: hourlySlope,
        change: Math.abs(slope * (timestamps[n-1] - timestamps[0])) / meanY,
        period: Math.round((timestamps[n-1] - timestamps[0]) / (60 * 60 * 1000)), // hours
        currentValue: values[n-1],
        confidence: Math.min(0.95, rSquared)
      };
    }
    
    return null;
  }
}

module.exports = AdvancedAnalyticsService; 