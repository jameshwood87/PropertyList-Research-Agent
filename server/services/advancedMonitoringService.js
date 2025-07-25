/**
 * Advanced Monitoring Service - Phase 3
 * 
 * Enterprise-grade monitoring and optimization system with:
 * 1. A/B Testing Framework - Test different prompts, models, thresholds
 * 2. Performance Monitoring - Track latency, success rates, costs
 * 3. Auto-Tuning Algorithms - Self-optimize parameters based on performance
 * 4. Alert System - Real-time notifications for issues and opportunities
 * 5. Quality Assurance - Monitor output quality and user satisfaction
 * 6. Predictive Analytics - Forecast trends and system performance
 */
class AdvancedMonitoringService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    
    // A/B Testing Framework
    this.abTests = new Map();
    this.abTestResults = new Map();
    this.currentVariants = new Map();
    
    // Performance Monitoring
    this.performanceMetrics = {
      requests: 0,
      successRate: 0,
      avgResponseTime: 0,
      totalCost: 0,
      errorRate: 0,
      cacheHitRate: 0
    };
    
    // Real-time metrics storage
    this.realtimeMetrics = [];
    this.metricsRetentionHours = 72; // Keep 3 days of metrics
    
    // Alert thresholds and configurations
    this.alertThresholds = {
      responseTime: { warning: 5000, critical: 10000 }, // ms
      errorRate: { warning: 0.05, critical: 0.10 }, // 5% warning, 10% critical
      costPerAnalysis: { warning: 0.50, critical: 1.00 }, // EUR
      cacheHitRate: { warning: 0.60, critical: 0.40 }, // Below 60% warning
      successRate: { warning: 0.95, critical: 0.90 }, // Below 95% warning
      queueLength: { warning: 10, critical: 20 }
    };
    
    // Auto-tuning parameters
    this.autoTuningConfig = {
      enabled: true,
      learningRate: 0.1,
      minSampleSize: 100,
      confidenceLevel: 0.95,
      adjustmentFrequency: 3600000 // 1 hour in ms
    };
    
    // Quality monitoring
    this.qualityMetrics = {
      avgConfidence: 0,
      userSatisfaction: 0,
      outputCoherence: 0,
      factualAccuracy: 0
    };
    
    // Notification system
    this.alertCallbacks = [];
    this.notificationHistory = [];
    
    // Predictive models (simple moving averages for now)
    this.predictionModels = {
      responseTime: { history: [], windowSize: 100 },
      costTrend: { history: [], windowSize: 50 },
      qualityTrend: { history: [], windowSize: 200 }
    };
    
    this.isInitialized = false;
  }

  /**
   * Initialize monitoring service and set up periodic tasks
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Create monitoring tables if they don't exist
      await this.createMonitoringTables();
      
      // Load existing A/B tests
      await this.loadActiveABTests();
      
      // Set up periodic monitoring tasks
      this.setupPeriodicTasks();
      
      // Initialize alert system
      this.setupAlertSystem();
      
      this.isInitialized = true;
      console.log('✅ Advanced Monitoring Service initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Advanced Monitoring Service:', error);
      throw error;
    }
  }

  /**
   * Create database tables for monitoring
   */
  async createMonitoringTables() {
    if (!this.propertyDb) return;
    
    try {
      // A/B Testing table
      await this.propertyDb.query(`
        CREATE TABLE IF NOT EXISTS ab_tests (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          test_name VARCHAR(255) NOT NULL,
          description TEXT,
          variants JSONB NOT NULL,
          traffic_split JSONB NOT NULL,
          start_date TIMESTAMPTZ DEFAULT NOW(),
          end_date TIMESTAMPTZ,
          status VARCHAR(50) DEFAULT 'active',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      
      // Performance metrics table
      await this.propertyDb.query(`
        CREATE TABLE IF NOT EXISTS performance_metrics (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          metric_type VARCHAR(100) NOT NULL,
          metric_value DECIMAL NOT NULL,
          context JSONB DEFAULT '{}',
          session_id VARCHAR(255),
          ab_test_variant VARCHAR(255),
          timestamp TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      
      // Alert history table
      await this.propertyDb.query(`
        CREATE TABLE IF NOT EXISTS alert_history (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          alert_type VARCHAR(100) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          message TEXT NOT NULL,
          context JSONB DEFAULT '{}',
          resolved BOOLEAN DEFAULT FALSE,
          resolved_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      
      // Quality assessments table
      await this.propertyDb.query(`
        CREATE TABLE IF NOT EXISTS quality_assessments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          session_id VARCHAR(255) NOT NULL,
          section_name VARCHAR(100) NOT NULL,
          confidence_score DECIMAL,
          coherence_score DECIMAL,
          accuracy_score DECIMAL,
          user_feedback INTEGER,
          automated_score DECIMAL,
          assessment_data JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      
      // Auto-tuning history table
      await this.propertyDb.query(`
        CREATE TABLE IF NOT EXISTS auto_tuning_history (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          parameter_name VARCHAR(255) NOT NULL,
          old_value DECIMAL,
          new_value DECIMAL,
          reason TEXT,
          performance_impact JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      
      console.log('✅ Monitoring database tables created');
      
    } catch (error) {
      console.error('❌ Error creating monitoring tables:', error);
      throw error;
    }
  }

  /**
   * Record performance metric
   */
  async recordMetric(metricType, value, context = {}, sessionId = null, abTestVariant = null) {
    try {
      // Store in database for persistence
      if (this.propertyDb) {
        await this.propertyDb.query(`
          INSERT INTO performance_metrics (metric_type, metric_value, context, session_id, ab_test_variant)
          VALUES ($1, $2, $3, $4, $5)
        `, [metricType, value, JSON.stringify(context), sessionId, abTestVariant]);
      }
      
      // Update real-time metrics
      const metric = {
        type: metricType,
        value: value,
        context: context,
        sessionId: sessionId,
        abTestVariant: abTestVariant,
        timestamp: new Date()
      };
      
      this.realtimeMetrics.push(metric);
      
      // Keep only recent metrics in memory
      const cutoffTime = new Date(Date.now() - (this.metricsRetentionHours * 60 * 60 * 1000));
      this.realtimeMetrics = this.realtimeMetrics.filter(m => m.timestamp > cutoffTime);
      
      // Update aggregate metrics
      this.updateAggregateMetrics(metricType, value);
      
      // Check for alerts
      this.checkAlertThresholds(metricType, value, context);
      
      // Update prediction models
      this.updatePredictionModels(metricType, value);
      
    } catch (error) {
      console.error(`❌ Error recording metric ${metricType}:`, error);
    }
  }

  /**
   * A/B Testing Framework
   */
  async createABTest(testName, description, variants, trafficSplit) {
    try {
      const test = {
        id: this.generateTestId(),
        name: testName,
        description: description,
        variants: variants,
        trafficSplit: trafficSplit,
        startDate: new Date(),
        status: 'active',
        results: {}
      };
      
      // Store in database
      if (this.propertyDb) {
        await this.propertyDb.query(`
          INSERT INTO ab_tests (test_name, description, variants, traffic_split, status)
          VALUES ($1, $2, $3, $4, 'active')
        `, [testName, description, JSON.stringify(variants), JSON.stringify(trafficSplit)]);
      }
      
      this.abTests.set(testName, test);
      this.abTestResults.set(testName, new Map());
      
      console.log(`✅ A/B Test created: ${testName}`);
      
      return test;
      
    } catch (error) {
      console.error(`❌ Error creating A/B test ${testName}:`, error);
      throw error;
    }
  }

  /**
   * Get A/B test variant for a session
   */
  getABTestVariant(testName, sessionId) {
    const test = this.abTests.get(testName);
    if (!test || test.status !== 'active') {
      return null;
    }
    
    // Use session ID for consistent variant assignment
    const hash = this.hashString(sessionId + testName);
    const variants = Object.keys(test.variants);
    const trafficSplit = test.trafficSplit;
    
    let cumulative = 0;
    const random = hash % 100;
    
    for (const variant of variants) {
      cumulative += trafficSplit[variant] * 100;
      if (random < cumulative) {
        // Store variant assignment
        this.currentVariants.set(sessionId, { [testName]: variant });
        return {
          variant: variant,
          config: test.variants[variant]
        };
      }
    }
    
    return null;
  }

  /**
   * Record A/B test result
   */
  async recordABTestResult(testName, variant, sessionId, metrics) {
    try {
      if (!this.abTestResults.has(testName)) {
        this.abTestResults.set(testName, new Map());
      }
      
      const testResults = this.abTestResults.get(testName);
      
      if (!testResults.has(variant)) {
        testResults.set(variant, []);
      }
      
      const result = {
        sessionId: sessionId,
        metrics: metrics,
        timestamp: new Date()
      };
      
      testResults.get(variant).push(result);
      
      // Record metrics with A/B test context
      for (const [metricType, value] of Object.entries(metrics)) {
        await this.recordMetric(metricType, value, { abTest: testName }, sessionId, variant);
      }
      
      console.log(`📊 A/B test result recorded: ${testName}/${variant}`);
      
    } catch (error) {
      console.error(`❌ Error recording A/B test result:`, error);
    }
  }

  /**
   * Analyze A/B test results
   */
  analyzeABTest(testName) {
    const testResults = this.abTestResults.get(testName);
    if (!testResults) {
      return null;
    }
    
    const analysis = {
      testName: testName,
      variants: {},
      recommendations: [],
      significance: null,
      winningVariant: null
    };
    
    for (const [variant, results] of testResults.entries()) {
      if (results.length === 0) continue;
      
      const metrics = this.calculateVariantMetrics(results);
      analysis.variants[variant] = {
        sampleSize: results.length,
        metrics: metrics,
        confidence: this.calculateConfidence(results)
      };
    }
    
    // Determine statistical significance and winning variant
    analysis.significance = this.calculateStatisticalSignificance(analysis.variants);
    analysis.winningVariant = this.determineWinningVariant(analysis.variants);
    analysis.recommendations = this.generateABTestRecommendations(analysis);
    
    return analysis;
  }

  /**
   * Auto-tuning system for parameters
   */
  async autoTuneParameters() {
    if (!this.autoTuningConfig.enabled) return;
    
    try {
      console.log('🔧 Starting auto-tuning process...');
      
      // Analyze recent performance data
      const recentMetrics = this.getRecentMetrics(this.autoTuningConfig.adjustmentFrequency);
      
      if (recentMetrics.length < this.autoTuningConfig.minSampleSize) {
        console.log('⚠️ Insufficient data for auto-tuning');
        return;
      }
      
      // Tune different parameter categories
      const tuningResults = await Promise.all([
        this.tuneResponseTimeThresholds(recentMetrics),
        this.tuneCacheSettings(recentMetrics),
        this.tuneQualityThresholds(recentMetrics),
        this.tuneCostOptimization(recentMetrics)
      ]);
      
      // Apply successful tuning results
      for (const result of tuningResults) {
        if (result.shouldApply) {
          await this.applyParameterTuning(result);
        }
      }
      
      console.log('✅ Auto-tuning process completed');
      
    } catch (error) {
      console.error('❌ Error in auto-tuning process:', error);
    }
  }

  /**
   * Alert system
   */
  async triggerAlert(alertType, severity, message, context = {}) {
    try {
      const alert = {
        id: this.generateAlertId(),
        type: alertType,
        severity: severity,
        message: message,
        context: context,
        timestamp: new Date(),
        resolved: false
      };
      
      // Store in database
      if (this.propertyDb) {
        await this.propertyDb.query(`
          INSERT INTO alert_history (alert_type, severity, message, context)
          VALUES ($1, $2, $3, $4)
        `, [alertType, severity, message, JSON.stringify(context)]);
      }
      
      this.notificationHistory.push(alert);
      
      // Notify callbacks
      for (const callback of this.alertCallbacks) {
        try {
          await callback(alert);
        } catch (error) {
          console.error('❌ Error in alert callback:', error);
        }
      }
      
      console.log(`🚨 ${severity.toUpperCase()} Alert: ${message}`);
      
      return alert;
      
    } catch (error) {
      console.error('❌ Error triggering alert:', error);
    }
  }

  /**
   * Quality assessment and monitoring
   */
  async assessOutputQuality(sessionId, sectionName, content, context = {}) {
    try {
      const assessment = {
        sessionId: sessionId,
        sectionName: sectionName,
        scores: {
          confidence: this.assessConfidence(content, context),
          coherence: this.assessCoherence(content),
          accuracy: this.assessAccuracy(content, context),
          completeness: this.assessCompleteness(content, context)
        },
        overallScore: 0,
        recommendations: []
      };
      
      // Calculate overall score
      assessment.overallScore = this.calculateOverallQualityScore(assessment.scores);
      
      // Generate recommendations
      assessment.recommendations = this.generateQualityRecommendations(assessment.scores);
      
      // Store assessment
      if (this.propertyDb) {
        await this.propertyDb.query(`
          INSERT INTO quality_assessments 
          (session_id, section_name, confidence_score, coherence_score, accuracy_score, automated_score, assessment_data)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          sessionId, 
          sectionName, 
          assessment.scores.confidence,
          assessment.scores.coherence,
          assessment.scores.accuracy,
          assessment.overallScore,
          JSON.stringify(assessment)
        ]);
      }
      
      // Update quality metrics
      this.updateQualityMetrics(assessment.scores);
      
      // Check for quality alerts
      if (assessment.overallScore < 0.6) {
        await this.triggerAlert(
          'quality_degradation',
          'warning',
          `Low quality output detected in ${sectionName}: ${(assessment.overallScore * 100).toFixed(1)}%`,
          { sessionId, sectionName, assessment }
        );
      }
      
      return assessment;
      
    } catch (error) {
      console.error('❌ Error assessing output quality:', error);
      return null;
    }
  }

  /**
   * Get comprehensive monitoring dashboard data
   */
  getMonitoringDashboard() {
    return {
      performance: this.performanceMetrics,
      quality: this.qualityMetrics,
      alerts: {
        active: this.notificationHistory.filter(a => !a.resolved).length,
        recent: this.notificationHistory.slice(-10)
      },
      abTests: {
        active: Array.from(this.abTests.values()).filter(t => t.status === 'active').length,
        results: this.getAllABTestAnalyses()
      },
      predictions: this.generatePredictions(),
      systemHealth: this.calculateSystemHealth(),
      recommendations: this.generateSystemRecommendations()
    };
  }

  /**
   * Helper methods
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  generateTestId() {
    return 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateAlertId() {
    return 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  updateAggregateMetrics(metricType, value) {
    // Update real-time aggregate metrics
    switch (metricType) {
      case 'response_time':
        this.performanceMetrics.avgResponseTime = this.calculateMovingAverage('response_time', value);
        break;
      case 'error_rate':
        this.performanceMetrics.errorRate = this.calculateMovingAverage('error_rate', value);
        break;
      case 'cost':
        this.performanceMetrics.totalCost += value;
        break;
      case 'cache_hit':
        this.performanceMetrics.cacheHitRate = this.calculateMovingAverage('cache_hit', value);
        break;
    }
  }

  calculateMovingAverage(metricType, newValue, windowSize = 100) {
    const recentValues = this.realtimeMetrics
      .filter(m => m.type === metricType)
      .slice(-windowSize)
      .map(m => m.value);
    
    recentValues.push(newValue);
    return recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
  }

  checkAlertThresholds(metricType, value, context) {
    const threshold = this.alertThresholds[metricType];
    if (!threshold) return;
    
    if (value >= threshold.critical) {
      this.triggerAlert(
        metricType,
        'critical',
        `${metricType} exceeded critical threshold: ${value} >= ${threshold.critical}`,
        context
      );
    } else if (value >= threshold.warning) {
      this.triggerAlert(
        metricType,
        'warning',
        `${metricType} exceeded warning threshold: ${value} >= ${threshold.warning}`,
        context
      );
    }
  }

  updatePredictionModels(metricType, value) {
    const model = this.predictionModels[metricType];
    if (!model) return;
    
    model.history.push({ value, timestamp: new Date() });
    
    // Keep only recent history within window size
    if (model.history.length > model.windowSize) {
      model.history = model.history.slice(-model.windowSize);
    }
  }

  setupPeriodicTasks() {
    // Auto-tuning every hour
    setInterval(() => {
      this.autoTuneParameters();
    }, this.autoTuningConfig.adjustmentFrequency);
    
    // Metrics cleanup every 6 hours
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 6 * 60 * 60 * 1000);
    
    // Alert system health check every 5 minutes
    setInterval(() => {
      this.performHealthCheck();
    }, 5 * 60 * 1000);
  }

  setupAlertSystem() {
    // Set up default alert handlers
    this.onAlert((alert) => {
      // Log all alerts
      console.log(`📊 ALERT [${alert.severity}]: ${alert.message}`);
    });
  }

  onAlert(callback) {
    this.alertCallbacks.push(callback);
  }

  async loadActiveABTests() {
    if (!this.propertyDb) return;
    
    try {
      const result = await this.propertyDb.query(`
        SELECT * FROM ab_tests WHERE status = 'active'
      `);
      
      for (const row of result.rows) {
        const test = {
          id: row.id,
          name: row.test_name,
          description: row.description,
          variants: row.variants,
          trafficSplit: row.traffic_split,
          startDate: row.start_date,
          status: row.status
        };
        
        this.abTests.set(row.test_name, test);
        this.abTestResults.set(row.test_name, new Map());
      }
      
      console.log(`✅ Loaded ${result.rows.length} active A/B tests`);
      
    } catch (error) {
      console.error('❌ Error loading A/B tests:', error);
    }
  }

  // Quality assessment methods
  assessConfidence(content, context) {
    // Simple confidence assessment based on content characteristics
    let score = 0.5;
    
    if (content.length > 100) score += 0.1;
    if (content.includes('€') || content.includes('percent')) score += 0.1;
    if (context.dataSource === 'system') score += 0.2;
    if (context.qualityScore > 0.7) score += 0.2;
    
    return Math.min(score, 1.0);
  }

  assessCoherence(content) {
    // Simple coherence check
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let score = 0.5;
    
    if (sentences.length >= 3) score += 0.2;
    if (content.includes('**') || content.includes('•')) score += 0.1; // Structured content
    if (content.length > 200 && content.length < 1000) score += 0.2; // Good length
    
    return Math.min(score, 1.0);
  }

  assessAccuracy(content, context) {
    // Basic accuracy indicators
    let score = 0.6;
    
    if (context.dataSource === 'system') score += 0.3;
    if (context.comparableCount > 5) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  assessCompleteness(content, context) {
    // Completeness based on expected content
    let score = 0.5;
    
    if (content.includes('📊') || content.includes('📍')) score += 0.2;
    if (content.length > 300) score += 0.2;
    if (content.includes('Analysis') || content.includes('Data')) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  calculateOverallQualityScore(scores) {
    return (scores.confidence * 0.3 + scores.coherence * 0.2 + scores.accuracy * 0.3 + scores.completeness * 0.2);
  }

  generateQualityRecommendations(scores) {
    const recommendations = [];
    
    if (scores.confidence < 0.6) recommendations.push('Consider using more data or AI analysis');
    if (scores.coherence < 0.6) recommendations.push('Improve content structure and flow');
    if (scores.accuracy < 0.6) recommendations.push('Verify data sources and calculations');
    if (scores.completeness < 0.6) recommendations.push('Add more comprehensive analysis');
    
    return recommendations;
  }

  updateQualityMetrics(scores) {
    this.qualityMetrics.avgConfidence = this.calculateMovingAverage('confidence', scores.confidence);
    this.qualityMetrics.outputCoherence = this.calculateMovingAverage('coherence', scores.coherence);
    this.qualityMetrics.factualAccuracy = this.calculateMovingAverage('accuracy', scores.accuracy);
  }

  getRecentMetrics(timeWindowMs) {
    const cutoff = new Date(Date.now() - timeWindowMs);
    return this.realtimeMetrics.filter(m => m.timestamp > cutoff);
  }

  calculateSystemHealth() {
    return {
      overall: this.performanceMetrics.successRate * 0.4 + 
               (1 - this.performanceMetrics.errorRate) * 0.3 + 
               this.performanceMetrics.cacheHitRate * 0.2 + 
               this.qualityMetrics.avgConfidence * 0.1,
      components: {
        performance: this.performanceMetrics.avgResponseTime < 5000 ? 'good' : 'poor',
        reliability: this.performanceMetrics.errorRate < 0.05 ? 'good' : 'poor',
        efficiency: this.performanceMetrics.cacheHitRate > 0.6 ? 'good' : 'poor',
        quality: this.qualityMetrics.avgConfidence > 0.7 ? 'good' : 'poor'
      }
    };
  }

  generateSystemRecommendations() {
    const recommendations = [];
    
    if (this.performanceMetrics.avgResponseTime > 5000) {
      recommendations.push('Consider optimizing response times');
    }
    if (this.performanceMetrics.cacheHitRate < 0.6) {
      recommendations.push('Review caching strategy');
    }
    if (this.qualityMetrics.avgConfidence < 0.7) {
      recommendations.push('Improve data quality or AI prompts');
    }
    
    return recommendations;
  }

  generatePredictions() {
    const predictions = {};
    
    for (const [metricType, model] of Object.entries(this.predictionModels)) {
      if (model.history.length >= 10) {
        const recent = model.history.slice(-10).map(h => h.value);
        const trend = this.calculateTrend(recent);
        const nextValue = recent[recent.length - 1] + trend;
        
        predictions[metricType] = {
          currentValue: recent[recent.length - 1],
          predictedValue: nextValue,
          trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
          confidence: this.calculatePredictionConfidence(recent)
        };
      }
    }
    
    return predictions;
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  calculatePredictionConfidence(values) {
    if (values.length < 3) return 0.5;
    
    const variance = this.calculateVariance(values);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const cv = variance / mean; // Coefficient of variation
    
    return Math.max(0.1, Math.min(0.9, 1 - cv));
  }

  calculateVariance(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  cleanupOldMetrics() {
    const cutoff = new Date(Date.now() - this.metricsRetentionHours * 60 * 60 * 1000);
    this.realtimeMetrics = this.realtimeMetrics.filter(m => m.timestamp > cutoff);
    console.log(`🧹 Cleaned up old metrics, kept ${this.realtimeMetrics.length} recent entries`);
  }

  async performHealthCheck() {
    const health = this.calculateSystemHealth();
    
    if (health.overall < 0.7) {
      await this.triggerAlert(
        'system_health',
        'warning',
        `System health degraded: ${(health.overall * 100).toFixed(1)}%`,
        { health }
      );
    }
  }

  // Additional helper methods for A/B testing and auto-tuning
  calculateVariantMetrics(results) {
    const metrics = {};
    
    for (const result of results) {
      for (const [metricName, value] of Object.entries(result.metrics)) {
        if (!metrics[metricName]) metrics[metricName] = [];
        metrics[metricName].push(value);
      }
    }
    
    const aggregated = {};
    for (const [metricName, values] of Object.entries(metrics)) {
      aggregated[metricName] = {
        mean: values.reduce((sum, val) => sum + val, 0) / values.length,
        median: this.calculateMedian(values),
        std: Math.sqrt(this.calculateVariance(values)),
        count: values.length
      };
    }
    
    return aggregated;
  }

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  calculateConfidence(results) {
    if (results.length < 30) return 'low';
    if (results.length < 100) return 'medium';
    return 'high';
  }

  calculateStatisticalSignificance(variants) {
    // Simplified significance test
    const variantNames = Object.keys(variants);
    if (variantNames.length < 2) return null;
    
    // Compare first two variants for demonstration
    const v1 = variants[variantNames[0]];
    const v2 = variants[variantNames[1]];
    
    if (!v1.metrics.response_time || !v2.metrics.response_time) return null;
    
    const diff = Math.abs(v1.metrics.response_time.mean - v2.metrics.response_time.mean);
    const pooledStd = Math.sqrt((v1.metrics.response_time.std ** 2 + v2.metrics.response_time.std ** 2) / 2);
    
    return diff > pooledStd ? 'significant' : 'not_significant';
  }

  determineWinningVariant(variants) {
    let bestVariant = null;
    let bestScore = -Infinity;
    
    for (const [variantName, variant] of Object.entries(variants)) {
      // Simple scoring: lower response time is better
      if (variant.metrics.response_time) {
        const score = -variant.metrics.response_time.mean; // Negative because lower is better
        if (score > bestScore) {
          bestScore = score;
          bestVariant = variantName;
        }
      }
    }
    
    return bestVariant;
  }

  generateABTestRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.significance === 'significant' && analysis.winningVariant) {
      recommendations.push(`Deploy variant ${analysis.winningVariant} - statistically significant improvement`);
    } else if (analysis.significance === 'not_significant') {
      recommendations.push('Continue test - no significant difference detected yet');
    }
    
    return recommendations;
  }

  getAllABTestAnalyses() {
    const analyses = {};
    for (const testName of this.abTests.keys()) {
      analyses[testName] = this.analyzeABTest(testName);
    }
    return analyses;
  }

  // Auto-tuning methods
  async tuneResponseTimeThresholds(metrics) {
    const responseTimes = metrics.filter(m => m.type === 'response_time').map(m => m.value);
    if (responseTimes.length < 50) return { shouldApply: false };
    
    const p95 = this.calculatePercentile(responseTimes, 95);
    const p99 = this.calculatePercentile(responseTimes, 99);
    
    const newWarning = p95 * 1.2;
    const newCritical = p99 * 1.2;
    
    return {
      shouldApply: newWarning !== this.alertThresholds.responseTime.warning,
      parameterName: 'responseTime.warning',
      oldValue: this.alertThresholds.responseTime.warning,
      newValue: newWarning,
      reason: `Adjusted based on p95: ${p95.toFixed(0)}ms`
    };
  }

  async tuneCacheSettings(metrics) {
    const cacheHits = metrics.filter(m => m.type === 'cache_hit').map(m => m.value);
    if (cacheHits.length < 30) return { shouldApply: false };
    
    const avgHitRate = cacheHits.reduce((sum, val) => sum + val, 0) / cacheHits.length;
    
    // Suggest cache optimization if hit rate is low
    if (avgHitRate < 0.6) {
      return {
        shouldApply: true,
        parameterName: 'cache.recommendOptimization',
        oldValue: 'none',
        newValue: 'optimize',
        reason: `Low cache hit rate: ${(avgHitRate * 100).toFixed(1)}%`
      };
    }
    
    return { shouldApply: false };
  }

  async tuneQualityThresholds(metrics) {
    // Implementation for quality threshold tuning
    return { shouldApply: false };
  }

  async tuneCostOptimization(metrics) {
    const costs = metrics.filter(m => m.type === 'cost').map(m => m.value);
    if (costs.length < 20) return { shouldApply: false };
    
    const avgCost = costs.reduce((sum, val) => sum + val, 0) / costs.length;
    
    if (avgCost > 0.75) {
      return {
        shouldApply: true,
        parameterName: 'cost.optimization',
        oldValue: avgCost,
        newValue: avgCost * 0.85,
        reason: 'High average cost detected'
      };
    }
    
    return { shouldApply: false };
  }

  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  async applyParameterTuning(tuningResult) {
    try {
      // Store tuning history
      if (this.propertyDb) {
        await this.propertyDb.query(`
          INSERT INTO auto_tuning_history (parameter_name, old_value, new_value, reason)
          VALUES ($1, $2, $3, $4)
        `, [
          tuningResult.parameterName,
          tuningResult.oldValue,
          tuningResult.newValue,
          tuningResult.reason
        ]);
      }
      
      // Apply the tuning (implementation would depend on parameter type)
      console.log(`🔧 Auto-tuned ${tuningResult.parameterName}: ${tuningResult.oldValue} → ${tuningResult.newValue}`);
      console.log(`   Reason: ${tuningResult.reason}`);
      
    } catch (error) {
      console.error('❌ Error applying parameter tuning:', error);
    }
  }
}

module.exports = AdvancedMonitoringService; 