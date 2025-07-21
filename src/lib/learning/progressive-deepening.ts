// Progressive Deepening System
// Tracks analysis frequency and provides enhanced prompts for subsequent analyses

import { 
  AnalysisHistory, 
  ProgressivePrompt, 
  DeepeningStrategy,
  UserFeedback 
} from './learning-types'
import { PropertyData, CMAReport } from '@/types'
import path from 'path'
import fs from 'fs'

// ========================================
// ANALYSIS HISTORY DATABASE
// ========================================

export class AnalysisHistoryDatabase {
  private dataDir: string
  private historyFile: string
  private history: Map<string, AnalysisHistory> = new Map()
  private isLoaded: boolean = false

  constructor(dataDir: string = './data/learning') {
    this.dataDir = dataDir
    this.historyFile = path.join(dataDir, 'analysis-history.json')
    this.ensureDataDirectory()
    this.loadDatabase()
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
    }
  }

  private loadDatabase(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = JSON.parse(fs.readFileSync(this.historyFile, 'utf-8'))
        this.history = new Map(Object.entries(data))
        console.log(`📊 Loaded ${this.history.size} analysis history records`)
      }
      this.isLoaded = true
    } catch (error) {
      console.warn('⚠️ Could not load analysis history database:', error)
      this.history = new Map()
      this.isLoaded = true
    }
  }

  private saveDatabase(): void {
    try {
      const data = Object.fromEntries(this.history)
      fs.writeFileSync(this.historyFile, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('❌ Failed to save analysis history database:', error)
    }
  }

  private generatePropertyId(propertyData: PropertyData): string {
    const key = `${propertyData.address}_${propertyData.city}_${propertyData.province}`
    return Buffer.from(key).toString('base64').replace(/[^a-zA-Z0-9]/g, '')
  }

  public getAnalysisHistory(propertyData: PropertyData): AnalysisHistory | null {
    const propertyId = this.generatePropertyId(propertyData)
    return this.history.get(propertyId) || null
  }

  public recordAnalysis(
    propertyData: PropertyData, 
    sessionId: string, 
    qualityScore: number, 
    promptVersion: string,
    dataGaps: string[] = []
  ): AnalysisHistory {
    const propertyId = this.generatePropertyId(propertyData)
    const now = new Date().toISOString()
    
    let history = this.history.get(propertyId)
    
    if (!history) {
      // First analysis
      history = {
        propertyId,
        analysisCount: 0,
        firstAnalysisDate: now,
        lastAnalysisDate: now,
        analysisQualityScores: [],
        promptVersions: [],
        dataGaps: [],
        userFeedback: [],
        regionalKnowledgeUpdates: 0
      }
    }

    // Update history
    history.analysisCount++
    history.lastAnalysisDate = now
    history.analysisQualityScores.push(qualityScore)
    history.promptVersions.push(promptVersion)
    history.dataGaps.push(...dataGaps)

    // Keep only last 10 quality scores
    if (history.analysisQualityScores.length > 10) {
      history.analysisQualityScores = history.analysisQualityScores.slice(-10)
    }

    this.history.set(propertyId, history)
    this.saveDatabase()
    
    console.log(`📊 Recorded analysis #${history.analysisCount} for property ${propertyId}`)
    return history
  }

  public addUserFeedback(propertyData: PropertyData, feedback: UserFeedback): void {
    const propertyId = this.generatePropertyId(propertyData)
    const history = this.history.get(propertyId)
    
    if (history) {
      history.userFeedback.push(feedback)
      this.saveDatabase()
    }
  }

  public getAnalysisStats(): { totalProperties: number; averageAnalyses: number; mostAnalyzed: Array<{ id: string; count: number }> } {
    const totalProperties = this.history.size
    const totalAnalyses = Array.from(this.history.values()).reduce((sum, h) => sum + h.analysisCount, 0)
    const averageAnalyses = totalProperties > 0 ? totalAnalyses / totalProperties : 0
    
    // Get most analyzed properties
    const mostAnalyzed = Array.from(this.history.entries())
      .sort((a, b) => b[1].analysisCount - a[1].analysisCount)
      .slice(0, 5)
      .map(([id, history]) => ({ id, count: history.analysisCount }))

    return { totalProperties, averageAnalyses, mostAnalyzed }
  }
}

// ========================================
// PROGRESSIVE PROMPT MANAGER
// ========================================

export class ProgressivePromptManager {
  private prompts: Map<number, ProgressivePrompt> = new Map()

  constructor() {
    this.initializePrompts()
  }

  private initializePrompts(): void {
    // Level 1: First Analysis - Comprehensive but standard
    this.prompts.set(1, {
      version: '1.0',
      analysisLevel: 1,
      promptTemplate: 'STANDARD_COMPREHENSIVE',
      focusAreas: ['basic_location', 'market_data', 'comparables', 'amenities', 'developments'],
      dataRequirements: ['coordinates', 'market_trends', 'comparable_properties', 'nearby_amenities', 'future_developments'],
      expectedOutcome: 'Complete property analysis with all standard sections filled',
      isActive: true,
      performanceMetrics: {
        averageQuality: 85,
        successRate: 95,
        userSatisfaction: 4.2,
        dataCompleteness: 90
      }
    })

    // Level 2: Second Analysis - Enhanced Market Intelligence
    this.prompts.set(2, {
      version: '2.0',
      analysisLevel: 2,
      promptTemplate: 'ENHANCED_MARKET_INTELLIGENCE',
      focusAreas: ['market_timing', 'investment_metrics', 'risk_assessment', 'seasonal_patterns', 'demographic_insights'],
      dataRequirements: ['seasonal_data', 'demographic_stats', 'investment_metrics', 'risk_factors', 'market_forecasts'],
      expectedOutcome: 'Enhanced market intelligence with investment timing and risk analysis',
      isActive: true,
      performanceMetrics: {
        averageQuality: 88,
        successRate: 92,
        userSatisfaction: 4.4,
        dataCompleteness: 85
      }
    })

    // Level 3: Third Analysis - Advanced Predictive Analytics
    this.prompts.set(3, {
      version: '3.0',
      analysisLevel: 3,
      promptTemplate: 'ADVANCED_PREDICTIVE_ANALYTICS',
      focusAreas: ['predictive_modeling', 'scenario_analysis', 'market_disruption', 'long_term_trends', 'comparative_analysis'],
      dataRequirements: ['historical_trends', 'predictive_models', 'scenario_data', 'market_disruption_indicators', 'long_term_forecasts'],
      expectedOutcome: 'Advanced predictive analysis with scenario modeling and long-term forecasts',
      isActive: true,
      performanceMetrics: {
        averageQuality: 92,
        successRate: 88,
        userSatisfaction: 4.6,
        dataCompleteness: 80
      }
    })

    // Level 4+: Specialized Deep Dives
    this.prompts.set(4, {
      version: '4.0',
      analysisLevel: 4,
      promptTemplate: 'SPECIALIZED_DEEP_DIVE',
      focusAreas: ['niche_markets', 'specialized_metrics', 'competitive_analysis', 'opportunity_identification', 'strategic_recommendations'],
      dataRequirements: ['niche_market_data', 'competitive_intelligence', 'opportunity_metrics', 'strategic_insights', 'specialized_forecasts'],
      expectedOutcome: 'Specialized analysis with niche market insights and strategic recommendations',
      isActive: true,
      performanceMetrics: {
        averageQuality: 95,
        successRate: 85,
        userSatisfaction: 4.8,
        dataCompleteness: 75
      }
    })
  }

  public getPromptForLevel(level: number): ProgressivePrompt | null {
    return this.prompts.get(level) || null
  }

  public getNextLevel(currentLevel: number): number {
    const maxLevel = Math.max(...Array.from(this.prompts.keys()))
    return Math.min(currentLevel + 1, maxLevel)
  }

  public shouldUpgradeLevel(history: AnalysisHistory): boolean {
    // Upgrade if:
    // 1. Current level is below max
    // 2. Previous analysis quality was good (>80)
    // 3. User feedback was positive (>3.5)
    // 4. Enough time has passed since last analysis (>24 hours)
    
    const currentLevel = history.promptVersions.length
    const maxLevel = Math.max(...Array.from(this.prompts.keys()))
    
    if (currentLevel >= maxLevel) return false
    
    const lastQualityScore = history.analysisQualityScores[history.analysisQualityScores.length - 1] || 0
    const lastFeedback = history.userFeedback[history.userFeedback.length - 1]
    const lastAnalysisDate = new Date(history.lastAnalysisDate)
    const hoursSinceLastAnalysis = (Date.now() - lastAnalysisDate.getTime()) / (1000 * 60 * 60)
    
    return lastQualityScore > 80 && 
           (!lastFeedback || lastFeedback.overallRating > 3.5) && 
           hoursSinceLastAnalysis > 24
  }
}

// ========================================
// PROGRESSIVE DEEPENING ENGINE
// ========================================

export class ProgressiveDeepeningEngine {
  private historyDatabase: AnalysisHistoryDatabase
  private promptManager: ProgressivePromptManager

  constructor() {
    this.historyDatabase = new AnalysisHistoryDatabase()
    this.promptManager = new ProgressivePromptManager()
  }

  public async getDeepeningStrategy(propertyData: PropertyData): Promise<DeepeningStrategy | null> {
    const history = this.historyDatabase.getAnalysisHistory(propertyData)
    
    if (!history) {
      // First analysis - no strategy needed
      return null
    }

    const currentLevel = history.analysisCount
    const nextLevel = this.promptManager.getNextLevel(currentLevel)
    const shouldUpgrade = this.promptManager.shouldUpgradeLevel(history)
    
    if (!shouldUpgrade) {
      return null
    }

    const nextPrompt = this.promptManager.getPromptForLevel(nextLevel)
    if (!nextPrompt) {
      return null
    }

    return {
      propertyId: history.propertyId,
      currentLevel,
      nextLevel,
      focusAreas: nextPrompt.focusAreas,
      additionalQueries: this.generateAdditionalQueries(propertyData, nextPrompt),
      expectedImprovements: this.getExpectedImprovements(nextPrompt),
      confidenceThreshold: 75,
      lastUpdated: new Date().toISOString()
    }
  }

  public async recordAnalysis(
    propertyData: PropertyData,
    sessionId: string,
    qualityScore: number,
    promptVersion: string,
    dataGaps: string[] = []
  ): Promise<AnalysisHistory> {
    return this.historyDatabase.recordAnalysis(propertyData, sessionId, qualityScore, promptVersion, dataGaps)
  }

  public async addUserFeedback(propertyData: PropertyData, feedback: UserFeedback): Promise<void> {
    this.historyDatabase.addUserFeedback(propertyData, feedback)
  }

  public getAnalysisStats(): { totalProperties: number; averageAnalyses: number; mostAnalyzed: Array<{ id: string; count: number }> } {
    return this.historyDatabase.getAnalysisStats()
  }

  private generateAdditionalQueries(propertyData: PropertyData, prompt: ProgressivePrompt): string[] {
    const queries: string[] = []
    
    if (prompt.focusAreas.includes('seasonal_patterns')) {
      queries.push(`"${propertyData.city}" seasonal property market patterns 2024`)
      queries.push(`"${propertyData.city}" property market seasonal trends`)
    }
    
    if (prompt.focusAreas.includes('demographic_insights')) {
      queries.push(`"${propertyData.city}" demographic trends population growth`)
      queries.push(`"${propertyData.city}" income levels property buyers`)
    }
    
    if (prompt.focusAreas.includes('predictive_modeling')) {
      queries.push(`"${propertyData.city}" property market forecast 2025 2026`)
      queries.push(`"${propertyData.city}" real estate market predictions`)
    }
    
    if (prompt.focusAreas.includes('market_disruption')) {
      queries.push(`"${propertyData.city}" property market disruption factors`)
      queries.push(`"${propertyData.city}" real estate market risks 2024`)
    }
    
    if (prompt.focusAreas.includes('niche_markets')) {
      queries.push(`"${propertyData.city}" luxury property market trends`)
      queries.push(`"${propertyData.city}" investment property market analysis`)
    }
    
    return queries
  }

  private getExpectedImprovements(prompt: ProgressivePrompt): string[] {
    const improvements: string[] = []
    
    switch (prompt.analysisLevel) {
      case 2:
        improvements.push('Enhanced market timing analysis')
        improvements.push('Investment metrics and ROI calculations')
        improvements.push('Risk assessment and mitigation strategies')
        improvements.push('Seasonal market pattern analysis')
        break
      case 3:
        improvements.push('Predictive market modeling')
        improvements.push('Scenario analysis and forecasting')
        improvements.push('Market disruption impact assessment')
        improvements.push('Long-term trend analysis')
        break
      case 4:
        improvements.push('Niche market specialization')
        improvements.push('Competitive market positioning')
        improvements.push('Strategic investment recommendations')
        improvements.push('Opportunity identification and analysis')
        break
    }
    
    return improvements
  }
}

// Export singleton instance
export const progressiveDeepeningEngine = new ProgressiveDeepeningEngine() 