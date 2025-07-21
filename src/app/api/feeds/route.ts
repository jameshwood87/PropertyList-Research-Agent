// Feed Management API Endpoints
import { NextRequest, NextResponse } from 'next/server'
import { FeedIntegration } from '@/lib/feeds/feed-integration'

export async function GET(request: NextRequest) {
  try {
    // Get feed system status and statistics
    const stats = FeedIntegration.getFeedSystemStats()
    
    return NextResponse.json({
      success: true,
      data: {
        feedSystem: stats,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error getting feed status:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get feed system status'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'update':
        // Manually trigger feed update
        const updateResult = await FeedIntegration.updateFeedData()
        return NextResponse.json({
          success: updateResult.success,
          message: updateResult.message,
          data: updateResult.stats
        })

      case 'initialize':
        // Initialize feed system
        const initialized = await FeedIntegration.initializeFeedSystem()
        return NextResponse.json({
          success: initialized,
          message: initialized ? 'Feed system initialized successfully' : 'Failed to initialize feed system'
        })

      case 'status':
        // Same as GET but via POST for consistency
        const stats = FeedIntegration.getFeedSystemStats()
        return NextResponse.json({
          success: true,
          data: stats
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: update, initialize, status'
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Error processing feed request:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
} 