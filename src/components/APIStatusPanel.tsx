'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApiStatus } from '@/hooks/useApiStatus'

interface ServiceStatus {
  name: string
  status: 'online' | 'offline' | 'error'
  responseTime?: number
  error?: string
  icon: string
}

interface APIStatusResponse {
  overall: 'healthy' | 'degraded' | 'down' | 'error'
  services: ServiceStatus[]
  lastChecked: string
  error?: string
}

export default function APIStatusPanel() {
  const [isExpanded, setIsExpanded] = useState(false)
  const { openai, googleMaps, tavily, isLoading, lastChecked, refresh } = useApiStatus()

  // Convert useApiStatus data to APIStatusResponse format
  const services: ServiceStatus[] = [
    { name: 'OpenAI', status: openai?.status || 'offline', responseTime: openai?.responseTime, error: openai?.error, icon: '🤖' },
    { name: 'Google Maps', status: googleMaps?.status || 'offline', responseTime: googleMaps?.responseTime, error: googleMaps?.error, icon: '🗺️' },
    { name: 'Tavily', status: tavily?.status || 'offline', responseTime: tavily?.responseTime, error: tavily?.error, icon: '🔍' }
  ]

  const overallStatus = services.every(s => s.status === 'online') ? 'healthy' : 
                       services.some(s => s.status === 'online') ? 'degraded' : 'down'

  const status: APIStatusResponse = {
    overall: overallStatus,
    services,
    lastChecked: lastChecked || new Date().toISOString()
  }

  const getStatusColor = (serviceStatus: 'online' | 'offline' | 'error') => {
    switch (serviceStatus) {
      case 'online': return 'bg-green-500'
      case 'offline': return 'bg-red-500'
      case 'error': return 'bg-yellow-500'
      default: return 'bg-gray-400'
    }
  }

  const getOverallStatusColor = (overall: string) => {
    switch (overall) {
      case 'healthy': return 'bg-green-500'
      case 'degraded': return 'bg-yellow-500'
      case 'down':
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-400'
    }
  }

  const getStatusText = (serviceStatus: 'online' | 'offline' | 'error') => {
    switch (serviceStatus) {
      case 'online': return 'Online'
      case 'offline': return 'Offline'
      case 'error': return 'Error'
      default: return 'Unknown'
    }
  }

  if (!status && !isLoading) return null

  return (
    <div className="fixed top-4 right-4 z-50">
      <div 
        className="relative"
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Main Status Indicator */}
        <motion.div
          className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/50 px-3 py-2 cursor-pointer"
          whileHover={{ scale: 1.02 }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${status ? getOverallStatusColor(status.overall) : 'bg-gray-400'} ${isLoading ? 'animate-pulse' : ''}`} />
            <span className="text-sm font-medium text-gray-700">
              {isLoading ? 'Checking...' : 'API Status'}
            </span>
            
            {/* Quick Service Indicators */}
            {status && status.services.length > 0 && (
              <div className="flex space-x-1">
                {status.services.map((service) => (
                  <div
                    key={service.name}
                    className={`w-2 h-2 rounded-full ${getStatusColor(service.status)}`}
                    title={`${service.name}: ${getStatusText(service.status)}`}
                  />
                ))}
              </div>
            )}

            {/* Refresh Button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                refresh()
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isLoading}
            >
              <svg 
                className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </motion.div>

        {/* Expanded Panel */}
        <AnimatePresence>
          {isExpanded && status && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full right-0 mt-2 w-80 bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200/50 p-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Service Status</h3>
        <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${getOverallStatusColor(status.overall)}`} />
                  <span className="text-sm text-gray-600 capitalize">{status.overall}</span>
        </div>
      </div>
      
              {/* Services List */}
      <div className="space-y-3">
                {status.services.map((service) => (
                  <div key={service.name} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
                      <span className="text-lg">{service.icon}</span>
                      <div>
                        <div className="font-medium text-gray-900">{service.name}</div>
                        {service.responseTime && (
                          <div className="text-xs text-gray-500">{service.responseTime}ms</div>
                        )}
            </div>
              </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(service.status)}`} />
                      <span className={`text-sm font-medium ${
                        service.status === 'online' ? 'text-green-600' : 
                        service.status === 'error' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {getStatusText(service.status)}
                      </span>
            </div>
          </div>
        ))}
      </div>
      
              {/* Error Messages */}
              {status.services.some(s => s.error) && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Issues:</h4>
                  <div className="space-y-1">
                    {status.services
                      .filter(s => s.error)
                      .map((service) => (
                        <div key={service.name} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                          <strong>{service.name}:</strong> {service.error}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                <span>Last checked: {new Date(status.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span>Manual refresh only</span>
        </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
} 