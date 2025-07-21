interface AnalysisLog {
  id: string
  timestamp: string
  sessionStart: string
  sessionEnd?: string
  duration?: number
  clientIP: string
  userAgent: string
  input: {
    propertyData: any
    requestHeaders: Record<string, string>
  }
  steps: AnalysisStep[]
  output?: {
    cmaReport: any
    success: boolean
    error?: string
  }
  apiCalls: ApiCall[]
  systemStatus: {
    memory: any
    performance: any
  }
}

interface AnalysisStep {
  stepNumber: number
  stepName: string
  startTime: string
  endTime?: string
  duration?: number
  status: 'started' | 'completed' | 'failed' | 'skipped'
  details: any
  error?: string
}

interface ApiCall {
  timestamp: string
  service: string
  endpoint: string
  method: string
  requestData?: any
  responseData?: any
  responseTime: number
  status: 'success' | 'error' | 'timeout'
  error?: string
  headers?: Record<string, string>
}

// In-memory storage for logs (in production, use a database or file system)
class AnalysisLogger {
  private logs: Map<string, AnalysisLog> = new Map()
  private maxLogs = 100 // Keep last 100 sessions
  private loggerId = Math.random().toString(36).substring(7)

  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  startSession(sessionId: string, propertyData: any, request: any): void {
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'
    
    const userAgent = request.headers.get('user-agent') || 'unknown'
    
    // Extract safe headers (exclude authorization)
    const safeHeaders: Record<string, string> = {}
    for (const [key, value] of request.headers.entries()) {
      if (!key.toLowerCase().includes('authorization') && 
          !key.toLowerCase().includes('token') &&
          !key.toLowerCase().includes('key')) {
        safeHeaders[key] = value || ''
      }
    }

    const log: AnalysisLog = {
      id: sessionId,
      timestamp: new Date().toISOString(),
      sessionStart: new Date().toISOString(),
      clientIP,
      userAgent,
      input: {
        propertyData,
        requestHeaders: safeHeaders
      },
      steps: [],
      apiCalls: [],
      systemStatus: {
        memory: this.getMemoryUsage(),
        performance: this.getPerformanceMetrics()
      }
    }

    this.logs.set(sessionId, log)
    console.log(`✅ Session ${sessionId} started. Logger has ${this.logs.size} sessions`)
    this.cleanupOldLogs()
  }

  addStep(sessionId: string, stepNumber: number, stepName: string, details?: any): void {
    const log = this.logs.get(sessionId)
    if (!log) return

    const step: AnalysisStep = {
      stepNumber,
      stepName,
      startTime: new Date().toISOString(),
      status: 'started',
      details: details || {}
    }

    log.steps.push(step)
  }

  completeStep(sessionId: string, stepNumber: number, details?: any, error?: string): void {
    const log = this.logs.get(sessionId)
    if (!log) return

    const step = log.steps.find(s => s.stepNumber === stepNumber)
    if (!step) return

    step.endTime = new Date().toISOString()
    step.duration = new Date(step.endTime).getTime() - new Date(step.startTime).getTime()
    step.status = error ? 'failed' : 'completed'
    step.details = { ...step.details, ...details }
    if (error) step.error = error
  }

  logApiCall(sessionId: string, service: string, endpoint: string, data: {
    method: string
    requestData?: any
    responseData?: any
    responseTime: number
    status: 'success' | 'error' | 'timeout'
    error?: string
    headers?: Record<string, string>
  }): void {
    const log = this.logs.get(sessionId)
    if (!log) return

    const apiCall: ApiCall = {
      timestamp: new Date().toISOString(),
      service,
      endpoint,
      ...data
    }

    log.apiCalls.push(apiCall)
  }

  completeSession(sessionId: string, output: any, success: boolean, error?: string): void {
    const log = this.logs.get(sessionId)
    if (!log) return

    log.sessionEnd = new Date().toISOString()
    log.duration = new Date(log.sessionEnd).getTime() - new Date(log.sessionStart).getTime()
    log.output = {
      cmaReport: output,
      success,
      error
    }
  }

  getAllLogs(): AnalysisLog[] {
    const logs = Array.from(this.logs.values()).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    console.log(`📊 Dashboard fetched ${logs.length} analysis sessions`)
    return logs
  }

  getLog(sessionId: string): AnalysisLog | undefined {
    return this.logs.get(sessionId)
  }

  getLogsSummary() {
    const logs = this.getAllLogs()
    const totalSessions = logs.length
    const successfulSessions = logs.filter(l => l.output?.success).length
    const failedSessions = logs.filter(l => l.output?.success === false).length
    const avgDuration = logs
      .filter(l => l.duration)
      .reduce((sum, l) => sum + (l.duration || 0), 0) / totalSessions

    const apiCallStats = logs.flatMap(l => l.apiCalls).reduce((stats, call) => {
      if (!stats[call.service]) {
        stats[call.service] = { total: 0, success: 0, error: 0, avgResponseTime: 0 }
      }
      stats[call.service].total++
      if (call.status === 'success') stats[call.service].success++
      if (call.status === 'error') stats[call.service].error++
      stats[call.service].avgResponseTime += call.responseTime
      return stats
    }, {} as Record<string, any>)

    // Calculate averages
    Object.keys(apiCallStats).forEach(service => {
      apiCallStats[service].avgResponseTime = 
        apiCallStats[service].avgResponseTime / apiCallStats[service].total
    })

    return {
      totalSessions,
      successfulSessions,
      failedSessions,
      successRate: totalSessions > 0 ? (successfulSessions / totalSessions * 100).toFixed(2) + '%' : '0%',
      avgDuration: Math.round(avgDuration),
      apiCallStats,
      lastSession: logs[0]?.timestamp,
      memoryUsage: this.getMemoryUsage(),
      performance: this.getPerformanceMetrics()
    }
  }

  private cleanupOldLogs(): void {
    if (this.logs.size > this.maxLogs) {
      const sortedLogs = Array.from(this.logs.entries())
        .sort(([,a], [,b]) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      
      // Keep only the most recent logs
      const logsToKeep = sortedLogs.slice(0, this.maxLogs)
      this.logs.clear()
      logsToKeep.forEach(([id, log]) => this.logs.set(id, log))
    }
  }

  private getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return {
        rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
        external: Math.round(usage.external / 1024 / 1024) + ' MB'
      }
    }
    return { error: 'Memory usage not available' }
  }

  private getPerformanceMetrics() {
    if (typeof process !== 'undefined' && process.uptime) {
      return {
        uptime: process.uptime() + ' seconds',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    }
    return { error: 'Performance metrics not available' }
  }

  clearLogs(): void {
    this.logs.clear()
  }

  exportLogs(): string {
    return JSON.stringify(this.getAllLogs(), null, 2)
  }
}

// Singleton instance
export const analysisLogger = new AnalysisLogger()

// Helper function to safely stringify objects with circular references
export function safeStringify(obj: any): string {
  const seen = new Set()
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]'
      }
      seen.add(value)
    }
    return value
  }, 2)
} 