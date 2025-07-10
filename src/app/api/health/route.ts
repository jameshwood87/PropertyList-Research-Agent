import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Simple health check - just verify the API is responding
    return NextResponse.json({ 
      status: 'online',
      timestamp: new Date().toISOString(),
      services: {
        api: 'running',
        scraper: 'ready',
        analysis: 'ready'
      }
    })
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      },
      { status: 500 }
    )
  }
} 