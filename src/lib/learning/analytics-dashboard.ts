// Learning Analytics Dashboard
// Monitors learning progress, system performance, and provides actionable insights

import { 
  LearningAnalytics,
  SystemMetrics,
  LearningInsight,
  SystemRecommendation
} from './learning-types'

// Import learning components for data access
import { feedbackDatabase, feedbackAnalyzer } from './feedback-system'
import { predictionDatabase } from './prediction-tracker'
import { promptDatabase } from './prompt-optimizer'
import { regionalKnowledgeDatabase } from './regional-intelligence'
import { comparableIntelligenceDatabase } from './smart-comparables'

import path from 'path'
import fs from 'fs'

// ========================================
// ANALYTICS DATA AGGREGATOR
// ========================================

export class AnalyticsDataAggregator {
  private dataDir: string
  private metricsHistoryFile: string
  private metricsHistory: SystemMetrics[] = []

  constructor(dataDir: string = './data/learning') {
    this.dataDir = dataDir
    this.metricsHistoryFile = path.join(dataDir, 'metrics-history.json')
    this.loadMetricsHistory()
  }

  private loadMetricsHistory(): void {
    try {
      if (fs.existsSync(this.metricsHistoryFile)) {
        const data = fs.readFileSync(this.metricsHistoryFile, 'utf8')
        this.metricsHistory = JSON.parse(data)
        console.log(`Loaded ${this.metricsHistory.length} historical metrics records`)
      }
    } catch (error) {
      console.error('Error loading metrics history:', error)
      this.metricsHistory = []
    }
  }

  private saveMetricsHistory(): void {
    try {
      fs.writeFileSync(this.metricsHistoryFile, JSON.stringify(this.metricsHistory, null, 2), 'utf8')
    } catch (error) {
      console.error('Error saving metrics history:', error)
    }
  }

  // Collect and aggregate all system metrics
  public async collectCurrentMetrics(): Promise<SystemMetrics> {
    try {
      console.log('Collecting current system metrics')

      // Get feedback metrics
      const feedbackStats = feedbackDatabase.getFeedbackStats()
      
      // Get prediction metrics
      const predictionStats = predictionDatabase.getPerformanceStats()
      
      // Get prompt metrics
      const promptPerformance = promptDatabase.getAllPerformance()
      
      // Get regional intelligence metrics
      const regionalStats = regionalKnowledgeDatabase.getKnowledgeStats()
      
      // Get comparable intelligence metrics
      const comparableStats = comparableIntelligenceDatabase.getIntelligenceStats()

      const currentMetrics: SystemMetrics = {
        totalAnalyses: feedbackStats.totalFeedback + predictionStats.totalPredictions,
        averageQualityScore: feedbackStats.averageRating * 20, // Convert to 0-100 scale
        userSatisfactionScore: feedbackStats.averageRating * 20,
        predictionAccuracy: predictionStats.averageAccuracy,
        systemReliability: this.calculateSystemReliability(feedbackStats, predictionStats),
        
        qualityTrend: feedbackStats.recentTrend,
        improvementRate: this.calculateImprovementRate(),
        
        criticalErrors: this.countCriticalErrors(),
        userReportedIssues: this.countUserReportedIssues(),
        systemUptime: this.calculateSystemUptime()
      }

      // Store in history
      this.metricsHistory.push(currentMetrics)
      
      // Keep only last 100 records
      if (this.metricsHistory.length > 100) {
        this.metricsHistory = this.metricsHistory.slice(-100)
      }
      
      this.saveMetricsHistory()
      
      console.log('Current metrics collected successfully')
      return currentMetrics
    } catch (error) {
      console.error('Error collecting current metrics:', error)
      throw error
    }
  }

  // Get historical metrics for trend analysis
  public getMetricsHistory(days: number = 30): SystemMetrics[] {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    // For now, return all history (would filter by date in real implementation)
    return this.metricsHistory
  }

  // Get metrics summary for dashboard
  public getMetricsSummary(): {
    current: SystemMetrics
    previous: SystemMetrics | null
    trends: { [key: string]: 'improving' | 'stable' | 'declining' }
    alerts: string[]
  } {
    const history = this.metricsHistory
    
    if (history.length === 0) {
      return {
        current: this.getDefaultMetrics(),
        previous: null,
        trends: {},
        alerts: ['No historical data available']
      }
    }

    const current = history[history.length - 1]
    const previous = history.length > 1 ? history[history.length - 2] : null
    
    const trends = this.calculateTrends(current, previous)
    const alerts = this.generateAlerts(current, trends)

    return { current, previous, trends, alerts }
  }

  private calculateSystemReliability(feedbackStats: any, predictionStats: any): number {
    let reliability = 85 // Base reliability score

    // Adjust based on user satisfaction
    if (feedbackStats.averageRating >= 4) reliability += 10
    else if (feedbackStats.averageRating < 3) reliability -= 20

    // Adjust based on prediction accuracy
    if (predictionStats.averageAccuracy >= 80) reliability += 5
    else if (predictionStats.averageAccuracy < 60) reliability -= 10

    // Adjust based on feedback response rate
    if (feedbackStats.responseRate >= 80) reliability += 5
    else if (feedbackStats.responseRate < 50) reliability -= 5

    return Math.max(0, Math.min(100, reliability))
  }

  private calculateImprovementRate(): number {
    if (this.metricsHistory.length < 2) return 0

    const recent = this.metricsHistory.slice(-5) // Last 5 measurements
    const previous = this.metricsHistory.slice(-10, -5) // Previous 5 measurements

    if (recent.length === 0 || previous.length === 0) return 0

    const recentAvg = recent.reduce((sum, m) => sum + m.averageQualityScore, 0) / recent.length
    const previousAvg = previous.reduce((sum, m) => sum + m.averageQualityScore, 0) / previous.length

    return ((recentAvg - previousAvg) / previousAvg) * 100
  }

  private countCriticalErrors(): number {
    // Count critical errors from feedback and system logs
    const allFeedback = feedbackDatabase.getAllFeedback()
    const criticalFeedback = allFeedback.filter(f => f.overallRating <= 2)
    return criticalFeedback.length
  }

  private countUserReportedIssues(): number {
    // Count user-reported issues from feedback comments
    const allFeedback = feedbackDatabase.getAllFeedback()
    const issueReports = allFeedback.filter(f => 
      f.overallComments?.toLowerCase().includes('issue') ||
      f.overallComments?.toLowerCase().includes('problem') ||
      f.overallComments?.toLowerCase().includes('error')
    )
    return issueReports.length
  }

  private calculateSystemUptime(): number {
    // Mock calculation - in production would track actual uptime
    return 99.2
  }

  private getDefaultMetrics(): SystemMetrics {
    return {
      totalAnalyses: 0,
      averageQualityScore: 0,
      userSatisfactionScore: 0,
      predictionAccuracy: 0,
      systemReliability: 0,
      qualityTrend: 'stable',
      improvementRate: 0,
      criticalErrors: 0,
      userReportedIssues: 0,
      systemUptime: 100
    }
  }

  private calculateTrends(current: SystemMetrics, previous: SystemMetrics | null): { [key: string]: 'improving' | 'stable' | 'declining' } {
    const trends: { [key: string]: 'improving' | 'stable' | 'declining' } = {}

    if (!previous) {
      return {
        qualityScore: 'stable',
        userSatisfaction: 'stable',
        predictionAccuracy: 'stable',
        systemReliability: 'stable'
      }
    }

    // Calculate trends for key metrics
    trends.qualityScore = this.getTrend(current.averageQualityScore, previous.averageQualityScore)
    trends.userSatisfaction = this.getTrend(current.userSatisfactionScore, previous.userSatisfactionScore)
    trends.predictionAccuracy = this.getTrend(current.predictionAccuracy, previous.predictionAccuracy)
    trends.systemReliability = this.getTrend(current.systemReliability, previous.systemReliability)

    return trends
  }

  private getTrend(current: number, previous: number): 'improving' | 'stable' | 'declining' {
    const change = ((current - previous) / previous) * 100
    if (change > 2) return 'improving'
    if (change < -2) return 'declining'
    return 'stable'
  }

  private generateAlerts(current: SystemMetrics, trends: { [key: string]: 'improving' | 'stable' | 'declining' }): string[] {
    const alerts: string[] = []

    // Quality alerts
    if (current.averageQualityScore < 60) {
      alerts.push('Critical: Average quality score below 60%')
    } else if (current.averageQualityScore < 70) {
      alerts.push('Warning: Average quality score below 70%')
    }

    // User satisfaction alerts
    if (current.userSatisfactionScore < 60) {
      alerts.push('Critical: User satisfaction below 60%')
    }

    // Prediction accuracy alerts
    if (current.predictionAccuracy < 60) {
      alerts.push('Warning: Prediction accuracy below 60%')
    }

    // System reliability alerts
    if (current.systemReliability < 80) {
      alerts.push('Critical: System reliability below 80%')
    }

    // Trend alerts
    if (trends.qualityScore === 'declining') {
      alerts.push('Alert: Quality score is declining')
    }
    if (trends.userSatisfaction === 'declining') {
      alerts.push('Alert: User satisfaction is declining')
    }

    // Error alerts
    if (current.criticalErrors > 5) {
      alerts.push(`Alert: ${current.criticalErrors} critical errors detected`)
    }

    return alerts
  }
}

// ========================================
// PERFORMANCE DASHBOARD
// ========================================

export class PerformanceDashboard {
  private aggregator: AnalyticsDataAggregator

  constructor(dataDir?: string) {
    this.aggregator = new AnalyticsDataAggregator(dataDir)
  }

  // Get comprehensive dashboard data
  public async getDashboardData(): Promise<{
    overview: any
    componentMetrics: any
    learningProgress: any
    insights: LearningInsight[]
    recommendations: SystemRecommendation[]
    alerts: string[]
  }> {
    try {
      console.log('Generating dashboard data')

      const currentMetrics = await this.aggregator.collectCurrentMetrics()
      const metricsSummary = this.aggregator.getMetricsSummary()
      
      const overview = {
        totalAnalyses: currentMetrics.totalAnalyses,
        averageQuality: currentMetrics.averageQualityScore,
        userSatisfaction: currentMetrics.userSatisfactionScore,
        predictionAccuracy: currentMetrics.predictionAccuracy,
        systemReliability: currentMetrics.systemReliability,
        uptime: currentMetrics.systemUptime,
        trends: metricsSummary.trends
      }

      const componentMetrics = await this.getComponentMetrics()
      const learningProgress = await this.getLearningProgress()
      const insights = await this.generateInsights()
      const recommendations = await this.generateRecommendations()

      return {
        overview,
        componentMetrics,
        learningProgress,
        insights,
        recommendations,
        alerts: metricsSummary.alerts
      }
    } catch (error) {
      console.error('Error generating dashboard data:', error)
      throw error
    }
  }

  // Get real-time performance data for live monitoring
  public async getRealTimeData(): Promise<{
    currentLoad: number
    responseTime: number
    errorRate: number
    activeUsers: number
    systemHealth: 'healthy' | 'warning' | 'critical'
  }> {
    try {
      const currentMetrics = await this.aggregator.collectCurrentMetrics()
      
      return {
        currentLoad: Math.random() * 100, // Mock data
        responseTime: 2500 + Math.random() * 1000, // Mock data
        errorRate: currentMetrics.criticalErrors / Math.max(1, currentMetrics.totalAnalyses) * 100,
        activeUsers: 5 + Math.floor(Math.random() * 20), // Mock data
        systemHealth: this.calculateSystemHealth(currentMetrics)
      }
    } catch (error) {
      console.error('Error getting real-time data:', error)
      return {
        currentLoad: 0,
        responseTime: 0,
        errorRate: 0,
        activeUsers: 0,
        systemHealth: 'critical'
      }
    }
  }

  // Get learning analytics report
  public async getLearningAnalytics(timeframe: string = 'monthly'): Promise<LearningAnalytics> {
    try {
      const reportId = `analytics_${Date.now()}`
      const currentMetrics = await this.aggregator.collectCurrentMetrics()
      
      const analytics: LearningAnalytics = {
        id: reportId,
        timestamp: new Date().toISOString(),
        timeframe: timeframe as any,
        overallMetrics: currentMetrics,
        componentMetrics: await this.getComponentMetrics(),
        insights: await this.generateInsights(),
        recommendations: await this.generateRecommendations()
      }

      console.log('Learning analytics report generated')
      return analytics
    } catch (error) {
      console.error('Error generating learning analytics:', error)
      throw error
    }
  }

  // Export dashboard data for external analysis
  public async exportData(format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const dashboardData = await this.getDashboardData()
      
      if (format === 'json') {
        return JSON.stringify(dashboardData, null, 2)
      } else {
        return this.convertToCSV(dashboardData)
      }
    } catch (error) {
      console.error('Error exporting dashboard data:', error)
      throw error
    }
  }

  // Private helper methods
  private async getComponentMetrics(): Promise<any> {
    const feedbackStats = feedbackDatabase.getFeedbackStats()
    const predictionStats = predictionDatabase.getPerformanceStats()
    const promptPerformance = promptDatabase.getAllPerformance()
    const regionalStats = regionalKnowledgeDatabase.getKnowledgeStats()
    const comparableStats = comparableIntelligenceDatabase.getIntelligenceStats()

    return {
      feedback: {
        totalReceived: feedbackStats.totalFeedback,
        averageRating: feedbackStats.averageRating,
        responseRate: feedbackStats.responseRate,
        trend: feedbackStats.recentTrend,
        componentSatisfaction: feedbackStats.componentSatisfaction
      },
      predictions: {
        total: predictionStats.totalPredictions,
        validated: predictionStats.validatedPredictions,
        accuracy: predictionStats.averageAccuracy,
        priceAccuracy: predictionStats.priceAccuracy,
        trendAccuracy: predictionStats.trendAccuracy,
        modelCalibration: predictionStats.modelCalibration
      },
      prompts: {
        totalPrompts: promptPerformance.length,
        averageQuality: this.calculateAveragePromptQuality(promptPerformance),
        successRate: this.calculateAveragePromptSuccess(promptPerformance),
        optimizationsNeeded: promptPerformance.filter(p => p.averageQuality < 3.5).length
      },
      regional: {
        totalRegions: regionalStats.totalRegions,
        averageConfidence: regionalStats.averageConfidence,
        regionTypes: regionalStats.regionsByType,
        topRegions: regionalStats.mostKnowledgeableRegions.slice(0, 5)
      },
      comparables: {
        totalCombinations: comparableStats.totalRegions * comparableStats.totalPropertyTypes,
        averageAccuracy: comparableStats.averageAccuracy,
        bestPerforming: comparableStats.bestPerformingCombinations.slice(0, 3),
        needsImprovement: comparableStats.worstPerformingCombinations.slice(0, 3)
      }
    }
  }

  private async getLearningProgress(): Promise<any> {
    const history = this.aggregator.getMetricsHistory(30) // Last 30 days
    
    if (history.length < 2) {
      return {
        dataPoints: history.length,
        trend: 'insufficient_data',
        improvementRate: 0,
        milestones: []
      }
    }

    const trend = this.calculateOverallTrend(history)
    const improvementRate = this.calculateLearningRate(history)
    const milestones = this.identifyMilestones(history)

    return {
      dataPoints: history.length,
      trend,
      improvementRate,
      milestones,
      progressChart: this.generateProgressChart(history)
    }
  }

  private async generateInsights(): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = []
    const currentMetrics = await this.aggregator.collectCurrentMetrics()
    const feedbackAnalytics = feedbackAnalyzer.generateLearningInsights()

    // Quality insights
    if (currentMetrics.averageQualityScore > 80) {
      insights.push({
        type: 'trend',
        title: 'High Quality Performance',
        description: `System is performing well with ${currentMetrics.averageQualityScore.toFixed(1)}% average quality score`,
        impact: 'medium',
        confidence: 85,
        evidence: ['User satisfaction metrics', 'Quality score trends'],
        relatedMetrics: ['quality_score', 'user_satisfaction'],
        recommendations: ['Maintain current performance standards', 'Focus on consistency']
      })
    } else if (currentMetrics.averageQualityScore < 60) {
      insights.push({
        type: 'risk',
        title: 'Quality Performance Below Target',
        description: `System quality needs improvement - current score: ${currentMetrics.averageQualityScore.toFixed(1)}%`,
        impact: 'high',
        confidence: 90,
        evidence: ['Low quality scores', 'User feedback patterns'],
        relatedMetrics: ['quality_score', 'user_satisfaction'],
        recommendations: ['Review and optimize core algorithms', 'Increase feedback collection', 'Implement quality assurance measures']
      })
    }

    // Learning progress insights
    if (currentMetrics.improvementRate > 5) {
      insights.push({
        type: 'opportunity',
        title: 'Strong Learning Progress',
        description: `System is improving rapidly with ${currentMetrics.improvementRate.toFixed(1)}% improvement rate`,
        impact: 'high',
        confidence: 80,
        evidence: ['Positive trend metrics', 'Improvement rate calculations'],
        relatedMetrics: ['improvement_rate', 'learning_progress'],
        recommendations: ['Continue current learning strategies', 'Expand successful techniques to other areas']
      })
    }

    // Prediction accuracy insights
    if (currentMetrics.predictionAccuracy < 70) {
      insights.push({
        type: 'pattern',
        title: 'Prediction Accuracy Needs Improvement',
        description: `Prediction accuracy is below target at ${currentMetrics.predictionAccuracy.toFixed(1)}%`,
        impact: 'medium',
        confidence: 75,
        evidence: ['Prediction validation results', 'Model performance metrics'],
        relatedMetrics: ['prediction_accuracy', 'model_performance'],
        recommendations: ['Improve training data quality', 'Adjust model parameters', 'Enhance feature engineering']
      })
    }

    return insights
  }

  private async generateRecommendations(): Promise<SystemRecommendation[]> {
    const recommendations: SystemRecommendation[] = []
    const currentMetrics = await this.aggregator.collectCurrentMetrics()
    const componentMetrics = await this.getComponentMetrics()

    // Quality improvement recommendations
    if (currentMetrics.averageQualityScore < 70) {
      recommendations.push({
        id: `rec_quality_${Date.now()}`,
        type: 'optimization',
        priority: 'high',
        title: 'Improve Overall Quality Score',
        description: 'System quality is below target and needs immediate attention',
        expectedImpact: 'Increase quality score by 15-20%',
        implementationEffort: 'medium',
        steps: [
          'Analyze low-rated components and identify root causes',
          'Implement targeted improvements for worst-performing areas',
          'Increase feedback collection and response monitoring',
          'Review and optimize core algorithms'
        ],
        estimatedTimeframe: '2-3 weeks',
        requiredResources: ['Development time', 'Data analysis resources'],
        successCriteria: ['Quality score > 75%', 'User satisfaction > 3.5/5'],
        expectedROI: 'High - improved user experience and system reliability'
      })
    }

    // Feedback collection recommendations
    if (componentMetrics.feedback.responseRate < 60) {
      recommendations.push({
        id: `rec_feedback_${Date.now()}`,
        type: 'process_improvement',
        priority: 'medium',
        title: 'Increase Feedback Collection Rate',
        description: 'Low feedback response rate limits learning effectiveness',
        expectedImpact: 'Improve learning data quality and volume',
        implementationEffort: 'low',
        steps: [
          'Simplify feedback forms and reduce friction',
          'Add incentives for providing feedback',
          'Implement smart prompting based on user behavior',
          'Create multiple feedback touchpoints'
        ],
        estimatedTimeframe: '1-2 weeks',
        requiredResources: ['UI/UX improvements', 'User engagement strategy'],
        successCriteria: ['Feedback response rate > 75%'],
        expectedROI: 'Medium - better learning data leads to improved performance'
      })
    }

    // Prediction accuracy recommendations
    if (componentMetrics.predictions.accuracy < 70) {
      recommendations.push({
        id: `rec_prediction_${Date.now()}`,
        type: 'model_adjustment',
        priority: 'high',
        title: 'Enhance Prediction Model Accuracy',
        description: 'Prediction accuracy is below acceptable threshold',
        expectedImpact: 'Increase prediction accuracy by 10-15%',
        implementationEffort: 'high',
        steps: [
          'Analyze prediction failures and identify patterns',
          'Improve training data quality and quantity',
          'Experiment with different model architectures',
          'Implement ensemble methods for better accuracy'
        ],
        estimatedTimeframe: '3-4 weeks',
        requiredResources: ['Data science expertise', 'Computational resources'],
        successCriteria: ['Prediction accuracy > 75%', 'Reduced prediction variance'],
        expectedROI: 'High - accurate predictions are core to system value'
      })
    }

    return recommendations.slice(0, 5) // Return top 5 recommendations
  }

  private calculateSystemHealth(metrics: SystemMetrics): 'healthy' | 'warning' | 'critical' {
    let healthScore = 100

    // Deduct points for various issues
    if (metrics.averageQualityScore < 70) healthScore -= 20
    if (metrics.userSatisfactionScore < 60) healthScore -= 25
    if (metrics.predictionAccuracy < 60) healthScore -= 15
    if (metrics.systemReliability < 80) healthScore -= 20
    if (metrics.criticalErrors > 5) healthScore -= 15
    if (metrics.systemUptime < 95) healthScore -= 10

    if (healthScore >= 80) return 'healthy'
    if (healthScore >= 60) return 'warning'
    return 'critical'
  }

  private calculateAveragePromptQuality(promptPerformance: any[]): number {
    if (promptPerformance.length === 0) return 0
    return promptPerformance.reduce((sum, p) => sum + p.averageQuality, 0) / promptPerformance.length
  }

  private calculateAveragePromptSuccess(promptPerformance: any[]): number {
    if (promptPerformance.length === 0) return 0
    return promptPerformance.reduce((sum, p) => sum + p.successRate, 0) / promptPerformance.length
  }

  private calculateOverallTrend(history: SystemMetrics[]): 'improving' | 'stable' | 'declining' {
    if (history.length < 5) return 'stable'

    const recent = history.slice(-3)
    const previous = history.slice(-6, -3)

    const recentAvg = recent.reduce((sum, m) => sum + m.averageQualityScore, 0) / recent.length
    const previousAvg = previous.reduce((sum, m) => sum + m.averageQualityScore, 0) / previous.length

    const change = ((recentAvg - previousAvg) / previousAvg) * 100

    if (change > 3) return 'improving'
    if (change < -3) return 'declining'
    return 'stable'
  }

  private calculateLearningRate(history: SystemMetrics[]): number {
    if (history.length < 2) return 0

    const firstQuarter = history.slice(0, Math.floor(history.length / 4))
    const lastQuarter = history.slice(-Math.floor(history.length / 4))

    if (firstQuarter.length === 0 || lastQuarter.length === 0) return 0

    const firstAvg = firstQuarter.reduce((sum, m) => sum + m.averageQualityScore, 0) / firstQuarter.length
    const lastAvg = lastQuarter.reduce((sum, m) => sum + m.averageQualityScore, 0) / lastQuarter.length

    return ((lastAvg - firstAvg) / firstAvg) * 100
  }

  private identifyMilestones(history: SystemMetrics[]): Array<{ date: string; milestone: string; value: number }> {
    const milestones = []

    // Find significant improvements
    for (let i = 1; i < history.length; i++) {
      const current = history[i]
      const previous = history[i - 1]

      // Quality milestone
      if (current.averageQualityScore >= 80 && previous.averageQualityScore < 80) {
        milestones.push({
          date: new Date().toISOString(), // Would use actual timestamp
          milestone: 'Quality Score Reached 80%',
          value: current.averageQualityScore
        })
      }

      // User satisfaction milestone
      if (current.userSatisfactionScore >= 80 && previous.userSatisfactionScore < 80) {
        milestones.push({
          date: new Date().toISOString(),
          milestone: 'User Satisfaction Reached 80%',
          value: current.userSatisfactionScore
        })
      }
    }

    return milestones.slice(-5) // Return last 5 milestones
  }

  private generateProgressChart(history: SystemMetrics[]): any {
    return {
      labels: history.map((_, index) => `Day ${index + 1}`),
      qualityScores: history.map(m => m.averageQualityScore),
      userSatisfaction: history.map(m => m.userSatisfactionScore),
      predictionAccuracy: history.map(m => m.predictionAccuracy),
      systemReliability: history.map(m => m.systemReliability)
    }
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion for basic metrics
    const headers = ['Metric', 'Value']
    let csv = headers.join(',') + '\n'

    const overview = data.overview
    Object.entries(overview).forEach(([key, value]) => {
      if (typeof value === 'number') {
        csv += `${key},${value}\n`
      }
    })

    return csv
  }
}

// Create singleton instances
export const analyticsAggregator = new AnalyticsDataAggregator()
export const performanceDashboard = new PerformanceDashboard()

export default {
  AnalyticsDataAggregator,
  PerformanceDashboard,
  analyticsAggregator,
  performanceDashboard
} 