'use client'

import { useState, useEffect } from 'react'
import { 
  Download, 
  Database, 
  Image as ImageIcon, 
  FileText, 
  CheckCircle, 
  Loader2,
  Zap,
  Clock
} from 'lucide-react'

export default function FreshAnalysisProgress({ 
  isActive = false, 
  startTime = null,
  onComplete = null 
}) {
  const [currentStage, setCurrentStage] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)

  const stages = [
    {
      id: 'api_call',
      name: 'Fetching Property Data',
      description: 'Connecting to PropertyList API for latest property information',
      icon: Database,
      duration: 15000, // 15 seconds
      color: 'blue'
    },
    {
      id: 'comparables',
      name: 'Finding Comparables',
      description: 'Searching for similar properties in the area',
      icon: Database,
      duration: 20000, // 20 seconds
      color: 'indigo'
    },
    {
      id: 'images',
      name: 'Processing Images',
      description: 'Downloading and optimizing property images',
      icon: ImageIcon,
      duration: 30000, // 30 seconds
      color: 'emerald'
    },
    {
      id: 'pdf',
      name: 'Generating Report',
      description: 'Creating comprehensive PDF with embedded images',
      icon: FileText,
      duration: 15000, // 15 seconds
      color: 'purple'
    }
  ]

  useEffect(() => {
    let interval = null
    
    if (isActive && startTime) {
      interval = setInterval(() => {
        const elapsed = Date.now() - startTime
        setElapsedTime(elapsed)
        
        // Determine current stage based on elapsed time
        let totalDuration = 0
        let newStage = 0
        
        for (let i = 0; i < stages.length; i++) {
          totalDuration += stages[i].duration
          if (elapsed < totalDuration) {
            newStage = i
            break
          }
          newStage = i + 1
        }
        
        setCurrentStage(newStage)
        
        // Auto-complete after all stages
        if (newStage >= stages.length && onComplete) {
          onComplete()
        }
      }, 1000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isActive, startTime, onComplete])

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }
    return `${remainingSeconds}s`
  }

  const getStageStatus = (index) => {
    if (index < currentStage) return 'completed'
    if (index === currentStage) return 'active'
    return 'pending'
  }

  const getProgressPercentage = () => {
    if (currentStage >= stages.length) return 100
    
    let totalDuration = stages.reduce((sum, stage) => sum + stage.duration, 0)
    let elapsedDuration = 0
    
    for (let i = 0; i < currentStage; i++) {
      elapsedDuration += stages[i].duration
    }
    
    // Add progress within current stage
    if (currentStage < stages.length) {
      const stageStartTime = elapsedDuration
      const stageProgress = Math.min(elapsedTime - stageStartTime, stages[currentStage].duration)
      elapsedDuration += stageProgress
    }
    
    return Math.min((elapsedDuration / totalDuration) * 100, 100)
  }

  if (!isActive) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 flex items-center justify-center">
      <div className="max-w-2xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Zap className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Fresh Analysis in Progress</h1>
          <p className="text-gray-600">Fetching latest data from PropertyList API</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm text-gray-600">
              {formatTime(elapsedTime)} elapsed
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-green-500 h-3 rounded-full transition-all duration-1000 ease-out shadow-sm"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
          <div className="text-center mt-2">
            <span className="text-lg font-semibold text-emerald-600">
              {Math.round(getProgressPercentage())}%
            </span>
          </div>
        </div>

        {/* Stages */}
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const status = getStageStatus(index)
            const IconComponent = stage.icon
            
            return (
              <div 
                key={stage.id}
                className={`bg-white rounded-xl p-6 shadow-lg border-2 transition-all duration-500 ${
                  status === 'active' 
                    ? `border-${stage.color}-200 shadow-${stage.color}-100` 
                    : status === 'completed'
                    ? 'border-green-200 shadow-green-100'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${
                    status === 'completed'
                      ? 'bg-green-500 text-white'
                      : status === 'active'
                      ? `bg-${stage.color}-500 text-white`
                      : 'bg-gray-200 text-gray-400'
                  }`}>
                    {status === 'completed' ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : status === 'active' ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <IconComponent className="w-6 h-6" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className={`text-lg font-semibold ${
                      status === 'active' ? `text-${stage.color}-900` : 'text-gray-900'
                    }`}>
                      {stage.name}
                    </h3>
                    <p className={`text-sm ${
                      status === 'active' ? `text-${stage.color}-700` : 'text-gray-600'
                    }`}>
                      {stage.description}
                    </p>
                  </div>
                  
                  <div className="ml-4">
                    {status === 'completed' && (
                      <span className="text-green-600 font-medium text-sm">✓ Complete</span>
                    )}
                    {status === 'active' && (
                      <span className={`text-${stage.color}-600 font-medium text-sm flex items-center`}>
                        <Clock className="w-4 h-4 mr-1" />
                        Processing...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 p-4 bg-white/50 rounded-lg">
          <p className="text-sm text-gray-600">
            ⚡ Getting fresh data and optimized images from PropertyList API
          </p>
          <p className="text-xs text-gray-500 mt-1">
            This analysis includes live property data, fresh comparable searches, and high-quality embedded images
          </p>
        </div>
      </div>
    </div>
  )
} 