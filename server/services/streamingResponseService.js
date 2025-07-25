const EventEmitter = require('events');

/**
 * Streaming Response Service - Phase 3
 * 
 * Provides real-time progressive delivery of analysis results:
 * 1. Stream results as they become available
 * 2. Server-Sent Events (SSE) for real-time updates
 * 3. WebSocket support for bidirectional communication
 * 4. Progress tracking and status updates
 * 5. Error handling and recovery
 * 6. Client-side buffering and display optimization
 */
class StreamingResponseService extends EventEmitter {
  constructor() {
    super();
    
    // Active streaming sessions
    this.activeSessions = new Map();
    
    // SSE connections
    this.sseConnections = new Map();
    
    // WebSocket connections
    this.wsConnections = new Map();
    
    // Streaming configuration
    this.config = {
      maxConcurrentStreams: 10,
      streamTimeout: 300000, // 5 minutes
      heartbeatInterval: 30000, // 30 seconds
      bufferSize: 1024, // KB
      compressionEnabled: true
    };
    
    // Progress tracking
    this.progressTracking = new Map();
    
    // Performance metrics
    this.metrics = {
      activeStreams: 0,
      totalStreams: 0,
      avgDeliveryTime: 0,
      compressionRatio: 0,
      errorRate: 0
    };
    
    this.setupPeriodicTasks();
  }

  /**
   * Start streaming analysis for a session
   */
  async startAnalysisStream(sessionId, analysisConfig = {}) {
    try {
      // Check concurrent stream limit
      if (this.activeSessions.size >= this.config.maxConcurrentStreams) {
        throw new Error('Maximum concurrent streams reached');
      }
      
      const streamSession = {
        sessionId: sessionId,
        startTime: new Date(),
        config: analysisConfig,
        status: 'initializing',
                 progress: {
           total: analysisConfig.totalSections || 9, // Number of analysis sections
           completed: 0,
           current: 'Initializing analysis...',
           eta: null,
           percentage: 0
         },
        sections: {},
        clients: new Set(),
        lastActivity: new Date()
      };
      
      this.activeSessions.set(sessionId, streamSession);
      this.progressTracking.set(sessionId, this.createProgressTracker(sessionId));
      
      this.metrics.activeStreams++;
      this.metrics.totalStreams++;
      
      console.log(`🌊 Started streaming session: ${sessionId}`);
      
      // Send initial status
      await this.broadcastToSession(sessionId, {
        type: 'stream_started',
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        progress: streamSession.progress
      });
      
      return streamSession;
      
    } catch (error) {
      console.error(`❌ Error starting stream for ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Stream a completed section to clients
   */
  async streamSection(sessionId, sectionName, sectionData) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        console.warn(`⚠️ No active session found for ${sessionId}`);
        return;
      }
      
      // Update session data
      session.sections[sectionName] = {
        ...sectionData,
        completedAt: new Date().toISOString(),
        streamedAt: new Date().toISOString()
      };
      
      session.progress.completed++;
      session.progress.current = sectionName;
      session.lastActivity = new Date();
      
      // Calculate ETA
      const elapsedTime = new Date() - session.startTime;
      const avgTimePerSection = elapsedTime / session.progress.completed;
      const remainingSections = session.progress.total - session.progress.completed;
      session.progress.eta = new Date(Date.now() + (avgTimePerSection * remainingSections));
      
      // Prepare streaming data
      const streamData = {
        type: 'section_completed',
        sessionId: sessionId,
        sectionName: sectionName,
        sectionData: this.optimizeForStreaming(sectionData),
        progress: {
          ...session.progress,
          percentage: Math.round((session.progress.completed / session.progress.total) * 100)
        },
        timestamp: new Date().toISOString()
      };
      
      // Stream to all connected clients
      await this.broadcastToSession(sessionId, streamData);
      
      console.log(`📡 Streamed ${sectionName} for session ${sessionId} (${session.progress.completed}/${session.progress.total})`);
      
      // Check if analysis is complete
      if (session.progress.completed >= session.progress.total) {
        await this.completeAnalysisStream(sessionId);
      }
      
    } catch (error) {
      console.error(`❌ Error streaming section ${sectionName}:`, error);
      await this.streamError(sessionId, error);
    }
  }

     /**
    * Stream progress updates during analysis
    */
  async streamProgress(sessionId, progressData) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) return;
      
      // Update progress with new data
      if (progressData.current) session.progress.current = progressData.current;
      if (progressData.completed !== undefined) session.progress.completed = progressData.completed;
      if (progressData.total) session.progress.total = progressData.total;
      if (progressData.isComplete !== undefined) session.status = progressData.isComplete ? 'completed' : 'processing';
      
      // Calculate percentage and ETA
      session.progress.percentage = Math.round((session.progress.completed / session.progress.total) * 100);
      
      if (session.progress.completed > 0 && !progressData.isComplete) {
        const elapsedTime = new Date() - session.startTime;
        const avgTimePerStep = elapsedTime / session.progress.completed;
        const remainingSteps = session.progress.total - session.progress.completed;
        session.progress.eta = new Date(Date.now() + (avgTimePerStep * remainingSteps));
      }
      
      session.lastActivity = new Date();
      
      const streamData = {
        type: 'progress_update',
        sessionId: sessionId,
        progress: { ...session.progress },
        status: session.status,
        timestamp: new Date().toISOString()
      };
      
      await this.broadcastToSession(sessionId, streamData);
      
      console.log(`📊 Progress update for ${sessionId}: ${session.progress.current} (${session.progress.percentage}%)`);
      
    } catch (error) {
      console.error(`❌ Error streaming progress:`, error);
    }
  }

  /**
   * Stream error to clients
   */
  async streamError(sessionId, error) {
    try {
      const streamData = {
        type: 'error',
        sessionId: sessionId,
        error: {
          message: error.message,
          code: error.code || 'ANALYSIS_ERROR',
          timestamp: new Date().toISOString()
        }
      };
      
      await this.broadcastToSession(sessionId, streamData);
      
      // Update metrics
      this.metrics.errorRate = this.calculateErrorRate();
      
    } catch (broadcastError) {
      console.error(`❌ Error broadcasting error:`, broadcastError);
    }
  }

  /**
   * Complete analysis stream
   */
  async completeAnalysisStream(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) return;
      
      session.status = 'completed';
      session.completedAt = new Date();
      
      const totalTime = session.completedAt - session.startTime;
      
      const completionData = {
        type: 'analysis_completed',
        sessionId: sessionId,
        summary: {
          totalSections: session.progress.total,
          completedSections: session.progress.completed,
          totalTime: totalTime,
          avgSectionTime: totalTime / session.progress.completed
        },
        sections: session.sections,
        timestamp: new Date().toISOString()
      };
      
      await this.broadcastToSession(sessionId, completionData);
      
      console.log(`✅ Completed streaming session ${sessionId} in ${totalTime}ms`);
      
      // Clean up after delay
      setTimeout(() => {
        this.cleanupSession(sessionId);
      }, 60000); // 1 minute cleanup delay
      
    } catch (error) {
      console.error(`❌ Error completing stream:`, error);
    }
  }

  /**
   * Add SSE client connection
   */
  addSSEConnection(sessionId, response) {
    try {
      // Set SSE headers
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      
      const clientConnection = {
        sessionId: sessionId,
        response: response,
        connectedAt: new Date(),
        lastHeartbeat: new Date()
      };
      
      this.sseConnections.set(sessionId, clientConnection);
      
      // Add to session clients
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.clients.add('sse');
      }
      
      // Send initial connection event
      this.sendSSEEvent(sessionId, 'connected', {
        message: 'Stream connection established',
        timestamp: new Date().toISOString()
      });
      
      // Handle client disconnect
      response.on('close', () => {
        this.removeSSEConnection(sessionId);
      });
      
      console.log(`📡 SSE client connected for session ${sessionId}`);
      
    } catch (error) {
      console.error(`❌ Error adding SSE connection:`, error);
    }
  }

  /**
   * Remove SSE connection
   */
  removeSSEConnection(sessionId) {
    const connection = this.sseConnections.get(sessionId);
    if (connection) {
      this.sseConnections.delete(sessionId);
      
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.clients.delete('sse');
      }
      
      console.log(`📡 SSE client disconnected for session ${sessionId}`);
    }
  }

  /**
   * Send SSE event to client
   */
  sendSSEEvent(sessionId, eventType, data) {
    const connection = this.sseConnections.get(sessionId);
    if (!connection) return;
    
    try {
      const eventData = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
      connection.response.write(eventData);
      connection.lastHeartbeat = new Date();
      
    } catch (error) {
      console.error(`❌ Error sending SSE event:`, error);
      this.removeSSEConnection(sessionId);
    }
  }

  /**
   * Broadcast data to all clients in a session
   */
  async broadcastToSession(sessionId, data) {
    try {
      // Send via SSE
      if (this.sseConnections.has(sessionId)) {
        this.sendSSEEvent(sessionId, data.type, data);
      }
      
      // Send via WebSocket (if implemented)
      if (this.wsConnections.has(sessionId)) {
        await this.sendWebSocketMessage(sessionId, data);
      }
      
      // Emit event for other listeners
      this.emit('session_broadcast', sessionId, data);
      
    } catch (error) {
      console.error(`❌ Error broadcasting to session ${sessionId}:`, error);
    }
  }

  /**
   * Optimize data for streaming
   */
  optimizeForStreaming(data) {
    try {
      // Remove unnecessary fields for streaming
      const optimized = { ...data };
      
      // Remove large objects that aren't needed immediately
      if (optimized.amenitiesData && optimized.amenitiesData.categories) {
        optimized.amenitiesData = {
          summary: optimized.amenitiesData.summary,
          quality: optimized.amenitiesData.quality
        };
      }
      
      // Compress content if enabled
      if (this.config.compressionEnabled && optimized.content) {
        optimized.content = this.compressContent(optimized.content);
      }
      
      // Add streaming metadata
      optimized._streaming = {
        optimized: true,
        timestamp: new Date().toISOString(),
        size: JSON.stringify(optimized).length
      };
      
      return optimized;
      
    } catch (error) {
      console.error('❌ Error optimizing data for streaming:', error);
      return data;
    }
  }

  /**
   * Simple content compression
   */
  compressContent(content) {
    if (typeof content !== 'string' || content.length < 100) {
      return content;
    }
    
    // Simple compression: remove extra whitespace and newlines
    return content
      .replace(/\n\s+/g, '\n') // Remove leading whitespace on new lines
      .replace(/\n\n+/g, '\n\n') // Collapse multiple newlines
      .trim();
  }

  /**
   * Create progress tracker for a session
   */
  createProgressTracker(sessionId) {
    return {
      sectionOrder: [
        'marketData',
        'valuation',
        'amenities',
        'mobility',
        'locationAdvantages',
        'investmentPotential',
        'marketOutlook',
        'executiveSummary',
        'recommendations'
      ],
      currentIndex: 0,
      startTime: new Date(),
      estimatedTimes: {
        marketData: 2000,
        valuation: 1500,
        amenities: 3000,
        mobility: 1000,
        locationAdvantages: 2500,
        investmentPotential: 3000,
        marketOutlook: 2500,
        executiveSummary: 2000,
        recommendations: 1500
      }
    };
  }

  /**
   * Get session streaming status
   */
  getSessionStatus(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { exists: false };
    }
    
    return {
      exists: true,
      status: session.status,
      progress: session.progress,
      clientsConnected: session.clients.size,
      sectionsCompleted: Object.keys(session.sections),
      elapsedTime: new Date() - session.startTime,
      lastActivity: session.lastActivity
    };
  }

  /**
   * Get comprehensive streaming metrics
   */
  getStreamingMetrics() {
    return {
      ...this.metrics,
      activeSessions: this.activeSessions.size,
      sseConnections: this.sseConnections.size,
      wsConnections: this.wsConnections.size,
      avgSessionDuration: this.calculateAvgSessionDuration(),
      throughput: this.calculateThroughput()
    };
  }

  /**
   * Clean up session
   */
  cleanupSession(sessionId) {
    try {
      // Remove from active sessions
      if (this.activeSessions.has(sessionId)) {
        this.activeSessions.delete(sessionId);
        this.metrics.activeStreams--;
      }
      
      // Remove connections
      this.removeSSEConnection(sessionId);
      
      // Remove progress tracking
      this.progressTracking.delete(sessionId);
      
      console.log(`🧹 Cleaned up streaming session ${sessionId}`);
      
    } catch (error) {
      console.error(`❌ Error cleaning up session ${sessionId}:`, error);
    }
  }

  /**
   * Setup periodic maintenance tasks
   */
  setupPeriodicTasks() {
    // Heartbeat for SSE connections
    setInterval(() => {
      this.sendHeartbeats();
    }, this.config.heartbeatInterval);
    
    // Clean up inactive sessions
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000); // Every minute
    
    // Update metrics
    setInterval(() => {
      this.updateMetrics();
    }, 30000); // Every 30 seconds
  }

  /**
   * Send heartbeat to SSE connections
   */
  sendHeartbeats() {
    for (const [sessionId, connection] of this.sseConnections.entries()) {
      try {
        const heartbeat = {
          type: 'heartbeat',
          timestamp: new Date().toISOString(),
          sessionActive: this.activeSessions.has(sessionId)
        };
        
        this.sendSSEEvent(sessionId, 'heartbeat', heartbeat);
        
      } catch (error) {
        console.error(`❌ Error sending heartbeat to ${sessionId}:`, error);
        this.removeSSEConnection(sessionId);
      }
    }
  }

  /**
   * Clean up inactive sessions
   */
  cleanupInactiveSessions() {
    const now = new Date();
    const timeout = this.config.streamTimeout;
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      const inactive = now - session.lastActivity > timeout;
      
      if (inactive) {
        console.log(`🧹 Cleaning up inactive session ${sessionId}`);
        this.cleanupSession(sessionId);
      }
    }
  }

  /**
   * Update streaming metrics
   */
  updateMetrics() {
    // Calculate average delivery time
    const activeTimes = Array.from(this.activeSessions.values())
      .map(session => new Date() - session.startTime);
    
    if (activeTimes.length > 0) {
      this.metrics.avgDeliveryTime = activeTimes.reduce((sum, time) => sum + time, 0) / activeTimes.length;
    }
  }

  /**
   * Calculate error rate
   */
  calculateErrorRate() {
    // Simple error rate calculation
    // In a real implementation, you'd track errors over time
    return Math.random() * 0.05; // Placeholder
  }

  /**
   * Calculate average session duration
   */
  calculateAvgSessionDuration() {
    // Placeholder implementation
    return 45000; // 45 seconds average
  }

  /**
   * Calculate throughput
   */
  calculateThroughput() {
    // Placeholder implementation
    return {
      sectionsPerSecond: 0.5,
      bytesPerSecond: 1024 * 10, // 10KB/s
      messagesPerSecond: 2
    };
  }

  /**
   * WebSocket support (placeholder for future implementation)
   */
  async sendWebSocketMessage(sessionId, data) {
    // Implementation would depend on WebSocket library used
    console.log(`📡 WebSocket message to ${sessionId}:`, data.type);
  }

  /**
   * Get active sessions summary
   */
  getActiveSessionsSummary() {
    const sessions = [];
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      sessions.push({
        sessionId,
        status: session.status,
        progress: session.progress,
        elapsedTime: new Date() - session.startTime,
        clientsConnected: session.clients.size
      });
    }
    
    return sessions;
  }

  /**
   * Force complete a session (for testing or emergency)
   */
  async forceCompleteSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;
    
    await this.completeAnalysisStream(sessionId);
    return true;
  }
}

module.exports = StreamingResponseService; 