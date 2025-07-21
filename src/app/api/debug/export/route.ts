import { NextRequest, NextResponse } from 'next/server'
import { analysisLogger } from '@/lib/logger'
import { validateApiToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Authentication check for debug access
    const authResult = validateApiToken(request)
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized access to debug logs' },
        { status: 401 }
      )
    }

    const logs = analysisLogger.getAllLogs()
    const summary = analysisLogger.getLogsSummary()
    
    const exportData = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        totalSessions: logs.length,
        exportedBy: 'PropertyList Research Agent Debug Console',
        version: '1.0.0'
      },
      summary,
      logs
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    const fileName = `analysis-logs-${new Date().toISOString().split('T')[0]}.json`

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': jsonString.length.toString()
      }
    })

  } catch (error) {
    console.error('Error exporting debug logs:', error)
    return NextResponse.json(
      { error: 'Failed to export logs' },
      { status: 500 }
    )
  }
} 