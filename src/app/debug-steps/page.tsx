'use client'

import { useState } from 'react'

export default function DebugStepsPage() {
  const [sessionId, setSessionId] = useState('')
  const [sessionData, setSessionData] = useState<any>(null)
  const [stepStatuses, setStepStatuses] = useState<any[]>([])

  const getStepStatus = (
    sessionStatus: string, 
    completedSteps: number = 0, 
    stepId: number, 
    criticalErrors: number = 0
  ): 'pending' | 'in_progress' | 'completed' | 'error' | 'skipped' => {
    if (sessionStatus === 'error' && criticalErrors > 0) {
      return stepId <= criticalErrors ? 'error' : 'skipped'
    }
    
    if (sessionStatus === 'completed' || sessionStatus === 'degraded') {
      return stepId <= completedSteps ? 'completed' : 'skipped'
    }
    
    if (sessionStatus === 'analyzing') {
      // Show step as completed if it's been finished
      if (stepId <= completedSteps) return 'completed'
      
      // Show the next step (completedSteps + 1) as in_progress when analyzing
      if (stepId === completedSteps + 1) return 'in_progress'
      
      // All other steps are pending
      return 'pending'
    }
    
    return stepId <= completedSteps ? 'completed' : 'pending'
  }

  const fetchSessionData = async () => {
    try {
      console.log('Fetching session:', sessionId)
      const response = await fetch(`http://localhost:3004/session/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        console.log('Raw session data:', data)
        setSessionData(data)
        
        // Calculate step statuses
        const statuses = []
        for (let i = 1; i <= 7; i++) {
          const status = getStepStatus(data.status, data.completedSteps, i, data.criticalErrors)
          statuses.push({
            stepId: i,
            status,
            calculation: `stepId ${i} <= completedSteps ${data.completedSteps} = ${i <= data.completedSteps}`
          })
        }
        setStepStatuses(statuses)
      } else {
        console.error('Failed to fetch session:', response.status)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Debug Step Status Calculation</h1>
      
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Session ID:</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Enter session ID"
            className="border rounded px-3 py-2 flex-1"
          />
          <button
            onClick={fetchSessionData}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Fetch Session
          </button>
        </div>
      </div>

      {sessionData && (
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded">
            <h2 className="font-semibold mb-2">Raw Session Data:</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>Status: <span className="font-mono">{sessionData.status}</span></div>
              <div>Completed Steps: <span className="font-mono">{sessionData.completedSteps}</span></div>
              <div>Total Steps: <span className="font-mono">{sessionData.totalSteps}</span></div>
              <div>Critical Errors: <span className="font-mono">{sessionData.criticalErrors}</span></div>
              <div>Quality Score: <span className="font-mono">{sessionData.qualityScore}</span></div>
            </div>
          </div>

          <div className="bg-white border rounded">
            <h2 className="font-semibold p-4 border-b">Step Status Calculation Results:</h2>
            <div className="divide-y">
              {stepStatuses.map((step) => (
                <div key={step.stepId} className="p-4 flex justify-between items-center">
                  <div>
                    <span className="font-medium">Step {step.stepId}</span>
                    <div className="text-sm text-gray-600">{step.calculation}</div>
                  </div>
                  <div className={`px-3 py-1 rounded text-sm font-medium ${
                    step.status === 'completed' ? 'bg-green-100 text-green-800' :
                    step.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    step.status === 'error' ? 'bg-red-100 text-red-800' :
                    step.status === 'skipped' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {step.status}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded">
            <h2 className="font-semibold mb-2">Full Session Data (JSON):</h2>
            <pre className="text-xs overflow-auto max-h-64 bg-white p-2 border rounded">
              {JSON.stringify(sessionData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
} 