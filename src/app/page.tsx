'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Header from '@/components/Header'
import { CMAReport } from '@/types'
import { Home as HomeIcon, ArrowRight, Users, Zap } from 'lucide-react'

// Direct imports to avoid webpack errors
import PropertyPreview from '@/components/PropertyPreview'
import AnalysisDashboard from '@/components/AnalysisDashboard'
import CMAReportDisplay from '@/components/CMAReportDisplay'
import RentalReportDisplay from '@/components/RentalReportDisplay'
// const PerformanceMonitor = React.lazy(() => import('@/components/PerformanceMonitor'))

interface SessionData {
  sessionId: string
  userId: string
  status: 'pending' | 'analyzing' | 'finalizing' | 'completed' | 'error' | 'degraded'
  property: any
  userContext: string
  createdAt: number
  steps: any[]
  report: CMAReport | null
  completedSteps?: number
  totalSteps?: number
  qualityScore?: number
  progress?: {
    currentStep: number
    totalSteps: number
    completedSteps: number
    failedSteps: number
    criticalErrors: number
    qualityScore: number
  }
}

// Loading component for dynamic imports (temporarily disabled)
// const ComponentLoader = () => (
//   <div className="flex items-center justify-center p-8">
//     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
//   </div>
// )

export default function Home() {
  const searchParams = useSearchParams()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  
  // Handle hydration mismatch for search params
  useEffect(() => {
    setIsClient(true)
    if (searchParams) {
      setSessionId(searchParams.get('sessionId'))
    }
  }, [searchParams])
  
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'preview' | 'dashboard' | 'report'>('preview')
  const [analysisStarted, setAnalysisStarted] = useState(false)
  const [viewTransitionLock, setViewTransitionLock] = useState(false)

  // Request deduplication cache
  const requestCache = useRef<Map<string, Promise<any>>>(new Map())

  // Adaptive polling interval based on analysis progress
  const getPollingInterval = (session: SessionData | null) => {
    if (!session) return null
    
    if (session.status === 'completed' || session.status === 'degraded') {
      return null // Stop polling for completed sessions
    }
    
    if (session.status !== 'analyzing') {
      return 3000 // 3 seconds for pending sessions
    }
    
    // Adaptive polling based on progress
    const progress = session.completedSteps && session.totalSteps 
      ? session.completedSteps / session.totalSteps 
      : 0
    
    if (progress < 0.3) return 3000  // Early: 3 seconds
    if (progress < 0.7) return 2000  // Middle: 2 seconds  
    if (progress < 0.9) return 1000  // Late: 1 second
    return 500 // Final: 0.5 seconds
  }

  // Fetch session data if sessionId is provided
  useEffect(() => {
    if (sessionId && isClient) {
      setAnalysisStarted(false) // Reset analysis started flag for new session
      setViewMode('preview') // Start with preview mode for new sessions
      
      // Progressive loading: Load basic info first, then detailed data
      const loadSessionProgressively = async () => {
        try {
          // First, load basic session info quickly
          const basicResponse = await fetch(`/api/session/${sessionId}?basic=true&t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
          })
          
          if (basicResponse.ok) {
            const basicData = await basicResponse.json()
            console.log('📡 [PROGRESSIVE] Basic session data loaded:', basicData.sessionId)
            setSession(basicData)
            setError(null)
          } else {
            // Fallback to full load if basic endpoint not available
            await fetchSessionData(sessionId)
          }
          
          // Then load detailed data after a short delay
          setTimeout(async () => {
            if (session?.status === 'analyzing' || !session) {
              console.log('📡 [PROGRESSIVE] Loading detailed session data')
              await fetchSessionData(sessionId)
            }
          }, 500)
          
        } catch (err) {
          console.error('❌ Error in progressive loading:', err)
          // Fallback to standard loading
          await fetchSessionData(sessionId)
        }
      }
      
      loadSessionProgressively()
      
      // Additional fetch after a short delay to handle hot reload race conditions
      const timeoutId = setTimeout(() => {
        console.log('🔄 Hot-reload recovery: Re-fetching session data')
        fetchSessionData(sessionId)
      }, 1000)
      
      return () => clearTimeout(timeoutId)
    }
  }, [sessionId])

  // SIMPLIFIED: Check if analysis is complete
  const isAnalysisComplete = session && 
    (session.status === 'completed' || session.status === 'degraded') &&
    session.completedSteps && session.totalSteps &&
    session.completedSteps >= session.totalSteps &&
    session.report

  // ENHANCED: Adaptive polling mechanism with deduplication
  useEffect(() => {
    if (!session || !sessionId) return
    
    // Only poll if analysis is in progress and not complete
    const shouldPoll = session.status === 'analyzing' && !isAnalysisComplete
    
    console.log('🔍 [POLLING] Should poll:', shouldPoll, {
      status: session.status,
      isComplete: isAnalysisComplete,
      completedSteps: session.completedSteps,
      totalSteps: session.totalSteps,
      hasReport: !!session.report
    })
    
          if (shouldPoll) {
        const interval = getPollingInterval(session)
        if (!interval) {
          console.log('🛑 [POLLING] No polling interval - analysis complete')
          return
        }
        
        console.log(`🔄 [POLLING] Starting adaptive polling for session: ${session.sessionId} (${interval}ms)`)
        
        const pollInterval = setInterval(() => {
          fetchSessionData(session.sessionId)
        }, interval)
        
        return () => {
          console.log('🛑 [POLLING] Stopping polling for session:', session.sessionId)
          clearInterval(pollInterval)
        }
      } else {
        console.log('🛑 [POLLING] Not polling - analysis complete or not analyzing')
      }
  }, [session?.status, session?.sessionId, isAnalysisComplete, sessionId])

  // FIXED: View transitions with better state management and transition lock
  useEffect(() => {
    if (!session || viewTransitionLock) return
    
    console.log('🔍 [VIEW] Checking view transition:', {
      status: session.status,
      isComplete: isAnalysisComplete,
      viewMode,
      analysisStarted,
      transitionLocked: viewTransitionLock
    })
    
    // FIXED: Don't switch back to preview if analysis has been started
    // This prevents flickering when session data is refreshed
    if (session.status === 'pending' && viewMode !== 'preview' && !analysisStarted) {
      console.log('🔄 [VIEW] Switching to preview - session pending (analysis not started)')
      setViewMode('preview')
    } else if (session.status === 'analyzing' && viewMode !== 'dashboard') {
              console.log('🔄 [VIEW] Switching to dashboard - analysis in progress')
      setViewMode('dashboard')
    } else if (isAnalysisComplete && viewMode !== 'report') {
              console.log('🔄 [VIEW] Switching to report - analysis complete')
      setViewMode('report')
      setLoading(false)
      setAnalysisStarted(false)
    }
  }, [session?.status, isAnalysisComplete, viewMode, analysisStarted, viewTransitionLock])

  // Ensure page scrolls to top when switching to dashboard view
  useEffect(() => {
    if (viewMode === 'dashboard') {
      window.scrollTo(0, 0)
    }
  }, [viewMode])

  const fetchSessionData = async (sessionId: string) => {
    // Request deduplication - prevent concurrent requests
    const requestKey = `session_${sessionId}`
    if (requestCache.current.has(requestKey)) {
      console.log(`🔄 [FETCH] Returning existing request for session: ${sessionId}`)
      
      // Emit cache hit event
      window.dispatchEvent(new CustomEvent('performance-metric', {
        detail: { type: 'cache_hit', data: { sessionId } }
      }))
      
      return requestCache.current.get(requestKey)
    }
    
    // Create the actual request promise
    const requestPromise = (async () => {
      try {
        const startTime = Date.now()
        console.log('📡 [FETCH] Making request to session:', sessionId)
        const response = await fetch(`/api/session/${sessionId}?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
        const callDuration = Date.now() - startTime
        
        // Emit response time event
        window.dispatchEvent(new CustomEvent('performance-metric', {
          detail: { type: 'response_time', data: { duration: callDuration, sessionId } }
        }))
        
        // Track cache performance from headers
        const cacheHit = response.headers.get('X-Cache-Hit') === 'true'
        const cacheTTL = response.headers.get('X-Cache-TTL')
        
        if (cacheHit) {
          window.dispatchEvent(new CustomEvent('performance-metric', {
            detail: { type: 'cache_hit', data: { sessionId, ttl: cacheTTL } }
          }))
        } else {
          window.dispatchEvent(new CustomEvent('performance-metric', {
            detail: { type: 'cache_miss', data: { sessionId, ttl: cacheTTL } }
          }))
        }
        
        if (response.ok) {
          const sessionData = await response.json()
          
          console.log('✅ [FETCH] Session data loaded successfully:', sessionData.sessionId)
          
          setSession(sessionData)
          setError(null)
          
          // Emit session load event for initial loads
          if (!session) {
            window.dispatchEvent(new CustomEvent('performance-metric', {
              detail: { type: 'session_load', data: { duration: callDuration, sessionId } }
            }))
          }
          
          console.log('📊 [FETCH] Session status:', sessionData.status, 'Steps:', sessionData.completedSteps, '/', sessionData.totalSteps)
        } else {
          let errorMessage = 'Failed to load session'
          try {
            const errorData = await response.json()
            console.error('❌ Session fetch failed:', errorData)
            errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`
          } catch (parseError) {
            console.error('❌ Session fetch failed with non-JSON response:', response.status, response.statusText)
            errorMessage = `HTTP ${response.status}: ${response.statusText}`
          }
          setError(errorMessage)
        }
      } catch (err) {
        console.error('❌ Error fetching session data:', err)
        setError(err instanceof Error ? err.message : 'Network error')
      }
    })()
    
    // Store the request promise for deduplication
    requestCache.current.set(requestKey, requestPromise)
    
    try {
      return await requestPromise
    } finally {
      // Clean up request cache after completion
      requestCache.current.delete(requestKey)
    }
  }

  const handleStartAnalysis = async (userContext: string) => {
    if (!session) {
      return
    }
    
    // Set loading state IMMEDIATELY to show button spinner
    setLoading(true)
    
    // Set analysis started flag to prevent automatic view mode changes
    setAnalysisStarted(true)
    
    // Lock view transitions to prevent flickering
    setViewTransitionLock(true)
    
    // Switch to dashboard view IMMEDIATELY when button is clicked
    setViewMode('dashboard')
    setSession(prev => prev ? { ...prev, status: 'analyzing', userContext } : null)
    try {
      const response = await fetch(`/api/session/${session.sessionId}/start-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userContext }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        // Don't revert navigation - stay on dashboard to show error state
        setSession(prev => prev ? { ...prev, status: 'error', error: errorData.message || 'Failed to start analysis' } : null)
        
        // Show user-friendly error message
        setError(`Failed to start analysis: ${errorData.message || 'Unknown error'}. Please try again.`)
      } else {
        const responseData = await response.json()
        
        // Main polling mechanism will handle data updates
        // No need for additional timeout-based fetching
      }
    } catch (err) {
      // Don't revert navigation - stay on dashboard to show error state
      const errorMessage = err instanceof Error ? err.message : 'Network error occurred'
      setSession(prev => prev ? { ...prev, status: 'error', error: errorMessage } : null)
      setError(`Network error: ${errorMessage}. Please check your connection and try again.`)
    } finally {
      setLoading(false)
      
      // Unlock view transitions after a short delay to prevent flickering
      setTimeout(() => {
        setViewTransitionLock(false)
      }, 2000) // 2 second delay to ensure stable state
    }
  }

  // Show loading state during hydration
  if (!isClient) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#00ae9a', borderTopColor: 'transparent' }}></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  // Landing page when no session ID is provided
  if (!sessionId) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-start justify-center p-6 pt-20">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white p-6 rounded-xl shadow-sm mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">How it works?</h3>
              <p className="text-gray-600">
                Click 'AI Analysis' on any property in <a href="https://propertylist.es" target="_blank" rel="noopener noreferrer" className="font-medium hover:underline" style={{ color: '#00ae9a' }}>PropertyList.es</a> MLS to start a full AI-powered report.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="text-3xl mb-3 text-center">📊</div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Instantly Know What Your Property Is Worth</h3>
                <p className="text-xs text-gray-600">Use our data-driven CMA tool to get an accurate value range for any home in Spain— based on real listings, recent sales, and regional market trends.</p>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="text-3xl mb-3 text-center">🏘️</div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Compare Listings Like a Local Agent</h3>
                <p className="text-xs text-gray-600">See side-by-side comparisons of similar properties, with photos, price/m², and days on market — using live data from PropertyList, Property Portals, INE, and Spanish property registries.</p>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="text-3xl mb-3 text-center">📄</div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Generate Your Own CMA Report</h3>
                <p className="text-xs text-gray-600">Download a professional, branded CMA report — perfect for sellers, buyers, or agents needing to make informed decisions in minutes.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-6">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Session Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Reload Page
            </button>
          </div>
        </main>
      </div>
    )
  }

  // Loading state
  if (!session) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#00ae9a', borderTopColor: 'transparent' }}></div>
            <p className="text-gray-600">Loading session data...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {viewMode === 'preview' && (
          <div className="py-8">
            <PropertyPreview
              property={session.property}
              onStartAnalysis={handleStartAnalysis}
            />
          </div>
        )}
        
        {viewMode === 'dashboard' && (
          <div className="py-8">
            <AnalysisDashboard 
              sessionId={session.sessionId}
              property={session.property}
              userContext={session.userContext}
              sessionData={session}
            />
          </div>
        )}
        
        {viewMode === 'report' && session.report && (
          <div className="py-8">
            {session.report.propertyData && (session.report.propertyData.isShortTerm || session.report.propertyData.isLongTerm || session.report.propertyData.monthlyPrice || session.report.propertyData.weeklyPriceFrom)
              ? <RentalReportDisplay report={session.report} sessionId={session.sessionId} />
              : <CMAReportDisplay report={session.report} sessionId={session.sessionId} />
            }
          </div>
        )}
      </main>
      
      {/* Performance Monitor */}
      {/* <PerformanceMonitor /> */}
    </div>
  )
} 