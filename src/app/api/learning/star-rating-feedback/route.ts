// Star Rating Feedback API
// Handles star rating feedback and triggers fresh analysis when threshold is reached

import { NextRequest, NextResponse } from 'next/server'
import { feedbackTriggerSystem } from '@/lib/feedback-trigger-system'

interface StarRatingFeedback {
  sessionId: string
  overallRating: 1 | 2 | 3 | 4 | 5
  timestamp: string
  userId?: string // Optional user identification
}

// POST - Submit star rating feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }
    
    if (!body.overallRating || ![1, 2, 3, 4, 5].includes(body.overallRating)) {
      return NextResponse.json(
        { error: 'overallRating must be 1, 2, 3, 4, or 5' },
        { status: 400 }
      )
    }
    
    // Create feedback object
    const feedback: StarRatingFeedback = {
      sessionId: body.sessionId,
      overallRating: body.overallRating,
      timestamp: body.timestamp || new Date().toISOString(),
      userId: body.userId // Optional user identification
    }
    
    // Add feedback through trigger system
    const result = await feedbackTriggerSystem.addStarRatingFeedback(feedback)
    
    if (result.success) {
      console.log(`✅ Star rating feedback submitted: ${feedback.sessionId} - ${feedback.overallRating} stars`)
      
      if (result.triggerActivated) {
        console.log(`🚨 FRESH ANALYSIS TRIGGERED: ${feedback.sessionId}`)
        console.log(`📊 Trigger details:`, result.triggerDetails)
      }
      
      return NextResponse.json({
        success: true,
        message: result.message,
        data: {
          sessionId: feedback.sessionId,
          overallRating: feedback.overallRating,
          timestamp: feedback.timestamp,
          triggerActivated: result.triggerActivated,
          triggerDetails: result.triggerDetails
        }
      })
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      )
    }
    
  } catch (error) {
    console.error('Star rating feedback submission error:', error)
    return NextResponse.json(
      { error: 'Failed to submit star rating feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET - Retrieve star rating feedback statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const action = searchParams.get('action')

    if (action === 'stats') {
      const stats = feedbackTriggerSystem.getTriggerStats()
      return NextResponse.json({
        success: true,
        data: stats
      })
    }

    if (sessionId) {
      // Return feedback for specific session
      // This would need to be implemented in the feedback trigger system
      return NextResponse.json({
        success: true,
        message: 'Session-specific star rating feedback retrieval not yet implemented'
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Star rating feedback API is active'
    })
    
  } catch (error) {
    console.error('Star rating feedback GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 