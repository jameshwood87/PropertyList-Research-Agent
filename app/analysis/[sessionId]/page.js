'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import LoadingSpinner from '../../components/LoadingSpinner'
import SystemStatus from '../../components/SystemStatus'
import PropertyImage from '../../components/PropertyImage'
import { getBestImageUrl, processPropertyImages } from '../../utils/imageUtils'
import { 
  Home, 
  TrendingUp, 
  Euro, 
  Building, 
  MapPin, 
  Calendar,
  Download,
  BarChart3,
  Navigation,
  ShoppingCart,
  Car,
  Heart,
  TreePine,
  Utensils,
  Eye,
  EyeOff,
  Footprints,
  Train,
  X,
  ChevronLeft,
  ChevronRight,
  Camera,
  Bike,
  Zap,
  PawPrint,
  Waves,
  Video,
  Coins,
  Building2,
  Flag,
  Sun,
  Check,
  Loader2,
  Printer,
  Smartphone
} from 'lucide-react'

export default function AnalysisPage() {
  const params = useParams()
  const sessionId = params.sessionId
  
  const [sessionData, setSessionData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [analysisProgress, setAnalysisProgress] = useState({})
  const [additionalInfo, setAdditionalInfo] = useState('')

  const analysisSteps = [
    {
      id: 'market',
      name: 'Market Analysis',
      description: 'Analyzing market trends and property valuation',
      icon: '📊',
      duration: 3000
    },
    {
      id: 'comparables',
      name: 'Comparables Search',
      description: 'Finding similar properties in the area',
      icon: '🏠',
      duration: 4000
    },
    {
      id: 'insights',
      name: 'Investment Insights',
      description: 'Generating investment recommendations',
      icon: '💡',
      duration: 2000
    },
    {
      id: 'report',
      name: 'Report Generation',
      description: 'Creating comprehensive analysis report',
      icon: '📄',
      duration: 1000
    }
  ]

  useEffect(() => {
    if (sessionId) {
      fetchSessionData(sessionId)
    }
  }, [sessionId])

  useEffect(() => {
    // Check if analysis is already completed and set appropriate state
    if (sessionData) {
      if (sessionData.analysisResults && sessionData.status === 'completed') {
        // Analysis already completed - go directly to results
        setCurrentStep(analysisSteps.length)
      }
      // REMOVED: Don't auto-continue analysis - wait for user to click "Analyse"
    }
  }, [sessionData])

  useEffect(() => {
    // Only run analysis steps if analysis was explicitly started by user
    if (sessionData && sessionData.status === 'analyzing' && currentStep < analysisSteps.length) {
      runAnalysisStep()
    } else if (currentStep >= analysisSteps.length && sessionData && sessionData.status === 'analyzing') {
      // Analysis just completed - save results to session
      saveAnalysisResults()
    }
  }, [currentStep, sessionData])

  const fetchSessionData = async (id) => {
    try {
      setLoading(true)
      const response = await fetch(`http://localhost:3004/api/session/${id}`)
      
      if (!response.ok) {
        throw new Error('Session not found')
      }
      
      const data = await response.json()
      console.log('Session data loaded:', data.sessionData)
      console.log('Property data:', data.sessionData?.propertyData)
      setSessionData(data.sessionData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const saveAnalysisResults = async () => {
    try {
      // Collect all analysis results
      const results = {}
      for (const step of analysisSteps) {
        if (analysisProgress[step.id]?.result) {
          results[step.id] = analysisProgress[step.id].result
        }
      }

      // Save to session
      await fetch(`http://localhost:3004/api/session/${sessionId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'completed',
          analysisResults: results
        })
      })

      // Update local session data
      setSessionData(prev => ({
        ...prev,
        status: 'completed',
        analysisResults: results
      }))
    } catch (error) {
      console.error('Error saving analysis results:', error)
    }
  }

  const handleStartAnalysis = async () => {
    // Only allow starting analysis if it hasn't been completed yet
    if (sessionData?.status !== 'completed') {
      try {
        // Update session with additional info and mark as analyzing
        const updateData = {
          status: 'analyzing'
        }
        
        // If user provided additional info, update the property data
        if (additionalInfo.trim()) {
          const updatedPropertyData = {
            ...sessionData.propertyData,
            additionalInfo: additionalInfo.trim(),
            userProvidedDetails: additionalInfo.trim()
          }
          updateData.propertyData = updatedPropertyData
        }
        
        await fetch(`http://localhost:3004/api/session/${sessionId}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        })
        
        // Update local session data
        setSessionData(prev => ({
          ...prev,
          status: 'analyzing',
          propertyData: updateData.propertyData || prev.propertyData
        }))
        
        // Start analysis from step 0
        setCurrentStep(0)
      } catch (error) {
        console.error('Error starting analysis:', error)
      }
    }
  }

  const runAnalysisStep = async () => {
    // Prevent running if analysis is already completed
    if (sessionData?.status === 'completed') {
      return
    }

    const step = analysisSteps[currentStep]
    
    setAnalysisProgress(prev => ({
      ...prev,
      [step.id]: { status: 'running', startTime: Date.now() }
    }))

    try {
      await new Promise(resolve => setTimeout(resolve, step.duration))
      
      const stepResult = await generateStepResult(step.id)

      setAnalysisProgress(prev => ({
        ...prev,
        [step.id]: { 
          status: 'complete', 
          duration: Date.now() - prev[step.id].startTime,
          result: stepResult
        }
      }))

      setTimeout(() => {
        setCurrentStep(prev => prev + 1)
      }, 500)

    } catch (error) {
      console.error(`Error in ${step.id} analysis:`, error)
      setAnalysisProgress(prev => ({
        ...prev,
        [step.id]: { status: 'error' }
      }))
    }
  }

  const generateStepResult = async (stepId) => {
    switch (stepId) {
      case 'market':
        return {
          marketValue: Math.round(sessionData.propertyData.price * (0.95 + Math.random() * 0.1)),
          pricePerSqm: Math.round(sessionData.propertyData.price / sessionData.propertyData.build_square_meters),
          trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)],
          confidence: Math.round(70 + Math.random() * 25)
        }
      case 'comparables':
        try {
          // Fetch real comparable properties from API
          const response = await fetch(`http://localhost:3004/api/comparables/${sessionId}`);
          if (response.ok) {
            const data = await response.json();
            return {
              comparables: data.comparables || [],
              summary: data.summary || 'No comparable properties found.',
              averagePrice: data.comparables?.length > 0 ? 
                Math.round(data.comparables.reduce((sum, comp) => sum + (comp.price || 0), 0) / data.comparables.length) : 
                null
            };
          } else {
            console.error('Failed to fetch comparables:', response.status);
            return {
              comparables: [],
              summary: 'Unable to load comparable properties at this time.',
              averagePrice: null
            };
          }
        } catch (error) {
          console.error('Error fetching comparables:', error);
          return {
            comparables: [],
            summary: 'Error loading comparable properties.',
            averagePrice: null
          };
        }
      case 'insights':
        return {
          recommendations: [
            'Consider this property as a good investment opportunity',
            'Monitor local market developments closely',
            'Factor in potential renovation costs if needed'
          ],
          risks: [
            'Market volatility in the current economic climate',
            'Potential interest rate changes affecting affordability'
          ]
        }
      case 'report':
        return {
          reportId: `REP_${Date.now()}`,
          generatedAt: new Date().toISOString()
        }
      default:
        return {}
    }
  }

  const handleDownloadReport = () => {
    const reportData = {
      sessionId,
      propertyData: sessionData?.propertyData,
      analysisResults: sessionData?.analysisResults,
      generatedAt: new Date().toISOString(),
      reportId: `REP_${Date.now()}`
    }
    
    const reportBlob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json'
    })
    
    const url = window.URL.createObjectURL(reportBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Property_Analysis_${sessionData?.propertyData?.reference}_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const getStepStatus = (stepIndex) => {
    if (stepIndex < currentStep) return 'complete'
    if (stepIndex === currentStep) return 'running'
    return 'pending'
  }

  const getStepIcon = (step, status) => {
    if (status === 'complete') return '✅'
    if (status === 'running') return '🔄'
    return step.icon
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  // Helper function to get analysis results from either stored session data or current progress
  const getAnalysisResult = (stepId) => {
    // First check if we have stored results in sessionData
    if (sessionData?.analysisResults && sessionData.analysisResults[stepId]) {
      return sessionData.analysisResults[stepId]
    }
    // Otherwise check current analysis progress
    if (analysisProgress[stepId]?.result) {
      return analysisProgress[stepId].result
    }
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
        </div>
      </div>
    )
  }

  // Preview State - Only show if analysis hasn't started yet
  if (currentStep === 0 && Object.keys(analysisProgress).length === 0 && sessionData?.status !== 'completed' && sessionData?.status !== 'analyzing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50/20 to-white">
        {/* Modern Header with Gradient */}
        <header className="relative hero-gradient shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Home className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    AI Property Research Agent
                  </h1>
                  <p className="text-primary-100 text-sm">Advanced Market Analysis Platform</p>
                </div>
              </div>
              <SystemStatus />
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Hero Section */}
          <div className="mb-12">
            <div className="glass-effect rounded-3xl p-8 animation-float">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Eye className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="ml-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Property Preview</h2>
                  <p className="text-gray-700 text-lg">Review the property details below and add any additional information you'd like included (such as urbanisation, street name, local landmarks, condition etc). Then click <span className="font-semibold text-primary-600">"Analyse Property"</span> to begin the AI-powered market analysis.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-8">


              {/* Property Overview */}
              <div className="card card-hover">
                <div className="section-header">
                  <div className="section-icon">
                    <Building className="w-5 h-5" />
                  </div>
                  <h2 className="section-title">Property Overview</h2>
                </div>
                {sessionData?.propertyData ? (
                  <div className="relative space-y-6">
                    {/* Property Image - Top Right Corner */}
                    <div className="absolute -top-16 right-0 z-10">
                      {(() => {
                        const processedImages = processPropertyImages(sessionData?.propertyData?.images);
                        return processedImages && processedImages.length > 0 ? (
                          <div className="relative w-52 h-36 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden shadow-lg group">
                            <PropertyImage
                              src={getBestImageUrl(processedImages[0])}
                              alt="Property image"
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                              fallback={
                                <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                                  <Camera className="w-12 h-12 text-primary-500 opacity-60" />
                                </div>
                              }
                            />

                          </div>
                        ) : (
                          <div className="w-52 h-36 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center border border-primary-200 shadow-lg">
                            <Camera className="w-12 h-12 text-primary-500 opacity-60" />
                          </div>
                        );
                      })()}
                    </div>

                    {/* Price Display - No Box */}
                    <div className="pr-56">
                      <div>
                        <p className="text-sm font-medium text-primary-600 mb-2">Asking Price</p>
                        <p className="price-display">{sessionData.propertyData.price ? formatPrice(sessionData.propertyData.price) : 'Price on Request'}</p>
                      </div>
                    </div>
                    
                    {/* Property Details Grid */}
                    <div className="grid grid-cols-2 gap-6">
                      <div className="spec-item">
                        <div className="spec-label">
                          <Flag className="w-4 h-4" />
                          <span>Reference</span>
                        </div>
                        <span className="spec-value">{sessionData.propertyData.reference || 'N/A'}</span>
                      </div>
                      
                      <div className="spec-item">
                        <div className="spec-label">
                          <Building2 className="w-4 h-4" />
                          <span>Type</span>
                        </div>
                        <span className="spec-value">
                          {sessionData.propertyData.property_type === 'apartment' ? 'Apartment' : 
                           sessionData.propertyData.property_type === 'house' ? 'House' : 
                           sessionData.propertyData.property_type === 'villa' ? 'Villa' : 
                           sessionData.propertyData.propertyTypeName || 'Property'}
                        </span>
                      </div>
                      
                      <div className="spec-item">
                        <div className="spec-label">
                          <MapPin className="w-4 h-4" />
                          <span>Location</span>
                        </div>
                        <span className="spec-value">
                          {sessionData.propertyData.suburb && sessionData.propertyData.city ? 
                            `${sessionData.propertyData.suburb}, ${sessionData.propertyData.city}` :
                            sessionData.propertyData.city || 'Location Available'}
                        </span>
                      </div>
                      
                      <div className="spec-item">
                        <div className="spec-label">
                          <Check className="w-4 h-4" />
                          <span>Status</span>
                        </div>
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
                            For Sale
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="animate-pulse space-y-4">
                    <div className="h-20 bg-gray-200 rounded-2xl"></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-12 bg-gray-200 rounded-xl"></div>
                      <div className="h-12 bg-gray-200 rounded-xl"></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Property Specifications */}
              <div className="card card-hover">
                <div className="section-header">
                  <div className="section-icon">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <h2 className="section-title">Specifications</h2>
                </div>
                {sessionData?.propertyData ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="spec-item">
                      <div className="spec-label">
                        <Home className="w-4 h-4" />
                        <span>Bedrooms</span>
                      </div>
                      <span className="spec-value">{sessionData.propertyData.bedrooms || 'N/A'}</span>
                    </div>
                    
                    <div className="spec-item">
                      <div className="spec-label">
                        <div className="w-4 h-4 flex items-center justify-center">🚿</div>
                        <span>Bathrooms</span>
                      </div>
                      <span className="spec-value">{sessionData.propertyData.bathrooms || 'N/A'}</span>
                    </div>
                    
                    <div className="spec-item">
                      <div className="spec-label">
                        <Building className="w-4 h-4" />
                        <span>Build Area</span>
                      </div>
                      <span className="spec-value">{sessionData.propertyData.build_square_meters || 'N/A'}m²</span>
                    </div>
                    
                    {sessionData.propertyData.plot_square_meters && (
                      <div className="spec-item">
                        <div className="spec-label">
                          <div className="w-4 h-4 flex items-center justify-center">🏞️</div>
                          <span>Plot Area</span>
                        </div>
                        <span className="spec-value">{sessionData.propertyData.plot_square_meters}m²</span>
                      </div>
                    )}
                    
                    {sessionData.propertyData.terrace_square_meters && (
                      <div className="spec-item">
                        <div className="spec-label">
                          <Sun className="w-4 h-4" />
                          <span>Terrace</span>
                        </div>
                        <span className="spec-value">{sessionData.propertyData.terrace_square_meters}m²</span>
                      </div>
                    )}
                    
                    <div className="spec-item">
                      <div className="spec-label">
                        <Car className="w-4 h-4" />
                        <span>Parking</span>
                      </div>
                      <span className="spec-value">{sessionData.propertyData.parking_spaces || 0} spaces</span>
                    </div>
                    
                    {sessionData.propertyData.floor_number && (
                      <div className="spec-item">
                        <div className="spec-label">
                          <Building2 className="w-4 h-4" />
                          <span>Floor</span>
                        </div>
                        <span className="spec-value">{sessionData.propertyData.floor_number}</span>
                      </div>
                    )}
                    
                    <div className="spec-item">
                      <div className="spec-label">
                        <Utensils className="w-4 h-4" />
                        <span>Furnished</span>
                      </div>
                      <span className="spec-value">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          sessionData.propertyData.furnished 
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : 'bg-gray-100 text-gray-800 border border-gray-200'
                        }`}>
                          {sessionData.propertyData.furnished ? 'Yes' : 'No'}
                        </span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="animate-pulse grid grid-cols-2 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-12 bg-gray-200 rounded-xl"></div>
                    ))}
                  </div>
                )}
              </div>

              {/* Costs and Ratings */}
              <div className="card card-hover">
                <div className="section-header">
                  <div className="section-icon">
                    <Euro className="w-5 h-5" />
                  </div>
                  <h2 className="section-title">Costs & Ratings</h2>
                </div>
                {sessionData?.propertyData ? (
                  <div className="space-y-6">
                    {/* Energy Rating */}
                    <div className="spec-item">
                      <div className="spec-label">
                        <Zap className="w-4 h-4" />
                        <span>Energy Rating</span>
                      </div>
                      <span className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold border-2 ${
                        sessionData.propertyData.energy_rating === 'A' ? 'text-green-700 bg-green-100 border-green-300' :
                        sessionData.propertyData.energy_rating === 'B' ? 'text-blue-700 bg-blue-100 border-blue-300' :
                        sessionData.propertyData.energy_rating === 'C' ? 'text-yellow-700 bg-yellow-100 border-yellow-300' :
                        sessionData.propertyData.energy_rating === 'D' ? 'text-orange-700 bg-orange-100 border-orange-300' :
                        'text-gray-700 bg-gray-100 border-gray-300'
                      }`}>
                        {sessionData.propertyData.energy_rating || 'N/A'}
                      </span>
                    </div>
                    
                    {/* Annual Costs */}
                    <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Annual Costs</h3>
                      
                      <div className="spec-item">
                        <div className="spec-label">
                          <div className="w-4 h-4 flex items-center justify-center">🏛️</div>
                          <span>IBI (Property Tax)</span>
                        </div>
                        <span className="spec-value">{sessionData.propertyData.ibi ? formatPrice(sessionData.propertyData.ibi) : 'N/A'}</span>
                      </div>
                      
                      <div className="spec-item">
                        <div className="spec-label">
                          <div className="w-4 h-4 flex items-center justify-center">🗑️</div>
                          <span>Basura (Waste Tax)</span>
                        </div>
                        <span className="spec-value">{sessionData.propertyData.basura ? formatPrice(sessionData.propertyData.basura) : 'N/A'}</span>
                      </div>
                    </div>
                    
                    {/* Monthly Costs */}
                    <div className="bg-primary-50 rounded-2xl p-6 border border-primary-200">
                      <h3 className="text-lg font-semibold text-primary-900 mb-4">Monthly Costs</h3>
                      
                      <div className="spec-item">
                        <div className="spec-label">
                          <Building className="w-4 h-4 text-primary-600" />
                          <span className="text-primary-800">Community Fees</span>
                        </div>
                        <span className="text-lg font-bold text-primary-900">
                          {sessionData.propertyData.community_fees ? formatPrice(sessionData.propertyData.community_fees) : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="animate-pulse space-y-4">
                    <div className="h-16 bg-gray-200 rounded-2xl"></div>
                    <div className="h-24 bg-gray-200 rounded-2xl"></div>
                    <div className="h-20 bg-gray-200 rounded-2xl"></div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Analysis Sidebar */}
            <div>
              <div className="card glass-effect sticky top-8 card-hover">
                {sessionData?.analysisResults ? (
                  // Analysis completed - show completion message
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-green-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg animation-float">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Analysis Complete!</h3>
                    <p className="text-gray-600 mb-4 text-base">
                      Your comprehensive property analysis has been completed. Review the results below.
                    </p>
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6">
                      <div className="space-y-3">
                        <div className="flex items-center text-green-800">
                          <Check className="w-5 h-5 mr-3 text-green-600" />
                          <span className="font-medium">Market analysis completed</span>
                        </div>
                        <div className="flex items-center text-green-800">
                          <Check className="w-5 h-5 mr-3 text-green-600" />
                          <span className="font-medium">Comparables analyzed</span>
                        </div>
                        <div className="flex items-center text-green-800">
                          <Check className="w-5 h-5 mr-3 text-green-600" />
                          <span className="font-medium">Investment insights generated</span>
                        </div>
                        <div className="flex items-center text-green-800">
                          <Check className="w-5 h-5 mr-3 text-green-600" />
                          <span className="font-medium">Report ready for download</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Analysis not started - show start button
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg animation-float">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Start Analysis</h3>
                    <p className="text-gray-600 mb-6 text-base">
                      Get comprehensive market analysis including:
                    </p>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center text-left">
                        <div className="w-6 h-6 bg-primary-100 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                          <BarChart3 className="w-3 h-3 text-primary-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">Market Value Estimation</h4>
                          <p className="text-xs text-gray-600">AI-powered property valuation</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center text-left">
                        <div className="w-6 h-6 bg-primary-100 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                          <Home className="w-3 h-3 text-primary-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">Comparable Properties</h4>
                          <p className="text-xs text-gray-600">Similar properties in the area</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center text-left">
                        <div className="w-6 h-6 bg-primary-100 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                          <Coins className="w-3 h-3 text-primary-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">Investment Insights</h4>
                          <p className="text-xs text-gray-600">ROI and market trends</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center text-left">
                        <div className="w-6 h-6 bg-primary-100 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                          <Printer className="w-3 h-3 text-primary-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">Professional Report</h4>
                          <p className="text-xs text-gray-600">Downloadable CMA document</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Additional Information Input - Compact */}
                    <div className="bg-gradient-to-r from-primary-50 to-primary-100/50 rounded-xl p-4 border border-primary-200 mb-4">
                      <div className="flex items-center mb-2">
                        <MapPin className="w-4 h-4 text-primary-600 mr-2" />
                        <h4 className="text-sm font-semibold text-primary-900">Additional Details</h4>
                      </div>
                      <textarea
                        value={additionalInfo}
                        onChange={(e) => {
                          if (e.target.value.length <= 200) {
                            setAdditionalInfo(e.target.value)
                          }
                        }}
                        placeholder="Urbanisation, street, landmarks..."
                        className="w-full px-3 py-2 border border-primary-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-300 focus:border-primary-400 transition-all duration-200 bg-white/90 text-sm text-gray-900 placeholder-gray-500 resize-none"
                        rows="2"
                        maxLength={200}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-primary-600">
                          {additionalInfo.length}/200
                        </span>
                        {additionalInfo.trim() && (
                          <button
                            onClick={() => setAdditionalInfo('')}
                            className="text-xs text-primary-600 hover:text-primary-800 underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={handleStartAnalysis}
                      className={`w-full btn-primary text-lg py-3 mb-3 transform transition-all duration-300 hover:scale-105 ${
                        additionalInfo.trim() ? 'bg-gradient-to-r from-primary-500 to-primary-600 shadow-lg' : ''
                      }`}
                    >
                      <span className="flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 mr-2" />
                        {additionalInfo.trim() ? 'Analyse with Details' : 'Analyse Property'}
                      </span>
                    </button>
                    
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 text-center">
                      <Loader2 className="w-3 h-3 inline mr-1" />
                      Analysis takes 2-3 minutes
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Analysis Steps State - Only show if analysis is in progress and not completed
  if (currentStep < analysisSteps.length && sessionData?.status !== 'completed') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <h1 className="text-xl font-semibold text-gray-900">
                AI Property Analysis
              </h1>
              <SystemStatus />
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h2 className="text-lg font-semibold text-primary-900">Analysis in Progress</h2>
                  <p className="text-primary-700">Our AI is analyzing your property. This typically takes 2-3 minutes.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {analysisSteps.map((step, index) => {
              const status = getStepStatus(index)
              const isRunning = status === 'running'
              const isComplete = status === 'complete'
              
              return (
                <div
                  key={step.id}
                  className={`card transition-all duration-300 ${
                    isRunning ? 'ring-2 ring-primary-500 bg-primary-50' : ''
                  } ${isComplete ? 'bg-green-50 border-green-200' : ''}`}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                        isComplete ? 'bg-green-100 text-green-600' :
                        isRunning ? 'bg-primary-100 text-primary-600 animate-pulse' :
                        'bg-gray-100 text-gray-400'
                      }`}>
                        {getStepIcon(step, status)}
                      </div>
                    </div>
                    
                    <div className="ml-4 flex-1">
                      <h3 className={`text-lg font-semibold ${
                        isComplete ? 'text-green-900' :
                        isRunning ? 'text-primary-900' :
                        'text-gray-900'
                      }`}>
                        {step.name}
                      </h3>
                      <p className={`text-sm ${
                        isComplete ? 'text-green-700' :
                        isRunning ? 'text-primary-700' :
                        'text-gray-600'
                      }`}>
                        {step.description}
                      </p>
                    </div>
                    
                    <div className="flex-shrink-0">
                      {isRunning && (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                          <span className="text-sm text-primary-600">Running...</span>
                        </div>
                      )}
                      {isComplete && (
                        <span className="text-sm text-green-600 font-medium">
                          Complete
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </main>
      </div>
    )
  }

  // Results State
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5">
      {/* Header with Download Button */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Property Analysis Report</h1>
            <p className="text-sm text-gray-600">Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="flex items-center space-x-4">
            <SystemStatus />
            <button
              onClick={handleDownloadReport}
              className="flex items-center space-x-2 px-6 py-3 rounded-lg transition-all duration-200 shadow-lg transform hover:-translate-y-0.5 bg-primary hover:bg-primary-600 text-white hover:shadow-xl"
            >
              <Download className="w-5 h-5" />
              <span>Download Full CMA</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Property Summary Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Home className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Property Summary</h2>
              </div>
              {sessionData?.propertyData?.reference && (
                <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-lg font-mono font-semibold">
                  Ref: {sessionData.propertyData.reference}
                </span>
              )}
            </div>
            
            <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0 lg:items-end">
              <div className="space-y-4">
                {/* Location */}
                <div className="flex items-start space-x-3 ml-4">
                  <MapPin className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Area 120, Marbella, Málaga</h3>
                    <p className="text-gray-600">Prestigious residential area with excellent connectivity</p>
                  </div>
                </div>

                {/* Property Details Grid - Show on mobile before images, on desktop after location */}
                <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Building className="w-5 h-5 text-primary" />
                      <span className="text-sm text-gray-600">Type</span>
                    </div>
                    <p className="font-semibold text-gray-900">Apartment</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Home className="w-5 h-5 text-primary" />
                      <span className="text-sm text-gray-600">Property Sizes</span>
                    </div>
                    <div className="flex gap-3 mt-2 flex-wrap">
                      <div className="text-center">
                        <div className="text-xs text-gray-600">Build</div>
                        <div className="font-semibold text-gray-900 text-sm">{sessionData?.propertyData?.build_square_meters || 108} m²</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Euro className="w-5 h-5 text-primary" />
                      <span className="text-sm text-gray-600">Asking Price</span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {sessionData?.propertyData?.price ? formatPrice(sessionData.propertyData.price) : '€450,000'}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      €4,167/m²
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      <span className="text-sm text-gray-600">Bedrooms/Bathrooms</span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {sessionData?.propertyData?.bedrooms || 3}bd / {sessionData?.propertyData?.bathrooms || 2}ba
                    </p>
                  </div>
                </div>

                {/* Desktop Property Details Grid - Hidden on mobile */}
                <div className="hidden lg:grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Building className="w-5 h-5 text-primary" />
                      <span className="text-sm text-gray-600">Type</span>
                    </div>
                    <p className="font-semibold text-gray-900">Apartment</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Home className="w-5 h-5 text-primary" />
                      <span className="text-sm text-gray-600">Property Sizes</span>
                    </div>
                    <div className="flex gap-6 mt-2">
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Build</div>
                        <div className="font-semibold text-gray-900">{sessionData?.propertyData?.build_square_meters || 108} m²</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Euro className="w-5 h-5 text-primary" />
                      <span className="text-sm text-gray-600">Asking Price</span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {sessionData?.propertyData?.price ? formatPrice(sessionData.propertyData.price) : '€450,000'}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      €4,167/m²
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      <span className="text-sm text-gray-600">Bedrooms/Bathrooms</span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {sessionData?.propertyData?.bedrooms || 3}bd / {sessionData?.propertyData?.bathrooms || 2}ba
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Image and Map */}
              <div className="lg:h-64 space-y-4 lg:space-y-0 lg:flex lg:gap-4">
                <div className="h-64 lg:w-1/2 lg:h-full bg-gray-200 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">Image unavailable</p>
                  </div>
                </div>
                <div className="h-64 lg:w-1/2 lg:h-full bg-gray-200 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                    </svg>
                    <p className="text-sm">Map</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Property Analysis & Investment Highlights */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Property Analysis & Investment Highlights</h2>
            </div>
            
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-l-4 border-primary p-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Property Analysis & Investment Highlights</h3>
                
                {/* AI Summary if available */}
                <p className="text-gray-700 leading-relaxed mb-4">
                  This apartment in Marbella represents a solid investment opportunity. The property features 3 bedrooms and modern amenities, making it attractive to both buyers and renters.
                </p>
                
                {/* Location Highlights */}
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-800 mb-2">📍 Location Advantages</h4>
                  <p className="text-gray-700 leading-relaxed">
                    This apartment is strategically located in Marbella, Málaga - a prime area on the Costa del Sol known for its excellent climate, proximity to international amenities, and strong rental market appeal. The location offers easy access to Marbella, Puerto Banús, and pristine beaches, making it highly desirable for both residents and investors.
                  </p>
                </div>
                
                {/* Investment Potential */}
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-800 mb-2">💰 Investment Potential</h4>
                  <p className="text-gray-700 leading-relaxed">
                    Marbella presents compelling investment opportunities with its established reputation as a prime Costa del Sol destination. Well-positioned apartments in Marbella offer excellent rental potential from both permanent residents and the thriving vacation rental market. The neighbourhood's proximity to amenities, established infrastructure, and strong tourism appeal make this 3-bedroom property an attractive investment opportunity in the Marbella market.
                  </p>
                </div>
                
                {/* Future Development & Market Outlook */}
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">🚀 Market Outlook</h4>
                  <p className="text-gray-700 leading-relaxed">
                    The Marbella property market benefits from its strategic location and established infrastructure, making it a preferred destination for international buyers. The mature residential character of this Marbella neighbourhood provides market stability while maintaining potential for steady appreciation. With nearby amenities including schools, shopping, and recreational facilities, this area continues to attract families and investors seeking quality lifestyle options.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Market Data & Trends */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Market Data & Trends</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Price Comparison Chart */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Average vs median property prices in the local market area.</h3>
                <div className="h-48 bg-white rounded-lg flex items-end justify-center space-x-8 p-4">
                  <div className="text-center">
                    <div className="w-16 bg-green-500 rounded-t" style={{ height: '60%' }}></div>
                    <p className="text-sm text-gray-600 mt-2">Average Price</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 bg-green-500 rounded-t" style={{ height: '60%' }}></div>
                    <p className="text-sm text-gray-600 mt-2">Median Price</p>
                  </div>
                </div>
              </div>
              
              {/* Market Activity Chart */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Current inventory levels and average time properties stay on the market.</h3>
                <div className="h-48 bg-white rounded-lg flex items-end justify-center space-x-8 p-4">
                  <div className="text-center">
                    <div className="w-16 bg-blue-500 rounded-t" style={{ height: '80%' }}></div>
                    <p className="text-sm text-gray-600 mt-2">Active Listings</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 bg-blue-500 rounded-t" style={{ height: '25%' }}></div>
                    <p className="text-sm text-gray-600 mt-2">Days on Market</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Recent price appreciation rates showing short and medium-term market momentum.</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">6-Month Change</span>
                    <span className="text-green-600 font-semibold">+3.2%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">12-Month Change</span>
                    <span className="text-green-600 font-semibold">+5.8%</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Overall market direction based on pricing patterns and analyzed property data.</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <span className="font-semibold text-green-600">Up Market</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">Prices are rising.</p>
              </div>
            </div>
          </div>

          {/* Valuation Analysis */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Euro className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Valuation Analysis</h2>
            </div>
            
            <div className="bg-gradient-to-r from-primary/10 to-primary-600/10 p-6 rounded-lg border-l-4 border-primary">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Estimated Market Value</h3>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {formatPrice(getAnalysisResult('market')?.marketValue || sessionData?.propertyData?.price || 450000)}
                  </div>
                  <div className="text-sm text-primary/80">
                    85% confidence
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-sm text-gray-600">Conservative</div>
                  <div className="font-semibold text-gray-900">
                    {formatPrice(Math.round((getAnalysisResult('market')?.marketValue || sessionData?.propertyData?.price || 450000) * 0.9))}
                  </div>
                </div>
                                    <div className="text-center p-3 bg-primary rounded-lg">
                      <div className="text-sm text-white">Market Value</div>
                      <div className="font-semibold text-white">
                        {formatPrice(getAnalysisResult('market')?.marketValue || sessionData?.propertyData?.price || 450000)}
                      </div>
                    </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-sm text-gray-600">Optimistic</div>
                  <div className="font-semibold text-gray-900">
                    {formatPrice(Math.round((getAnalysisResult('market')?.marketValue || sessionData?.propertyData?.price || 450000) * 1.1))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Comparable Properties */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Comparable Properties</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {getAnalysisResult('comparables')?.comparables?.length || 8} comparable properties analyzed
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Sort by:</span>
                  <select className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-[#00ae9a] focus:border-transparent">
                    <option>Distance</option>
                    <option>Price: Low to High</option>
                    <option>Price: High to Low</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Sample Comparable Property */}
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <svg className="w-8 h-8 mx-auto mb-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs">Image unavailable</p>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm">Area 120, Marbella</h3>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                      Ref: COMP001
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">Apartment</p>
                  
                  <div className="mb-3 space-y-1">
                                      <div className="flex justify-between items-center">
                    <span className="font-semibold text-primary text-lg">€450,000</span>
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">Same Area</span>
                  </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">€4,167/m²</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="flex items-center space-x-1">
                      <span className="text-gray-500">🛏️</span>
                      <span className="font-medium">3 beds</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-gray-500">🚿</span>
                      <span className="font-medium">2 baths</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Nearby Amenities */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Navigation className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Nearby Amenities</h2>
            </div>
            
            <div className="flex flex-wrap gap-3 mb-6">
              <button className="flex items-center space-x-2 px-4 py-2 rounded-lg border-2 border-primary bg-primary text-white">
                <span>🛒</span>
                <span>Shopping</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                  </svg>
                  <p className="text-sm">Map</p>
                </div>
              </div>
              
              <div className="space-y-4 max-h-64 overflow-y-auto">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">🛒</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">Local Park</h3>
                      <p className="text-sm text-gray-600 mb-2">Recreational area with walking paths</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">0.80km</span>
                        <span className="text-sm text-yellow-500">★★★★☆</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">🛒</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">Shopping Centre</h3>
                      <p className="text-sm text-gray-600 mb-2">Modern shopping complex with various stores</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">1.29km</span>
                        <span className="text-sm text-yellow-500">★★★★☆</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobility & Transportation */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Car className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Mobility & Transportation</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto mb-3">
                  🚶
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Walking</h3>
                <p className="text-sm text-gray-600 mb-2">Pedestrian Access</p>
                <div className="text-2xl font-bold text-green-600 mb-2">85</div>
                <p className="text-xs text-gray-600">Excellent walkability with many amenities within walking distance</p>
                <p className="text-xs text-gray-500 mt-1">Avg. walk time: 8 min</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white mx-auto mb-3">
                  🚗
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Driving</h3>
                <p className="text-sm text-gray-600 mb-2">Vehicle Access</p>
                <div className="text-2xl font-bold text-purple-600 mb-2">75</div>
                <p className="text-xs text-gray-600">Good driving access with major roads nearby</p>
                <p className="text-xs text-gray-500 mt-1">Avg. drive time: 15 min</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto mb-3">
                  🚊
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Transit</h3>
                <p className="text-sm text-gray-600 mb-2">Public Transport</p>
                <div className="text-2xl font-bold text-green-600 mb-2">90</div>
                <p className="text-xs text-gray-600">Excellent public transport connections</p>
                <p className="text-xs text-gray-500 mt-1">40 destinations accessible</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto mb-3">
                  🎯
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Overall</h3>
                <p className="text-sm text-gray-600 mb-2">Accessibility Score</p>
                <div className="text-2xl font-bold text-green-600 mb-2">85</div>
                <p className="text-xs text-gray-600">Combined Mobility Rating</p>
                <p className="text-xs text-gray-500 mt-1">45 key destinations analyzed</p>
              </div>
            </div>
          </div>

          {/* AI Analysis Summary */}
          <div className="bg-primary rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">AI Analysis Summary</h2>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white/10 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Executive Summary</h3>
                <p>This apartment in Marbella represents a solid investment opportunity. The property features 3 bedrooms and modern amenities, making it attractive to both buyers and renters.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/10 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <span>🌱</span>
                    <h4 className="font-semibold">Investment Recommendation</h4>
                  </div>
                  <p className="text-sm">Excellent long-term investment potential.</p>
                </div>
                
                <div className="bg-white/10 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <span>🏠</span>
                    <h4 className="font-semibold">Valuation Range</h4>
                  </div>
                  <p className="text-sm">€375,000 - €415,000 (85% confidence)</p>
                </div>
                
                <div className="bg-white/10 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <span>🔧</span>
                    <h4 className="font-semibold">Property Condition</h4>
                  </div>
                  <p className="text-sm">Recently renovated with modern features.</p>
                </div>
                
                <div className="bg-white/10 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <span>⏰</span>
                    <h4 className="font-semibold">Market Timing</h4>
                  </div>
                  <p className="text-sm">Good timing for investment in this area.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 