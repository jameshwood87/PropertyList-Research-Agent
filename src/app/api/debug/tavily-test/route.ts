import { NextRequest, NextResponse } from 'next/server'

// Test Tavily search function with detailed response
async function searchTavily(query: string): Promise<any> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    console.warn('Tavily API key not configured')
    return []
  }

  try {
    const startTime = Date.now()
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        search_depth: 'advanced',
        include_answer: true,
        include_raw_content: false,
        max_results: 5
      })
    })
    
    const responseTime = Date.now() - startTime
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log('Tavily response:', { query, responseTime, resultsCount: data.results?.length || 0 })
    
    return {
      success: true,
      results: data.results || [],
      responseTime,
      rawResponse: data
    }
    
  } catch (error) {
    console.error('Tavily API error:', error)
    return {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: 0
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required and must be a string' },
        { status: 400 }
      )
    }

    console.log('🔍 Testing Tavily search:', query)
    
    const results = await searchTavily(query)
    
    return NextResponse.json(results)
    
  } catch (error) {
    console.error('❌ Tavily test endpoint error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results: []
      },
      { status: 500 }
    )
  }
} 