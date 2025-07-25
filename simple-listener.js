const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const app = express();
const port = process.env.PORT || 3004;

// Session manager with file persistence
const sessionManager = {
  sessions: new Map(),
  sessionDir: path.join(__dirname, 'server', 'data', 'sessions'),
  
  // Ensure session directory exists
  init() {
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
  },
  
  createSession(sessionId, sessionData) {
    this.sessions.set(sessionId, sessionData);
    this.saveSessionToFile(sessionId, sessionData);
    console.log(`✅ Session created and saved: ${sessionId}`);
  },
  
  getSession(sessionId) {
    // Try to get from memory first
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }
    
    // Try to load from file
    try {
      const sessionData = this.loadSessionFromFile(sessionId);
      if (sessionData) {
        this.sessions.set(sessionId, sessionData);
        return sessionData;
      }
    } catch (error) {
      console.error(`❌ Error loading session ${sessionId}:`, error);
    }
    
    return null;
  },
  
  updateSession(sessionId, updates) {
    const session = this.getSession(sessionId);
    if (session) {
      const updatedSession = { ...session, ...updates };
      this.sessions.set(sessionId, updatedSession);
      this.saveSessionToFile(sessionId, updatedSession);
      return updatedSession;
    }
    return null;
  },
  
  saveSessionToFile(sessionId, sessionData) {
    try {
      const filepath = path.join(this.sessionDir, `${sessionId}.json`);
      fs.writeFileSync(filepath, JSON.stringify(sessionData, null, 2));
    } catch (error) {
      console.error(`❌ Error saving session ${sessionId}:`, error);
    }
  },
  
  loadSessionFromFile(sessionId) {
    try {
      const filepath = path.join(this.sessionDir, `${sessionId}.json`);
      if (fs.existsSync(filepath)) {
        const data = fs.readFileSync(filepath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`❌ Error loading session file ${sessionId}:`, error);
    }
    return null;
  }
};

// Initialize session manager
sessionManager.init();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Add explicit UTF-8 encoding support for Spanish characters
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Health check endpoint - Enhanced to match SystemStatus expectations
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', // SystemStatus expects 'healthy', not 'ok'
    timestamp: new Date().toISOString(),
    message: 'AI Property Research Agent listener is running',
    services: {
      propertyDatabase: true, // Mark database as active for simplified mode
      aiService: true         // Mark AI service as active for simplified mode
    },
    ai: {
      status: 'active'        // AI status expected by SystemStatus
    }
  });
});

// Create session endpoint
app.post('/api/property', async (req, res) => {
  try {
    console.log('📦 Received property data for new session...');
    
    const propertyData = req.body;
    console.log(`🏠 Property: ${propertyData.reference || 'Unknown'}`);
    
    // Create new session
    const sessionId = uuidv4();
    const sessionData = {
      sessionId: sessionId,
      createdAt: new Date().toISOString(),
      property: propertyData,
      status: 'ready',
      steps: {
        market: { status: 'pending' },
        comparables: { status: 'pending' },
        insights: { status: 'pending' },
        report: { status: 'pending' }
      }
    };
    
    sessionManager.createSession(sessionId, sessionData);
    
    // Return success response with session info
    const baseUrl = `${req.protocol}://${req.get('host').replace(':3004', ':3000')}`;
    const agentUrl = `${baseUrl}/analysis/${sessionId}`;
    
    console.log(`✅ Session created: ${sessionId}`);
    console.log(`🔗 Analysis URL: ${agentUrl}`);
    
    res.json({
      success: true,
      sessionId: sessionId,
      agentUrl: agentUrl,
      message: 'Property session created successfully'
    });
    
  } catch (error) {
    console.error('❌ Error creating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create property session'
    });
  }
});

// Get session data endpoint - FIXED to match frontend expectations
app.get('/api/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log(`📋 Getting session data for: ${sessionId}`);
    
    const sessionData = sessionManager.getSession(sessionId);
    
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    // Fix the data structure to match what the frontend expects
    const responseData = {
      sessionId: sessionData.sessionId,
      createdAt: sessionData.createdAt,
      propertyData: sessionData.property, // Frontend expects propertyData, not property
      status: sessionData.status,
      steps: sessionData.steps,
      analysisResults: sessionData.analysisResults,
      freshAnalysisResults: sessionData.freshAnalysisResults,
      pdfReport: sessionData.pdfReport
    };
    
    res.json({
      success: true,
      sessionData: responseData // Frontend expects sessionData wrapper
    });
    
  } catch (error) {
    console.error('❌ Error getting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session data'
    });
  }
});

// Update session step endpoint
app.post('/api/session/:sessionId/step/:stepId', async (req, res) => {
  try {
    const { sessionId, stepId } = req.params;
    const stepData = req.body;
    
    console.log(`📝 Updating session ${sessionId}, step: ${stepId}`);
    
    if (!['market', 'comparables', 'insights', 'report'].includes(stepId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid stepId. Must be one of: market, comparables, insights, report'
      });
    }
    
    const sessionData = sessionManager.getSession(sessionId);
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    // Update step data
    sessionData.steps[stepId] = {
      ...sessionData.steps[stepId],
      ...stepData,
      updatedAt: new Date().toISOString()
    };
    
    const updatedSession = sessionManager.updateSession(sessionId, sessionData);
    
    res.json({
      success: true,
      session: updatedSession
    });
    
  } catch (error) {
    console.error('❌ Error updating session step:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update session step'
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Simple AI Property Research Agent listener running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/api/health`);
  console.log(`📁 Session directory: ${sessionManager.sessionDir}`);
}); 