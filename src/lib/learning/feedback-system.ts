// User Feedback System - Core Implementation
// Collects user ratings, corrections, and outcome verification for AI learning

import { 
  UserFeedback, 
  ComponentRating, 
  PropertyCorrection, 
  OutcomeVerification,
  LearningAnalytics 
} from './learning-types'
import { PropertyData, CMAReport } from '@/types'
import path from 'path'
import fs from 'fs'

// ========================================
// FEEDBACK DATABASE MANAGEMENT
// ========================================

export class FeedbackDatabase {
  private dataDir: string
  private feedbackFile: string
  private feedback: Map<string, UserFeedback> = new Map()
  private isLoaded: boolean = false

  constructor(dataDir: string = './data/learning') {
    this.dataDir = dataDir
    this.feedbackFile = path.join(dataDir, 'user-feedback.json')
    this.ensureDataDirectory()
    this.loadDatabase()
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
      console.log(`Created learning data directory: ${this.dataDir}`)
    }
  }

  private loadDatabase(): void {
    try {
      if (fs.existsSync(this.feedbackFile)) {
        const data = fs.readFileSync(this.feedbackFile, 'utf8')
        const feedbackArray: UserFeedback[] = JSON.parse(data)
        this.feedback.clear()
        feedbackArray.forEach(fb => {
          this.feedback.set(fb.id, fb)
        })
        console.log(`Loaded ${this.feedback.size} feedback entries from database`)
      }
      this.isLoaded = true
    } catch (error) {
      console.error('Error loading feedback database:', error)
      this.feedback.clear()
      this.isLoaded = true
    }
  }

  private saveDatabase(): void {
    try {
      const feedbackArray = Array.from(this.feedback.values())
      fs.writeFileSync(this.feedbackFile, JSON.stringify(feedbackArray, null, 2), 'utf8')
    } catch (error) {
      console.error('Error saving feedback database:', error)
    }
  }

  public addFeedback(feedback: UserFeedback): void {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    this.feedback.set(feedback.id, feedback)
    this.saveDatabase()
    console.log(`Saved feedback for session: ${feedback.sessionId}`)
  }

  public updateOutcome(sessionId: string, outcome: OutcomeVerification): boolean {
    if (!this.isLoaded) {
      this.loadDatabase()
    }

    // Find feedback by session ID
    for (const [id, feedback] of Array.from(this.feedback.entries())) {
      if (feedback.sessionId === sessionId) {
        feedback.outcomeVerification = outcome
        this.feedback.set(id, feedback)
        this.saveDatabase()
        console.log(`Updated outcome verification for session: ${sessionId}`)
        return true
      }
    }
    return false
  }

  public getFeedbackBySession(sessionId: string): UserFeedback | null {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    for (const feedback of Array.from(this.feedback.values())) {
      if (feedback.sessionId === sessionId) {
        return feedback
      }
    }
    return null
  }

  public getAllFeedback(): UserFeedback[] {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    return Array.from(this.feedback.values())
  }

  public getFeedbackStats(): {
    totalFeedback: number
    averageRating: number
    responseRate: number
    componentSatisfaction: { [component: string]: number }
    recentTrend: 'improving' | 'stable' | 'declining'
  } {
    const allFeedback = this.getAllFeedback()
    
    if (allFeedback.length === 0) {
      return {
        totalFeedback: 0,
        averageRating: 0,
        responseRate: 0,
        componentSatisfaction: {},
        recentTrend: 'stable'
      }
    }

    // Calculate average rating
    const averageRating = allFeedback.reduce((sum, fb) => sum + fb.overallRating, 0) / allFeedback.length

    // Calculate component satisfaction
    const componentSatisfaction: { [component: string]: number } = {}
    const components = ['valuation', 'comparables', 'marketAnalysis', 'amenities', 'futureOutlook', 'aiSummary']
    
    components.forEach(component => {
      const ratings = allFeedback.map(fb => fb.componentRatings[component as keyof typeof fb.componentRatings]?.rating).filter(r => r)
      componentSatisfaction[component] = ratings.length > 0 
        ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length 
        : 0
    })

    // Calculate trend (compare last 30 days to previous 30 days)
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    const recentFeedback = allFeedback.filter(fb => new Date(fb.timestamp) >= thirtyDaysAgo)
    const previousFeedback = allFeedback.filter(fb => {
      const date = new Date(fb.timestamp)
      return date >= sixtyDaysAgo && date < thirtyDaysAgo
    })

    let recentTrend: 'improving' | 'stable' | 'declining' = 'stable'
    if (recentFeedback.length > 0 && previousFeedback.length > 0) {
      const recentAvg = recentFeedback.reduce((sum, fb) => sum + fb.overallRating, 0) / recentFeedback.length
      const previousAvg = previousFeedback.reduce((sum, fb) => sum + fb.overallRating, 0) / previousFeedback.length
      
      const improvement = recentAvg - previousAvg
      if (improvement > 0.2) recentTrend = 'improving'
      else if (improvement < -0.2) recentTrend = 'declining'
    }

    return {
      totalFeedback: allFeedback.length,
      averageRating,
      responseRate: 100, // This would need to be calculated based on total sessions
      componentSatisfaction,
      recentTrend
    }
  }
}

// ========================================
// FEEDBACK COLLECTION SERVICE
// ========================================

export class FeedbackCollectionService {
  private database: FeedbackDatabase

  constructor(dataDir?: string) {
    this.database = new FeedbackDatabase(dataDir)
  }

  // Create feedback template from session analysis
  public createFeedbackTemplate(sessionId: string, report: CMAReport): UserFeedback {
    const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    return {
      id: feedbackId,
      sessionId,
      timestamp: new Date().toISOString(),
      overallRating: 3, // Default neutral rating
      componentRatings: {
        valuation: { rating: 3, accuracy: 3, usefulness: 3 },
        comparables: { rating: 3, accuracy: 3, usefulness: 3 },
        marketAnalysis: { rating: 3, accuracy: 3, usefulness: 3 },
        amenities: { rating: 3, accuracy: 3, usefulness: 3 },
        futureOutlook: { rating: 3, accuracy: 3, usefulness: 3 },
        aiSummary: { rating: 3, accuracy: 3, usefulness: 3 }
      },
      corrections: []
    }
  }

  // Submit user feedback
  public async submitFeedback(feedback: UserFeedback): Promise<{ success: boolean; message: string }> {
    try {
      // Validate feedback
      const validation = this.validateFeedback(feedback)
      if (!validation.isValid) {
        return { success: false, message: validation.error || 'Invalid feedback data' }
      }

      // Add timestamp if not present
      if (!feedback.timestamp) {
        feedback.timestamp = new Date().toISOString()
      }

      // Save to database
      this.database.addFeedback(feedback)

      // Process feedback for immediate learning insights
      await this.processFeedbackForLearning(feedback)

      console.log(`Feedback submitted successfully for session: ${feedback.sessionId}`)
      return { success: true, message: 'Feedback submitted successfully' }
    } catch (error) {
      console.error('Error submitting feedback:', error)
      return { success: false, message: 'Failed to submit feedback' }
    }
  }

  // Update outcome verification
  public async updateOutcome(sessionId: string, outcome: OutcomeVerification): Promise<{ success: boolean; message: string }> {
    try {
      const success = this.database.updateOutcome(sessionId, outcome)
      
      if (success) {
        // Process outcome for learning
        await this.processOutcomeForLearning(sessionId, outcome)
        return { success: true, message: 'Outcome updated successfully' }
      } else {
        return { success: false, message: 'Feedback not found for this session' }
      }
    } catch (error) {
      console.error('Error updating outcome:', error)
      return { success: false, message: 'Failed to update outcome' }
    }
  }

  // Get feedback analytics
  public getFeedbackAnalytics(): any {
    return this.database.getFeedbackStats()
  }

  // Get all feedback for analysis
  public getAllFeedback(): UserFeedback[] {
    return this.database.getAllFeedback()
  }

  // Validate feedback data
  private validateFeedback(feedback: UserFeedback): { isValid: boolean; error?: string } {
    if (!feedback.sessionId) {
      return { isValid: false, error: 'Session ID is required' }
    }

    if (!feedback.overallRating || feedback.overallRating < 1 || feedback.overallRating > 5) {
      return { isValid: false, error: 'Overall rating must be between 1 and 5' }
    }

    // Validate component ratings
    const components = ['valuation', 'comparables', 'marketAnalysis', 'amenities', 'futureOutlook', 'aiSummary']
    for (const component of components) {
      const rating = feedback.componentRatings[component as keyof typeof feedback.componentRatings]
      if (rating && (rating.rating < 1 || rating.rating > 5)) {
        return { isValid: false, error: `Invalid rating for component: ${component}` }
      }
    }

    return { isValid: true }
  }

  // Process feedback for immediate learning insights
  private async processFeedbackForLearning(feedback: UserFeedback): Promise<void> {
    try {
      // Identify areas for improvement
      const lowRatedComponents = this.identifyLowRatedComponents(feedback)
      if (lowRatedComponents.length > 0) {
        console.log(`Low-rated components identified: ${lowRatedComponents.join(', ')}`)
        // This could trigger immediate optimizations
      }

      // Process corrections for data quality improvement
      if (feedback.corrections.length > 0) {
        console.log(`Property corrections received: ${feedback.corrections.length} corrections`)
        await this.processPropertyCorrections(feedback.corrections, feedback.sessionId)
      }

      // Update prompt performance if AI summary was rated
      const aiRating = feedback.componentRatings.aiSummary
      if (aiRating) {
        await this.updatePromptPerformance(feedback.sessionId, aiRating)
      }

    } catch (error) {
      console.error('Error processing feedback for learning:', error)
    }
  }

  // Process outcome verification for prediction validation
  private async processOutcomeForLearning(sessionId: string, outcome: OutcomeVerification): Promise<void> {
    try {
      console.log(`Processing outcome verification for session: ${sessionId}`)
      
      // This would update prediction validation
      if (outcome.actualSalePrice || outcome.marketTrendAccuracy) {
        console.log('Market prediction data received - updating validation system')
        // Update prediction validation system
      }

      if (outcome.investmentOutcome) {
        console.log(`Investment outcome reported: ${outcome.investmentOutcome}`)
        // Update investment prediction accuracy
      }

    } catch (error) {
      console.error('Error processing outcome for learning:', error)
    }
  }

  // Identify components with low ratings
  private identifyLowRatedComponents(feedback: UserFeedback): string[] {
    const lowRatedComponents: string[] = []
    const threshold = 3 // Ratings below 3 are considered low

    Object.entries(feedback.componentRatings).forEach(([component, rating]) => {
      if (rating.rating < threshold || rating.accuracy < threshold) {
        lowRatedComponents.push(component)
      }
    })

    return lowRatedComponents
  }

  // Process property corrections
  private async processPropertyCorrections(corrections: PropertyCorrection[], sessionId: string): Promise<void> {
    for (const correction of corrections) {
      console.log(`Property correction: ${correction.field} changed from ${correction.originalValue} to ${correction.correctedValue}`)
      
      // This could update data validation rules or highlight data quality issues
      if (correction.confidence >= 4) {
        console.log(`High-confidence correction received for: ${correction.field}`)
        // Could trigger immediate data source validation
      }
    }
  }

  // Update prompt performance based on AI summary ratings
  private async updatePromptPerformance(sessionId: string, aiRating: ComponentRating): Promise<void> {
    try {
      console.log(`AI Summary rated: ${aiRating.rating}/5 (accuracy: ${aiRating.accuracy}/5, usefulness: ${aiRating.usefulness}/5)`)
      
      // This would feed into the prompt optimization system
      if (aiRating.rating < 3) {
        console.log('Low AI summary rating - may need prompt optimization')
      }

      if (aiRating.comments) {
        console.log(`AI Summary feedback: ${aiRating.comments}`)
        // Could analyze comments for specific improvement areas
      }

    } catch (error) {
      console.error('Error updating prompt performance:', error)
    }
  }
}

// ========================================
// FEEDBACK ANALYSIS & INSIGHTS
// ========================================

export class FeedbackAnalyzer {
  private database: FeedbackDatabase

  constructor(dataDir?: string) {
    this.database = new FeedbackDatabase(dataDir)
  }

  // Generate learning insights from feedback
  public generateLearningInsights(): {
    overallTrends: any
    componentInsights: any
    correctionPatterns: any
    outcomeValidation: any
    recommendations: string[]
  } {
    const allFeedback = this.database.getAllFeedback()
    
    return {
      overallTrends: this.analyzeOverallTrends(allFeedback),
      componentInsights: this.analyzeComponentPerformance(allFeedback),
      correctionPatterns: this.analyzeCorrectionPatterns(allFeedback),
      outcomeValidation: this.analyzeOutcomeValidation(allFeedback),
      recommendations: this.generateRecommendations(allFeedback)
    }
  }

  // Analyze overall satisfaction trends
  private analyzeOverallTrends(feedback: UserFeedback[]): any {
    if (feedback.length === 0) return null

    // Sort by date
    const sortedFeedback = feedback.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    
    // Calculate moving averages
    const window = 10 // 10-feedback moving average
    const movingAverages = []
    
    for (let i = window - 1; i < sortedFeedback.length; i++) {
      const slice = sortedFeedback.slice(i - window + 1, i + 1)
      const average = slice.reduce((sum, fb) => sum + fb.overallRating, 0) / slice.length
      movingAverages.push({
        date: slice[slice.length - 1].timestamp,
        rating: average
      })
    }

    return {
      totalFeedback: feedback.length,
      averageRating: feedback.reduce((sum, fb) => sum + fb.overallRating, 0) / feedback.length,
      movingAverages,
      trend: this.calculateTrend(movingAverages)
    }
  }

  // Analyze component-specific performance
  private analyzeComponentPerformance(feedback: UserFeedback[]): any {
    const components = ['valuation', 'comparables', 'marketAnalysis', 'amenities', 'futureOutlook', 'aiSummary']
    const componentStats: any = {}

    components.forEach(component => {
      const ratings = feedback.map(fb => fb.componentRatings[component as keyof typeof fb.componentRatings]).filter(r => r)
      
      if (ratings.length > 0) {
        componentStats[component] = {
          averageRating: ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length,
          averageAccuracy: ratings.reduce((sum, r) => sum + r.accuracy, 0) / ratings.length,
          averageUsefulness: ratings.reduce((sum, r) => sum + r.usefulness, 0) / ratings.length,
          totalRatings: ratings.length,
          comments: ratings.map(r => r.comments).filter(c => c),
          trend: this.calculateComponentTrend(feedback, component)
        }
      }
    })

    return componentStats
  }

  // Analyze correction patterns
  private analyzeCorrectionPatterns(feedback: UserFeedback[]): any {
    const allCorrections = feedback.flatMap(fb => fb.corrections)
    
    if (allCorrections.length === 0) return null

    // Group by field
    const correctionsByField: { [field: string]: PropertyCorrection[] } = {}
    allCorrections.forEach(correction => {
      if (!correctionsByField[correction.field]) {
        correctionsByField[correction.field] = []
      }
      correctionsByField[correction.field].push(correction)
    })

    // Analyze patterns
    const patterns: any = {}
    Object.entries(correctionsByField).forEach(([field, corrections]) => {
      patterns[field] = {
        totalCorrections: corrections.length,
        averageConfidence: corrections.reduce((sum, c) => sum + c.confidence, 0) / corrections.length,
        commonSources: this.getMostCommonSources(corrections),
        pattern: this.identifyPattern(corrections)
      }
    })

    return {
      totalCorrections: allCorrections.length,
      correctionsByField: patterns,
      mostCorrectedFields: Object.keys(patterns).sort((a, b) => patterns[b].totalCorrections - patterns[a].totalCorrections).slice(0, 5)
    }
  }

  // Analyze outcome validation
  private analyzeOutcomeValidation(feedback: UserFeedback[]): any {
    const outcomesWithValidation = feedback.filter(fb => fb.outcomeVerification)
    
    if (outcomesWithValidation.length === 0) return null

    const validationStats = {
      totalValidations: outcomesWithValidation.length,
      priceAccuracy: [] as number[],
      investmentOutcomes: [] as string[],
      marketTrendAccuracy: [] as string[]
    }

    outcomesWithValidation.forEach(fb => {
      const outcome = fb.outcomeVerification!
      
      if (outcome.finalSaleRatio) {
        // Calculate how close our estimate was (1.0 = perfect)
        const accuracy = 100 - Math.abs((outcome.finalSaleRatio - 1.0) * 100)
        validationStats.priceAccuracy.push(Math.max(0, accuracy))
      }
      
      if (outcome.investmentOutcome) {
        validationStats.investmentOutcomes.push(outcome.investmentOutcome)
      }
      
      if (outcome.marketTrendAccuracy) {
        validationStats.marketTrendAccuracy.push(outcome.marketTrendAccuracy)
      }
    })

    return validationStats
  }

  // Generate actionable recommendations
  private generateRecommendations(feedback: UserFeedback[]): string[] {
    const recommendations: string[] = []
    const stats = this.database.getFeedbackStats()

    // Overall rating recommendations
    if (stats.averageRating < 3.5) {
      recommendations.push('Overall satisfaction is below target. Focus on improving core analysis quality.')
    }

    // Component-specific recommendations
    Object.entries(stats.componentSatisfaction).forEach(([component, rating]) => {
      if (rating < 3.0) {
        recommendations.push(`${component} component needs improvement (rating: ${rating.toFixed(1)}/5)`)
      }
    })

    // Trend-based recommendations
    if (stats.recentTrend === 'declining') {
      recommendations.push('Recent trend is declining. Investigate recent changes and user feedback patterns.')
    }

    // Data quality recommendations
    const correctionPatterns = this.analyzeCorrectionPatterns(feedback)
    if (correctionPatterns && correctionPatterns.totalCorrections > feedback.length * 0.1) {
      recommendations.push('High correction rate detected. Review data sources and validation processes.')
    }

    return recommendations
  }

  // Helper methods
  private calculateTrend(data: any[]): 'improving' | 'stable' | 'declining' {
    if (data.length < 2) return 'stable'
    
    const recent = data.slice(-5)
    const previous = data.slice(-10, -5)
    
    if (recent.length === 0 || previous.length === 0) return 'stable'
    
    const recentAvg = recent.reduce((sum, d) => sum + d.rating, 0) / recent.length
    const previousAvg = previous.reduce((sum, d) => sum + d.rating, 0) / previous.length
    
    const diff = recentAvg - previousAvg
    if (diff > 0.1) return 'improving'
    if (diff < -0.1) return 'declining'
    return 'stable'
  }

  private calculateComponentTrend(feedback: UserFeedback[], component: string): 'improving' | 'stable' | 'declining' {
    const recentFeedback = feedback.slice(-10)
    const ratings = recentFeedback.map(fb => fb.componentRatings[component as keyof typeof fb.componentRatings]?.rating).filter(r => r)
    
    if (ratings.length < 4) return 'stable'
    
    const recent = ratings.slice(-2).reduce((sum, r) => sum + r, 0) / 2
    const previous = ratings.slice(-4, -2).reduce((sum, r) => sum + r, 0) / 2
    
    const diff = recent - previous
    if (diff > 0.2) return 'improving'
    if (diff < -0.2) return 'declining'
    return 'stable'
  }

  private getMostCommonSources(corrections: PropertyCorrection[]): string[] {
    const sources: { [source: string]: number } = {}
    corrections.forEach(c => {
      if (c.source) {
        sources[c.source] = (sources[c.source] || 0) + 1
      }
    })
    
    return Object.keys(sources).sort((a, b) => sources[b] - sources[a]).slice(0, 3)
  }

  private identifyPattern(corrections: PropertyCorrection[]): string {
    // Simple pattern identification
    if (corrections.length < 3) return 'insufficient_data'
    
    const averageConfidence = corrections.reduce((sum, c) => sum + c.confidence, 0) / corrections.length
    
    if (averageConfidence > 4) return 'high_confidence_corrections'
    if (averageConfidence < 2) return 'low_confidence_corrections'
    return 'mixed_confidence'
  }
}

// Create singleton instances
export const feedbackDatabase = new FeedbackDatabase()
export const feedbackService = new FeedbackCollectionService()
export const feedbackAnalyzer = new FeedbackAnalyzer()

export default {
  FeedbackDatabase,
  FeedbackCollectionService,
  FeedbackAnalyzer,
  feedbackDatabase,
  feedbackService,
  feedbackAnalyzer
} 