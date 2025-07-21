// Feedback Management API
// Dedicated endpoints for user feedback collection and analysis

import { NextRequest, NextResponse } from 'next/server'
import { feedbackService, feedbackAnalyzer } from '@/lib/learning/feedback-system'
import { UserFeedback, ComponentRating, PropertyCorrection, OutcomeVerification } from '@/lib/learning/learning-types'

// GET - Retrieve feedback data and analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const sessionId = searchParams.get('sessionId')
    const timeframe = searchParams.get('timeframe') || '30'

    switch (action) {
      case 'analytics':
        return await getFeedbackAnalytics()
      
      case 'session':
        if (!sessionId) {
          return NextResponse.json(
            { error: 'sessionId parameter required' },
            { status: 400 }
          )
        }
        return await getSessionFeedback(sessionId)
      
      case 'insights':
        return await getFeedbackInsights()
      
      case 'trends':
        return await getFeedbackTrends(parseInt(timeframe))
      
      case 'corrections':
        return await getPropertyCorrections()
      
      default:
        return await getAllFeedback()
    }
  } catch (error) {
    console.error('Feedback API GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Submit new feedback
export async function POST(request: NextRequest) {
  try {
    const feedbackData = await request.json()
    
    // Validate required fields
    const validation = validateFeedback(feedbackData)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Invalid feedback data', details: validation.errors },
        { status: 400 }
      )
    }

    // Generate feedback ID if not provided
    if (!feedbackData.id) {
      feedbackData.id = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    // Add timestamp if not provided
    if (!feedbackData.timestamp) {
      feedbackData.timestamp = new Date().toISOString()
    }

    // Submit feedback
    const result = await feedbackService.submitFeedback(feedbackData as UserFeedback)
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Feedback submitted successfully',
        data: {
          feedbackId: feedbackData.id,
          sessionId: feedbackData.sessionId,
          submittedAt: feedbackData.timestamp
        }
      })
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Feedback submission error:', error)
    return NextResponse.json(
      { error: 'Failed to submit feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT - Update existing feedback or outcome verification
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const body = await request.json()

    switch (action) {
      case 'outcome':
        return await updateOutcome(body.sessionId, body.outcome)
      
      case 'correction':
        return await addPropertyCorrection(body.sessionId, body.correction)
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "outcome" or "correction"' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Feedback update error:', error)
    return NextResponse.json(
      { error: 'Failed to update feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ========================================
// GET ENDPOINT HANDLERS
// ========================================

async function getFeedbackAnalytics() {
  try {
    const analytics = feedbackService.getFeedbackAnalytics()
    const insights = feedbackAnalyzer.generateLearningInsights()
    
    return NextResponse.json({
      success: true,
      data: {
        ...analytics,
        insights: insights.overallTrends,
        componentInsights: insights.componentInsights,
        correctionPatterns: insights.correctionPatterns,
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to get feedback analytics: ${error}`)
  }
}

async function getSessionFeedback(sessionId: string) {
  try {
    const allFeedback = feedbackService.getAllFeedback()
    const sessionFeedback = allFeedback.find(f => f.sessionId === sessionId)
    
    if (!sessionFeedback) {
      return NextResponse.json(
        { error: 'Feedback not found for this session' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: sessionFeedback
    })
  } catch (error) {
    throw new Error(`Failed to get session feedback: ${error}`)
  }
}

async function getFeedbackInsights() {
  try {
    const insights = feedbackAnalyzer.generateLearningInsights()
    
    return NextResponse.json({
      success: true,
      data: {
        overallTrends: insights.overallTrends,
        componentInsights: insights.componentInsights,
        correctionPatterns: insights.correctionPatterns,
        outcomeValidation: insights.outcomeValidation,
        recommendations: insights.recommendations,
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to get feedback insights: ${error}`)
  }
}

async function getFeedbackTrends(days: number) {
  try {
    const allFeedback = feedbackService.getAllFeedback()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    const recentFeedback = allFeedback.filter(f => 
      new Date(f.timestamp) >= cutoffDate
    )
    
    // Calculate trends
    const trends = calculateFeedbackTrends(recentFeedback, days)
    
    return NextResponse.json({
      success: true,
      data: {
        timeframe: `${days} days`,
        totalFeedback: recentFeedback.length,
        trends,
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to get feedback trends: ${error}`)
  }
}

async function getPropertyCorrections() {
  try {
    const allFeedback = feedbackService.getAllFeedback()
    const allCorrections = allFeedback.flatMap(f => 
      f.corrections.map(c => ({
        ...c,
        sessionId: f.sessionId,
        timestamp: f.timestamp,
        userId: f.userId
      }))
    )
    
    // Group corrections by field
    const correctionsByField = groupCorrectionsByField(allCorrections)
    
    return NextResponse.json({
      success: true,
      data: {
        totalCorrections: allCorrections.length,
        correctionsByField,
        recentCorrections: allCorrections.slice(-20), // Last 20 corrections
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to get property corrections: ${error}`)
  }
}

async function getAllFeedback() {
  try {
    const allFeedback = feedbackService.getAllFeedback()
    const analytics = feedbackService.getFeedbackAnalytics()
    
    return NextResponse.json({
      success: true,
      data: {
        feedback: allFeedback,
        summary: analytics,
        count: allFeedback.length,
        retrievedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to get all feedback: ${error}`)
  }
}

// ========================================
// PUT ENDPOINT HANDLERS
// ========================================

async function updateOutcome(sessionId: string, outcome: OutcomeVerification) {
  try {
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }

    const result = await feedbackService.updateOutcome(sessionId, outcome)
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Outcome verification updated successfully',
        data: {
          sessionId,
          updatedAt: new Date().toISOString()
        }
      })
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 404 }
      )
    }
  } catch (error) {
    throw new Error(`Failed to update outcome: ${error}`)
  }
}

async function addPropertyCorrection(sessionId: string, correction: PropertyCorrection) {
  try {
    if (!sessionId || !correction.field || correction.correctedValue === undefined) {
      return NextResponse.json(
        { error: 'sessionId, field, and correctedValue are required' },
        { status: 400 }
      )
    }

    // Find existing feedback for this session
    const allFeedback = feedbackService.getAllFeedback()
    const existingFeedback = allFeedback.find(f => f.sessionId === sessionId)
    
    if (!existingFeedback) {
      return NextResponse.json(
        { error: 'No feedback found for this session' },
        { status: 404 }
      )
    }

    // Add correction to existing feedback
    existingFeedback.corrections.push(correction)
    
    // Resubmit updated feedback
    const result = await feedbackService.submitFeedback(existingFeedback)
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Property correction added successfully',
        data: {
          sessionId,
          correction,
          addedAt: new Date().toISOString()
        }
      })
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      )
    }
  } catch (error) {
    throw new Error(`Failed to add property correction: ${error}`)
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function validateFeedback(feedback: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!feedback.sessionId) {
    errors.push('sessionId is required')
  }

  if (!feedback.overallRating || feedback.overallRating < 1 || feedback.overallRating > 5) {
    errors.push('overallRating must be between 1 and 5')
  }

  if (!feedback.componentRatings) {
    errors.push('componentRatings is required')
  } else {
    const requiredComponents = ['valuation', 'comparables', 'marketAnalysis', 'amenities', 'futureOutlook', 'aiSummary']
    for (const component of requiredComponents) {
      if (!feedback.componentRatings[component]) {
        errors.push(`componentRatings.${component} is required`)
      } else {
        const rating = feedback.componentRatings[component]
        if (rating.rating < 1 || rating.rating > 5) {
          errors.push(`componentRatings.${component}.rating must be between 1 and 5`)
        }
        if (rating.accuracy < 1 || rating.accuracy > 5) {
          errors.push(`componentRatings.${component}.accuracy must be between 1 and 5`)
        }
        if (rating.usefulness < 1 || rating.usefulness > 5) {
          errors.push(`componentRatings.${component}.usefulness must be between 1 and 5`)
        }
      }
    }
  }

  if (feedback.corrections && !Array.isArray(feedback.corrections)) {
    errors.push('corrections must be an array')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

function calculateFeedbackTrends(feedback: UserFeedback[], days: number) {
  if (feedback.length === 0) {
    return {
      averageRating: 0,
      ratingTrend: 'stable',
      volumeTrend: 'stable',
      componentTrends: {}
    }
  }

  // Calculate average rating
  const averageRating = feedback.reduce((sum, f) => sum + f.overallRating, 0) / feedback.length

  // Calculate rating trend (compare first half to second half)
  const midPoint = Math.floor(feedback.length / 2)
  const firstHalf = feedback.slice(0, midPoint)
  const secondHalf = feedback.slice(midPoint)

  let ratingTrend: 'improving' | 'stable' | 'declining' = 'stable'
  if (firstHalf.length > 0 && secondHalf.length > 0) {
    const firstAvg = firstHalf.reduce((sum, f) => sum + f.overallRating, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, f) => sum + f.overallRating, 0) / secondHalf.length
    const improvement = ((secondAvg - firstAvg) / firstAvg) * 100

    if (improvement > 5) ratingTrend = 'improving'
    else if (improvement < -5) ratingTrend = 'declining'
  }

  // Calculate volume trend (simple check)
  const volumeTrend = feedback.length > 10 ? 'increasing' : feedback.length > 5 ? 'stable' : 'low'

  // Component trends
  const componentTrends: { [key: string]: number } = {}
  const components = ['valuation', 'comparables', 'marketAnalysis', 'amenities', 'futureOutlook', 'aiSummary']
  
  components.forEach(component => {
    const ratings = feedback.map(f => f.componentRatings[component as keyof typeof f.componentRatings]?.rating).filter(r => r)
    if (ratings.length > 0) {
      componentTrends[component] = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    }
  })

  return {
    averageRating,
    ratingTrend,
    volumeTrend,
    componentTrends
  }
}

function groupCorrectionsByField(corrections: any[]) {
  const grouped: { [field: string]: any } = {}
  
  corrections.forEach(correction => {
    if (!grouped[correction.field]) {
      grouped[correction.field] = {
        count: 0,
        averageConfidence: 0,
        recentCorrections: []
      }
    }
    
    grouped[correction.field].count++
    grouped[correction.field].averageConfidence = 
      (grouped[correction.field].averageConfidence + correction.confidence) / 2
    grouped[correction.field].recentCorrections.push(correction)
  })

  // Keep only recent corrections for each field
  Object.keys(grouped).forEach(field => {
    grouped[field].recentCorrections = grouped[field].recentCorrections.slice(-5)
  })

  return grouped
} 