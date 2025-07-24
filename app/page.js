'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PropertyDisplay from './components/PropertyDisplay'
import AnalysisPanel from './components/AnalysisPanel'
import LoadingSpinner from './components/LoadingSpinner'

// Separate component for content that uses useSearchParams
function HomeContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')
  
  const [sessionData, setSessionData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (sessionId) {
      fetchSessionData(sessionId)
    } else {
      setLoading(false)
    }
  }, [sessionId])

  const fetchSessionData = async (id) => {
    try {
      setLoading(true)
      const response = await fetch(`http://localhost:3004/api/session/${id}`)
      
      if (!response.ok) {
        throw new Error('Session not found')
      }
      
      const data = await response.json()
      setSessionData(data.session)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Please check your session URL and try again.</p>
        </div>
      </div>
    )
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            AI Property Research Agent
          </h1>
          <p className="text-gray-600 mb-8">
            Welcome to the advanced property market analysis platform.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-sm text-blue-800">
              To access property analysis, please use a valid session URL.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-xl font-semibold text-gray-900">
              AI Property Research Agent
            </h1>
            <div className="text-sm text-gray-500">
              Session: {sessionId.slice(0, 8)}...
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <PropertyDisplay propertyData={sessionData?.propertyData} />
          </div>
          <div>
            <AnalysisPanel sessionId={sessionId} propertyData={sessionData?.propertyData} />
          </div>
        </div>
      </main>
    </div>
  )
}

// Main component with Suspense boundary
export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
} 