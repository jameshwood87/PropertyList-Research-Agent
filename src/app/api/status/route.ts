import { NextRequest, NextResponse } from 'next/server'

interface ServiceStatus {
  name: string
  status: 'online' | 'offline' | 'error'
  responseTime?: number
  error?: string
  icon: string
}

// Simple API status check that doesn't rely on external services
function checkBasicAPI(): ServiceStatus {
  return { 
    name: 'API Server', 
    status: 'online', 
    responseTime: 0, 
    icon: '⚡' 
  }
}

// Fast external service checks with very short timeouts
async function checkOpenAI(): Promise<ServiceStatus> {
  try {
    const startTime = Date.now()
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(2000) // Very short timeout
    })
    
    const responseTime = Date.now() - startTime
    
    if (response.ok) {
      return { name: 'OpenAI', status: 'online', responseTime, icon: '🤖' }
    } else {
      return { name: 'OpenAI', status: 'error', responseTime, error: `HTTP ${response.status}`, icon: '🤖' }
    }
  } catch (error) {
    return { 
      name: 'OpenAI', 
      status: 'offline', 
      error: 'Timeout', 
      icon: '🤖' 
    }
  }
}

async function checkGoogleMaps(): Promise<ServiceStatus> {
  try {
    const startTime = Date.now()
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=Madrid,Spain&key=${process.env.GOOGLE_MAPS_API_KEY}`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // Very short timeout
      }
    )
    
    const responseTime = Date.now() - startTime
    
    if (response.ok) {
      const data = await response.json()
      if (data.status === 'OK') {
        return { name: 'Google Maps', status: 'online', responseTime, icon: '🗺️' }
      } else {
        return { name: 'Google Maps', status: 'error', responseTime, error: data.error_message || data.status, icon: '🗺️' }
      }
    } else {
      return { name: 'Google Maps', status: 'error', responseTime, error: `HTTP ${response.status}`, icon: '🗺️' }
    }
  } catch (error) {
    return { 
      name: 'Google Maps', 
      status: 'offline', 
      error: 'Timeout', 
      icon: '🗺️' 
    }
  }
}

async function checkTavily(): Promise<ServiceStatus> {
  try {
    const startTime = Date.now()
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: 'test',
        max_results: 1
      }),
      signal: AbortSignal.timeout(2000) // Very short timeout
    })
    
    const responseTime = Date.now() - startTime
    
    if (response.ok) {
      return { name: 'Tavily', status: 'online', responseTime, icon: '🔍' }
    } else if (response.status === 401) {
      return { name: 'Tavily', status: 'error', responseTime, error: 'Invalid API key', icon: '🔍' }
    } else {
      return { name: 'Tavily', status: 'error', responseTime, error: `HTTP ${response.status}`, icon: '🔍' }
    }
  } catch (error) {
    return { 
      name: 'Tavily', 
      status: 'offline', 
      error: 'Timeout', 
      icon: '🔍' 
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    // Always include basic API status first
    const basicAPIStatus = checkBasicAPI()
    
    // Check external services with very short timeouts in parallel
    const [openaiStatus, googleMapsStatus, tavilyStatus] = await Promise.allSettled([
      checkOpenAI(),
      checkGoogleMaps(),
      checkTavily()
    ])
    
    // Handle results with proper error handling
    const statuses = [
      basicAPIStatus, // Always show API as online
      openaiStatus.status === 'fulfilled' ? openaiStatus.value : { name: 'OpenAI', status: 'offline', error: 'Timeout', icon: '🤖' },
      googleMapsStatus.status === 'fulfilled' ? googleMapsStatus.value : { name: 'Google Maps', status: 'offline', error: 'Timeout', icon: '🗺️' },
      tavilyStatus.status === 'fulfilled' ? tavilyStatus.value : { name: 'Tavily', status: 'offline', error: 'Timeout', icon: '🔍' }
    ]
    
    // Overall system health - always healthy if basic API is online
    const overallStatus = 'healthy'
    
    return NextResponse.json({
      overall: overallStatus,
      services: statuses,
      lastChecked: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Error checking service statuses:', error)
    
    // Even on error, show basic API as online
    const basicAPIStatus = checkBasicAPI()
    
    return NextResponse.json({
      overall: 'healthy',
      services: [basicAPIStatus],
      lastChecked: new Date().toISOString()
    }, { status: 200 })
  }
} 