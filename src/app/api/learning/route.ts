// Learning System API Endpoints
// Main API routes for feedback, analytics, and system management

import { NextRequest, NextResponse } from 'next/server'
import { learningEngine } from '@/lib/learning/learning-engine'
import { performanceDashboard } from '@/lib/learning/analytics-dashboard'
import { feedbackService } from '@/lib/learning/feedback-system'
import { UserFeedback, OutcomeVerification } from '@/lib/learning/learning-types'

// GET - Get learning system status and analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const timeframe = searchParams.get('timeframe') || 'monthly'

    switch (action) {
      case 'status':
        return await getSystemStatus()
      
      case 'analytics':
        return await getAnalytics(timeframe)
      
      case 'dashboard':
        return await getDashboardData()
      
      case 'insights':
        return await getInsights(timeframe)
      
      case 'recommendations':
        return await getRecommendations()
      
      case 'export':
        const format = searchParams.get('format') as 'json' | 'csv' || 'json'
        return await exportData(format)
      
      default:
        return await getSystemOverview()
    }
  } catch (error) {
    console.error('Learning API GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Submit feedback or trigger learning operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'submit_feedback':
        return await submitFeedback(data as UserFeedback)
      
      case 'update_outcome':
        return await updateOutcome(data.sessionId, data.outcome as OutcomeVerification)
      
      case 'trigger_optimization':
        return await triggerOptimization()
      
      case 'validate_predictions':
        return await validatePredictions()
      
      case 'learn_from_session':
        return await learnFromSession(data)
      
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Learning API POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT - Update learning system configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'update_weights':
        return await updateModelWeights(data)
      
      case 'configure_learning':
        return await configureLearning(data)
      
      case 'reset_learning_data':
        return await resetLearningData(data.confirm)
      
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Learning API PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove learning data or disable features
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const confirm = searchParams.get('confirm')

    switch (action) {
      case 'clear_feedback':
        return await clearFeedbackData(confirm)
      
      case 'clear_predictions':
        return await clearPredictionData(confirm)
      
      case 'disable_learning':
        return await disableLearning()
      
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Learning API DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ========================================
// GET ENDPOINT HANDLERS
// ========================================

async function getSystemStatus() {
  try {
    const isEnabled = learningEngine.isLearningEnabled()
    const dashboardData = await performanceDashboard.getRealTimeData()
    const feedbackStats = feedbackService.getFeedbackAnalytics()

    return NextResponse.json({
      success: true,
      data: {
        learningEnabled: isEnabled,
        systemHealth: dashboardData.systemHealth,
        currentLoad: dashboardData.currentLoad,
        responseTime: dashboardData.responseTime,
        errorRate: dashboardData.errorRate,
        activeUsers: dashboardData.activeUsers,
        totalFeedback: feedbackStats.totalFeedback,
        averageRating: feedbackStats.averageRating,
        lastUpdate: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to get system status: ${error}`)
  }
}

async function getAnalytics(timeframe: string) {
  try {
    const analytics = await performanceDashboard.getLearningAnalytics(timeframe)
    
    return NextResponse.json({
      success: true,
      data: analytics
    })
  } catch (error) {
    throw new Error(`Failed to get analytics: ${error}`)
  }
}

async function getDashboardData() {
  try {
    const dashboardData = await performanceDashboard.getDashboardData()
    
    return NextResponse.json({
      success: true,
      data: dashboardData
    })
  } catch (error) {
    throw new Error(`Failed to get dashboard data: ${error}`)
  }
}

async function getInsights(timeframe: string) {
  try {
    const analytics = await learningEngine.generateLearningReport(timeframe)
    
    return NextResponse.json({
      success: true,
      data: {
        insights: analytics.insights,
        timeframe,
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to get insights: ${error}`)
  }
}

async function getRecommendations() {
  try {
    const recommendations = await learningEngine.getSystemRecommendations()
    
    return NextResponse.json({
      success: true,
      data: {
        recommendations,
        count: recommendations.length,
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to get recommendations: ${error}`)
  }
}

async function exportData(format: 'json' | 'csv') {
  try {
    const exportedData = await performanceDashboard.exportData(format)
    
    const headers: { [key: string]: string } = {
      'Content-Type': format === 'json' ? 'application/json' : 'text/csv',
      'Content-Disposition': `attachment; filename="learning-data-${Date.now()}.${format}"`
    }

    return new NextResponse(exportedData, { headers })
  } catch (error) {
    throw new Error(`Failed to export data: ${error}`)
  }
}

async function getSystemOverview() {
  try {
    const dashboardData = await performanceDashboard.getDashboardData()
    const recommendations = await learningEngine.getSystemRecommendations()
    
    return NextResponse.json({
      success: true,
      data: {
        overview: dashboardData.overview,
        topInsights: dashboardData.insights.slice(0, 3),
        urgentRecommendations: recommendations.filter(r => r.priority === 'critical' || r.priority === 'high').slice(0, 3),
        systemHealth: dashboardData.overview.systemReliability > 80 ? 'healthy' : 
                     dashboardData.overview.systemReliability > 60 ? 'warning' : 'critical',
        lastUpdate: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to get system overview: ${error}`)
  }
}

// ========================================
// POST ENDPOINT HANDLERS
// ========================================

async function submitFeedback(feedback: UserFeedback) {
  try {
    // Validate feedback data
    if (!feedback.sessionId || !feedback.overallRating) {
      return NextResponse.json(
        { error: 'Missing required feedback fields: sessionId and overallRating' },
        { status: 400 }
      )
    }

    // Process feedback through learning engine
    await learningEngine.processUserFeedback(feedback)
    
    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
      data: {
        feedbackId: feedback.id,
        sessionId: feedback.sessionId,
        processedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to submit feedback: ${error}`)
  }
}

async function updateOutcome(sessionId: string, outcome: OutcomeVerification) {
  try {
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required field: sessionId' },
        { status: 400 }
      )
    }

    const result = await feedbackService.updateOutcome(sessionId, outcome)
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Outcome updated successfully',
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

async function triggerOptimization() {
  try {
    const optimizations = await learningEngine.optimizePrompts()
    
    return NextResponse.json({
      success: true,
      message: 'Optimization completed successfully',
      data: {
        optimizations: optimizations.length,
        details: optimizations.map(opt => ({
          type: opt.optimizationType,
          reason: opt.optimizationReason
        })),
        triggeredAt: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to trigger optimization: ${error}`)
  }
}

async function validatePredictions() {
  try {
    const validationResults = await learningEngine.validatePredictions()
    
    return NextResponse.json({
      success: true,
      message: 'Prediction validation completed',
      data: {
        validated: validationResults.length,
        validatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to validate predictions: ${error}`)
  }
}

async function learnFromSession(sessionData: any) {
  try {
    if (!sessionData.propertyData || !sessionData.report || !sessionData.sessionId) {
      return NextResponse.json(
        { error: 'Missing required session data: propertyData, report, sessionId' },
        { status: 400 }
      )
    }

    await learningEngine.updateRegionalKnowledge({
      propertyData: sessionData.propertyData,
      report: sessionData.report,
      comparables: sessionData.comparables || [],
      sessionId: sessionData.sessionId,
      analysisQuality: sessionData.analysisQuality,
      userFeedback: sessionData.userFeedback
    })
    
    return NextResponse.json({
      success: true,
      message: 'Session learning completed successfully',
      data: {
        sessionId: sessionData.sessionId,
        processedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to learn from session: ${error}`)
  }
}

// ========================================
// PUT ENDPOINT HANDLERS
// ========================================

async function updateModelWeights(validationData: any) {
  try {
    if (!validationData || !Array.isArray(validationData)) {
      return NextResponse.json(
        { error: 'Invalid validation data format' },
        { status: 400 }
      )
    }

    await learningEngine.updateModelWeights(validationData)
    
    return NextResponse.json({
      success: true,
      message: 'Model weights updated successfully',
      data: {
        validationCount: validationData.length,
        updatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to update model weights: ${error}`)
  }
}

async function configureLearning(config: any) {
  try {
    // Configure learning system settings
    if (config.enabled !== undefined) {
      if (config.enabled) {
        learningEngine.enableLearning()
      } else {
        learningEngine.disableLearning()
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Learning configuration updated successfully',
      data: {
        enabled: learningEngine.isLearningEnabled(),
        configuredAt: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to configure learning: ${error}`)
  }
}

async function resetLearningData(confirm: string) {
  try {
    if (confirm !== 'RESET_ALL_LEARNING_DATA') {
      return NextResponse.json(
        { error: 'Invalid confirmation string. Use "RESET_ALL_LEARNING_DATA" to confirm.' },
        { status: 400 }
      )
    }

    // This would reset all learning data - implement with caution
    console.warn('Learning data reset requested - this would delete all learning progress')
    
    return NextResponse.json({
      success: true,
      message: 'Learning data reset initiated (not implemented for safety)',
      data: {
        resetAt: new Date().toISOString(),
        note: 'Full reset not implemented for data safety'
      }
    })
  } catch (error) {
    throw new Error(`Failed to reset learning data: ${error}`)
  }
}

// ========================================
// DELETE ENDPOINT HANDLERS
// ========================================

async function clearFeedbackData(confirm: string | null) {
  try {
    if (confirm !== 'CLEAR_FEEDBACK') {
      return NextResponse.json(
        { error: 'Invalid confirmation. Use "CLEAR_FEEDBACK" to confirm.' },
        { status: 400 }
      )
    }

    // This would clear feedback data - implement with caution
    console.warn('Feedback data clear requested - not implemented for safety')
    
    return NextResponse.json({
      success: true,
      message: 'Feedback data clear requested (not implemented for safety)',
      data: {
        requestedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to clear feedback data: ${error}`)
  }
}

async function clearPredictionData(confirm: string | null) {
  try {
    if (confirm !== 'CLEAR_PREDICTIONS') {
      return NextResponse.json(
        { error: 'Invalid confirmation. Use "CLEAR_PREDICTIONS" to confirm.' },
        { status: 400 }
      )
    }

    // This would clear prediction data - implement with caution
    console.warn('Prediction data clear requested - not implemented for safety')
    
    return NextResponse.json({
      success: true,
      message: 'Prediction data clear requested (not implemented for safety)',
      data: {
        requestedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to clear prediction data: ${error}`)
  }
}

async function disableLearning() {
  try {
    learningEngine.disableLearning()
    
    return NextResponse.json({
      success: true,
      message: 'Learning system disabled successfully',
      data: {
        enabled: false,
        disabledAt: new Date().toISOString()
      }
    })
  } catch (error) {
    throw new Error(`Failed to disable learning: ${error}`)
  }
} 