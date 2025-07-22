'use client'

import { useState } from 'react'

export default function MarketAnalysis({ sessionId, propertyData, onAnalysisComplete, setLoading }) {
  const [analysisOptions, setAnalysisOptions] = useState({
    includeTrends: true,
    includeForecast: true,
    includeRisks: true
  })

  const handleAnalysis = async () => {
    try {
      setLoading(true)
      
      // Simulate AI analysis (in production, this would call OpenAI API)
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Mock analysis results
      const analysisResult = {
        type: 'market',
        marketValue: Math.round(propertyData.price * (0.95 + Math.random() * 0.1)),
        pricePerSqm: Math.round(propertyData.price / propertyData.build_square_meters),
        trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)],
        confidence: Math.round(70 + Math.random() * 25),
        insights: [
          'Property is priced competitively for the area',
          'Recent market trends show stable growth',
          'Energy rating B is above average for similar properties',
          'Location offers good accessibility to amenities'
        ],
        risks: [
          'Market volatility in the current economic climate',
          'Potential interest rate changes affecting affordability'
        ],
        recommendations: [
          'Consider the property as a good investment opportunity',
          'Monitor local market developments closely',
          'Factor in potential renovation costs if needed'
        ]
      }
      
      // Update session with analysis results
      await fetch(`http://localhost:3004/api/session/${sessionId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'market_analysis_complete',
          data: analysisResult
        })
      })
      
      onAnalysisComplete(analysisResult)
      
    } catch (error) {
      console.error('Market analysis error:', error)
      alert('Error performing market analysis. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Market Analysis</h3>
        <p className="text-sm text-gray-600 mb-4">
          Get AI-powered market value estimation, trend analysis, and investment insights for this property.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Analysis Options</h4>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={analysisOptions.includeTrends}
                onChange={(e) => setAnalysisOptions(prev => ({
                  ...prev,
                  includeTrends: e.target.checked
                }))}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include market trends</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={analysisOptions.includeForecast}
                onChange={(e) => setAnalysisOptions(prev => ({
                  ...prev,
                  includeForecast: e.target.checked
                }))}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include price forecast</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={analysisOptions.includeRisks}
                onChange={(e) => setAnalysisOptions(prev => ({
                  ...prev,
                  includeRisks: e.target.checked
                }))}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include risk assessment</span>
            </label>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Analysis Information</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>This analysis will provide:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Market value estimation based on comparable properties</li>
                  <li>Price per square metre analysis</li>
                  <li>Market trend indicators</li>
                  <li>Investment recommendations</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleAnalysis}
          className="w-full btn-primary"
        >
          Start Market Analysis
        </button>
      </div>
    </div>
  )
} 