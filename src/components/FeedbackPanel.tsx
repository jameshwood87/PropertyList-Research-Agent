'use client'

import React, { useState, useCallback } from 'react'
import { Star, ThumbsUp, ThumbsDown, MessageSquare, Send, Check, X, AlertCircle } from 'lucide-react'
import { UserFeedback, ComponentRating, PropertyCorrection } from '@/lib/learning/learning-types'
import { CMAReport } from '@/types'

interface FeedbackPanelProps {
  sessionId: string
  report: CMAReport
  onSubmit?: (feedback: UserFeedback) => void
  className?: string
}

interface StarRatingProps {
  rating: number
  onRatingChange: (rating: number) => void
  label: string
  size?: 'sm' | 'md' | 'lg'
}

const StarRating: React.FC<StarRatingProps> = ({ rating, onRatingChange, label, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700 min-w-0 flex-1">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRatingChange(star)}
            className={`${sizeClasses[size]} text-gray-300 hover:text-yellow-400 transition-colors`}
          >
            <Star 
              className={`w-full h-full ${star <= rating ? 'fill-yellow-400 text-yellow-400' : ''}`}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ 
  sessionId, 
  report, 
  onSubmit,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<'rating' | 'details' | 'corrections' | 'submitted'>('rating')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Feedback state
  const [overallRating, setOverallRating] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [overallComments, setOverallComments] = useState('')
  
  const [componentRatings, setComponentRatings] = useState<{
    [key: string]: ComponentRating
  }>({
    valuation: { rating: 3, accuracy: 3, usefulness: 3 },
    comparables: { rating: 3, accuracy: 3, usefulness: 3 },
    marketAnalysis: { rating: 3, accuracy: 3, usefulness: 3 },
    amenities: { rating: 3, accuracy: 3, usefulness: 3 },
    futureOutlook: { rating: 3, accuracy: 3, usefulness: 3 },
    aiSummary: { rating: 3, accuracy: 3, usefulness: 3 }
  })

  const [corrections, setCorrections] = useState<PropertyCorrection[]>([])
  const [newCorrection, setNewCorrection] = useState<Partial<PropertyCorrection>>({
    field: '',
    originalValue: '',
    correctedValue: '',
    confidence: 3,
    source: ''
  })

  const componentLabels = {
    valuation: 'Property Valuation',
    comparables: 'Comparable Properties',
    marketAnalysis: 'Market Analysis',
    amenities: 'Nearby Amenities',
    futureOutlook: 'Future Outlook',
    aiSummary: 'AI Analysis Summary'
  }

  const updateComponentRating = useCallback((component: string, field: keyof ComponentRating, value: number) => {
    setComponentRatings(prev => ({
      ...prev,
      [component]: {
        ...prev[component],
        [field]: value
      }
    }))
  }, [])

  const addCorrection = useCallback(() => {
    if (newCorrection.field && newCorrection.correctedValue) {
      const correction: PropertyCorrection = {
        field: newCorrection.field,
        originalValue: newCorrection.originalValue || 'Unknown',
        correctedValue: newCorrection.correctedValue,
        confidence: newCorrection.confidence || 3,
        source: newCorrection.source
      }
      
      setCorrections(prev => [...prev, correction])
      setNewCorrection({
        field: '',
        originalValue: '',
        correctedValue: '',
        confidence: 3,
        source: ''
      })
    }
  }, [newCorrection])

  const removeCorrection = useCallback((index: number) => {
    setCorrections(prev => prev.filter((_, i) => i !== index))
  }, [])

  const submitFeedback = useCallback(async () => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const feedback: UserFeedback = {
        id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        timestamp: new Date().toISOString(),
        overallRating,
        overallComments: overallComments.trim() || undefined,
        componentRatings: componentRatings as any,
        corrections
      }

      // Submit to API
      const response = await fetch('/api/learning/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(feedback)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit feedback')
      }

      // Call onSubmit callback if provided
      onSubmit?.(feedback)

      setStep('submitted')
    } catch (error) {
      console.error('Error submitting feedback:', error)
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit feedback')
    } finally {
      setIsSubmitting(false)
    }
  }, [sessionId, overallRating, overallComments, componentRatings, corrections, onSubmit])

  if (!isOpen) {
    return (
      <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
        <button
          onClick={() => setIsOpen(true)}
          className="bg-[#00ae9a] hover:bg-[#00c5ad] text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
        >
          <MessageSquare className="w-5 h-5" />
          Rate This Analysis
        </button>
      </div>
    )
  }

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {step === 'rating' && 'Rate Your Experience'}
            {step === 'details' && 'Detailed Feedback'}
            {step === 'corrections' && 'Data Corrections (Optional)'}
            {step === 'submitted' && 'Thank You!'}
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'rating' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Overall Experience</h3>
                <StarRating
                  rating={overallRating}
                  onRatingChange={(rating) => setOverallRating(rating as 1 | 2 | 3 | 4 | 5)}
                  label="How would you rate this analysis overall?"
                  size="lg"
                />
              </div>

              <div>
                <label htmlFor="comments" className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Comments (Optional)
                </label>
                <textarea
                  id="comments"
                  value={overallComments}
                  onChange={(e) => setOverallComments(e.target.value)}
                  placeholder="Share any thoughts about your experience..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00ae9a] focus:border-transparent resize-none"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep('details')}
                  className="bg-[#00ae9a] hover:bg-[#00c5ad] text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Component Ratings</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Please rate each component on accuracy and usefulness:
                </p>
                
                <div className="space-y-6">
                  {Object.entries(componentLabels).map(([key, label]) => (
                    <div key={key} className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-3">{label}</h4>
                      <div className="space-y-3">
                        <StarRating
                          rating={componentRatings[key].rating}
                          onRatingChange={(rating) => updateComponentRating(key, 'rating', rating)}
                          label="Overall Quality"
                        />
                        <StarRating
                          rating={componentRatings[key].accuracy}
                          onRatingChange={(rating) => updateComponentRating(key, 'accuracy', rating)}
                          label="Accuracy"
                        />
                        <StarRating
                          rating={componentRatings[key].usefulness}
                          onRatingChange={(rating) => updateComponentRating(key, 'usefulness', rating)}
                          label="Usefulness"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep('rating')}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Back
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('corrections')}
                    className="px-6 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    Add Corrections
                  </button>
                  <button
                    onClick={submitFeedback}
                    disabled={isSubmitting}
                    className="bg-[#00ae9a] hover:bg-[#00c5ad] disabled:opacity-50 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit Feedback
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'corrections' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Data Corrections</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Help us improve by correcting any inaccurate information you noticed:
                </p>

                {/* Existing corrections */}
                {corrections.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-3">Current Corrections:</h4>
                    <div className="space-y-2">
                      {corrections.map((correction, index) => (
                        <div key={index} className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                          <div className="flex-1">
                            <span className="font-medium">{correction.field}:</span>
                            <span className="text-gray-600 mx-2">"{correction.originalValue}"</span>
                            <span className="text-gray-500">→</span>
                            <span className="text-green-700 mx-2">"{correction.correctedValue}"</span>
                          </div>
                          <button
                            onClick={() => removeCorrection(index)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add new correction */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <h4 className="font-medium text-gray-900">Add New Correction:</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Field to Correct
                      </label>
                      <select
                        value={newCorrection.field}
                        onChange={(e) => setNewCorrection(prev => ({ ...prev, field: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00ae9a] focus:border-transparent"
                      >
                        <option value="">Select field...</option>
                        <option value="price">Price</option>
                        <option value="bedrooms">Bedrooms</option>
                        <option value="bathrooms">Bathrooms</option>
                        <option value="area">Area (m²)</option>
                        <option value="condition">Condition</option>
                        <option value="propertyType">Property Type</option>
                        <option value="features">Features</option>
                        <option value="address">Address</option>
                        <option value="description">Description</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Original Value
                      </label>
                      <input
                        type="text"
                        value={newCorrection.originalValue}
                        onChange={(e) => setNewCorrection(prev => ({ ...prev, originalValue: e.target.value }))}
                        placeholder="What was shown..."
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00ae9a] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Correct Value *
                      </label>
                      <input
                        type="text"
                        value={newCorrection.correctedValue}
                        onChange={(e) => setNewCorrection(prev => ({ ...prev, correctedValue: e.target.value }))}
                        placeholder="What it should be..."
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00ae9a] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Source (Optional)
                      </label>
                      <input
                        type="text"
                        value={newCorrection.source}
                        onChange={(e) => setNewCorrection(prev => ({ ...prev, source: e.target.value }))}
                        placeholder="Where you found the correct info..."
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00ae9a] focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <StarRating
                      rating={newCorrection.confidence || 3}
                      onRatingChange={(rating) => setNewCorrection(prev => ({ ...prev, confidence: rating as 1 | 2 | 3 | 4 | 5 }))}
                      label="How confident are you in this correction?"
                    />
                  </div>

                  <button
                    onClick={addCorrection}
                    disabled={!newCorrection.field || !newCorrection.correctedValue}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Add Correction
                  </button>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep('details')}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={submitFeedback}
                  disabled={isSubmitting}
                  className="bg-[#00ae9a] hover:bg-[#00c5ad] disabled:opacity-50 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Feedback
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'submitted' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Thank you for your feedback!
                </h3>
                <p className="text-gray-600">
                  Your input helps us improve the analysis quality and accuracy. 
                  The AI system will learn from your feedback to provide better results.
                </p>
              </div>

              <div className="bg-[#00ae9a]/10 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[#00ae9a] mt-0.5" />
                  <div className="text-left">
                    <h4 className="font-medium text-[#00ae9a] mb-1">Follow-up Opportunity</h4>
                    <p className="text-sm text-[#00ae9a]/80">
                      We may contact you in a few months to verify how accurate our predictions were. 
                      This helps us improve our forecasting accuracy.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="bg-[#00ae9a] hover:bg-[#00c5ad] text-white px-6 py-2 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* Error display */}
          {submitError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Submission Error</span>
              </div>
              <p className="text-red-600 mt-1">{submitError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FeedbackPanel 