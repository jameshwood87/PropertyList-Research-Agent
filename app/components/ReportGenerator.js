'use client'

import { useState } from 'react'

export default function ReportGenerator({ sessionId, propertyData, analysisData, setLoading }) {
  const [reportOptions, setReportOptions] = useState({
    includeImages: true,
    includeComparables: true,
    includeMarketAnalysis: true,
    includeRecommendations: true
  })

  const handleGenerateReport = async () => {
    try {
      setLoading(true)
      
      // Simulate report generation
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // Create report data
      const reportData = {
        sessionId,
        propertyData,
        analysisData,
        reportOptions,
        generatedAt: new Date().toISOString(),
        reportId: `REP_${Date.now()}`
      }
      
      // Update session with report data
      await fetch(`http://localhost:3004/api/session/${sessionId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'report_generated',
          data: reportData
        })
      })
      
      // In a real implementation, this would generate and download a PDF
      // For now, we'll create a downloadable JSON report
      const reportBlob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: 'application/json'
      })
      
      const url = window.URL.createObjectURL(reportBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Property_Report_${propertyData.reference}_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      alert('Report generated successfully!')
      
    } catch (error) {
      console.error('Report generation error:', error)
      alert('Error generating report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const canGenerateReport = propertyData && (analysisData?.type === 'market' || analysisData?.type === 'comparables')

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Generate Report</h3>
        <p className="text-sm text-gray-600 mb-4">
          Create a comprehensive property analysis report for printing or sharing.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Report Options</h4>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={reportOptions.includeImages}
                onChange={(e) => setReportOptions(prev => ({
                  ...prev,
                  includeImages: e.target.checked
                }))}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include property images</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={reportOptions.includeComparables}
                onChange={(e) => setReportOptions(prev => ({
                  ...prev,
                  includeComparables: e.target.checked
                }))}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include comparables analysis</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={reportOptions.includeMarketAnalysis}
                onChange={(e) => setReportOptions(prev => ({
                  ...prev,
                  includeMarketAnalysis: e.target.checked
                }))}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include market analysis</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={reportOptions.includeRecommendations}
                onChange={(e) => setReportOptions(prev => ({
                  ...prev,
                  includeRecommendations: e.target.checked
                }))}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include recommendations</span>
            </label>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6zm2 2a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-purple-800">Report Contents</h3>
              <div className="mt-2 text-sm text-purple-700">
                <p>Your report will include:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Property details and specifications</li>
                  <li>Market analysis and valuation</li>
                  <li>Comparable properties analysis</li>
                  <li>Investment recommendations</li>
                  <li>Printable format for professional use</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {!canGenerateReport && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Analysis Required</h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Please complete a market analysis or comparables analysis first to generate a comprehensive report.
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleGenerateReport}
          disabled={!canGenerateReport}
          className={`w-full ${
            canGenerateReport 
              ? 'btn-primary' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed font-medium py-2 px-4 rounded-lg'
          }`}
        >
          {canGenerateReport ? 'Generate Report' : 'Complete Analysis First'}
        </button>
      </div>
    </div>
  )
} 