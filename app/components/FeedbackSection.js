'use client'

import { useState } from 'react'

export default function FeedbackSection({ sessionId, stepId, stepResult, sessionData }) {
  const [feedback, setFeedback] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)

  // Show feedback after a delay to let user read results
  useState(() => {
    const timer = setTimeout(() => {
      setShowFeedback(true)
    }, 8000) // Show after 8 seconds

    return () => clearTimeout(timer)
  }, [])

  const submitFeedback = async (helpful) => {
    if (isSubmitting || feedback !== null) return

    setIsSubmitting(true)
    
    try {
      const response = await fetch('http://localhost:3004/api/feedback', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          sessionId,
          stepId,
          helpful,
          propertyReference: sessionData?.propertyData?.reference,
          timestamp: new Date().toISOString()
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setFeedback(helpful)
        console.log('✅ Feedback submitted successfully')
      } else {
        console.error('❌ Feedback submission failed:', result.error)
      }
    } catch (error) {
      console.error('❌ Error submitting feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!showFeedback && feedback === null) {
    return null
  }

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
      {feedback === null ? (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <p className="text-sm font-medium text-gray-700">
              Was this {getStepDisplayName(stepId)} helpful?
            </p>
          </div>
          
          <div className="flex space-x-3">
            <button 
              onClick={() => submitFeedback(true)}
              disabled={isSubmitting}
              className={`
                flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${isSubmitting 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-green-100 text-green-700 hover:bg-green-200 hover:scale-105 active:scale-95'
                }
              `}
            >
              <span className="mr-2">👍</span>
              Helpful
            </button>
            
            <button 
              onClick={() => submitFeedback(false)}
              disabled={isSubmitting}
              className={`
                flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${isSubmitting 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-red-100 text-red-700 hover:bg-red-200 hover:scale-105 active:scale-95'
                }
              `}
            >
              <span className="mr-2">👎</span>
              Needs work
            </button>
          </div>
          
          {isSubmitting && (
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
              <span>Processing feedback...</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center
            ${feedback ? 'bg-green-100' : 'bg-red-100'}
          `}>
            <span className="text-lg">
              {feedback ? '✅' : '⚠️'}
            </span>
          </div>
          <div>
            <p className={`
              text-sm font-medium
              ${feedback ? 'text-green-700' : 'text-red-700'}
            `}>
              {feedback 
                ? 'Thanks! Your feedback helps improve our analysis.' 
                : 'Thanks! We\'ll work on improving this analysis step.'
              }
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Your feedback is being used to enhance our AI analysis engine.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function getStepDisplayName(stepId) {
  const displayNames = {
    market: 'market analysis',
    comparables: 'comparable properties analysis',
    insights: 'investment insights',
    report: 'analysis report'
  }
  return displayNames[stepId] || stepId
} 