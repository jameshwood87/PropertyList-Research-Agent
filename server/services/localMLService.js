/**
 * Local ML Service - Phase 2 Enhancement
 * 
 * Implements lightweight machine learning models that run locally
 * to provide intelligent predictions without external API costs.
 * 
 * Features:
 * - Usage Predictor: Forecasts traffic patterns and demand
 * - Performance Predictor: Predicts optimization effectiveness
 * - Error Predictor: Estimates failure probability
 * - Model Training: Uses historical data for continuous learning
 * - Zero External Dependencies: All models run locally
 */

class LocalMLService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    
    // ML Models
    this.models = {
      usagePredictor: new SimpleLinearRegression(),
      performancePredictor: new DecisionTree(),
      errorPredictor: new LogisticRegression()
    };
    
    // Training data and model state
    this.trainingData = {
      usage: [],
      performance: [],
      errors: []
    };
    
    // Model performance metrics
    this.modelMetrics = {
      usagePredictor: { accuracy: 0, lastTrained: null, predictions: 0 },
      performancePredictor: { accuracy: 0, lastTrained: null, predictions: 0 },
      errorPredictor: { accuracy: 0, lastTrained: null, predictions: 0 }
    };
    
    // Training configuration
    this.trainingConfig = {
      minTrainingSize: 30,
      retrainingInterval: 24 * 60 * 60 * 1000, // 24 hours
      maxTrainingSize: 1000,
      validationSplit: 0.2
    };
    
    this.isInitialized = false;
    this.initializeMLService();
  }

  /**
   * Initialize ML service and start training
   */
  async initializeMLService() {
    console.log('🤖 Initializing Local ML Service...');
    
    try {
      // Load historical data for training
      await this.loadTrainingData();
      
      // Initial model training if we have enough data
      await this.trainAllModels();
      
      // Start periodic retraining
      this.startPeriodicTraining();
      
      this.isInitialized = true;
      console.log('✅ Local ML Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Local ML Service:', error);
    }
  }

  /**
   * Load historical data for model training
   */
  async loadTrainingData() {
    try {
      console.log('📊 Loading training data...');
      
      // Load usage data (last 30 days)
      const usageData = await this.loadUsageTrainingData();
      this.trainingData.usage = usageData;
      
      // Load performance data
      const performanceData = await this.loadPerformanceTrainingData();
      this.trainingData.performance = performanceData;
      
      // Load error data
      const errorData = await this.loadErrorTrainingData();
      this.trainingData.errors = errorData;
      
      console.log(`✅ Loaded training data: ${usageData.length} usage, ${performanceData.length} performance, ${errorData.length} error samples`);
    } catch (error) {
      console.error('❌ Error loading training data:', error);
    }
  }

  /**
   * Load usage training data
   */
  async loadUsageTrainingData() {
    const query = `
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as analysis_count,
        EXTRACT(DOW FROM created_at) as day_of_week,
        EXTRACT(HOUR FROM created_at) as hour_of_day,
        EXTRACT(DAY FROM created_at) as day_of_month
      FROM analysis_sections 
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('hour', created_at), 
               EXTRACT(DOW FROM created_at),
               EXTRACT(HOUR FROM created_at),
               EXTRACT(DAY FROM created_at)
      ORDER BY hour
    `;
    
    const result = await this.propertyDb.pool.query(query);
    
    return result.rows.map(row => ({
      features: [
        parseFloat(row.day_of_week),
        parseFloat(row.hour_of_day), 
        parseFloat(row.day_of_month)
      ],
      target: parseInt(row.analysis_count),
      timestamp: row.hour
    }));
  }

  /**
   * Load performance training data
   */
  async loadPerformanceTrainingData() {
    const query = `
      SELECT 
        t.section_name,
        t.threshold_config,
        t.avg_cost,
        t.avg_quality,
        t.avg_response_time,
        t.sample_count,
        t.cost_efficiency_score
      FROM threshold_performance t
      WHERE t.sample_count >= 10
      ORDER BY t.created_at DESC
      LIMIT 500
    `;
    
    const result = await this.propertyDb.pool.query(query);
    
    return result.rows.map(row => {
      const thresholds = JSON.parse(row.threshold_config);
      return {
        features: [
          thresholds.nComparables || 10,
          thresholds.nAnalyses || 3,
          thresholds.qualityScore || 0.6,
          parseFloat(row.sample_count),
          parseFloat(row.avg_response_time) || 1000
        ],
        target: parseFloat(row.cost_efficiency_score) || 0.5,
        metadata: {
          section: row.section_name,
          cost: parseFloat(row.avg_cost),
          quality: parseFloat(row.avg_quality)
        }
      };
    });
  }

  /**
   * Load error training data  
   */
  async loadErrorTrainingData() {
    const query = `
      SELECT 
        session_id,
        section_name,
        approach_used,
        response_time_ms,
        confidence_score,
        created_at,
        CASE WHEN confidence_score < 0.5 THEN 1 ELSE 0 END as is_error
      FROM analysis_sections 
      WHERE created_at >= NOW() - INTERVAL '14 days'
      ORDER BY created_at DESC
      LIMIT 1000
    `;
    
    const result = await this.propertyDb.pool.query(query);
    
    return result.rows.map(row => ({
      features: [
        row.approach_used === 'ai' ? 1 : 0,
        parseFloat(row.response_time_ms) / 1000 || 1, // seconds
        parseFloat(row.confidence_score) || 0.5,
        new Date(row.created_at).getHours() // hour of day
      ],
      target: parseInt(row.is_error),
      metadata: {
        sessionId: row.session_id,
        section: row.section_name
      }
    }));
  }

  /**
   * Train all ML models
   */
  async trainAllModels() {
    console.log('🎓 Training ML models...');
    
    try {
      // Train usage predictor
      if (this.trainingData.usage.length >= this.trainingConfig.minTrainingSize) {
        await this.trainUsagePredictor();
      }
      
      // Train performance predictor
      if (this.trainingData.performance.length >= this.trainingConfig.minTrainingSize) {
        await this.trainPerformancePredictor();
      }
      
      // Train error predictor
      if (this.trainingData.errors.length >= this.trainingConfig.minTrainingSize) {
        await this.trainErrorPredictor();
      }
      
      console.log('✅ Model training completed');
    } catch (error) {
      console.error('❌ Error training models:', error);
    }
  }

  /**
   * Train usage prediction model
   */
  async trainUsagePredictor() {
    try {
      const data = this.trainingData.usage;
      const splitIndex = Math.floor(data.length * (1 - this.trainingConfig.validationSplit));
      
      const trainData = data.slice(0, splitIndex);
      const validData = data.slice(splitIndex);
      
      // Train model
      const features = trainData.map(d => d.features);
      const targets = trainData.map(d => d.target);
      
      this.models.usagePredictor.train(features, targets);
      
      // Validate model
      const accuracy = this.validateUsagePredictor(validData);
      
      this.modelMetrics.usagePredictor = {
        accuracy: accuracy,
        lastTrained: new Date().toISOString(),
        predictions: 0
      };
      
      console.log(`✅ Usage predictor trained with ${accuracy.toFixed(2)}% accuracy`);
    } catch (error) {
      console.error('❌ Error training usage predictor:', error);
    }
  }

  /**
   * Train performance prediction model
   */
  async trainPerformancePredictor() {
    try {
      const data = this.trainingData.performance;
      const splitIndex = Math.floor(data.length * (1 - this.trainingConfig.validationSplit));
      
      const trainData = data.slice(0, splitIndex);
      const validData = data.slice(splitIndex);
      
      // Train model
      const features = trainData.map(d => d.features);
      const targets = trainData.map(d => d.target);
      
      this.models.performancePredictor.train(features, targets);
      
      // Validate model
      const accuracy = this.validatePerformancePredictor(validData);
      
      this.modelMetrics.performancePredictor = {
        accuracy: accuracy,
        lastTrained: new Date().toISOString(),
        predictions: 0
      };
      
      console.log(`✅ Performance predictor trained with ${accuracy.toFixed(2)}% accuracy`);
    } catch (error) {
      console.error('❌ Error training performance predictor:', error);
    }
  }

  /**
   * Train error prediction model
   */
  async trainErrorPredictor() {
    try {
      const data = this.trainingData.errors;
      const splitIndex = Math.floor(data.length * (1 - this.trainingConfig.validationSplit));
      
      const trainData = data.slice(0, splitIndex);
      const validData = data.slice(splitIndex);
      
      // Train model
      const features = trainData.map(d => d.features);
      const targets = trainData.map(d => d.target);
      
      this.models.errorPredictor.train(features, targets);
      
      // Validate model
      const accuracy = this.validateErrorPredictor(validData);
      
      this.modelMetrics.errorPredictor = {
        accuracy: accuracy,
        lastTrained: new Date().toISOString(),
        predictions: 0
      };
      
      console.log(`✅ Error predictor trained with ${accuracy.toFixed(2)}% accuracy`);
    } catch (error) {
      console.error('❌ Error training error predictor:', error);
    }
  }

  /**
   * Predict expected usage for next period
   */
  predictUsage(hoursAhead = 1) {
    if (!this.isInitialized || this.modelMetrics.usagePredictor.accuracy === 0) {
      return { prediction: 10, confidence: 0.5 }; // Default fallback
    }
    
    try {
      const now = new Date();
      const futureTime = new Date(now.getTime() + (hoursAhead * 60 * 60 * 1000));
      
      const features = [
        futureTime.getDay(), // day of week
        futureTime.getHours(), // hour of day
        futureTime.getDate() // day of month
      ];
      
      const prediction = this.models.usagePredictor.predict(features);
      this.modelMetrics.usagePredictor.predictions++;
      
      return {
        prediction: Math.max(0, Math.round(prediction)),
        confidence: this.modelMetrics.usagePredictor.accuracy / 100,
        hoursAhead: hoursAhead
      };
    } catch (error) {
      console.error('Error predicting usage:', error);
      return { prediction: 10, confidence: 0.5 };
    }
  }

  /**
   * Predict performance for given thresholds
   */
  predictPerformance(thresholds, sampleCount = 50, avgResponseTime = 1000) {
    if (!this.isInitialized || this.modelMetrics.performancePredictor.accuracy === 0) {
      return { prediction: 0.6, confidence: 0.5 }; // Default fallback
    }
    
    try {
      const features = [
        thresholds.nComparables || 10,
        thresholds.nAnalyses || 3,
        thresholds.qualityScore || 0.6,
        sampleCount,
        avgResponseTime
      ];
      
      const prediction = this.models.performancePredictor.predict(features);
      this.modelMetrics.performancePredictor.predictions++;
      
      return {
        prediction: Math.max(0, Math.min(1, prediction)),
        confidence: this.modelMetrics.performancePredictor.accuracy / 100,
        thresholds: thresholds
      };
    } catch (error) {
      console.error('Error predicting performance:', error);
      return { prediction: 0.6, confidence: 0.5 };
    }
  }

  /**
   * Predict error probability for given conditions
   */
  predictErrorProbability(approach = 'system', responseTime = 1000, confidence = 0.7) {
    if (!this.isInitialized || this.modelMetrics.errorPredictor.accuracy === 0) {
      return { prediction: 0.1, confidence: 0.5 }; // Default fallback
    }
    
    try {
      const features = [
        approach === 'ai' ? 1 : 0,
        responseTime / 1000, // convert to seconds
        confidence,
        new Date().getHours() // current hour
      ];
      
      const prediction = this.models.errorPredictor.predict(features);
      this.modelMetrics.errorPredictor.predictions++;
      
      return {
        prediction: Math.max(0, Math.min(1, prediction)),
        confidence: this.modelMetrics.errorPredictor.accuracy / 100,
        approach: approach
      };
    } catch (error) {
      console.error('Error predicting error probability:', error);
      return { prediction: 0.1, confidence: 0.5 };
    }
  }

  /**
   * Get intelligent recommendations based on ML predictions
   */
  getMLRecommendations() {
    const recommendations = [];
    
    // Usage-based recommendations
    const usagePrediction = this.predictUsage(1);
    if (usagePrediction.prediction > 30) {
      recommendations.push({
        type: 'high_usage_preparation',
        priority: 'medium',
        reason: `Predicted high usage: ${usagePrediction.prediction} analyses next hour`,
        action: 'Optimize for speed and efficiency',
        confidence: usagePrediction.confidence
      });
    } else if (usagePrediction.prediction < 5) {
      recommendations.push({
        type: 'low_usage_opportunity',
        priority: 'low', 
        reason: `Predicted low usage: ${usagePrediction.prediction} analyses next hour`,
        action: 'Opportunity for quality optimization',
        confidence: usagePrediction.confidence
      });
    }
    
    // Performance-based recommendations
    const currentThresholds = { nComparables: 15, nAnalyses: 4, qualityScore: 0.6 };
    const perfPrediction = this.predictPerformance(currentThresholds);
    
    if (perfPrediction.prediction < 0.5) {
      recommendations.push({
        type: 'performance_optimization',
        priority: 'high',
        reason: `Predicted poor performance: ${(perfPrediction.prediction * 100).toFixed(1)}% efficiency`,
        action: 'Adjust thresholds for better performance',
        confidence: perfPrediction.confidence
      });
    }
    
    // Error-based recommendations
    const errorProb = this.predictErrorProbability('ai', 2000, 0.6);
    if (errorProb.prediction > 0.3) {
      recommendations.push({
        type: 'error_prevention',
        priority: 'high',
        reason: `High error probability: ${(errorProb.prediction * 100).toFixed(1)}%`,
        action: 'Switch to more conservative approach',
        confidence: errorProb.confidence
      });
    }
    
    return recommendations;
  }

  // Validation methods
  validateUsagePredictor(validData) {
    let correct = 0;
    for (const sample of validData) {
      const prediction = this.models.usagePredictor.predict(sample.features);
      // Within 20% is considered correct
      if (Math.abs(prediction - sample.target) <= sample.target * 0.2) {
        correct++;
      }
    }
    return (correct / validData.length) * 100;
  }

  validatePerformancePredictor(validData) {
    let correct = 0;
    for (const sample of validData) {
      const prediction = this.models.performancePredictor.predict(sample.features);
      // Within 15% is considered correct
      if (Math.abs(prediction - sample.target) <= 0.15) {
        correct++;
      }
    }
    return (correct / validData.length) * 100;
  }

  validateErrorPredictor(validData) {
    let correct = 0;
    for (const sample of validData) {
      const prediction = this.models.errorPredictor.predict(sample.features);
      const predictedClass = prediction > 0.5 ? 1 : 0;
      if (predictedClass === sample.target) {
        correct++;
      }
    }
    return (correct / validData.length) * 100;
  }

  /**
   * Start periodic retraining
   */
  startPeriodicTraining() {
    setInterval(async () => {
      console.log('🔄 Starting periodic model retraining...');
      await this.loadTrainingData();
      await this.trainAllModels();
    }, this.trainingConfig.retrainingInterval);
  }

  /**
   * Get ML service status and metrics
   */
  getMLStatus() {
    return {
      isInitialized: this.isInitialized,
      models: {
        usagePredictor: this.modelMetrics.usagePredictor,
        performancePredictor: this.modelMetrics.performancePredictor,
        errorPredictor: this.modelMetrics.errorPredictor
      },
      trainingDataSize: {
        usage: this.trainingData.usage.length,
        performance: this.trainingData.performance.length,
        errors: this.trainingData.errors.length
      }
    };
  }
}

// Simple Linear Regression Model
class SimpleLinearRegression {
  constructor() {
    this.weights = null;
    this.bias = 0;
    this.isTrained = false;
  }

  train(features, targets) {
    const n = features.length;
    const numFeatures = features[0].length;
    
    // Initialize weights
    this.weights = new Array(numFeatures).fill(0);
    this.bias = 0;
    
    // Simple gradient descent
    const learningRate = 0.01;
    const epochs = 100;
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalError = 0;
      const weightGradients = new Array(numFeatures).fill(0);
      let biasGradient = 0;
      
      for (let i = 0; i < n; i++) {
        const prediction = this.predict(features[i]);
        const error = prediction - targets[i];
        totalError += error * error;
        
        // Calculate gradients
        for (let j = 0; j < numFeatures; j++) {
          weightGradients[j] += error * features[i][j];
        }
        biasGradient += error;
      }
      
      // Update weights
      for (let j = 0; j < numFeatures; j++) {
        this.weights[j] -= learningRate * weightGradients[j] / n;
      }
      this.bias -= learningRate * biasGradient / n;
    }
    
    this.isTrained = true;
  }

  predict(features) {
    if (!this.isTrained) return 0;
    
    let result = this.bias;
    for (let i = 0; i < features.length; i++) {
      result += this.weights[i] * features[i];
    }
    return result;
  }
}

// Simple Decision Tree Model
class DecisionTree {
  constructor() {
    this.tree = null;
    this.isTrained = false;
  }

  train(features, targets) {
    this.tree = this.buildTree(features, targets, 0);
    this.isTrained = true;
  }

  buildTree(features, targets, depth) {
    if (depth > 5 || features.length < 10) { // Simple stopping criteria
      return this.calculateAverage(targets);
    }
    
    const bestSplit = this.findBestSplit(features, targets);
    if (!bestSplit) {
      return this.calculateAverage(targets);
    }
    
    const leftIndices = [];
    const rightIndices = [];
    
    for (let i = 0; i < features.length; i++) {
      if (features[i][bestSplit.feature] <= bestSplit.threshold) {
        leftIndices.push(i);
      } else {
        rightIndices.push(i);
      }
    }
    
    const leftFeatures = leftIndices.map(i => features[i]);
    const leftTargets = leftIndices.map(i => targets[i]);
    const rightFeatures = rightIndices.map(i => features[i]);
    const rightTargets = rightIndices.map(i => targets[i]);
    
    return {
      feature: bestSplit.feature,
      threshold: bestSplit.threshold,
      left: this.buildTree(leftFeatures, leftTargets, depth + 1),
      right: this.buildTree(rightFeatures, rightTargets, depth + 1)
    };
  }

  findBestSplit(features, targets) {
    let bestGain = 0;
    let bestSplit = null;
    
    const numFeatures = features[0].length;
    
    for (let feature = 0; feature < numFeatures; feature++) {
      const values = features.map(f => f[feature]).sort((a, b) => a - b);
      
      for (let i = 1; i < values.length; i++) {
        const threshold = (values[i-1] + values[i]) / 2;
        
        const leftTargets = [];
        const rightTargets = [];
        
        for (let j = 0; j < features.length; j++) {
          if (features[j][feature] <= threshold) {
            leftTargets.push(targets[j]);
          } else {
            rightTargets.push(targets[j]);
          }
        }
        
        if (leftTargets.length === 0 || rightTargets.length === 0) continue;
        
        const gain = this.calculateGain(targets, leftTargets, rightTargets);
        
        if (gain > bestGain) {
          bestGain = gain;
          bestSplit = { feature, threshold };
        }
      }
    }
    
    return bestSplit;
  }

  calculateGain(parent, left, right) {
    const parentVariance = this.calculateVariance(parent);
    const leftVariance = this.calculateVariance(left);
    const rightVariance = this.calculateVariance(right);
    
    const weightedVariance = (left.length / parent.length) * leftVariance + 
                            (right.length / parent.length) * rightVariance;
    
    return parentVariance - weightedVariance;
  }

  calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }

  calculateAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  predict(features) {
    if (!this.isTrained) return 0;
    return this.traverseTree(this.tree, features);
  }

  traverseTree(node, features) {
    if (typeof node === 'number') {
      return node; // Leaf node
    }
    
    if (features[node.feature] <= node.threshold) {
      return this.traverseTree(node.left, features);
    } else {
      return this.traverseTree(node.right, features);
    }
  }
}

// Simple Logistic Regression Model
class LogisticRegression {
  constructor() {
    this.weights = null;
    this.bias = 0;
    this.isTrained = false;
  }

  train(features, targets) {
    const n = features.length;
    const numFeatures = features[0].length;
    
    // Initialize weights
    this.weights = new Array(numFeatures).fill(0);
    this.bias = 0;
    
    // Gradient descent
    const learningRate = 0.1;
    const epochs = 100;
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      const weightGradients = new Array(numFeatures).fill(0);
      let biasGradient = 0;
      
      for (let i = 0; i < n; i++) {
        const prediction = this.predict(features[i]);
        const error = prediction - targets[i];
        
        // Calculate gradients
        for (let j = 0; j < numFeatures; j++) {
          weightGradients[j] += error * features[i][j];
        }
        biasGradient += error;
      }
      
      // Update weights
      for (let j = 0; j < numFeatures; j++) {
        this.weights[j] -= learningRate * weightGradients[j] / n;
      }
      this.bias -= learningRate * biasGradient / n;
    }
    
    this.isTrained = true;
  }

  predict(features) {
    if (!this.isTrained) return 0.5;
    
    let logit = this.bias;
    for (let i = 0; i < features.length; i++) {
      logit += this.weights[i] * features[i];
    }
    
    // Sigmoid function
    return 1 / (1 + Math.exp(-logit));
  }
}

module.exports = LocalMLService; 