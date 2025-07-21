// Smart Learning System - Core Types and Interfaces
// This defines all the data structures for making the AI agent continuously smarter

import { PropertyData, Comparable, MarketTrends } from '@/types'

// ========================================
// 1. USER FEEDBACK LEARNING SYSTEM
// ========================================

export interface UserFeedback {
  id: string
  sessionId: string
  timestamp: string
  userId?: string // Optional user identification
  
  // Overall analysis rating
  overallRating: 1 | 2 | 3 | 4 | 5
  overallComments?: string
  
  // Specific component ratings
  componentRatings: {
    valuation: ComponentRating
    comparables: ComponentRating
    marketAnalysis: ComponentRating
    amenities: ComponentRating
    futureOutlook: ComponentRating
    aiSummary: ComponentRating
  }
  
  // Field corrections
  corrections: PropertyCorrection[]
  
  // Outcome verification (follow-up data)
  outcomeVerification?: OutcomeVerification
}

export interface ComponentRating {
  rating: 1 | 2 | 3 | 4 | 5
  accuracy: 1 | 2 | 3 | 4 | 5 // How accurate was this component?
  usefulness: 1 | 2 | 3 | 4 | 5 // How useful was this information?
  comments?: string
}

export interface PropertyCorrection {
  field: string // e.g., 'price', 'bedrooms', 'condition'
  originalValue: any
  correctedValue: any
  confidence: 1 | 2 | 3 | 4 | 5 // How confident is the user in this correction?
  source?: string // Where did they get the correct information?
}

export interface OutcomeVerification {
  // Real market outcomes (provided later)
  actualSalePrice?: number
  actualSaleDate?: string
  timeOnMarket?: number
  finalSaleRatio?: number // Actual sale price / estimated price
  
  // Investment outcomes
  investmentOutcome?: 'excellent' | 'good' | 'neutral' | 'poor' | 'bad'
  investmentReason?: string
  
  // Market prediction verification
  marketTrendAccuracy?: 'very_accurate' | 'accurate' | 'somewhat_accurate' | 'inaccurate'
  priceChangeActual?: number // Actual price change percentage
}

// ========================================
// 2. PREDICTION VALIDATION SYSTEM
// ========================================

export interface MarketPrediction {
  id: string
  sessionId: string
  propertyId: string
  timestamp: string
  
  // Price predictions
  predictedPriceRange: {
    low: number
    high: number
    estimated: number
    confidence: number
  }
  
  // Market trend predictions
  predictedMarketTrend: 'up' | 'down' | 'stable'
  predictedPriceChange: number // Percentage change predicted
  predictionTimeframe: '3_months' | '6_months' | '1_year' | '2_years'
  
  // Investment predictions
  predictedRentalYield?: number
  predictedAppreciation?: number
  investmentGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  
  // Confidence factors
  dataQuality: number // 0-100, how much data was available
  modelConfidence: number // 0-100, model's confidence in prediction
  
  // Methodology used
  analysisMethod: string[]
  dataSourcesUsed: string[]
}

export interface PredictionValidation {
  id: string
  predictionId: string
  validationDate: string
  
  // Actual outcomes
  actualOutcome: {
    actualPrice?: number
    actualMarketTrend?: 'up' | 'down' | 'stable'
    actualPriceChange?: number
    actualTimeOnMarket?: number
    actualRentalYield?: number
  }
  
  // Accuracy metrics
  priceAccuracy: number // 0-100, how close was the price prediction
  trendAccuracy: number // 0-100, was the trend prediction correct
  overallAccuracy: number // 0-100, combined accuracy score
  
  // Learning insights
  successFactors: string[] // What made this prediction accurate
  failureFactors: string[] // What caused prediction errors
  modelPerformance: ModelPerformance
}

export interface ModelPerformance {
  accuracyScore: number // 0-100
  precisionScore: number // 0-100
  recallScore: number // 0-100
  confidenceCalibration: number // How well calibrated were confidence scores
  biasDetection: {
    priceRangeBias?: number // Tendency to over/under estimate
    marketTrendBias?: string // Tendency toward certain trend predictions
    regionalBias?: string[] // Regions where model performs poorly
  }
}

// ========================================
// 3. PROMPT OPTIMIZATION SYSTEM
// ========================================

export interface PromptPerformance {
  id: string
  promptTemplate: string
  promptCategory: 'location_analysis' | 'market_summary' | 'valuation' | 'investment_advice' | 'comparable_analysis'
  
  // Performance metrics
  useCount: number
  averageQuality: number // 0-100 based on user feedback
  successRate: number // 0-100 percentage of successful responses
  averageResponseTime: number // milliseconds
  
  // User satisfaction
  userRatings: number[] // Array of user ratings
  userComments: string[]
  
  // Technical metrics
  tokenUsage: number
  costPerUse: number
  errorRate: number // 0-100 percentage of failed responses
  
  // A/B testing results
  testResults?: ABTestResult[]
  
  // Optimization history
  optimizationHistory: PromptOptimization[]
}

export interface ABTestResult {
  testId: string
  promptA: string
  promptB: string
  testPeriod: { start: string; end: string }
  
  results: {
    promptA: { uses: number; averageRating: number; successRate: number }
    promptB: { uses: number; averageRating: number; successRate: number }
  }
  
  winner: 'A' | 'B' | 'tie'
  confidenceLevel: number // Statistical confidence 0-100
  statisticalSignificance: boolean
}

export interface PromptOptimization {
  id: string
  timestamp: string
  originalPrompt: string
  optimizedPrompt: string
  
  optimizationType: 'clarity' | 'specificity' | 'context' | 'format' | 'tone'
  optimizationReason: string
  
  // Before/after performance
  beforeMetrics: PromptMetrics
  afterMetrics?: PromptMetrics // Populated after testing
  
  // Optimization strategy
  strategy: 'rule_based' | 'ml_generated' | 'user_feedback' | 'a_b_testing'
}

export interface PromptMetrics {
  averageQuality: number
  successRate: number
  userSatisfaction: number
  responseTime: number
  tokenEfficiency: number // Quality per token used
}

// ========================================
// 4. REGIONAL INTELLIGENCE SYSTEM
// ========================================

export interface RegionalKnowledge {
  id: string
  regionType: 'city' | 'province' | 'neighborhood' | 'postal_code'
  regionName: string
  regionCode?: string
  
  // Market characteristics learned over time
  marketCharacteristics: MarketCharacteristics
  
  // Pricing patterns
  pricingPatterns: PricingPattern[]
  
  // Development impact learning
  developmentImpacts: DevelopmentImpact[]
  
  // Seasonal patterns
  seasonalPatterns: SeasonalPattern[]
  
  // Demographic insights
  demographicInsights: DemographicInsight[]
  
  // Learning confidence
  confidenceScore: number // 0-100, based on amount of data
  lastUpdated: string
  dataPoints: number // How many analyses contributed to this knowledge
}

export interface MarketCharacteristics {
  // Price characteristics
  averagePricePerM2: number
  priceVolatility: number // Standard deviation
  priceAppreciation: number // Average annual appreciation
  
  // Market dynamics
  averageTimeOnMarket: number
  inventoryLevels: 'low' | 'moderate' | 'high'
  demandLevel: 'low' | 'moderate' | 'high'
  
  // Property types performance
  bestPerformingTypes: string[]
  worstPerformingTypes: string[]
  
  // Investment metrics
  averageRentalYield: number
  investmentGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  
  // Risk factors
  riskFactors: string[]
  opportunities: string[]
}

export interface PricingPattern {
  pattern: string // Description of the pattern
  conditions: string[] // What conditions trigger this pattern
  impact: number // Percentage impact on price
  confidence: number // 0-100, confidence in this pattern
  exampleCases: string[] // Property IDs where this pattern was observed
}

export interface DevelopmentImpact {
  developmentType: 'transport' | 'commercial' | 'residential' | 'infrastructure' | 'education'
  distance: number // Distance in km
  impactOnPrice: number // Percentage impact
  impactTimeframe: string // How long until impact is realized
  confidence: number // 0-100
  
  // Learning from actual cases
  historicalCases: {
    propertyId: string
    predictedImpact: number
    actualImpact: number
    accuracy: number
  }[]
}

export interface SeasonalPattern {
  season: 'spring' | 'summer' | 'autumn' | 'winter'
  priceAdjustment: number // Percentage adjustment for seasonal effects
  marketActivity: 'low' | 'moderate' | 'high'
  averageTimeOnMarket: number
  
  // Learning confidence
  yearsOfData: number
  confidence: number
}

export interface DemographicInsight {
  buyerProfile: {
    ageRange: string
    incomeLevel: string
    familyStatus: string
    nationality: string[]
  }
  
  preferences: {
    propertyTypes: string[]
    features: string[]
    priceRange: { min: number; max: number }
  }
  
  motivations: string[]
  sensitivity: {
    priceChanges: number // How sensitive to price changes
    marketConditions: number // How sensitive to market conditions
  }
}

// ========================================
// 5. INTELLIGENT COMPARABLE SELECTION
// ========================================

export interface ComparableIntelligence {
  id: string
  regionId: string
  propertyType: string
  
  // Learned selection criteria
  optimalCriteria: ComparableSelectionCriteria
  
  // Feature importance weights (learned from feedback)
  featureWeights: FeatureWeights
  
  // Success patterns
  successPatterns: ComparablePattern[]
  
  // Performance metrics
  selectionAccuracy: number // 0-100, based on user feedback
  valuationAccuracy: number // 0-100, how accurate valuations were
  
  lastUpdated: string
  learningConfidence: number // 0-100
}

export interface ComparableSelectionCriteria {
  // Distance criteria (learned optimal values)
  maxDistance: number
  optimalDistance: number
  
  // Size criteria
  areaRange: { min: number; max: number } // Percentage of target property
  
  // Feature matching requirements
  requiredMatches: string[] // Features that must match
  preferredMatches: string[] // Features that should match if possible
  
  // Temporal criteria
  maxAge: number // Maximum age of comparable in days
  preferredAge: number // Preferred age for best comparables
  
  // Market condition adjustments
  marketConditionWeight: number // How much to weight for market conditions
}

export interface FeatureWeights {
  location: number // Geographic proximity importance
  size: number // Size similarity importance
  condition: number // Property condition importance
  age: number // Property age importance
  features: number // Feature matching importance
  recentSales: number // How much to prefer recent sales
  marketConditions: number // Market condition adjustments
  
  // Property-specific weights
  propertyTypeSpecific: { [key: string]: number }
  regionSpecific: { [key: string]: number }
}

export interface ComparablePattern {
  patternName: string
  description: string
  conditions: string[] // When this pattern applies
  
  // Selection adjustments
  distanceAdjustment: number
  timeAdjustment: number
  featureWeightAdjustments: { [feature: string]: number }
  
  // Success metrics
  useCount: number
  successRate: number // How often this pattern leads to accurate valuations
  userSatisfaction: number // User feedback on these selections
}

// ========================================
// 6. LEARNING ANALYTICS & REPORTING
// ========================================

export interface LearningAnalytics {
  id: string
  timestamp: string
  timeframe: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  
  // Overall system performance
  overallMetrics: SystemMetrics
  
  // Component performance
  componentMetrics: {
    userFeedback: FeedbackMetrics
    predictionAccuracy: PredictionMetrics
    promptOptimization: PromptMetrics
    regionalIntelligence: RegionalMetrics
    comparableSelection: ComparableMetrics
  }
  
  // Learning insights
  insights: LearningInsight[]
  
  // Recommendations
  recommendations: SystemRecommendation[]
}

export interface SystemMetrics {
  totalAnalyses: number
  averageQualityScore: number
  userSatisfactionScore: number
  predictionAccuracy: number
  systemReliability: number
  
  // Improvement trends
  qualityTrend: 'improving' | 'stable' | 'declining'
  improvementRate: number // Percentage improvement per month
  
  // Error rates
  criticalErrors: number
  userReportedIssues: number
  systemUptime: number
}

export interface FeedbackMetrics {
  totalFeedbackReceived: number
  averageRating: number
  feedbackResponseRate: number // Percentage of users providing feedback
  
  // Component breakdown
  componentSatisfaction: { [component: string]: number }
  
  // Trends
  satisfactionTrend: 'improving' | 'stable' | 'declining'
  feedbackQuality: number // How detailed/useful is the feedback
}

export interface PredictionMetrics {
  totalPredictions: number
  validatedPredictions: number
  averageAccuracy: number
  
  // Prediction type breakdown
  priceAccuracy: number
  trendAccuracy: number
  timeframeAccuracy: number
  
  // Model performance
  modelCalibration: number // How well calibrated are confidence scores
  biasDetection: string[] // Any biases detected
}

export interface RegionalMetrics {
  regionsLearned: number
  averageConfidence: number
  patternAccuracy: number
  
  // Best/worst performing regions
  bestRegions: string[]
  worstRegions: string[]
  
  // Knowledge coverage
  coveragePercentage: number // Percentage of target regions with knowledge
}

export interface ComparableMetrics {
  selectionAccuracy: number
  valuationImprovement: number // Improvement from better comparable selection
  userSatisfaction: number
  
  // Pattern performance
  activePatterns: number
  patternSuccessRate: number
}

export interface LearningInsight {
  type: 'trend' | 'pattern' | 'anomaly' | 'opportunity' | 'risk'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  confidence: number // 0-100
  
  // Supporting data
  evidence: string[]
  relatedMetrics: string[]
  
  // Actionable recommendations
  recommendations: string[]
}

export interface SystemRecommendation {
  id: string
  type: 'optimization' | 'data_collection' | 'model_adjustment' | 'process_improvement'
  priority: 'critical' | 'high' | 'medium' | 'low'
  
  title: string
  description: string
  expectedImpact: string
  implementationEffort: 'low' | 'medium' | 'high'
  
  // Implementation details
  steps: string[]
  estimatedTimeframe: string
  requiredResources: string[]
  
  // Success metrics
  successCriteria: string[]
  expectedROI: string
}

// ========================================
// 7. CORE LEARNING ENGINE INTERFACES
// ========================================

export interface LearningEngine {
  // Learning operations
  processUserFeedback(feedback: UserFeedback): Promise<void>
  updateRegionalKnowledge(sessionData: any): Promise<void>
  optimizePrompts(): Promise<PromptOptimization[]>
  improveComparableSelection(feedback: UserFeedback[]): Promise<void>
  
  // Analytics
  generateLearningReport(timeframe: string): Promise<LearningAnalytics>
  getSystemRecommendations(): Promise<SystemRecommendation[]>
  
  // Model management
  validatePredictions(): Promise<PredictionValidation[]>
  updateModelWeights(validationResults: PredictionValidation[]): Promise<void>
  
  // Knowledge querying
  getRegionalInsights(region: string): Promise<RegionalKnowledge | null>
  getOptimalComparableCriteria(propertyData: PropertyData): Promise<ComparableSelectionCriteria>
  getBestPromptTemplate(category: string, context?: any): Promise<string>
}

// ========================================
// 8. DATABASE SCHEMAS
// ========================================

export interface LearningDatabase {
  // Tables
  user_feedback: UserFeedback[]
  prediction_tracking: MarketPrediction[]
  prediction_validation: PredictionValidation[]
  prompt_performance: PromptPerformance[]
  regional_knowledge: RegionalKnowledge[]
  comparable_intelligence: ComparableIntelligence[]
  learning_analytics: LearningAnalytics[]
  
  // Indexes for performance
  indexes: {
    feedback_by_session: string
    predictions_by_property: string
    regional_by_location: string
    prompts_by_category: string
    analytics_by_timeframe: string
  }
}

// ========================================
// 9. API INTERFACES
// ========================================

export interface LearningAPI {
  // Feedback endpoints
  submitFeedback(feedback: UserFeedback): Promise<{ success: boolean; message: string }>
  updateOutcome(sessionId: string, outcome: OutcomeVerification): Promise<{ success: boolean }>
  
  // Analytics endpoints
  getLearningInsights(timeframe?: string): Promise<LearningAnalytics>
  getRegionalInsights(region: string): Promise<RegionalKnowledge | null>
  getPerformanceMetrics(): Promise<SystemMetrics>
  
  // Optimization endpoints
  triggerPromptOptimization(): Promise<{ optimizations: number; message: string }>
  updateComparableCriteria(region: string): Promise<{ success: boolean }>
  validatePredictions(): Promise<{ validated: number; accuracy: number }>
  
  // Admin endpoints
  getSystemRecommendations(): Promise<SystemRecommendation[]>
  exportLearningData(format: 'json' | 'csv'): Promise<Blob>
  resetLearningData(confirm: string): Promise<{ success: boolean }>
}

// ========================================
// 9. PROGRESSIVE DEEPENING SYSTEM
// ========================================

export interface AnalysisHistory {
  propertyId: string // Unique identifier for the property (address + city + province hash)
  analysisCount: number // How many times this property has been analyzed
  firstAnalysisDate: string
  lastAnalysisDate: string
  analysisQualityScores: number[] // Quality scores from each analysis
  promptVersions: string[] // Which prompt versions were used
  dataGaps: string[] // What data was missing in previous analyses
  userFeedback: UserFeedback[] // Feedback from each analysis
  regionalKnowledgeUpdates: number // How many times regional knowledge was updated
}

export interface ProgressivePrompt {
  version: string
  analysisLevel: number // 1 = first analysis, 2 = second analysis, etc.
  promptTemplate: string
  focusAreas: string[] // What areas to focus on for this level
  dataRequirements: string[] // What additional data to gather
  expectedOutcome: string
  isActive: boolean
  performanceMetrics: {
    averageQuality: number
    successRate: number
    userSatisfaction: number
    dataCompleteness: number
  }
}

export interface DeepeningStrategy {
  propertyId: string
  currentLevel: number
  nextLevel: number
  focusAreas: string[]
  additionalQueries: string[]
  expectedImprovements: string[]
  confidenceThreshold: number
  lastUpdated: string
}

// All types are exported individually above 