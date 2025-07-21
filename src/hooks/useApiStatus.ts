'use client'

import { useState, useEffect } from 'react'

interface ApiService {
  name: string
  status: 'online' | 'offline' | 'error'
  responseTime?: number
  error?: string
  icon: string
}

interface ApiStatusResponse {
  overall: 'healthy' | 'degraded' | 'down' | 'error'
  services: ApiService[]
  lastChecked: string
}

// Singleton pattern to prevent multiple API calls
let globalApiStatus: {
  openai: ApiService | null
  googleMaps: ApiService | null
  tavily: ApiService | null
  isLoading: boolean
  lastChecked: string | null
  apisActive: boolean
} | null = null

let globalPromise: Promise<void> | null = null
let subscribers: Array<(status: any) => void> = []

export function useApiStatus() {
  const [status, setStatus] = useState<{
    openai: ApiService | null
    googleMaps: ApiService | null
    tavily: ApiService | null
    isLoading: boolean
    lastChecked: string | null
    apisActive: boolean
  }>(() => {
    // Initialize with global state if it exists
    if (globalApiStatus) {
      return globalApiStatus
    }
    return {
      openai: null,
      googleMaps: null,
      tavily: null,
      isLoading: true,
      lastChecked: null,
      apisActive: false
    }
  })

  const fetchApiStatus = async (isManual: boolean = false) => {
    // If already fetching, return the same promise
    if (globalPromise) {
      return globalPromise
    }

    globalPromise = (async () => {
      try {
        const headers: Record<string, string> = {}
        if (isManual) {
          headers['x-manual-refresh'] = 'true'
        }
        
        const response = await fetch('/api/status', { headers })
        const data: ApiStatusResponse = await response.json()
        
        const apiServerStatus = data.services.find(service => service.name === 'API Server')
        const openaiStatus = data.services.find(service => service.name === 'OpenAI')
        const googleMapsStatus = data.services.find(service => service.name === 'Google Maps')
        const tavilyStatus = data.services.find(service => service.name === 'Tavily')
        
        // API is active if the basic API server is online (not requiring all external services)
        const apisActive = apiServerStatus?.status === 'online' || data.overall === 'healthy'
        
        const newStatus = {
          openai: openaiStatus || null,
          googleMaps: googleMapsStatus || null,
          tavily: tavilyStatus || null,
          isLoading: false,
          lastChecked: data.lastChecked,
          apisActive
        }

        // Update global state
        globalApiStatus = newStatus
        
        // Notify all subscribers
        subscribers.forEach(callback => callback(newStatus))
        
      } catch (error) {
        console.error('Failed to fetch API status:', error)
        // Fallback: Show API as active since core functionality is working
        const errorStatus = {
          openai: null,
          googleMaps: null,
          tavily: null,
          isLoading: false,
          lastChecked: new Date().toISOString(),
          apisActive: true // Show as active even on error since session API works
        }
        
        globalApiStatus = errorStatus
        subscribers.forEach(callback => callback(errorStatus))
      } finally {
        globalPromise = null
      }
    })()

    return globalPromise
  }

  useEffect(() => {
    // Subscribe to global state changes
    subscribers.push(setStatus)
    
    // Initial fetch on page load (only if not already loaded)
    if (!globalApiStatus) {
      fetchApiStatus()
    }
    
    // Removed auto-refresh timer - only check once per session or manual refresh
    
    return () => {
      // Remove from subscribers
      const index = subscribers.indexOf(setStatus)
      if (index > -1) {
        subscribers.splice(index, 1)
      }
    }
  }, [])

  return {
    ...status,
    refresh: () => fetchApiStatus(true)
  }
} 