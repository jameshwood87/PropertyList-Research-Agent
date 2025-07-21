import { NextRequest, NextResponse } from 'next/server'
import { cacheManager } from '@/lib/cache-manager'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'stats') {
      const stats = await cacheManager.getCacheStats()
      return NextResponse.json({
        success: true,
        stats,
        message: 'Cache statistics retrieved successfully'
      })
    }

    if (action === 'cleanup') {
      await cacheManager.cleanup()
      return NextResponse.json({
        success: true,
        message: 'Cache cleanup completed'
      })
    }

    // Default: return cache stats
    const stats = await cacheManager.getCacheStats()
    return NextResponse.json({
      success: true,
      stats,
      message: 'Cache system is operational'
    })

  } catch (error) {
    console.error('Cache API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Cache operation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cacheType = searchParams.get('type')
    const key = searchParams.get('key')

    if (cacheType && key) {
      await cacheManager.delete(cacheType, key)
      return NextResponse.json({
        success: true,
        message: `Deleted cache entry: ${cacheType}:${key}`
      })
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Missing cache type or key parameters'
      },
      { status: 400 }
    )

  } catch (error) {
    console.error('Cache deletion error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Cache deletion failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 