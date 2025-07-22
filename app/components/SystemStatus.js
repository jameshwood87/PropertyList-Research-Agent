'use client'

import { useState, useEffect } from 'react'
import { Zap, Database, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

export default function SystemStatus() {
  const [status, setStatus] = useState({
    system: { active: false, loading: true },
    ai: { active: false, loading: true },
    database: { active: false, loading: true }
  })

  const checkSystemStatus = async () => {
    try {
      // Check system health
      const healthResponse = await fetch('http://localhost:3004/api/health', { 
        method: 'GET',
        cache: 'no-cache' 
      })
      const healthData = await healthResponse.json()
      
      setStatus(prev => ({
        ...prev,
        system: { 
          active: healthResponse.ok && healthData.status === 'healthy' && healthData.services?.propertyDatabase, 
          loading: false 
        },
        database: { 
          active: healthData.services?.propertyDatabase || false, 
          loading: false 
        },
        ai: { 
          active: healthData.ai?.status === 'active' && healthData.services?.aiService, 
          loading: false 
        }
      }))
    } catch (error) {
      console.error('Status check failed:', error)
      setStatus(prev => ({
        system: { active: false, loading: false },
        ai: { active: false, loading: false },
        database: { active: false, loading: false }
      }))
    }
  }

  useEffect(() => {
    checkSystemStatus()
    // Check status every 30 seconds
    const interval = setInterval(checkSystemStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (isActive, isLoading) => {
    if (isLoading) return 'bg-yellow-500'
    return isActive ? 'bg-green-500' : 'bg-red-500'
  }

  const getStatusIcon = (isActive, isLoading) => {
    if (isLoading) return <Loader2 className="w-3 h-3 animate-spin" />
    return isActive ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />
  }

  const allSystemsActive = status.system.active && status.database.active
  const aiActive = status.ai.active

  return (
    <div className="flex items-center space-x-3">
      {/* AI Status */}
      <div className={`flex items-center space-x-2 px-3 py-2 rounded-xl border transition-all duration-300 ${
        status.ai.loading 
          ? 'bg-yellow-50 border-yellow-200 text-yellow-800' 
          : aiActive 
            ? 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100' 
            : 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'
      }`}>
        <div className={`w-2 h-2 rounded-full ${getStatusColor(aiActive, status.ai.loading)} shadow-sm`}></div>
        <Zap className="w-4 h-4" />
        <span className="text-sm font-medium">
          {status.ai.loading ? 'Checking AI...' : aiActive ? 'AI Active' : 'AI Offline'}
        </span>
        {getStatusIcon(aiActive, status.ai.loading)}
      </div>

      {/* System Status */}
      <div className={`flex items-center space-x-2 px-3 py-2 rounded-xl border transition-all duration-300 ${
        status.system.loading 
          ? 'bg-yellow-50 border-yellow-200 text-yellow-800' 
          : allSystemsActive 
            ? 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100' 
            : 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'
      }`}>
        <div className={`w-2 h-2 rounded-full ${getStatusColor(allSystemsActive, status.system.loading)} shadow-sm`}></div>
        <Database className="w-4 h-4" />
        <span className="text-sm font-medium">
          {status.system.loading ? 'Checking...' : allSystemsActive ? 'System Active' : 'System Issues'}
        </span>
        {getStatusIcon(allSystemsActive, status.system.loading)}
      </div>
    </div>
  )
} 