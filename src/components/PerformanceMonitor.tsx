'use client'

import React, { useState, useEffect } from 'react'
import { Clock, Zap, Database, TrendingUp } from 'lucide-react'

interface PerformanceMetrics {
  initialLoadTime: number
  cacheHitRate: number
  averageResponseTime: number
  activeRequests: number
  memoryUsage: number
}

export default function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    initialLoadTime: 0,
    cacheHitRate: 0,
    averageResponseTime: 0,
    activeRequests: 0,
    memoryUsage: 0
  })
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Track performance metrics
    const trackMetrics = () => {
      // Get memory usage if available
      let memoryUsage = 0
      try {
        if (performance && (performance as any).memory && (performance as any).memory.usedJSHeapSize) {
          memoryUsage = Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
        }
      } catch (error) {
        // Memory API not available or failed
        memoryUsage = 0
      }

      setMetrics(prev => ({
        ...prev,
        memoryUsage
      }))
    }

    // Update metrics every 5 seconds
    const interval = setInterval(trackMetrics, 5000)
    trackMetrics() // Initial call

    return () => clearInterval(interval)
  }, [])

  // Listen for performance events from the session API
  useEffect(() => {
    const handlePerformanceEvent = (event: CustomEvent) => {
      try {
        const { type, data } = event.detail || {}
        
        if (!type) return
      
      switch (type) {
        case 'session_load':
          setMetrics(prev => ({
            ...prev,
              initialLoadTime: data?.duration || 0
          }))
          break
        case 'cache_hit':
          setMetrics(prev => ({
            ...prev,
            cacheHitRate: Math.round((prev.cacheHitRate * 0.9) + (100 * 0.1))
          }))
          break
        case 'cache_miss':
          setMetrics(prev => ({
            ...prev,
            cacheHitRate: Math.round((prev.cacheHitRate * 0.9) + (0 * 0.1))
          }))
          break
        case 'response_time':
          setMetrics(prev => ({
            ...prev,
              averageResponseTime: Math.round((prev.averageResponseTime * 0.9) + ((data?.duration || 0) * 0.1))
          }))
          break
        }
      } catch (error) {
        // Ignore performance event errors
        console.warn('Performance event error:', error)
      }
    }

    try {
    window.addEventListener('performance-metric', handlePerformanceEvent as EventListener)
    return () => window.removeEventListener('performance-metric', handlePerformanceEvent as EventListener)
    } catch (error) {
      // Event listener not supported
      return () => {}
    }
  }, [])

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors z-50"
        title="Show Performance Monitor"
      >
        <Zap className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-64 z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Performance Monitor</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center text-gray-600">
            <Clock className="w-3 h-3 mr-1" />
            Initial Load
          </div>
          <span className="font-mono">{metrics.initialLoadTime}ms</span>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center text-gray-600">
            <Database className="w-3 h-3 mr-1" />
            Cache Hit Rate
          </div>
          <span className="font-mono">{metrics.cacheHitRate}%</span>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center text-gray-600">
            <TrendingUp className="w-3 h-3 mr-1" />
            Avg Response
          </div>
          <span className="font-mono">{metrics.averageResponseTime}ms</span>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center text-gray-600">
            <Zap className="w-3 h-3 mr-1" />
            Memory Usage
          </div>
          <span className="font-mono">{metrics.memoryUsage}MB</span>
        </div>
      </div>
      
      <div className="mt-3 pt-2 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          Cache TTL: Adaptive (1-30s)
        </div>
        <div className="text-xs text-gray-500">
          Polling: Adaptive (0.5-3s)
        </div>
      </div>
    </div>
  )
} 