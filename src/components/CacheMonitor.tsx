'use client'

import React, { useState, useEffect } from 'react'
import { RefreshCw, Trash2, BarChart3 } from 'lucide-react'

interface CacheStats {
  memoryCacheSize: number
  fileCacheCount: number
  cacheTypes: Record<string, number>
}

interface CacheMonitorProps {
  className?: string
}

export default function CacheMonitor({ className = '' }: CacheMonitorProps) {
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/cache?action=stats')
      const data = await response.json()
      
      if (data.success) {
        setStats(data.stats)
      } else {
        setError(data.message || 'Failed to fetch cache stats')
      }
    } catch (err) {
      setError('Failed to connect to cache API')
    } finally {
      setLoading(false)
    }
  }

  const cleanupCache = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/cache?action=cleanup')
      const data = await response.json()
      
      if (data.success) {
        await fetchStats() // Refresh stats after cleanup
      } else {
        setError(data.message || 'Failed to cleanup cache')
      }
    } catch (err) {
      setError('Failed to cleanup cache')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (!stats && !loading && !error) {
    return null
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          Cache System
        </h3>
        <div className="flex gap-2">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
            title="Refresh cache stats"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={cleanupCache}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
            title="Clean up expired cache entries"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {loading && !stats && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading cache stats...</span>
        </div>
      )}

      {stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-3 rounded-md">
              <div className="text-2xl font-bold text-blue-600">{stats.memoryCacheSize}</div>
              <div className="text-sm text-blue-700">Memory Cache</div>
            </div>
            <div className="bg-green-50 p-3 rounded-md">
              <div className="text-2xl font-bold text-green-600">{stats.fileCacheCount}</div>
              <div className="text-sm text-green-700">File Cache</div>
            </div>
          </div>

          {Object.keys(stats.cacheTypes).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Cache Types</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(stats.cacheTypes).map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 capitalize">{type}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-md">
            <div className="font-medium mb-1">Cache TTL (Time To Live):</div>
            <div>• Coordinates: 30 days</div>
            <div>• Amenities: 7 days</div>
            <div>• Market Data: 24 hours</div>
            <div>• Tavily Results: 7 days (intelligent)</div>
            <div>• Mobility Data: 7 days</div>
          </div>
        </div>
      )}
    </div>
  )
} 