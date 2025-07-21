'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Activity, 
  MapPin, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Home,
  Loader2,
  BarChart3,
  Building,
  Brain,
  Footprints,
  Eye,
  XCircle,
  Info
} from 'lucide-react'
import { fixSpanishCharacters } from '@/lib/utils'
import CMAReportDisplay from './CMAReportDisplay'

interface AnalysisStep {
  id: number
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'error' | 'skipped'
  emoji: string
  startTime?: string
  endTime?: string
  details?: any
  error?: string
}

interface ActiveAnalysis {
  sessionId: string
  property: {
    address: string
    city: string
    state: string
    propertyType: string
  }
  startTime: string
  steps: AnalysisStep[]
  status: 'active' | 'completed' | 'error' | 'degraded'
  qualityScore?: number
  completedSteps?: number
  totalSteps?: number
  criticalErrors?: number
}

interface AnalysisDashboardProps {
  sessionId: string
  property: any
  userContext: string
  sessionData?: any // Add session data from main page
}

export default function AnalysisDashboard({ sessionId, property, userContext, sessionData }: AnalysisDashboardProps) {
  const [activeAnalyses, setActiveAnalyses] = useState<ActiveAnalysis[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previousCompletedSteps, setPreviousCompletedSteps] = useState<number>(0)
  const [isMobile, setIsMobile] = useState<boolean>(false)
  
  // Refs for each step element
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])
  
  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // Ensure page starts at the top when component mounts
  useEffect(() => {
    // Force scroll to top immediately when component mounts
    window.scrollTo(0, 0)
  }, [])
  
  // Mobile auto-scroll functionality
  useEffect(() => {
    if (!isMobile || activeAnalyses.length === 0) return
    
    const analysis = activeAnalyses[0]
    const currentCompletedSteps = analysis.completedSteps || 0
    
    // Only scroll if a new step completed (and we're past step 1)
    if (currentCompletedSteps > previousCompletedSteps && currentCompletedSteps >= 2) {
      const nextStepIndex = currentCompletedSteps // This is the step that just completed
      const stepRef = stepRefs.current[nextStepIndex - 1] // Array is 0-indexed
      
      if (stepRef) {
        // Add a small delay to ensure the step status has updated visually
        setTimeout(() => {
          stepRef.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          })
        }, 300)
      }
    }
    
    setPreviousCompletedSteps(currentCompletedSteps)
  }, [activeAnalyses, isMobile, previousCompletedSteps])
  
  // REMOVED: fetchAnalysisData function - no longer needed
  // AnalysisDashboard now receives data from main page props

  // Create analysis from session data
  const createAnalysisFromSessionData = (sessionData: any): ActiveAnalysis => {
    // Determine overall status with better logic
    let overallStatus: 'active' | 'completed' | 'error' | 'degraded' = 'active'
    let qualityScore = 0
    
    if (sessionData.status === 'completed') {
      // Check if we have report data to determine quality
      if (sessionData.report) {
        const completedSteps = sessionData.completedSteps || 7
        const totalSteps = sessionData.totalSteps || 7
        qualityScore = Math.round((completedSteps / totalSteps) * 100)
        
        if (qualityScore >= 80) {
          overallStatus = 'completed'
        } else if (qualityScore >= 50) {
          overallStatus = 'degraded' // Partial success
        } else {
          overallStatus = 'error'
        }
      } else {
        overallStatus = 'completed'
      }
    } else if (sessionData.status === 'error') {
      overallStatus = 'error'
    } else if (sessionData.completedSteps === sessionData.totalSteps && sessionData.completedSteps > 0) {
      // All steps complete but status not "completed" yet - show as completed
      overallStatus = 'completed'
      qualityScore = 100 // Assume high quality since all steps completed
    }
    
    // Create analysis object for this session
    const analysis: ActiveAnalysis = {
      sessionId: sessionData.sessionId,
      property: {
        address: sessionData.property?.address || property.address || 'Unknown',
        city: sessionData.property?.city || property.city || 'Unknown',
        state: sessionData.property?.state || property.state || 'Unknown',
        propertyType: sessionData.property?.propertyType || property.propertyType || 'Unknown'
      },
      startTime: new Date(sessionData.createdAt || Date.now()).toISOString(),
      status: overallStatus,
      qualityScore,
      completedSteps: sessionData.completedSteps,
      totalSteps: sessionData.totalSteps,
      criticalErrors: sessionData.criticalErrors,
      steps: [
        {
          id: 1,
          title: 'AI Description Analysis',
          description: 'Extracting location details from property description',
          emoji: '🧠',
          status: getStepStatus(sessionData.status, sessionData.completedSteps, 1, sessionData.criticalErrors)
        },
        {
          id: 2,
          title: 'Geolocation, Amenities & Walkability',
          description: 'Getting coordinates and nearby facilities',
          emoji: '🗺️',
          status: getStepStatus(sessionData.status, sessionData.completedSteps, 2, sessionData.criticalErrors)
        },
        {
          id: 3,
          title: 'Market Data & Trends',
          description: 'Fetching market information',
          emoji: '📈',
          status: getStepStatus(sessionData.status, sessionData.completedSteps, 3, sessionData.criticalErrors)
        },
        {
          id: 4,
          title: 'Comparable Listings',
          description: 'Finding similar properties',
          emoji: '🏘️',
          status: getStepStatus(sessionData.status, sessionData.completedSteps, 4, sessionData.criticalErrors)
        },
        {
          id: 5,
          title: 'Future Developments',
          description: 'Checking upcoming projects',
          emoji: '🏗️',
          status: getStepStatus(sessionData.status, sessionData.completedSteps, 5, sessionData.criticalErrors)
        },
        {
          id: 6,
          title: 'Neighborhood Insights',
          description: 'Gathering local information',
          emoji: '🌍',
          status: getStepStatus(sessionData.status, sessionData.completedSteps, 6, sessionData.criticalErrors)
        },
        {
          id: 7,
          title: 'AI Summary Generation',
          description: 'Creating comprehensive analysis',
          emoji: '🤖',
          status: getStepStatus(sessionData.status, sessionData.completedSteps, 7, sessionData.criticalErrors)
        }
      ]
    }
    
    return analysis
  }

  // Create fallback analysis if session fetch fails
  const createFallbackAnalysis = () => {
    console.log('📊 Creating fallback analysis for session:', sessionId)
    const analysis: ActiveAnalysis = {
      sessionId: sessionId,
      property: {
        address: property.address || 'Unknown',
        city: property.city || 'Unknown',
        state: property.state || 'Unknown',
        propertyType: property.propertyType || 'Unknown'
      },
      startTime: new Date().toISOString(),
      status: 'active',
      steps: [
        {
          id: 1,
          title: 'AI Description Analysis',
          description: 'Extracting location details from property description',
          emoji: '🧠',
          status: 'in_progress'
        },
        {
          id: 2,
          title: 'Geolocation, Verification & Amenities',
          description: 'Getting coordinates, verifying accuracy, and nearby facilities',
          emoji: '🗺️',
          status: 'pending'
        },
        {
          id: 3,
          title: 'Market Data & Trends',
          description: 'Fetching market information',
          emoji: '📈',
          status: 'pending'
        },
        {
          id: 4,
          title: 'Comparable Listings',
          description: 'Finding similar properties',
          emoji: '🏘️',
          status: 'pending'
        },
        {
          id: 5,
          title: 'Future Developments',
          description: 'Checking upcoming projects',
          emoji: '🏗️',
          status: 'pending'
        },
        {
          id: 6,
          title: 'Neighborhood Insights',
          description: 'Gathering local information',
          emoji: '🌍',
          status: 'pending'
        },
        {
          id: 7,
          title: 'AI Summary Generation',
          description: 'Creating comprehensive analysis',
          emoji: '🤖',
          status: 'pending'
        }
      ]
    }
    setActiveAnalyses([analysis])
    setLastUpdate(new Date())
  }
  
  // Helper function to determine step status with improved logic
  const getStepStatus = (
    sessionStatus: string, 
    completedSteps: number = 0, 
    stepId: number, 
    criticalErrors: number = 0
  ): 'pending' | 'in_progress' | 'completed' | 'error' | 'skipped' => {
    console.log(`🔍 [STEP] Step ${stepId} status check:`, {
      sessionStatus,
      completedSteps,
      stepId,
      criticalErrors
    })
    
    // Handle error states first
    if (sessionStatus === 'error' && criticalErrors > 0) {
      return stepId <= criticalErrors ? 'error' : 'skipped'
    }
    
    // FIXED: Always show completed steps as completed, regardless of session status
    if (stepId <= completedSteps) {
      console.log(`✅ [STEP] Step ${stepId} marked as completed (${stepId} <= ${completedSteps})`)
      return 'completed'
    }
    
    // Show appropriate status for remaining steps based on session state
    if (sessionStatus === 'completed' || sessionStatus === 'degraded') {
      // Analysis finished - remaining steps are skipped
      console.log(`⏭️ [STEP] Step ${stepId} marked as skipped (analysis ${sessionStatus})`)
      return 'skipped'
    }
    
    if (sessionStatus === 'analyzing') {
      // Show the next step (completedSteps + 1) as in_progress when actively analyzing
      if (stepId === completedSteps + 1) {
        console.log(`🔄 [STEP] Step ${stepId} marked as in_progress (next step)`)
        return 'in_progress'
      }
      
      // All other future steps are pending
      console.log(`⏳ [STEP] Step ${stepId} marked as pending (future step)`)
      return 'pending'
    }
    
    // Default for 'pending' or other states - all remaining steps are pending
    console.log(`⏳ [STEP] Step ${stepId} marked as pending (default)`)
    return 'pending'
  }

  // Update analysis when session data changes from main page
  useEffect(() => {
    if (sessionData) {
      console.log('🔄 [DASHBOARD] Updating analysis with session data:', {
        status: sessionData.status,
        completedSteps: sessionData.completedSteps,
        totalSteps: sessionData.totalSteps,
        qualityScore: sessionData.qualityScore
      })
      
      // Create analysis from session data
      const analysis = createAnalysisFromSessionData(sessionData)
      setActiveAnalyses([analysis])
      setLastUpdate(new Date())
      setError(null)
    } else if (activeAnalyses.length === 0) {
      // Only create fallback if no session data is available
      createFallbackAnalysis()
    }
  }, [sessionData, sessionId])

  // DISABLED: Polling is now handled by main page only
  // useEffect(() => {
  //   if (!isPolling) {
  //     return
  //   }

  //   const interval = setInterval(() => {
  //     fetchAnalysisData()
  //   }, 3000)

  //   return () => {
  //     clearInterval(interval)
  //   }
  // }, [isPolling, sessionId])

  // DISABLED: Completion detection is now handled by main page only
  // useEffect(() => {
  //   if (activeAnalyses.length > 0) {
  //     const analysis = activeAnalyses[0]
  //     const isAnalysisComplete = analysis.status === 'completed' || 
  //                               analysis.status === 'degraded' ||
  //                               (analysis.completedSteps && analysis.totalSteps && 
  //                                analysis.completedSteps >= analysis.totalSteps && 
  //                                analysis.completedSteps > 0)
  //     
  //     if (isAnalysisComplete && isPolling) {
  //       console.log('✅ Analysis complete - stopping dashboard polling')
  //       fetchAnalysisData()
  //       setIsPolling(false) // Stop polling immediately
  //     }
  //   }
  // }, [activeAnalyses, isPolling])

  // DISABLED: Polling is now handled by main page only
  // useEffect(() => {
  //   const handleVisibilityChange = () => {
  //     if (!document.hidden && !isPolling && activeAnalyses.length > 0) {
  //       const analysis = activeAnalyses[0]
  //       const isAnalysisComplete = analysis.status === 'completed' || 
  //                                 analysis.status === 'degraded' ||
  //                                 (analysis.completedSteps && analysis.totalSteps && 
  //                                  analysis.completedSteps >= analysis.totalSteps && 
  //                                  analysis.completedSteps > 0)
  //       
  //       // Only resume polling if analysis is not complete
  //       if (!isAnalysisComplete) {
  //         setIsPolling(true)
  //         fetchAnalysisData()
  //       }
  //     }
  //   }

  //   const handleFocus = () => {
  //     if (!isPolling && activeAnalyses.length > 0) {
  //       const analysis = activeAnalyses[0]
  //       const analysis.completedSteps && analysis.totalSteps && 
  //        analysis.completedSteps >= analysis.totalSteps && 
  //        analysis.completedSteps > 0)
  //       
  //       // Only resume polling if analysis is not complete
  //       if (!isAnalysisComplete) {
  //         setIsPolling(true)
  //         fetchAnalysisData()
  //       }
  //     }
  //   }

  //   document.addEventListener('visibilitychange', handleVisibilityChange)
  //   window.addEventListener('focus', handleFocus)

  //   return () => {
  //     document.removeEventListener('visibilitychange', handleVisibilityChange)
  //     window.removeEventListener('focus', handleFocus)
  //   }
  // }, [isPolling, sessionId, activeAnalyses])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-[#00ae9a]" />
      case 'in_progress': return <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#00ae9a' }} />
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />
      case 'skipped': return <AlertCircle className="w-5 h-5 text-yellow-500" />
      default: return <div className="w-5 h-5 rounded-full bg-gray-300" />
    }
  }

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getQualityLabel = (score: number) => {
    if (score >= 80) return 'High Quality'
    if (score >= 60) return 'Moderate Quality'
    return 'Limited Quality'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#00ae9a]/5 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-800 font-medium">Connection Error</span>
            </div>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Active Analyses */}
        <div className="space-y-6">
          <AnimatePresence>
            {activeAnalyses.map((analysis) => (
                <motion.div
                  key={analysis.sessionId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white/90 backdrop-blur-sm rounded-xl shadow-xl border border-white/20 overflow-hidden"
                >
                  {/* Analysis Steps */}
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {analysis.steps.map((step) => (
                        <div
                          key={step.id}
                          ref={(el) => {
                            stepRefs.current[step.id - 1] = el
                            return
                          }}
                          className={`p-4 rounded-lg border transition-all duration-200 ${
                            step.status === 'completed' 
                              ? 'bg-green-50 border-green-200' 
                              : step.status === 'in_progress'
                              ? 'bg-[#00ae9a]/10 border-[#00ae9a]/30'
                              : step.status === 'error'
                              ? 'bg-red-50 border-red-200'
                              : step.status === 'skipped'
                              ? 'bg-yellow-50 border-yellow-200'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="text-2xl">{step.emoji}</span>
                            {getStatusIcon(step.status)}
                          </div>
                          <h4 className="font-semibold text-gray-900 mb-1">{step.title}</h4>
                          <p className="text-sm text-gray-600">{step.description}</p>
                          
                          {/* Show error message if step failed */}
                          {step.status === 'error' && step.error && (
                            <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">
                              Error: {step.error}
                            </div>
                          )}
                          
                          {/* Show skipped message */}
                          {step.status === 'skipped' && (
                            <div className="mt-2 p-2 bg-yellow-100 border border-yellow-200 rounded text-xs text-yellow-700">
                              Skipped due to earlier failures
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-6 p-4 bg-gray-50 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                        <span className="text-sm text-gray-500">
                          {analysis.steps.filter(s => s.status === 'completed').length} / {analysis.steps.length} completed
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            analysis.status === 'completed' ? 'bg-gradient-to-r from-green-500 to-green-600' :
                            analysis.status === 'degraded' ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                            analysis.status === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600' :
                            'bg-gradient-to-r from-[#00ae9a] to-[#00c5ad]'
                          }`}
                          style={{ 
                            width: `${(analysis.steps.filter(s => s.status === 'completed').length / analysis.steps.length) * 100}%` 
                          }}
                        />
                      </div>
                      
                      {/* Status Messages */}
                      {analysis.status === 'completed' && (
                                                  <div className="mt-4 p-3 bg-[#00ae9a]/10 border border-[#00ae9a]/30 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="w-5 h-5 text-[#00ae9a]" />
                                                          <span className="text-[#00ae9a] font-medium">Analysis Complete!</span>
                          </div>
                                                      <p className="text-[#00ae9a]/80 text-sm mt-1">
                            🔄 Loading CMA report... The full analysis will appear automatically.
                          </p>
                        </div>
                      )}
                      
                      {/* New: All steps complete but waiting for final report */}
                      {analysis.status === 'active' && analysis.completedSteps === analysis.totalSteps && analysis.completedSteps > 0 && (
                        <div className="mt-4 p-3 bg-[#00ae9a]/10 border border-[#00ae9a]/30 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#00ae9a' }} />
                            <span className="text-[#00ae9a] font-medium">Finalizing Report...</span>
                          </div>
                          <p className="text-[#00ae9a]/80 text-sm mt-1">
                            ✅ All analysis steps completed! Generating your comprehensive CMA report...
                          </p>
                        </div>
                      )}
                      
                      {analysis.status === 'degraded' && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="w-5 h-5 text-yellow-500" />
                            <span className="text-yellow-800 font-medium">Partial Analysis Complete</span>
                          </div>
                          <p className="text-yellow-700 text-sm mt-1">
                            Some data sources were unavailable, but we've generated a report with available information.
                          </p>
                          {analysis.qualityScore && (
                            <p className="text-yellow-700 text-sm mt-1">
                              Report Quality: <span className={`font-medium ${getQualityColor(analysis.qualityScore)}`}>
                                {analysis.qualityScore}% - {getQualityLabel(analysis.qualityScore)}
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                      
                      {analysis.status === 'error' && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <XCircle className="w-5 h-5 text-red-500" />
                            <span className="text-red-800 font-medium">Analysis Failed</span>
                          </div>
                          <p className="text-red-700 text-sm mt-1">
                            Critical errors prevented completion. Please try again or contact support.
                          </p>
                          {analysis.criticalErrors && (
                            <p className="text-red-700 text-sm mt-1">
                              Critical errors: {analysis.criticalErrors}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {analysis.status === 'active' && analysis.completedSteps !== analysis.totalSteps && (
                        <div className="mt-4 p-3 bg-[#00ae9a]/10 border border-[#00ae9a]/30 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#00ae9a' }} />
                            <span className="text-[#00ae9a] font-medium">Analysis in Progress</span>
                          </div>
                          <p className="text-[#00ae9a]/80 text-sm mt-1">
                            Gathering property data and market information...
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Render CMAReportDisplay when report is available and analysis is complete or degraded */}
                  {sessionData?.report && (analysis.status === 'completed' || analysis.status === 'degraded') && (
                    <div className="mt-8">
                      <CMAReportDisplay report={sessionData.report} sessionId={sessionId} />
                    </div>
                  )}
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
} 