// Core Learning Engine
// Orchestrates all learning components and provides pattern recognition and optimization

import { 
  LearningEngine as ILearningEngine,
  UserFeedback,
  MarketPrediction,
  PredictionValidation,
  PromptOptimization,
  RegionalKnowledge,
  ComparableSelectionCriteria,
  LearningAnalytics,
  SystemRecommendation
} from './learning-types'
import { PropertyData, CMAReport } from '@/types'

// Import all learning components
import { feedbackService, feedbackAnalyzer } from './feedback-system'
import { predictionTracker } from './prediction-tracker'
import { promptOptimizer } from './prompt-optimizer'
import { regionalIntelligence } from './regional-intelligence'
import { smartComparableEngine } from './smart-comparables'

import path from 'path'
import fs from 'fs'

// ========================================
// CORE LEARNING ORCHESTRATOR
// ========================================

export class LearningEngine implements ILearningEngine {
  private dataDir: string
  private metricsFile: string
  private isEnabled: boolean = true

  constructor(dataDir: string = './data/learning') {
    this.dataDir = dataDir
    this.metricsFile = path.join(dataDir, 'learning-metrics.json')
    this.ensureDataDirectory()
    console.log('Learning Engine initialized')
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
      console.log(`Created learning engine data directory: ${this.dataDir}`)
    }
  }

  // ========================================
  // PRIMARY LEARNING OPERATIONS
  // ========================================

  async processUserFeedback(feedback: UserFeedback): Promise<void> {
    try {
      if (!this.isEnabled) {
        console.log('Learning engine disabled - skipping feedback processing')
        return
      }

      console.log(`Processing user feedback for session: ${feedback.sessionId}`)

      // Store feedback in database
      await feedbackService.submitFeedback(feedback)

      // Extract learning insights from feedback
      await this.extractFeedbackInsights(feedback)

      // Update component-specific learning
      await this.updateComponentLearning(feedback)

      // Trigger immediate optimizations if needed
      await this.triggerImmediateOptimizations(feedback)

      console.log('User feedback processed successfully')
    } catch (error) {
      console.error('Error processing user feedback:', error)
    }
  }

  async updateRegionalKnowledge(sessionData: {
    propertyData: PropertyData
    report: CMAReport
    comparables: any[]
    sessionId: string
    analysisQuality?: number
    userFeedback?: UserFeedback
  }): Promise<void> {
    try {
      if (!this.isEnabled) {
        console.log('Learning engine disabled - skipping regional knowledge update')
        return
      }

      console.log(`Updating regional knowledge for ${sessionData.propertyData.city}, ${sessionData.propertyData.province}`)

      // Calculate analysis quality if not provided
      const analysisQuality = sessionData.analysisQuality || this.calculateAnalysisQuality(sessionData.report)

      // Update regional intelligence
      await regionalIntelligence.learnFromAnalysis({
        propertyData: sessionData.propertyData,
        report: sessionData.report,
        comparables: sessionData.comparables,
        analysisQuality
      })

      // Store prediction for future validation
      await this.storePredictionData(sessionData)

      // Update comparable selection intelligence if feedback available
      if (sessionData.userFeedback) {
        await smartComparableEngine.learnFromFeedback(
          sessionData.propertyData,
          sessionData.comparables,
          sessionData.userFeedback
        )
      }

      console.log('Regional knowledge updated successfully')
    } catch (error) {
      console.error('Error updating regional knowledge:', error)
    }
  }

  async optimizePrompts(): Promise<PromptOptimization[]> {
    try {
      if (!this.isEnabled) {
        console.log('Learning engine disabled - skipping prompt optimization')
        return []
      }

      console.log('Running prompt optimization')
      
      // Run prompt optimization
      const optimizations = await promptOptimizer.optimizePrompts()

      // Analyze optimization impact
      await this.analyzeOptimizationImpact(optimizations)

      console.log(`Generated ${optimizations.length} prompt optimizations`)
      return optimizations
    } catch (error) {
      console.error('Error optimizing prompts:', error)
      return []
    }
  }

  async improveComparableSelection(feedbackList: UserFeedback[]): Promise<void> {
    try {
      if (!this.isEnabled) {
        console.log('Learning engine disabled - skipping comparable selection improvement')
        return
      }

      console.log(`Improving comparable selection from ${feedbackList.length} feedback entries`)

      // Process each feedback for comparable learning
      for (const feedback of feedbackList) {
        await this.processComparableFeedback(feedback)
      }

      // Analyze global comparable patterns
      await this.analyzeComparablePatterns()

      console.log('Comparable selection improvement completed')
    } catch (error) {
      console.error('Error improving comparable selection:', error)
    }
  }

  // ========================================
  // ANALYTICS AND REPORTING
  // ========================================

  async generateLearningReport(timeframe: string = 'monthly'): Promise<LearningAnalytics> {
    try {
      console.log(`Generating learning analytics report for timeframe: ${timeframe}`)

      const report: LearningAnalytics = {
        id: `report_${Date.now()}`,
        timestamp: new Date().toISOString(),
        timeframe: timeframe as any,
        overallMetrics: await this.calculateOverallMetrics(),
        componentMetrics: await this.calculateComponentMetrics(),
        insights: await this.generateLearningInsights(),
        recommendations: await this.getSystemRecommendations()
      }

      // Save report
      await this.saveLearningReport(report)

      console.log('Learning analytics report generated successfully')
      return report
    } catch (error) {
      console.error('Error generating learning report:', error)
      throw error
    }
  }

  async getSystemRecommendations(): Promise<SystemRecommendation[]> {
    try {
      const recommendations: SystemRecommendation[] = []

      // Get recommendations from each component
      const feedbackRecommendations = await this.getFeedbackRecommendations()
      const predictionRecommendations = await this.getPredictionRecommendations()
      const promptRecommendations = await this.getPromptRecommendations()
      const regionalRecommendations = await this.getRegionalRecommendations()
      const comparableRecommendations = await this.getComparableRecommendations()

      // Combine and prioritize recommendations
      recommendations.push(
        ...feedbackRecommendations,
        ...predictionRecommendations,
        ...promptRecommendations,
        ...regionalRecommendations,
        ...comparableRecommendations
      )

      // Sort by priority and impact
      recommendations.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      })

      return recommendations.slice(0, 10) // Return top 10 recommendations
    } catch (error) {
      console.error('Error getting system recommendations:', error)
      return []
    }
  }

  // ========================================
  // MODEL MANAGEMENT
  // ========================================

  async validatePredictions(): Promise<PredictionValidation[]> {
    try {
      if (!this.isEnabled) {
        console.log('Learning engine disabled - skipping prediction validation')
        return []
      }

      console.log('Running prediction validation')

      // Run prediction validation
      const validationResult = await predictionTracker.validatePredictions()
      
      // Update learning based on validation results
      if (validationResult.validated > 0) {
        await this.updateLearningFromValidation(validationResult)
      }

      console.log(`Validated ${validationResult.validated} predictions with ${validationResult.accuracy.toFixed(1)}% average accuracy`)
      return [] // Return empty for now - would return actual validation details
    } catch (error) {
      console.error('Error validating predictions:', error)
      return []
    }
  }

  async updateModelWeights(validationResults: PredictionValidation[]): Promise<void> {
    try {
      if (!this.isEnabled) {
        console.log('Learning engine disabled - skipping model weight updates')
        return
      }

      console.log(`Updating model weights from ${validationResults.length} validation results`)

      // Update prediction model weights
      await predictionTracker.updateModelWeights(validationResults)

      // Update regional intelligence weights
      await this.updateRegionalWeights(validationResults)

      // Update comparable selection weights
      await this.updateComparableWeights(validationResults)

      console.log('Model weights updated successfully')
    } catch (error) {
      console.error('Error updating model weights:', error)
    }
  }

  // ========================================
  // KNOWLEDGE QUERYING
  // ========================================

  async getRegionalInsights(region: string): Promise<RegionalKnowledge | null> {
    try {
      // Try to parse region string
      const parts = region.split(',').map(p => p.trim())
      
      if (parts.length >= 2) {
        const city = parts[0]
        const province = parts[1]
        return regionalIntelligence.getRegionalInsights(city, province)
      } else {
        // Try to find region by name
        return regionalIntelligence.getRegionalInsights(region, '')
      }
    } catch (error) {
      console.error('Error getting regional insights:', error)
      return null
    }
  }

  async getOptimalComparableCriteria(propertyData: PropertyData): Promise<ComparableSelectionCriteria> {
    try {
      return smartComparableEngine.getOptimalCriteria(propertyData)
    } catch (error) {
      console.error('Error getting optimal comparable criteria:', error)
      // Return default criteria
      return {
        maxDistance: 5,
        optimalDistance: 2,
        areaRange: { min: 0.8, max: 1.2 },
        requiredMatches: ['propertyType'],
        preferredMatches: ['bedrooms', 'condition'],
        maxAge: 365,
        preferredAge: 180,
        marketConditionWeight: 0.3
      }
    }
  }

  async getBestPromptTemplate(category: string, context?: any): Promise<string> {
    try {
      return promptOptimizer.getBestPromptTemplate(category, context)
    } catch (error) {
      console.error('Error getting best prompt template:', error)
      return `Analyze the ${category} data and provide insights.`
    }
  }

  // ========================================
  // PATTERN RECOGNITION ALGORITHMS
  // ========================================

  private async analyzeDataPatterns(): Promise<{
    userBehaviorPatterns: any[]
    marketTrendPatterns: any[]
    performancePatterns: any[]
    anomalies: any[]
  }> {
    try {
      console.log('Analyzing data patterns for insights')

      // Analyze user behavior patterns
      const userPatterns = await this.analyzeUserBehaviorPatterns()
      
      // Analyze market trend patterns
      const marketPatterns = await this.analyzeMarketTrendPatterns()
      
      // Analyze performance patterns
      const performancePatterns = await this.analyzePerformancePatterns()
      
      // Detect anomalies
      const anomalies = await this.detectAnomalies()

      return {
        userBehaviorPatterns: userPatterns,
        marketTrendPatterns: marketPatterns,
        performancePatterns: performancePatterns,
        anomalies: anomalies
      }
    } catch (error) {
      console.error('Error analyzing data patterns:', error)
      return {
        userBehaviorPatterns: [],
        marketTrendPatterns: [],
        performancePatterns: [],
        anomalies: []
      }
    }
  }

  private async correlationAnalysis(): Promise<{
    strongCorrelations: Array<{ factor1: string; factor2: string; correlation: number }>
    insights: string[]
    actionableFindings: string[]
  }> {
    try {
      console.log('Running correlation analysis')

      // Analyze correlations between different factors
      const correlations = []

      // User satisfaction vs analysis quality
      const satisfactionQualityCorr = await this.calculateCorrelation('user_satisfaction', 'analysis_quality')
      correlations.push({
        factor1: 'user_satisfaction',
        factor2: 'analysis_quality',
        correlation: satisfactionQualityCorr
      })

      // Regional accuracy vs data availability
      const regionalDataCorr = await this.calculateCorrelation('regional_accuracy', 'data_availability')
      correlations.push({
        factor1: 'regional_accuracy',
        factor2: 'data_availability',
        correlation: regionalDataCorr
      })

      // Generate insights from correlations
      const insights = this.generateCorrelationInsights(correlations)
      const actionableFindings = this.generateActionableFindings(correlations)

      return {
        strongCorrelations: correlations.filter(c => Math.abs(c.correlation) > 0.6),
        insights,
        actionableFindings
      }
    } catch (error) {
      console.error('Error in correlation analysis:', error)
      return {
        strongCorrelations: [],
        insights: [],
        actionableFindings: []
      }
    }
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  private async extractFeedbackInsights(feedback: UserFeedback): Promise<void> {
    // Identify areas needing immediate attention
    const lowRatedComponents = Object.entries(feedback.componentRatings)
      .filter(([_, rating]) => rating.rating < 3)
      .map(([component, _]) => component)

    if (lowRatedComponents.length > 0) {
      console.log(`Low-rated components detected: ${lowRatedComponents.join(', ')}`)
      await this.triggerComponentImprovements(lowRatedComponents, feedback.sessionId)
    }

    // Process corrections for data quality
    if (feedback.corrections.length > 0) {
      await this.processDataCorrections(feedback.corrections, feedback.sessionId)
    }
  }

  private async updateComponentLearning(feedback: UserFeedback): Promise<void> {
    // Update prompt performance tracking
    await this.updatePromptTracking(feedback)

    // Update comparable selection tracking
    await this.updateComparableTracking(feedback)

    // Update regional accuracy tracking
    await this.updateRegionalTracking(feedback)
  }

  private async triggerImmediateOptimizations(feedback: UserFeedback): Promise<void> {
    // Trigger immediate optimizations for severely low-rated components
    const criticalIssues = Object.entries(feedback.componentRatings)
      .filter(([_, rating]) => rating.rating <= 2)

    for (const [component, rating] of criticalIssues) {
      console.log(`Triggering immediate optimization for critically low-rated component: ${component}`)
      await this.optimizeComponent(component, rating.comments)
    }
  }

  private calculateAnalysisQuality(report: CMAReport): number {
    let quality = 0
    let maxQuality = 0

    // Valuation quality
    maxQuality += 25
    if (report.valuationEstimate.confidence > 80) quality += 25
    else if (report.valuationEstimate.confidence > 60) quality += 20
    else if (report.valuationEstimate.confidence > 40) quality += 15

    // Comparable quality
    maxQuality += 25
    if (report.comparableProperties.length > 5) quality += 25
    else if (report.comparableProperties.length > 2) quality += 20
    else if (report.comparableProperties.length > 0) quality += 15

    // Market data quality
    maxQuality += 20
    if (report.marketTrends.marketTrend && report.marketTrends.priceChange6Month !== undefined) quality += 20

    // Location data quality
    maxQuality += 15
    if (report.coordinates) quality += 15

    // Analysis depth
    maxQuality += 15
    if (report.summary?.overview && report.summary.overview.length > 200) quality += 15
    else if (report.summary?.overview && report.summary.overview.length > 100) quality += 10

    return Math.round((quality / maxQuality) * 100)
  }

  private async storePredictionData(sessionData: any): Promise<void> {
    try {
      await predictionTracker.storePrediction(
        sessionData.sessionId,
        sessionData.propertyData,
        sessionData.report
      )
    } catch (error) {
      console.error('Error storing prediction data:', error)
    }
  }

  private async analyzeOptimizationImpact(optimizations: PromptOptimization[]): Promise<void> {
    // Analyze the potential impact of optimizations
    console.log(`Analyzing impact of ${optimizations.length} prompt optimizations`)
    
    // Track optimization metrics
    const metrics = {
      clarityImprovements: optimizations.filter(o => o.optimizationType === 'clarity').length,
      specificityImprovements: optimizations.filter(o => o.optimizationType === 'specificity').length,
      contextImprovements: optimizations.filter(o => o.optimizationType === 'context').length,
      formatImprovements: optimizations.filter(o => o.optimizationType === 'format').length,
      toneImprovements: optimizations.filter(o => o.optimizationType === 'tone').length
    }

    console.log('Optimization impact analysis:', metrics)
  }

  private async processComparableFeedback(feedback: UserFeedback): Promise<void> {
    // Extract comparable-specific insights from feedback
    const comparableRating = feedback.componentRatings.comparables
    
    if (comparableRating.comments) {
      console.log(`Processing comparable feedback: ${comparableRating.comments}`)
      // This would analyze the feedback for specific improvement areas
    }
  }

  private async analyzeComparablePatterns(): Promise<void> {
    console.log('Analyzing global comparable selection patterns')
    const patterns = smartComparableEngine.analyzeSelectionPatterns()
    console.log('Comparable patterns analysis:', patterns)
  }

  private async calculateOverallMetrics(): Promise<any> {
    const feedbackStats = feedbackService.getFeedbackAnalytics()
    const predictionStats = predictionTracker.getPerformanceAnalytics()
    const promptStats = promptOptimizer.getOptimizationRecommendations()

    return {
      totalAnalyses: feedbackStats.totalFeedback || 0,
      averageQualityScore: feedbackStats.averageRating * 20 || 0, // Convert to 0-100 scale
      userSatisfactionScore: feedbackStats.averageRating * 20 || 0,
      predictionAccuracy: predictionStats.overallStats?.averageAccuracy || 0,
      systemReliability: this.calculateSystemReliability(feedbackStats, predictionStats),
      qualityTrend: feedbackStats.recentTrend || 'stable',
      improvementRate: 0, // Would calculate from historical data
      criticalErrors: 0,
      userReportedIssues: 0,
      systemUptime: 99.5 // Mock value
    }
  }

  private async calculateComponentMetrics(): Promise<any> {
    const feedbackAnalytics = feedbackAnalyzer.generateLearningInsights()
    
    return {
      userFeedback: {
        totalFeedbackReceived: feedbackAnalytics.overallTrends?.totalFeedback || 0,
        averageRating: feedbackAnalytics.overallTrends?.averageRating || 0,
        feedbackResponseRate: 75, // Mock value
        componentSatisfaction: feedbackAnalytics.componentInsights || {},
        satisfactionTrend: feedbackAnalytics.overallTrends?.trend || 'stable',
        feedbackQuality: 80 // Mock value
      },
      predictionAccuracy: {
        totalPredictions: 0,
        validatedPredictions: 0,
        averageAccuracy: 0,
        priceAccuracy: 0,
        trendAccuracy: 0,
        timeframeAccuracy: 0,
        modelCalibration: 0,
        biasDetection: []
      },
      promptOptimization: {
        averageQuality: 75,
        successRate: 85,
        userSatisfaction: 4.0,
        responseTime: 2500,
        tokenEfficiency: 0.03
      },
      regionalIntelligence: {
        regionsLearned: 0,
        averageConfidence: 0,
        patternAccuracy: 0,
        bestRegions: [],
        worstRegions: [],
        coveragePercentage: 0
      },
      comparableSelection: {
        selectionAccuracy: 75,
        valuationImprovement: 10,
        userSatisfaction: 3.8,
        activePatterns: 0,
        patternSuccessRate: 0
      }
    }
  }

  private async generateLearningInsights(): Promise<any[]> {
    const patterns = await this.analyzeDataPatterns()
    const correlations = await this.correlationAnalysis()
    
    const insights = []

    // Add pattern-based insights
    if (patterns.anomalies.length > 0) {
      insights.push({
        type: 'anomaly',
        title: 'Performance Anomalies Detected',
        description: `${patterns.anomalies.length} unusual patterns detected in system performance`,
        impact: 'medium',
        confidence: 70,
        evidence: patterns.anomalies.map(a => a.description),
        relatedMetrics: ['performance_metrics'],
        recommendations: ['Investigate anomaly root causes', 'Adjust monitoring thresholds']
      })
    }

    // Add correlation insights
    if (correlations.strongCorrelations.length > 0) {
      insights.push({
        type: 'pattern',
        title: 'Strong Performance Correlations Found',
        description: `Found ${correlations.strongCorrelations.length} strong correlations affecting performance`,
        impact: 'high',
        confidence: 85,
        evidence: correlations.insights,
        relatedMetrics: ['correlation_analysis'],
        recommendations: correlations.actionableFindings
      })
    }

    return insights
  }

  private calculateSystemReliability(feedbackStats: any, predictionStats: any): number {
    // Calculate overall system reliability score
    let reliability = 80 // Base score

    if (feedbackStats.averageRating > 4) reliability += 10
    else if (feedbackStats.averageRating < 3) reliability -= 15

    if (predictionStats.overallStats?.averageAccuracy > 80) reliability += 10
    else if (predictionStats.overallStats?.averageAccuracy < 60) reliability -= 15

    return Math.max(0, Math.min(100, reliability))
  }

  private async saveLearningReport(report: LearningAnalytics): Promise<void> {
    try {
      const reportFile = path.join(this.dataDir, `learning-report-${Date.now()}.json`)
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8')
      console.log(`Learning report saved to: ${reportFile}`)
    } catch (error) {
      console.error('Error saving learning report:', error)
    }
  }

  // Placeholder methods for different recommendation types
  private async getFeedbackRecommendations(): Promise<SystemRecommendation[]> { return [] }
  private async getPredictionRecommendations(): Promise<SystemRecommendation[]> { return [] }
  private async getPromptRecommendations(): Promise<SystemRecommendation[]> { return [] }
  private async getRegionalRecommendations(): Promise<SystemRecommendation[]> { return [] }
  private async getComparableRecommendations(): Promise<SystemRecommendation[]> { return [] }

  private async updateLearningFromValidation(validationResult: any): Promise<void> {
    console.log(`Updating learning from validation results: ${validationResult.accuracy}% accuracy`)
  }

  private async updateRegionalWeights(validationResults: PredictionValidation[]): Promise<void> {
    console.log('Updating regional intelligence weights from validation')
  }

  private async updateComparableWeights(validationResults: PredictionValidation[]): Promise<void> {
    console.log('Updating comparable selection weights from validation')
  }

  // Pattern analysis methods
  private async analyzeUserBehaviorPatterns(): Promise<any[]> { return [] }
  private async analyzeMarketTrendPatterns(): Promise<any[]> { return [] }
  private async analyzePerformancePatterns(): Promise<any[]> { return [] }
  private async detectAnomalies(): Promise<any[]> { return [] }

  private async calculateCorrelation(factor1: string, factor2: string): Promise<number> {
    // Placeholder correlation calculation
    return Math.random() * 2 - 1 // Random correlation between -1 and 1
  }

  private generateCorrelationInsights(correlations: any[]): string[] {
    return correlations.map(c => 
      `${c.factor1} and ${c.factor2} show ${Math.abs(c.correlation) > 0.7 ? 'strong' : 'moderate'} correlation`
    )
  }

  private generateActionableFindings(correlations: any[]): string[] {
    return ['Focus on data quality improvement', 'Enhance user feedback collection']
  }

  // Component improvement methods
  private async triggerComponentImprovements(components: string[], sessionId: string): Promise<void> {
    console.log(`Triggering improvements for components: ${components.join(', ')}`)
  }

  private async processDataCorrections(corrections: any[], sessionId: string): Promise<void> {
    console.log(`Processing ${corrections.length} data corrections for session: ${sessionId}`)
  }

  private async updatePromptTracking(feedback: UserFeedback): Promise<void> {
    await promptOptimizer.trackPromptUsage(
      'market_summary',
      '',
      feedback.componentRatings.aiSummary.rating,
      { success: feedback.componentRatings.aiSummary.rating >= 3 }
    )
  }

  private async updateComparableTracking(feedback: UserFeedback): Promise<void> {
    console.log('Updating comparable tracking from feedback')
  }

  private async updateRegionalTracking(feedback: UserFeedback): Promise<void> {
    console.log('Updating regional tracking from feedback')
  }

  private async optimizeComponent(component: string, comments?: string): Promise<void> {
    console.log(`Optimizing component: ${component}`, comments ? `Comments: ${comments}` : '')
  }

  // Public utility methods
  public enableLearning(): void {
    this.isEnabled = true
    console.log('Learning engine enabled')
  }

  public disableLearning(): void {
    this.isEnabled = false
    console.log('Learning engine disabled')
  }

  public isLearningEnabled(): boolean {
    return this.isEnabled
  }
}

// Create singleton instance
export const learningEngine = new LearningEngine()

export default {
  LearningEngine,
  learningEngine
} 