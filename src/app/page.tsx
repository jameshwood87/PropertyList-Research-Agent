'use client'

import { useState, useEffect, useRef } from 'react'
import { PropertyAnalyzer } from '@/components/PropertyAnalyzer'
import { Home, Search, FileText, TrendingUp } from 'lucide-react'

export default function HomePage() {
  const [propertyUrl, setPropertyUrl] = useState('')
  const [researchTopic, setResearchTopic] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  
  // Refs for auto-scrolling
  const analysisStepsRef = useRef<HTMLDivElement>(null)
  const analysisResultsRef = useRef<HTMLDivElement>(null)

  // Check AI services status
  const checkServiceStatus = async () => {
    try {
      // Use dedicated health check endpoint
      const response = await fetch('/api/health', {
        method: 'GET',
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.status === 'online') {
          setServiceStatus('online')
        } else {
          setServiceStatus('offline')
        }
      } else {
        setServiceStatus('offline')
      }
    } catch (error) {
      console.log('Service check failed:', error)
      setServiceStatus('offline')
    }
  }

  // Check service status on component mount and every 30 seconds
  useEffect(() => {
    checkServiceStatus()
    const interval = setInterval(checkServiceStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleAnalyze = async () => {
    if (!propertyUrl.trim()) return
    
    setIsAnalyzing(true)
    
    // Scroll to analysis steps section after a brief delay to allow rendering
    setTimeout(() => {
      analysisStepsRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      })
    }, 100)
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: propertyUrl,
          topic: researchTopic,
        }),
      })
      
      const result = await response.json()
      setAnalysisResult(result)
      
      // Update service status to online after successful analysis
      if (!result.error) {
        setServiceStatus('online')
      }
      
      // Scroll to results after analysis completes
      setTimeout(() => {
        analysisResultsRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        })
      }, 500)
          } catch (error) {
      console.error('Analysis failed:', error)
      setAnalysisResult({
        error: 'Network error: Failed to connect to the analysis service. Please try again.',
        steps: [{
          id: 'error',
          title: 'Connection Error',
          status: 'error',
          description: 'Failed to connect to analysis service'
        }]
      })
      
      // Scroll to error results
      setTimeout(() => {
        analysisResultsRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        })
      }, 500)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center items-center gap-3 mb-4">
            <img 
              src="/logo.png" 
              alt="PropertyList Research Agent Logo" 
              className="w-16 h-16 object-contain"
            />
            <h1 className="text-4xl font-bold text-gray-900">
              PropertyList Research Agent
            </h1>
            {/* AI Service Status Indicator */}
            <div className="flex items-center gap-2 ml-4">
              <div className={`w-3 h-3 rounded-full transition-all duration-500 ${
                serviceStatus === 'online' 
                  ? 'bg-green-500 shadow-lg shadow-green-500/50 animate-pulse' 
                  : serviceStatus === 'offline' 
                  ? 'bg-red-500 shadow-lg shadow-red-500/50' 
                  : 'bg-yellow-500 shadow-lg shadow-yellow-500/50 animate-pulse'
              }`}></div>
              <span className={`text-sm font-medium ${
                serviceStatus === 'online' 
                  ? 'text-green-600' 
                  : serviceStatus === 'offline' 
                  ? 'text-red-600' 
                  : 'text-yellow-600'
              }`}>
                {serviceStatus === 'online' 
                  ? 'AI Services Online' 
                  : serviceStatus === 'offline' 
                  ? 'AI Services Offline' 
                  : 'Checking Services...'}
              </span>
            </div>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            AI-powered property market research and analysis. Get instant insights, 
            market comparisons, and investment recommendations.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="bg-[#00ae9a]/10 p-3 rounded-lg w-fit mb-4">
              <Search className="w-6 h-6 text-[#00ae9a]" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Market Research</h3>
            <p className="text-gray-600">
              Comprehensive market analysis with local trends, price comparisons, and area insights
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="bg-[#00ae9a]/10 p-3 rounded-lg w-fit mb-4">
              <TrendingUp className="w-6 h-6 text-[#00ae9a]" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Price Analysis</h3>
            <p className="text-gray-600">
              Fair market value estimation with investment potential and risk assessment
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="bg-[#00ae9a]/10 p-3 rounded-lg w-fit mb-4">
              <FileText className="w-6 h-6 text-[#00ae9a]" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Client Reports</h3>
            <p className="text-gray-600">
              Professional reports with PDF export for clients and stakeholders
            </p>
          </div>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-6 text-gray-900">
            Analyze Property
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Property Listing URL *
              </label>
              <input
                type="url"
                value={propertyUrl}
                onChange={(e) => setPropertyUrl(e.target.value)}
                placeholder="https://www.idealista.com/inmueble/12345678/ or other property listing URL"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00ae9a] focus:border-transparent"
                suppressHydrationWarning
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Research Focus (Optional)
              </label>
              <input
                type="text"
                value={researchTopic}
                onChange={(e) => setResearchTopic(e.target.value)}
                placeholder="e.g., investment potential, rental yield, buyer market trends"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00ae9a] focus:border-transparent"
                suppressHydrationWarning
              />
            </div>
            
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !propertyUrl.trim()}
              className="w-full bg-[#00ae9a] text-white py-3 px-6 rounded-lg font-semibold hover:bg-[#008a7c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAnalyzing ? 'Analyzing Property...' : 'Start Analysis'}
            </button>
          </div>
        </div>

        {/* Analysis Results */}
        {(isAnalyzing || analysisResult) && (
          <div ref={analysisStepsRef}>
            <PropertyAnalyzer
              isAnalyzing={isAnalyzing}
              result={analysisResult}
              propertyUrl={propertyUrl}
              researchTopic={researchTopic}
              resultsRef={analysisResultsRef}
            />
          </div>
        )}
      </div>
    </div>
  )
} 