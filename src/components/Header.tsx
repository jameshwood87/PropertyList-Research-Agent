'use client'

import { useApiStatus } from '@/hooks/useApiStatus'

export default function Header() {
  const { apisActive, isLoading } = useApiStatus()

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <img
                src="/logo.png"
                alt="PropertyList Research Agent"
                width={40}
                height={40}
                className="rounded-lg"
              />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                PropertyList Research Agent
              </h1>
              <p className="text-sm text-gray-500">
                AI-powered CMA Report Generation
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                isLoading 
                  ? 'bg-gray-400 animate-pulse' 
                  : apisActive 
                    ? 'bg-green-500 animate-pulse' 
                    : 'bg-red-500'
              }`}></div>
              <span className="text-sm text-gray-600">API's Active</span>
            </div>
            <div className="hidden sm:flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">AI Agent Active</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
} 