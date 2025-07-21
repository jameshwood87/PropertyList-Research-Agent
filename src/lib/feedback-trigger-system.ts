// Feedback Trigger System
// Monitors multiple thumbs down from different users and triggers fresh analysis

import fs from 'fs'
import path from 'path'

interface SimpleFeedback {
  sessionId: string
  sectionId: string
  feedback: 'positive' | 'negative'
  timestamp: string
  userId?: string // Optional user identification
}

interface StarRatingFeedback {
  sessionId: string
  overallRating: 1 | 2 | 3 | 4 | 5
  timestamp: string
  userId?: string // Optional user identification
}

interface FeedbackTriggerConfig {
  negativeFeedbackThreshold: number // Number of thumbs down needed to trigger
  lowStarRatingThreshold: number // Number of low star ratings (1-2 stars) needed to trigger
  timeWindowHours: number // Time window to consider feedback (e.g., 24 hours)
  requireDifferentUsers: boolean // Whether feedback must come from different users
  autoTriggerFreshAnalysis: boolean // Whether to automatically trigger fresh analysis
}

interface TriggeredAnalysis {
  sessionId: string
  triggerType: 'negative_feedback_threshold' | 'low_star_rating_threshold'
  triggerTimestamp: string
  negativeFeedbackCount: number
  uniqueUsers: string[]
  sections: string[]
  status: 'pending' | 'triggered' | 'completed'
}

export class FeedbackTriggerSystem {
  private feedbackFile: string
  private starRatingFile: string
  private triggersFile: string
  private config: FeedbackTriggerConfig

  constructor(
    feedbackFile: string = './data/simple-feedback.json',
    starRatingFile: string = './data/star-rating-feedback.json',
    triggersFile: string = './data/feedback-triggers.json',
    config: Partial<FeedbackTriggerConfig> = {}
  ) {
    this.feedbackFile = feedbackFile
    this.starRatingFile = starRatingFile
    this.triggersFile = triggersFile
    this.config = {
      negativeFeedbackThreshold: 2, // Default: 2 thumbs down
      lowStarRatingThreshold: 2, // Default: 2 low star ratings (1-2 stars)
      timeWindowHours: 336, // Default: 2 weeks (336 hours)
      requireDifferentUsers: true, // Default: require different users
      autoTriggerFreshAnalysis: true, // Default: auto-trigger
      ...config
    }
    
    this.ensureFilesExist()
  }

  private ensureFilesExist() {
    // Ensure feedback file exists
    if (!fs.existsSync(this.feedbackFile)) {
      fs.writeFileSync(this.feedbackFile, '[]', 'utf8')
    }
    
    // Ensure star rating feedback file exists
    if (!fs.existsSync(this.starRatingFile)) {
      fs.writeFileSync(this.starRatingFile, '[]', 'utf8')
    }
    
    // Ensure triggers file exists
    if (!fs.existsSync(this.triggersFile)) {
      fs.writeFileSync(this.triggersFile, '[]', 'utf8')
    }
  }

  private loadFeedback(): SimpleFeedback[] {
    try {
      const data = fs.readFileSync(this.feedbackFile, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      console.error('Error loading feedback:', error)
      return []
    }
  }

  private saveFeedback(feedback: SimpleFeedback[]) {
    try {
      fs.writeFileSync(this.feedbackFile, JSON.stringify(feedback, null, 2), 'utf8')
    } catch (error) {
      console.error('Error saving feedback:', error)
    }
  }

  private loadStarRatingFeedback(): StarRatingFeedback[] {
    try {
      const data = fs.readFileSync(this.starRatingFile, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      console.error('Error loading star rating feedback:', error)
      return []
    }
  }

  private saveStarRatingFeedback(feedback: StarRatingFeedback[]) {
    try {
      fs.writeFileSync(this.starRatingFile, JSON.stringify(feedback, null, 2), 'utf8')
    } catch (error) {
      console.error('Error saving star rating feedback:', error)
    }
  }

  private loadTriggers(): TriggeredAnalysis[] {
    try {
      const data = fs.readFileSync(this.triggersFile, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      console.error('Error loading triggers:', error)
      return []
    }
  }

  private saveTriggers(triggers: TriggeredAnalysis[]) {
    try {
      fs.writeFileSync(this.triggersFile, JSON.stringify(triggers, null, 2), 'utf8')
    } catch (error) {
      console.error('Error saving triggers:', error)
    }
  }

  // Add new feedback and check for triggers
  async addFeedback(feedback: SimpleFeedback): Promise<{
    success: boolean
    message: string
    triggerActivated?: boolean
    triggerDetails?: TriggeredAnalysis
  }> {
    try {
      // Load existing feedback
      const allFeedback = this.loadFeedback()
      
      // Add new feedback
      allFeedback.push(feedback)
      this.saveFeedback(allFeedback)

      console.log(`✅ Feedback added: ${feedback.sessionId} - ${feedback.sectionId} - ${feedback.feedback}`)

      // Check if this triggers a fresh analysis
      const triggerResult = await this.checkForTrigger(feedback.sessionId)
      
      if (triggerResult.shouldTrigger) {
        const triggerDetails = await this.activateTrigger(feedback.sessionId, triggerResult)
        
        return {
          success: true,
          message: 'Feedback added and trigger activated',
          triggerActivated: true,
          triggerDetails
        }
      }

      return {
        success: true,
        message: 'Feedback added successfully',
        triggerActivated: false
      }

    } catch (error) {
      console.error('Error adding feedback:', error)
      return {
        success: false,
        message: 'Failed to add feedback'
      }
    }
  }

  // Add star rating feedback and check for triggers
  async addStarRatingFeedback(feedback: StarRatingFeedback): Promise<{
    success: boolean
    message: string
    triggerActivated?: boolean
    triggerDetails?: TriggeredAnalysis
  }> {
    try {
      // Load existing star rating feedback
      const allStarRatingFeedback = this.loadStarRatingFeedback()
      
      // Add new feedback
      allStarRatingFeedback.push(feedback)
      this.saveStarRatingFeedback(allStarRatingFeedback)

      console.log(`✅ Star rating feedback added: ${feedback.sessionId} - ${feedback.overallRating} stars`)

      // Check if this triggers a fresh analysis
      const triggerResult = await this.checkForStarRatingTrigger(feedback.sessionId)
      
      if (triggerResult.shouldTrigger) {
        const triggerDetails = await this.activateTrigger(feedback.sessionId, triggerResult)
        
        return {
          success: true,
          message: 'Star rating feedback added and trigger activated',
          triggerActivated: true,
          triggerDetails
        }
      }

      return {
        success: true,
        message: 'Star rating feedback added successfully',
        triggerActivated: false
      }

    } catch (error) {
      console.error('Error adding star rating feedback:', error)
      return {
        success: false,
        message: 'Failed to add star rating feedback'
      }
    }
  }

  // Check if a session should trigger fresh analysis
  private async checkForTrigger(sessionId: string): Promise<{
    shouldTrigger: boolean
    negativeCount: number
    uniqueUsers: string[]
    sections: string[]
  }> {
    const allFeedback = this.loadFeedback()
    const now = new Date()
    const timeWindowMs = this.config.timeWindowHours * 60 * 60 * 1000

    // Filter feedback for this session within time window
    const sessionFeedback = allFeedback.filter(f => {
      if (f.sessionId !== sessionId) return false
      
      const feedbackTime = new Date(f.timestamp)
      const timeDiff = now.getTime() - feedbackTime.getTime()
      
      return timeDiff <= timeWindowMs
    })

    // Count negative feedback
    const negativeFeedback = sessionFeedback.filter(f => f.feedback === 'negative')
    
    if (negativeFeedback.length < this.config.negativeFeedbackThreshold) {
      return {
        shouldTrigger: false,
        negativeCount: negativeFeedback.length,
        uniqueUsers: [],
        sections: []
      }
    }

    // Check if we need different users
    if (this.config.requireDifferentUsers) {
      const uniqueUsers = Array.from(new Set(negativeFeedback.map(f => f.userId || 'anonymous')))
      
      if (uniqueUsers.length < this.config.negativeFeedbackThreshold) {
        return {
          shouldTrigger: false,
          negativeCount: negativeFeedback.length,
          uniqueUsers,
          sections: []
        }
      }
    }

    // Get unique sections with negative feedback
    const sections = Array.from(new Set(negativeFeedback.map(f => f.sectionId)))
    const uniqueUsers = Array.from(new Set(negativeFeedback.map(f => f.userId || 'anonymous')))

    return {
      shouldTrigger: true,
      negativeCount: negativeFeedback.length,
      uniqueUsers,
      sections
    }
  }

  // Check if a session should trigger fresh analysis based on star ratings
  private async checkForStarRatingTrigger(sessionId: string): Promise<{
    shouldTrigger: boolean
    lowStarCount: number
    uniqueUsers: string[]
    averageRating: number
  }> {
    const allStarRatingFeedback = this.loadStarRatingFeedback()
    const now = new Date()
    const timeWindowMs = this.config.timeWindowHours * 60 * 60 * 1000

    // Filter feedback for this session within time window
    const sessionFeedback = allStarRatingFeedback.filter(f => {
      if (f.sessionId !== sessionId) return false
      
      const feedbackTime = new Date(f.timestamp)
      const timeDiff = now.getTime() - feedbackTime.getTime()
      
      return timeDiff <= timeWindowMs
    })

    // Count low star ratings (1-2 stars)
    const lowStarFeedback = sessionFeedback.filter(f => f.overallRating <= 2)
    
    if (lowStarFeedback.length < this.config.lowStarRatingThreshold) {
      return {
        shouldTrigger: false,
        lowStarCount: lowStarFeedback.length,
        uniqueUsers: [],
        averageRating: sessionFeedback.length > 0 
          ? sessionFeedback.reduce((sum, f) => sum + f.overallRating, 0) / sessionFeedback.length 
          : 0
      }
    }

    // Check if we need different users
    if (this.config.requireDifferentUsers) {
      const uniqueUsers = Array.from(new Set(lowStarFeedback.map(f => f.userId || 'anonymous')))
      
      if (uniqueUsers.length < this.config.lowStarRatingThreshold) {
        return {
          shouldTrigger: false,
          lowStarCount: lowStarFeedback.length,
          uniqueUsers,
          averageRating: sessionFeedback.length > 0 
            ? sessionFeedback.reduce((sum, f) => sum + f.overallRating, 0) / sessionFeedback.length 
            : 0
        }
      }
    }

    const uniqueUsers = Array.from(new Set(lowStarFeedback.map(f => f.userId || 'anonymous')))
    const averageRating = sessionFeedback.length > 0 
      ? sessionFeedback.reduce((sum, f) => sum + f.overallRating, 0) / sessionFeedback.length 
      : 0

    return {
      shouldTrigger: true,
      lowStarCount: lowStarFeedback.length,
      uniqueUsers,
      averageRating
    }
  }

  // Activate the trigger and start fresh analysis
  private async activateTrigger(sessionId: string, triggerInfo: {
    shouldTrigger: boolean
    negativeCount?: number
    lowStarCount?: number
    uniqueUsers: string[]
    sections?: string[]
    averageRating?: number
  }): Promise<TriggeredAnalysis> {
    const triggers = this.loadTriggers()
    
    const newTrigger: TriggeredAnalysis = {
      sessionId,
      triggerType: triggerInfo.lowStarCount ? 'low_star_rating_threshold' : 'negative_feedback_threshold',
      triggerTimestamp: new Date().toISOString(),
      negativeFeedbackCount: triggerInfo.negativeCount || 0,
      uniqueUsers: triggerInfo.uniqueUsers,
      sections: triggerInfo.sections || [],
      status: 'triggered'
    }

    triggers.push(newTrigger)
    this.saveTriggers(triggers)

    console.log(`🚨 FRESH ANALYSIS TRIGGERED for session: ${sessionId}`)
    console.log(`📊 Trigger details:`)
    if (triggerInfo.lowStarCount) {
      console.log(`   • Low star rating count: ${triggerInfo.lowStarCount}`)
      console.log(`   • Average rating: ${triggerInfo.averageRating?.toFixed(1)}`)
      console.log(`   • Threshold: ${this.config.lowStarRatingThreshold} low ratings`)
    } else {
      console.log(`   • Negative feedback count: ${triggerInfo.negativeCount}`)
      console.log(`   • Affected sections: ${triggerInfo.sections?.join(', ')}`)
      console.log(`   • Threshold: ${this.config.negativeFeedbackThreshold}`)
    }
    console.log(`   • Unique users: ${triggerInfo.uniqueUsers.length}`)

    // Auto-trigger fresh analysis if enabled
    if (this.config.autoTriggerFreshAnalysis) {
      await this.startFreshAnalysis(sessionId, triggerInfo)
    }

    return newTrigger
  }

  // Start fresh analysis for the session
  private async startFreshAnalysis(sessionId: string, triggerInfo?: {
    shouldTrigger: boolean
    negativeCount?: number
    lowStarCount?: number
    uniqueUsers: string[]
    sections?: string[]
    averageRating?: number
  }): Promise<void> {
    try {
      console.log(`🔄 Starting fresh analysis for session: ${sessionId}`)
      
      // Reset session to pending status
      await this.resetSessionStatus(sessionId)
      
      // Trigger fresh analysis
      const response = await fetch(`http://localhost:3004/start-analysis/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userContext: triggerInfo.lowStarCount 
            ? `Fresh analysis triggered by low star rating threshold (${this.config.lowStarRatingThreshold} low ratings from different users)`
            : `Fresh analysis triggered by negative feedback threshold (${this.config.negativeFeedbackThreshold} thumbs down from different users)`
        })
      })

      if (response.ok) {
        console.log(`✅ Fresh analysis started successfully for session: ${sessionId}`)
      } else {
        console.error(`❌ Failed to start fresh analysis for session: ${sessionId}`)
      }

    } catch (error) {
      console.error(`❌ Error starting fresh analysis for session ${sessionId}:`, error)
    }
  }

  // Reset session status to pending
  private async resetSessionStatus(sessionId: string): Promise<void> {
    try {
      const sessionsPath = path.join(process.cwd(), 'server', 'sessions.json')
      
      if (fs.existsSync(sessionsPath)) {
        const sessionsData = fs.readFileSync(sessionsPath, 'utf8')
        const sessions = JSON.parse(sessionsData)
        
        // Find and reset the session
        const sessionIndex = sessions.findIndex((s: any) => s.sessionId === sessionId)
        
        if (sessionIndex !== -1) {
          sessions[sessionIndex] = {
            ...sessions[sessionIndex],
            status: 'pending',
            steps: [],
            progress: {
              currentStep: 0,
              totalSteps: 7,
              completedSteps: 0,
              failedSteps: 0,
              criticalErrors: 0,
              qualityScore: 0
            },
            report: null,
            error: null,
            startedAt: null,
            completedAt: null,
            duration: null
          }
          
          fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2), 'utf8')
          console.log(`✅ Session ${sessionId} reset to pending status`)
        }
      }
    } catch (error) {
      console.error(`❌ Error resetting session ${sessionId}:`, error)
    }
  }

  // Get trigger statistics
  getTriggerStats(): {
    totalTriggers: number
    recentTriggers: number
    averageNegativeFeedback: number
    mostTriggeredSections: string[]
  } {
    const triggers = this.loadTriggers()
    const allFeedback = this.loadFeedback()
    
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    const recentTriggers = triggers.filter(t => 
      new Date(t.triggerTimestamp) >= thirtyDaysAgo
    )
    
    const negativeFeedback = allFeedback.filter(f => f.feedback === 'negative')
    const averageNegativeFeedback = negativeFeedback.length > 0 
      ? negativeFeedback.length / triggers.length 
      : 0
    
    // Get most triggered sections
    const sectionCounts: { [section: string]: number } = {}
    triggers.forEach(trigger => {
      trigger.sections.forEach(section => {
        sectionCounts[section] = (sectionCounts[section] || 0) + 1
      })
    })
    
    const mostTriggeredSections = Object.entries(sectionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([section]) => section)

    return {
      totalTriggers: triggers.length,
      recentTriggers: recentTriggers.length,
      averageNegativeFeedback,
      mostTriggeredSections
    }
  }

  // Update configuration
  updateConfig(newConfig: Partial<FeedbackTriggerConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log('✅ Feedback trigger configuration updated:', this.config)
  }

  // Get current configuration
  getConfig(): FeedbackTriggerConfig {
    return { ...this.config }
  }
}

// Export singleton instance
export const feedbackTriggerSystem = new FeedbackTriggerSystem() 