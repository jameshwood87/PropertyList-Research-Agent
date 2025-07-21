import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    
    const body = await request.json()
    
    // Forward request to listener server
    const listenerUrl = process.env.LISTENER_URL || 'http://localhost:3004'
    const fullUrl = `${listenerUrl}/start-analysis/${sessionId}`
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }
    
    return NextResponse.json(data)
    
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to start analysis',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: 'Check server logs for more information'
      },
      { status: 500 }
    )
  }
} 