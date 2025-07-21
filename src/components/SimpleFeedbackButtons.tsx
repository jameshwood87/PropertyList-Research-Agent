'use client'

import React, { useState, useEffect } from 'react'
import { ThumbsUp, ThumbsDown, Check, X } from 'lucide-react'

interface SimpleFeedbackButtonsProps {
  sectionId: string
  sessionId: string
  onFeedbackSubmitted?: (sectionId: string, isPositive: boolean) => void
  className?: string
}

export default function SimpleFeedbackButtons({ 
  sectionId, 
  sessionId, 
  onFeedbackSubmitted,
  className = '' 
}: SimpleFeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showThankYou, setShowThankYou] = useState(false)

  // Reduced logging for production

  const handleFeedback = async (isPositive: boolean) => {
    if (feedback !== null) return // Prevent double submission
    
    // Reduced logging for production
    
    setFeedback(isPositive ? 'positive' : 'negative')
    setIsSubmitting(true)

    try {
      // Submit feedback to API
      const response = await fetch('/api/learning/simple-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          sectionId,
          feedback: isPositive ? 'positive' : 'negative',
          timestamp: new Date().toISOString()
        })
      })

      if (response.ok) {
        // Reduced logging for production
        setShowThankYou(true)
        onFeedbackSubmitted?.(sectionId, isPositive)
        
        // Hide thank you message after 2 seconds
        setTimeout(() => {
          setShowThankYou(false)
          setFeedback(null)
        }, 2000)
      } else {
        console.error('❌ Feedback submission failed:', response.status)
        // Reset on error
        setFeedback(null)
      }
    } catch (error) {
      console.error('❌ Error submitting feedback:', error)
      setFeedback(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setFeedback(null)
    setShowThankYou(false)
  }

  if (showThankYou) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <Check className="w-4 h-4 text-green-600" />
        <span className="text-green-700 font-medium">Thank you!</span>
        <button
          onClick={handleReset}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={() => handleFeedback(true)}
        disabled={feedback !== null || isSubmitting}
        className={`p-2 rounded-full transition-all ${
          feedback === 'positive'
            ? 'bg-green-100 text-green-600 border-2 border-green-300'
            : feedback === 'negative'
            ? 'bg-gray-100 text-gray-400 border-2 border-gray-200'
            : 'bg-white text-gray-500 hover:text-green-600 hover:bg-green-50 border-2 border-gray-200 hover:border-green-300'
        } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
        title="This section is helpful"
      >
        <ThumbsUp className="w-4 h-4" />
      </button>
      
      <button
        onClick={() => handleFeedback(false)}
        disabled={feedback !== null || isSubmitting}
        className={`p-2 rounded-full transition-all ${
          feedback === 'negative'
            ? 'bg-red-100 text-red-600 border-2 border-red-300'
            : feedback === 'positive'
            ? 'bg-gray-100 text-gray-400 border-2 border-gray-200'
            : 'bg-white text-gray-500 hover:text-red-600 hover:bg-red-50 border-2 border-gray-200 hover:border-red-300'
        } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
        title="This section needs improvement"
      >
        <ThumbsDown className="w-4 h-4" />
      </button>
    </div>
  )
} 