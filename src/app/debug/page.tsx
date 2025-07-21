'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface AnalysisLog {
  id: string
  timestamp: string
  sessionStart: string
  sessionEnd?: string
  duration?: number
  clientIP: string
  userAgent: string
  input: {
    propertyData: any
    requestHeaders: Record<string, string>
  }
  steps: Array<{
    stepNumber: number
    stepName: string
    startTime: string
    endTime?: string
    duration?: number
    status: string
    details: any
    error?: string
  }>
  output?: {
    cmaReport: any
    success: boolean
    error?: string
  }
  apiCalls: Array<{
    timestamp: string
    service: string
    endpoint: string
    method: string
    requestData?: any
    responseData?: any
    responseTime: number
    status: string
    error?: string
  }>
  systemStatus: {
    memory: any
    performance: any
  }
}

interface LogsSummary {
  totalSessions: number
  successfulSessions: number
  failedSessions: number
  successRate: string
  avgDuration: number
  apiCallStats: Record<string, any>
  lastSession: string
  memoryUsage: any
  performance: any
}

export default function DebugPage() {
  const [logs, setLogs] = useState<AnalysisLog[]>([])
  const [summary, setSummary] = useState<LogsSummary | null>(null)
  const [selectedLog, setSelectedLog] = useState<AnalysisLog | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'summary' | 'detailed' | 'raw'>('summary')

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 60000) // Refresh every 60 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchLogs = async () => {
    try {
      const apiToken = process.env.NEXT_PUBLIC_API_TOKEN
      if (!apiToken) {
        throw new Error('API token not configured')
      }

      const response = await fetch('/api/debug/logs', {
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setLogs(data.logs)
      setSummary(data.summary)
    } catch (error) {
      console.error('Failed to fetch logs:', error)
      setLogs([])
      setSummary(null)
    } finally {
      setIsLoading(false)
    }
  }

  const clearLogs = async () => {
    if (confirm('Are you sure you want to clear all logs?')) {
      try {
        const apiToken = process.env.NEXT_PUBLIC_API_TOKEN
        if (!apiToken) {
          throw new Error('API token not configured')
        }

        await fetch('/api/debug/logs', { 
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${apiToken}`
          }
        })
        await fetchLogs()
      } catch (error) {
        console.error('Failed to clear logs:', error)
      }
    }
  }

  const exportLogs = async () => {
    try {
      const apiToken = process.env.NEXT_PUBLIC_API_TOKEN
      if (!apiToken) {
        throw new Error('API token not configured')
      }

      const response = await fetch('/api/debug/export', {
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analysis-logs-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to export logs:', error)
    }
  }

  const filteredLogs = logs.filter(log => {
    if (filter === 'success' && !log.output?.success) return false
    if (filter === 'failed' && log.output?.success !== false) return false
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      return (
        log.id.toLowerCase().includes(searchLower) ||
        log.input.propertyData?.address?.toLowerCase().includes(searchLower) ||
        log.clientIP.includes(searchLower)
      )
    }
    
    return true
  })

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const getStatusColor = (status: boolean | undefined) => {
    if (status === true) return 'text-green-600'
    if (status === false) return 'text-red-600'
    return 'text-yellow-600'
  }

  const getStatusIcon = (status: boolean | undefined) => {
    if (status === true) return '✅'
    if (status === false) return '❌'
    return '⏳'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderBottomColor: '#00ae9a' }}></div>
          <p>Loading debug logs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-blue-400">🐛 Debug Console</h1>
              <p className="text-gray-400 mt-1">PropertyList Research Agent - Analysis Session Logs</p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={fetchLogs}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
              >
                🔄 Refresh
              </button>
              <button
                onClick={exportLogs}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition-colors"
              >
                📥 Export
              </button>
              <button
                onClick={clearLogs}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition-colors"
              >
                🗑️ Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-blue-400 font-semibold mb-2">Total Sessions</h3>
              <p className="text-2xl font-bold">{summary.totalSessions}</p>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-green-400 font-semibold mb-2">Success Rate</h3>
              <p className="text-2xl font-bold text-green-500">{summary.successRate}</p>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-yellow-400 font-semibold mb-2">Avg Duration</h3>
              <p className="text-2xl font-bold">{formatDuration(summary.avgDuration)}</p>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-purple-400 font-semibold mb-2">Memory Usage</h3>
              <p className="text-lg font-bold">{summary.memoryUsage.heapUsed}</p>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex space-x-2">
              <button
                onClick={() => setViewMode('summary')}
                className={`px-3 py-1 rounded text-sm ${viewMode === 'summary' ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                Summary
              </button>
              <button
                onClick={() => setViewMode('detailed')}
                className={`px-3 py-1 rounded text-sm ${viewMode === 'detailed' ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                Detailed
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`px-3 py-1 rounded text-sm ${viewMode === 'raw' ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                Raw JSON
              </button>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded text-sm ${filter === 'all' ? 'bg-green-600' : 'bg-gray-700'}`}
              >
                All ({logs.length})
              </button>
              <button
                onClick={() => setFilter('success')}
                className={`px-3 py-1 rounded text-sm ${filter === 'success' ? 'bg-green-600' : 'bg-gray-700'}`}
              >
                Success ({logs.filter(l => l.output?.success).length})
              </button>
              <button
                onClick={() => setFilter('failed')}
                className={`px-3 py-1 rounded text-sm ${filter === 'failed' ? 'bg-green-600' : 'bg-gray-700'}`}
              >
                Failed ({logs.filter(l => l.output?.success === false).length})
              </button>
            </div>

            <input
              type="text"
              placeholder="Search by ID, address, or IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-700 text-white px-3 py-1 rounded flex-1 min-w-[200px]"
            />
          </div>
        </div>

        {/* Logs Display */}
        {viewMode === 'raw' ? (
          <div className="bg-gray-800 rounded-lg p-4">
            <pre className="text-xs overflow-auto max-h-[80vh] text-green-400">
              {JSON.stringify(filteredLogs, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredLogs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-750 transition-colors"
                  onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-4">
                      <span className="text-lg">{getStatusIcon(log.output?.success)}</span>
                      <div>
                        <h3 className="text-blue-400 font-mono text-sm">{log.id}</h3>
                        <p className="text-gray-400 text-xs">{new Date(log.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${getStatusColor(log.output?.success)}`}>
                        {log.output?.success ? 'SUCCESS' : log.output?.success === false ? 'FAILED' : 'IN PROGRESS'}
                      </p>
                      <p className="text-gray-400 text-xs">{formatDuration(log.duration)}</p>
                    </div>
                  </div>

                  {viewMode === 'summary' && (
                    <div className="text-sm">
                      <p><strong>Address:</strong> {log.input.propertyData?.address}, {log.input.propertyData?.city}</p>
                      <p><strong>IP:</strong> {log.clientIP}</p>
                      <p><strong>Steps:</strong> {log.steps.length} | <strong>API Calls:</strong> {log.apiCalls.length}</p>
                    </div>
                  )}

                  {viewMode === 'detailed' && selectedLog?.id === log.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 border-t border-gray-700 pt-4"
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Input Data */}
                        <div>
                          <h4 className="text-yellow-400 font-semibold mb-2">Input Data</h4>
                          <pre className="bg-gray-900 p-3 rounded text-xs overflow-auto max-h-64">
                            {JSON.stringify(log.input.propertyData, null, 2)}
                          </pre>
                        </div>

                        {/* Steps */}
                        <div>
                          <h4 className="text-blue-400 font-semibold mb-2">Analysis Steps</h4>
                          <div className="space-y-2 max-h-64 overflow-auto">
                            {log.steps.map((step) => (
                              <div key={step.stepNumber} className="bg-gray-900 p-2 rounded text-xs">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-blue-300">{step.stepNumber}. {step.stepName}</span>
                                  <span className={`${step.status === 'completed' ? 'text-green-400' : step.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}>
                                    {step.status}
                                  </span>
                                </div>
                                <p className="text-gray-400">{formatDuration(step.duration)}</p>
                                {step.error && <p className="text-red-400">{step.error}</p>}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* API Calls */}
                        <div>
                          <h4 className="text-green-400 font-semibold mb-2">API Calls</h4>
                          <div className="space-y-2 max-h-64 overflow-auto">
                            {log.apiCalls.map((call, index) => (
                              <div key={index} className="bg-gray-900 p-2 rounded text-xs">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-green-300">{call.service}</span>
                                  <span className={`${call.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                    {call.responseTime}ms
                                  </span>
                                </div>
                                <p className="text-gray-400">{call.endpoint}</p>
                                {call.error && <p className="text-red-400">{call.error}</p>}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Output */}
                        {log.output && (
                          <div>
                            <h4 className="text-purple-400 font-semibold mb-2">Output</h4>
                            <pre className="bg-gray-900 p-3 rounded text-xs overflow-auto max-h-64">
                              {JSON.stringify(log.output, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {filteredLogs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No logs found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  )
} 