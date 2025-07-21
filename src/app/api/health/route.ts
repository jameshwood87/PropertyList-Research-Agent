import { NextResponse } from 'next/server'

// Simple in-memory cache for health status
let healthCache: {
  data: any
  timestamp: number
} | null = null

const CACHE_DURATION = 30000 // 30 seconds

export async function GET() {
  try {
    // Check cache first
    const now = Date.now()
    if (healthCache && (now - healthCache.timestamp) < CACHE_DURATION) {
      return NextResponse.json(healthCache.data, { 
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=30',
          'X-Cache': 'HIT'
        }
      })
    }

    // Basic health check - you can add more sophisticated checks here
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      memory: process.memoryUsage ? {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      } : null
    }

    // Cache the result
    healthCache = {
      data: healthData,
      timestamp: now
    }

    return NextResponse.json(healthData, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=30',
        'X-Cache': 'MISS'
      }
    })
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    )
  }
} 