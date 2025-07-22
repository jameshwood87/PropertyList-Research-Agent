'use client'

import { useState } from 'react'

export default function ComparablesAnalysis({ sessionId, propertyData, onAnalysisComplete, setLoading }) {
  const [searchRadius, setSearchRadius] = useState(2)
  const [maxComparables, setMaxComparables] = useState(10)
  const [includeSold, setIncludeSold] = useState(true)

  const handleAnalysis = async () => {
    try {
      setLoading(true)
      
      // Simulate AI analysis (in production, this would call external APIs)
      await new Promise(resolve => setTimeout(resolve, 4000))
      
      // Mock comparables data
      const comparables = Array.from({ length: Math.min(maxComparables, 8) }, (_, i) => ({
        id: `comp_${i + 1}`,
        reference: `COMP${String(i + 1).padStart(3, '0')}`,
        price: Math.round(propertyData.price * (0.8 + Math.random() * 0.4)),
        bedrooms: propertyData.bedrooms + Math.floor(Math.random() * 3) - 1,
        bathrooms: propertyData.bathrooms + Math.floor(Math.random() * 2) - 0.5,
        build_square_meters: Math.round(propertyData.build_square_meters * (0.9 + Math.random() * 0.2)),
        price_per_sqm: 0,
        distance: (Math.random() * searchRadius).toFixed(1),
        sold_date: includeSold && Math.random() > 0.5 ? new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
        status: includeSold && Math.random() > 0.5 ? 'sold' : 'active'
      }))
      
      // Calculate price per sqm for each comparable
      comparables.forEach(comp => {
        comp.price_per_sqm = Math.round(comp.price / comp.build_square_meters)
      })
      
      const prices = comparables.map(c => c.price)
      const pricesPerSqm = comparables.map(c => c.price_per_sqm)
      
      const analysisResult = {
        type: 'comparables',
        comparables,
        averagePrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        averagePricePerSqm: Math.round(pricesPerSqm.reduce((a, b) => a + b, 0) / pricesPerSqm.length),
        priceRange: {
          min: Math.min(...prices),
          max: Math.max(...prices)
        },
        pricePerSqmRange: {
          min: Math.min(...pricesPerSqm),
          max: Math.max(...pricesPerSqm)
        },
        searchCriteria: {
          radius: searchRadius,
          maxResults: maxComparables,
          includeSold
        },
        insights: [
          `Found ${comparables.length} comparable properties within ${searchRadius}km`,
          `Average price: €${Math.round(prices.reduce((a, b) => a + b, 0) / prices.length).toLocaleString()}`,
          `Price range: €${Math.min(...prices).toLocaleString()} - €${Math.max(...prices).toLocaleString()}`,
          `Subject property is ${propertyData.price > (prices.reduce((a, b) => a + b, 0) / prices.length) ? 'above' : 'below'} average market price`
        ]
      }
      
      // Update session with analysis results
      await fetch(`http://localhost:3004/api/session/${sessionId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'comparables_analysis_complete',
          data: analysisResult
        })
      })
      
      onAnalysisComplete(analysisResult)
      
    } catch (error) {
      console.error('Comparables analysis error:', error)
      alert('Error performing comparables analysis. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Comparables Analysis</h3>
        <p className="text-sm text-gray-600 mb-4">
          Find and analyze similar properties in the market to determine fair market value.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Search Parameters</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Radius (km)
              </label>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={searchRadius}
                onChange={(e) => setSearchRadius(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0.5km</span>
                <span className="font-medium">{searchRadius}km</span>
                <span>5km</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Comparables
              </label>
              <select
                value={maxComparables}
                onChange={(e) => setMaxComparables(parseInt(e.target.value))}
                className="input-field"
              >
                <option value={5}>5 properties</option>
                <option value={10}>10 properties</option>
                <option value={15}>15 properties</option>
                <option value={20}>20 properties</option>
              </select>
            </div>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeSold}
                onChange={(e) => setIncludeSold(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include recently sold properties</span>
            </label>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Comparables Search</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>This search will find properties with similar:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Property type and size</li>
                  <li>Number of bedrooms and bathrooms</li>
                  <li>Location and amenities</li>
                  <li>Price range and market conditions</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleAnalysis}
          className="w-full btn-primary"
        >
          Find Comparables
        </button>
      </div>
    </div>
  )
} 