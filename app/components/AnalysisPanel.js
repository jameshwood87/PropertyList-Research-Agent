'use client'

import { useState } from 'react'
import MarketAnalysis from './MarketAnalysis'
import ComparablesAnalysis from './ComparablesAnalysis'
import ReportGenerator from './ReportGenerator'

export default function AnalysisPanel({ sessionId, propertyData }) {
  const [activeTab, setActiveTab] = useState('market')
  const [analysisData, setAnalysisData] = useState(null)
  const [loading, setLoading] = useState(false)

  const tabs = [
    { id: 'market', name: 'Market Analysis', icon: '📊' },
    { id: 'comparables', name: 'Comparables', icon: '🏠' },
    { id: 'report', name: 'Generate Report', icon: '📄' }
  ]

  const handleAnalysisComplete = (data) => {
    setAnalysisData(data)
  }

  return (
    <div className="space-y-6">
      {/* Analysis Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6">
          {activeTab === 'market' && (
            <MarketAnalysis
              sessionId={sessionId}
              propertyData={propertyData}
              onAnalysisComplete={handleAnalysisComplete}
              setLoading={setLoading}
            />
          )}
          {activeTab === 'comparables' && (
            <ComparablesAnalysis
              sessionId={sessionId}
              propertyData={propertyData}
              onAnalysisComplete={handleAnalysisComplete}
              setLoading={setLoading}
            />
          )}
          {activeTab === 'report' && (
            <ReportGenerator
              sessionId={sessionId}
              propertyData={propertyData}
              analysisData={analysisData}
              setLoading={setLoading}
            />
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="text-gray-700">Analysing property data...</span>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysisData && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Results</h3>
          <div className="space-y-4">
            {analysisData.type === 'market' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Market Value Estimate</span>
                  <span className="text-lg font-semibold text-primary-600">
                    €{analysisData.marketValue?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Price per m²</span>
                  <span className="text-lg font-semibold text-gray-900">
                    €{analysisData.pricePerSqm?.toLocaleString()}/m²
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Market Trend</span>
                  <span className={`text-sm font-semibold ${
                    analysisData.trend === 'up' ? 'text-green-600' : 
                    analysisData.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {analysisData.trend === 'up' ? '↗️ Rising' : 
                     analysisData.trend === 'down' ? '↘️ Falling' : '→ Stable'}
                  </span>
                </div>
              </div>
            )}
            
            {analysisData.type === 'comparables' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Comparables Found</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {analysisData.comparables?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Average Price</span>
                  <span className="text-lg font-semibold text-primary-600">
                    €{analysisData.averagePrice?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Price Range</span>
                  <span className="text-lg font-semibold text-gray-900">
                    €{analysisData.priceRange?.min?.toLocaleString()} - €{analysisData.priceRange?.max?.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 