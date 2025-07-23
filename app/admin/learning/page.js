'use client'

import { useState, useEffect } from 'react'

export default function LearningDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedArea, setSelectedArea] = useState('Marbella')
  const [areaInsights, setAreaInsights] = useState(null)

  useEffect(() => {
    fetchLearningStats()
  }, [])

  useEffect(() => {
    if (selectedArea) {
      fetchAreaInsights(selectedArea)
    }
  }, [selectedArea])

  const fetchLearningStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:3004/api/admin/learning/stats')
      const data = await response.json()
      
      if (data.success) {
        setStats(data)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchAreaInsights = async (area) => {
    try {
      const response = await fetch(`http://localhost:3004/api/admin/learning/insights/${area}`)
      const data = await response.json()
      
      if (data.success) {
        setAreaInsights(data)
      }
    } catch (err) {
      console.error('Error fetching area insights:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading learning dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600">{error}</p>
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
              🧠 AI Learning Dashboard
            </h1>
            <button 
              onClick={fetchLearningStats}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Data
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                📊
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Feedback</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalFeedback || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                👍
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Helpfulness Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round((stats?.helpfulnessRate || 0) * 100)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                📈
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">This Week Accuracy</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round((stats?.learningProgress?.thisWeek || 0) * 100)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                (stats?.learningProgress?.improvement || 0) >= 0 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {(stats?.learningProgress?.improvement || 0) >= 0 ? '📈' : '📉'}
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Weekly Improvement</p>
                <p className={`text-2xl font-bold ${
                  (stats?.learningProgress?.improvement || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(stats?.learningProgress?.improvement >= 0 ? '+' : '')}
                  {Math.round((stats?.learningProgress?.improvement || 0) * 100)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Area Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Area-Specific Learning</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Area:
              </label>
              <select 
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Marbella">Marbella</option>
                <option value="Estepona">Estepona</option>
                <option value="Manilva">Manilva</option>
                <option value="Fuengirola">Fuengirola</option>
                <option value="Benalmadena">Benalmadena</option>
              </select>
            </div>

            {areaInsights && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Learning Insights</h3>
                  {areaInsights.insights?.length > 0 ? (
                    <ul className="space-y-2">
                      {areaInsights.insights.map((insight, index) => (
                        <li key={index} className="flex items-start">
                          <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                          <span className="text-sm text-gray-700">{insight}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No insights available yet</p>
                  )}
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Optimized Weights</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(areaInsights.optimizedWeights || {}).map(([key, value]) => (
                      <div key={key} className="bg-gray-50 p-3 rounded">
                        <span className="text-xs font-medium text-gray-500 uppercase">{key}</span>
                        <p className="text-lg font-semibold text-gray-900">
                          {Math.round(value * 100)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Analysis</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Top Performing Steps</h3>
                {stats?.topPerformingSteps?.length > 0 ? (
                  <div className="space-y-2">
                    {stats.topPerformingSteps.map((step, index) => (
                      <div key={index} className="flex items-center justify-between bg-green-50 p-3 rounded">
                        <span className="text-sm font-medium text-green-700 capitalize">{step}</span>
                        <span className="text-xs text-green-600">Performing Well</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No performance data available</p>
                )}
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-3">Improvement Areas</h3>
                {stats?.improvementAreas?.length > 0 ? (
                  <div className="space-y-2">
                    {stats.improvementAreas.map((area, index) => (
                      <div key={index} className="flex items-center justify-between bg-yellow-50 p-3 rounded">
                        <span className="text-sm font-medium text-yellow-700 capitalize">{area}</span>
                        <span className="text-xs text-yellow-600">Needs Focus</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No improvement areas identified</p>
                )}
              </div>

              {areaInsights?.feedbackPatterns && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Feedback Patterns</h3>
                  <div className="bg-gray-50 p-4 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Helpfulness Rate</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {Math.round(areaInsights.feedbackPatterns.helpfulnessRate * 100)}%
                      </span>
                    </div>
                    
                    {areaInsights.feedbackPatterns.commonIssues?.length > 0 && (
                      <div className="mt-3">
                        <span className="text-xs font-medium text-gray-500">Common Issues:</span>
                        <ul className="mt-1 space-y-1">
                          {areaInsights.feedbackPatterns.commonIssues.slice(0, 2).map((issue, index) => (
                            <li key={index} className="text-xs text-gray-600">• {issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <span className="text-sm text-gray-700">AI Learning Service: Active</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <span className="text-sm text-gray-700">Feedback Collection: Enabled</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
              <span className="text-sm text-gray-700">Last Updated: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 