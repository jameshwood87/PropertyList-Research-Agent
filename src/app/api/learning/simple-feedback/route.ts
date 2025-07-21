// Simple Feedback API for thumbs up/down buttons
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { feedbackTriggerSystem } from '@/lib/feedback-trigger-system'

interface SimpleFeedback {
  sessionId: string
  sectionId: string
  feedback: 'positive' | 'negative'
  timestamp: string
  userId?: string // Optional user identification
}

const FEEDBACK_FILE = path.join(process.cwd(), 'data', 'simple-feedback.json')

// Ensure feedback file exists
function ensureFeedbackFile() {
  const dir = path.dirname(FEEDBACK_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(FEEDBACK_FILE)) {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify([], null, 2))
  }
}

// Load existing feedback
function loadFeedback(): SimpleFeedback[] {
  try {
    ensureFeedbackFile()
    const data = fs.readFileSync(FEEDBACK_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error loading feedback:', error)
    return []
  }
}

// Save feedback
function saveFeedback(feedback: SimpleFeedback[]) {
  try {
    ensureFeedbackFile()
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedback, null, 2))
  } catch (error) {
    console.error('Error saving feedback:', error)
  }
}

// POST - Submit simple feedback
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
    
    if (!body.sectionId) {
      return NextResponse.json(
        { error: 'sectionId is required' },
        { status: 400 }
      )
    }
    
    if (!body.feedback || !['positive', 'negative'].includes(body.feedback)) {
      return NextResponse.json(
        { error: 'feedback must be "positive" or "negative"' },
        { status: 400 }
      )
    }
    
    // Create feedback object
    const feedback: SimpleFeedback = {
      sessionId: body.sessionId,
      sectionId: body.sectionId,
      feedback: body.feedback,
      timestamp: body.timestamp || new Date().toISOString(),
      userId: body.userId // Optional user identification
    }
    
    // Add feedback through trigger system
    const result = await feedbackTriggerSystem.addFeedback(feedback)
    
    if (result.success) {
      console.log(`✅ Simple feedback submitted: ${feedback.sessionId} - ${feedback.sectionId} - ${feedback.feedback}`)
      
      if (result.triggerActivated) {
        console.log(`🚨 FRESH ANALYSIS TRIGGERED: ${feedback.sessionId}`)
        console.log(`📊 Trigger details:`, result.triggerDetails)
      }
      
      return NextResponse.json({
        success: true,
        message: result.message,
        data: {
          sessionId: feedback.sessionId,
          sectionId: feedback.sectionId,
          feedback: feedback.feedback,
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
    console.error('Simple feedback submission error:', error)
    return NextResponse.json(
      { error: 'Failed to submit feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET - Retrieve feedback statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const sectionId = searchParams.get('sectionId')
    
    const allFeedback = loadFeedback()
    
    if (sessionId && sectionId) {
      // Get feedback for specific session and section
      const sessionFeedback = allFeedback.filter(f => 
        f.sessionId === sessionId && f.sectionId === sectionId
      )
      
      return NextResponse.json({
        success: true,
        data: {
          sessionId,
          sectionId,
          feedback: sessionFeedback,
          total: sessionFeedback.length
        }
      })
    } else if (sessionId) {
      // Get feedback for specific session
      const sessionFeedback = allFeedback.filter(f => f.sessionId === sessionId)
      
      return NextResponse.json({
        success: true,
        data: {
          sessionId,
          feedback: sessionFeedback,
          total: sessionFeedback.length
        }
      })
    } else {
      // Get overall statistics
      const totalFeedback = allFeedback.length
      const positiveFeedback = allFeedback.filter(f => f.feedback === 'positive').length
      const negativeFeedback = allFeedback.filter(f => f.feedback === 'negative').length
      
      // Group by section
      const sectionStats: { [key: string]: { positive: number; negative: number; total: number } } = {}
      allFeedback.forEach(f => {
        if (!sectionStats[f.sectionId]) {
          sectionStats[f.sectionId] = { positive: 0, negative: 0, total: 0 }
        }
        sectionStats[f.sectionId].total++
        if (f.feedback === 'positive') {
          sectionStats[f.sectionId].positive++
        } else {
          sectionStats[f.sectionId].negative++
        }
      })
      
      return NextResponse.json({
        success: true,
        data: {
          totalFeedback,
          positiveFeedback,
          negativeFeedback,
          positivePercentage: totalFeedback > 0 ? Math.round((positiveFeedback / totalFeedback) * 100) : 0,
          sectionStats,
          generatedAt: new Date().toISOString()
        }
      })
    }
    
  } catch (error) {
    console.error('Simple feedback retrieval error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 