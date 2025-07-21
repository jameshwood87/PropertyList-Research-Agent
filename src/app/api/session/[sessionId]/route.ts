import { NextRequest, NextResponse } from 'next/server'
import { fixPropertySpanishCharacters } from '@/lib/utils'

// Simple in-memory cache
const sessionCache = new Map<string, { data: any; timestamp: number }>()

// Helper function to handle session data processing
const handleSessionData = (data: any, sessionId: string, now: number, isBasicRequest: boolean) => {
  // Fix Spanish characters in property data
  if (data.property) {
    data.property = fixPropertySpanishCharacters(data.property)
  }
  
  // Cache the response
  const ttl = getCacheTTL(data.status)
  sessionCache.set(sessionId, { data, timestamp: now })
  
  // Return basic data if requested
  if (isBasicRequest) {
    const basicData = {
      sessionId: data.sessionId,
      status: data.status,
      property: {
        address: data.property?.address,
        city: data.property?.city,
        province: data.property?.province,
        price: data.property?.price,
        propertyType: data.property?.propertyType
      },
      completedSteps: data.completedSteps,
      totalSteps: data.totalSteps,
      createdAt: data.createdAt
    }
    return NextResponse.json(basicData)
  }
  
  return NextResponse.json(data)
}

// Cache TTL based on session status
const getCacheTTL = (sessionStatus: string) => {
  switch (sessionStatus) {
    case 'pending': return 1000    // 1 second for pending sessions
    case 'analyzing': return 3000  // 3 seconds for active analysis
    case 'completed': return 30000 // 30 seconds for completed sessions
    case 'degraded': return 30000  // 30 seconds for degraded sessions
    default: return 5000           // 5 seconds default
  }
}

// Simple cache cleanup
const cleanupCache = () => {
  const now = Date.now()
  const maxAge = 5 * 60 * 1000 // 5 minutes max age
  
  for (const [key, value] of Array.from(sessionCache.entries())) {
    if (now - value.timestamp > maxAge) {
      sessionCache.delete(key)
    }
  }
}

// Run cleanup every 30 seconds
setInterval(cleanupCache, 30 * 1000)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const { searchParams } = new URL(request.url)
    const isBasicRequest = searchParams.get('basic') === 'true'
    
    // Check cache first (skip cache if debug parameter is present)
    const skipCache = searchParams.get('debug') === 'true'
    const cached = sessionCache.get(sessionId)
    const now = Date.now()
    
    if (cached && !skipCache) {
      const ttl = getCacheTTL(cached.data.status)
      if (now - cached.timestamp < ttl) {
        // console.log(`📦 [CACHE] Cache hit for session: ${sessionId} (TTL: ${ttl}ms)`)
        
        // Return basic data if requested
        if (isBasicRequest) {
          const basicData = {
            sessionId: cached.data.sessionId,
            status: cached.data.status,
            property: {
              address: cached.data.property?.address,
              city: cached.data.property?.city,
              province: cached.data.property?.province,
              price: cached.data.property?.price,
              propertyType: cached.data.property?.propertyType
            },
            completedSteps: cached.data.completedSteps,
            totalSteps: cached.data.totalSteps,
            createdAt: cached.data.createdAt
          }
          return NextResponse.json(basicData)
        }
        
        return NextResponse.json(cached.data)
      }
    }
    
    // For production, we need to handle sessions without external listener server
    // Check if we're in development (localhost) or production
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development'
    
    if (isDevelopment) {
      // In development, try to fetch from listener server
      const listenerUrl = process.env.LISTENER_URL || 'http://localhost:3004'
      const timestamp = Date.now()
      const fullUrl = `${listenerUrl}/session/${sessionId}?t=${timestamp}`
      
      try {
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store'
        })
        
        if (response.ok) {
          const data = await response.json()
          return handleSessionData(data, sessionId, now, isBasicRequest)
        }
      } catch (error) {
        console.log('⚠️ Listener server not available, falling back to cache')
      }
    }
    
    // Fallback: Return cached data or error
    if (cached) {
      return handleSessionData(cached.data, sessionId, now, isBasicRequest)
    }
    
    // Check if session exists in property analysis storage
    const propertyAnalysisStorage = (globalThis as any).sessionStorage
    if (propertyAnalysisStorage && propertyAnalysisStorage.has(sessionId)) {
      const sessionData = propertyAnalysisStorage.get(sessionId)
      return handleSessionData(sessionData, sessionId, now, isBasicRequest)
    }
    
    return NextResponse.json(
      { error: 'Session not found' }, 
      { status: 404 }
    )
    
  } catch (error) {
    console.error('❌ Session fetch error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch session',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 