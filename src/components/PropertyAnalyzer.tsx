'use client'

import { useEffect, useState, RefObject } from 'react'
import { AnalysisResult, AnalysisStep } from '@/types'
import { CheckCircle, Clock, AlertCircle, Loader2, Download, MapPin, Home, Euro, TrendingUp, FileText } from 'lucide-react'

interface PropertyAnalyzerProps {
  isAnalyzing: boolean
  result: AnalysisResult | null
  propertyUrl: string
  researchTopic: string
  resultsRef?: RefObject<HTMLDivElement>
}

export function PropertyAnalyzer({ isAnalyzing, result, propertyUrl, researchTopic, resultsRef }: PropertyAnalyzerProps) {
  const [error, setError] = useState<string>('')
  const [steps, setSteps] = useState<AnalysisStep[]>([
    {
      id: 'extract',
      title: 'Extract Property Data',
      status: 'pending',
      description: 'Scraping property listing for key information'
    },
    {
      id: 'market',
      title: 'Market Research',
      status: 'pending',
      description: 'Searching for comparable properties and market trends'
    },
    {
      id: 'news',
      title: 'Local News & Trends',
      status: 'pending',
      description: 'Gathering local market news and developments'
    },
    {
      id: 'analysis',
      title: 'AI Analysis',
      status: 'pending',
      description: 'Generating insights and recommendations'
    },
    {
      id: 'report',
      title: 'Generate Report',
      status: 'pending',
      description: 'Creating client-ready market analysis report'
    }
  ])

  useEffect(() => {
    if (isAnalyzing) {
      // Simulate step progression
      const stepProgression = async () => {
        const delays = [1000, 2000, 2500, 3000, 1500]
        for (let i = 0; i < steps.length; i++) {
          await new Promise(resolve => setTimeout(resolve, delays[i]))
          setSteps(prev => prev.map((step, index) => ({
            ...step,
            status: index === i ? 'in_progress' : index < i ? 'completed' : 'pending'
          })))
          
          if (i < steps.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
            setSteps(prev => prev.map((step, index) => ({
              ...step,
              status: index <= i ? 'completed' : 'pending'
            })))
          }
        }
      }
      stepProgression()
    }
  }, [isAnalyzing])

  const getStatusIcon = (status: AnalysisStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'in_progress':
        return <Loader2 className="w-5 h-5 text-[#00ae9a] animate-spin" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const handleDownloadPDF = async () => {
    if (!result) return
    
    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          result,
          propertyUrl,
          researchTopic
        }),
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `property-analysis-${Date.now()}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('PDF generation failed:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {result && result.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-semibold text-red-800">Analysis Error</h3>
          </div>
          <p className="text-red-700">{result.error}</p>
          <p className="text-sm text-red-600 mt-2">
            Please check that the URL is valid and points to a supported property listing.
          </p>
        </div>
      )}

      {/* Step Progress */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Analysis Progress</h3>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {getStatusIcon(step.status)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {index + 1}. {step.title}
                  </span>
                  {step.status === 'completed' && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      Complete
                    </span>
                  )}
                  {step.status === 'in_progress' && (
                    <span className="text-xs bg-[#00ae9a]/10 text-[#00ae9a] px-2 py-1 rounded">
                      Processing...
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {result && result.propertyData && (
        <div ref={resultsRef} className="space-y-6">
          {/* Property Summary */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Property Summary</h3>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 bg-[#00ae9a] text-white px-4 py-2 rounded-lg hover:bg-[#008a7c] transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-600">Location</span>
                </div>
                <p className="text-lg font-semibold">{result.propertyData?.location || 'Unknown'}</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Euro className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-600">Price</span>
                </div>
                <p className="text-lg font-semibold">€{result.propertyData?.price?.toLocaleString() || 'N/A'}</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Home className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-600">Size</span>
                </div>
                <p className="text-lg font-semibold">{result.propertyData?.sqm || 'N/A'} m²</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-600">€/m²</span>
                </div>
                <p className="text-lg font-semibold">
                  €{result.propertyData?.pricePerSqm?.toLocaleString() || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Market Insights */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Market Analysis</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Valuation Assessment</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Estimated Value:</span>
                    <span className="font-semibold">€{result.insights?.valuation?.estimatedValue?.toLocaleString() || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Price Assessment:</span>
                    <span className={`font-semibold ${
                      result.insights?.valuation?.priceAssessment === 'underpriced' ? 'text-green-600' :
                      result.insights?.valuation?.priceAssessment === 'overpriced' ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      {result.insights?.valuation?.priceAssessment?.replace('_', ' ') || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confidence:</span>
                    <span className="font-semibold">{result.insights?.valuation?.confidence || 'N/A'}%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-3">Investment Potential</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Potential:</span>
                    <span className={`font-semibold ${
                      result.insights?.investment?.potential === 'high' ? 'text-green-600' :
                      result.insights?.investment?.potential === 'medium' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {result.insights?.investment?.potential || 'N/A'}
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-sm font-medium">Key Risks:</span>
                    <ul className="text-sm text-gray-600 mt-1">
                      {result.insights?.investment?.risks?.slice(0, 3).map((risk, index) => (
                        <li key={index}>
                          • {typeof risk === 'string' ? risk : risk?.risk || 'Risk assessment pending...'}
                          {typeof risk === 'object' && risk?.impact && (
                            <span className={`ml-2 text-xs px-1 py-0.5 rounded ${
                              risk.impact === 'high' ? 'bg-red-100 text-red-700' :
                              risk.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {risk.impact} impact
                            </span>
                          )}
                        </li>
                      )) || <li>• No risk data available</li>}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Report */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-gray-600" />
              <h3 className="text-xl font-semibold">AI Analysis Report</h3>
            </div>
            
            <div className="prose max-w-none">
              <div className="mb-6">
                <h4 className="text-lg font-medium mb-2">Executive Summary</h4>
                <p className="text-gray-700">{result.report?.summary || 'Analysis in progress...'}</p>
              </div>
              
              <div className="mb-6">
                <h4 className="text-lg font-medium mb-2">Detailed Analysis</h4>
                <div className="text-gray-700 whitespace-pre-wrap">{result.report?.fullReport || 'Detailed analysis will appear here once processing is complete.'}</div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 mt-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h5 className="font-medium mb-2">For Buyers</h5>
                  <div className="text-sm text-gray-700">
                    {typeof result.insights?.recommendations?.buyerAdvice === 'string' 
                      ? result.insights?.recommendations?.buyerAdvice 
                      : result.insights?.recommendations?.buyerAdvice?.reasoning || result.insights?.recommendations?.buyerAdvice?.recommendation || 'Buyer recommendations will be generated...'}
                    {typeof result.insights?.recommendations?.buyerAdvice === 'object' && result.insights?.recommendations?.buyerAdvice?.maxPrice && (
                      <div className="mt-2 text-xs">
                        <strong>Max Price:</strong> €{result.insights.recommendations.buyerAdvice.maxPrice.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h5 className="font-medium mb-2">For Sellers</h5>
                  <div className="text-sm text-gray-700">
                    {typeof result.insights?.recommendations?.sellerAdvice === 'string' 
                      ? result.insights?.recommendations?.sellerAdvice 
                      : result.insights?.recommendations?.sellerAdvice?.marketingStrategy || result.insights?.recommendations?.sellerAdvice?.pricingStrategy || 'Seller recommendations will be generated...'}
                    {typeof result.insights?.recommendations?.sellerAdvice === 'object' && result.insights?.recommendations?.sellerAdvice?.expectedTimeToSell && (
                      <div className="mt-2 text-xs">
                        <strong>Expected Time to Sell:</strong> {result.insights.recommendations.sellerAdvice.expectedTimeToSell} days
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h5 className="font-medium mb-2">For Investors</h5>
                  <div className="text-sm text-gray-700">
                    {typeof result.insights?.recommendations?.investorAdvice === 'string' 
                      ? result.insights?.recommendations?.investorAdvice 
                      : result.insights?.recommendations?.investorAdvice?.strategy || result.insights?.recommendations?.investorAdvice?.exitStrategy || 'Investment recommendations will be generated...'}
                    {typeof result.insights?.recommendations?.investorAdvice === 'object' && result.insights?.recommendations?.investorAdvice?.holdPeriod && (
                      <div className="mt-2 text-xs">
                        <strong>Hold Period:</strong> {result.insights.recommendations.investorAdvice.holdPeriod} years
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 