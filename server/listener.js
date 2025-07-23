const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Import new optimized services
const PropertyDatabase = require('./database/postgresDatabase');
const XMLFeedService = require('./services/xmlFeedService');
const ComparableService = require('./services/comparableService');
const PropertyDataMapper = require('./services/propertyDataMapper');
const AILearningService = require('./services/aiLearningService');
const LocationIntelligenceService = require('./services/locationIntelligenceService');
const imageProxyRouter = require('./routes/imageProxy');

// Session manager with file persistence
const sessionManager = {
  sessions: new Map(),
  sessionDir: path.join(__dirname, 'data', 'sessions'),
  
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
    // First try memory
    let session = this.sessions.get(sessionId);
    
    // If not in memory, try loading from file
    if (!session) {
      session = this.loadSessionFromFile(sessionId);
      if (session) {
        this.sessions.set(sessionId, session);
      }
    }
    
    return session;
  },
  
  updateSession(sessionId, updates) {
    const session = this.sessions.get(sessionId) || this.loadSessionFromFile(sessionId);
    if (session) {
      Object.assign(session, updates);
      this.sessions.set(sessionId, session);
      this.saveSessionToFile(sessionId, session);
    }
  },
  
  saveSessionToFile(sessionId, sessionData) {
    try {
      const filePath = path.join(this.sessionDir, `${sessionId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
    } catch (error) {
      console.error(`❌ Error saving session ${sessionId}:`, error);
    }
  },
  
  loadSessionFromFile(sessionId) {
    try {
      const filePath = path.join(this.sessionDir, `${sessionId}.json`);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`❌ Error loading session ${sessionId}:`, error);
    }
    return null;
  }
};

const app = express();
const port = process.env.PORT || 3004;

// Initialize services
let propertyDatabase;
let xmlFeedService;
let comparableService;
let propertyDataMapper;
let aiLearningService;
let locationIntelligenceService;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Image proxy routes
app.use('/api', imageProxyRouter);

// Initialize database and services
async function initializeServices() {
  try {
    // Initialize property database
    propertyDatabase = new PropertyDatabase();
    await propertyDatabase.init();
    
    // Initialize AI learning service
    aiLearningService = new AILearningService(propertyDatabase);
    
    // Initialize location intelligence service
    locationIntelligenceService = new LocationIntelligenceService(propertyDatabase);
    
    // Initialize XML feed service
    xmlFeedService = new XMLFeedService(propertyDatabase);
    xmlFeedService.startCronJob();
    
    // Initialize comparable service with learning enhancement
    comparableService = new ComparableService(propertyDatabase);
    
    // Enhance AI analysis service with learning
    const AIAnalysisService = require('./services/aiAnalysisService');
    const originalAiAnalysis = comparableService.aiAnalysis;
    comparableService.aiAnalysis = new AIAnalysisService(propertyDatabase, aiLearningService);
    
    // Initialize PropertyList.es data mapper
    propertyDataMapper = new PropertyDataMapper();
    
    console.log('All services initialized successfully with AI learning enabled');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Data storage
const dataDir = path.join(__dirname, 'data');

// Ensure data directories exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Routes
app.get('/api/health', (req, res) => {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasTavily = !!process.env.TAVILY_API_KEY;
  const isDatabaseActive = propertyDatabase?.initialized || false;
  
  const status = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      propertyDatabase: isDatabaseActive,
      xmlFeedService: xmlFeedService ? true : false,
      comparableService: comparableService ? true : false,
      aiService: hasOpenAI,
      tavilyService: hasTavily
    },
    ai: {
      openai: hasOpenAI,
      tavily: hasTavily,
      status: hasOpenAI ? 'active' : 'offline'
    },
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    }
  };
  
  if (!hasOpenAI) {
    status.message = 'OpenAI API key not found - AI analysis will be disabled';
  }
  
  if (propertyDatabase?.initialized) {
    status.database = propertyDatabase.getFeedStats();
  }
  
  res.json(status);
});

app.post('/api/property', async (req, res) => {
  try {
    const propertyData = req.body;
    console.log('🏠 Property data received:', {
      reference: propertyData.reference,
      type: propertyData.property_type,
      city: propertyData.city,
      bedrooms: propertyData.bedrooms
    });

    // Transform using PropertyList.es format
    const transformedData = propertyDataMapper.transformPropertyListData(propertyData);
    
    // Enhance with location intelligence
    let locationContext = null;
    
    // Check if we have specific location data (urbanization OR street address)
    const hasUrbanization = transformedData.urbanization && transformedData.urbanization.trim().length > 0;
    const hasStreetAddress = transformedData.address && 
                           transformedData.address.includes(' ') && // Has street name + number
                           /\d/.test(transformedData.address); // Contains numbers
    
    // AI location intelligence should only be triggered when we DON'T have specific location data
    if (!hasUrbanization && !hasStreetAddress) {
      console.log('🤖 No specific location data found - triggering AI location intelligence...');
      console.log(`   - Urbanization: ${transformedData.urbanization || 'Not provided'}`);
      console.log(`   - Street address: ${transformedData.address || 'Not provided'}`);
      
      // Use city or available location info for AI analysis
      const locationInput = transformedData.suburb || transformedData.city || 'Unknown location';
      
      locationContext = await locationIntelligenceService.resolveLocationWithLogging(
        locationInput,
        { 
          city: transformedData.city,
          bedrooms: transformedData.bedrooms,
          propertyType: transformedData.property_type,
          propertyData: transformedData, // Pass full property data for description analysis
          triggerReason: 'missing_specific_location_data'
        }
      );
      
      // Enhance property data with resolved location
      transformedData.resolvedLocation = locationContext;
      console.log(`✅ AI location resolved: ${locationContext.location} (${(locationContext.confidence * 100).toFixed(1)}% confidence)`);
    } else {
      console.log('✅ Specific location data found - skipping AI location intelligence');
      console.log(`   - Using urbanization: ${transformedData.urbanization || 'N/A'}`);
      console.log(`   - Using street address: ${transformedData.address || 'N/A'}`);
    }
    
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      propertyData: transformedData,
      locationContext: locationContext,
      createdAt: new Date().toISOString(),
      status: 'ready'
    };

    // Store session
    sessionManager.createSession(sessionId, session);

    // Generate session URL for frontend
    const baseUrl = `${req.protocol}://${req.get('host').replace(':3004', ':3000')}`;
    const sessionUrl = `${baseUrl}/analysis/${sessionId}`;

    console.log('Property data received and session created:', sessionId);

    res.json({
      success: true,
      sessionId,
      sessionUrl,
      message: 'Property data received and session created successfully'
    });

  } catch (error) {
    console.error('Error creating property session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create property session'
    });
  }
});

app.post('/api/property/reference', async (req, res) => {
  try {
    const { reference } = req.body;
    
    if (!reference) {
      return res.status(400).json({
        success: false,
        error: 'Property reference is required'
      });
    }

    console.log('🔍 Fetching property by reference:', reference);

    // Fetch property from database
    const property = await propertyDatabase.getPropertyByReference(reference);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    console.log('🏠 Property found in database:', {
      reference: property.reference,
      type: property.property_type,
      city: property.city,
      bedrooms: property.bedrooms
    });

    // Transform using PropertyList.es format
    const transformedData = propertyDataMapper.transformPropertyListData(property);
    
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      propertyData: transformedData,
      createdAt: new Date().toISOString(),
      status: 'ready'
    };

    // Store session
    sessionManager.createSession(sessionId, session);

    // Generate session URL for frontend
    const baseUrl = `${req.protocol}://${req.get('host').replace(':3004', ':3000')}`;
    const sessionUrl = `${baseUrl}/analysis/${sessionId}`;

    console.log('Property session created from database:', sessionId);

    res.json({
      success: true,
      sessionId,
      sessionUrl,
      message: 'Property session created from database successfully'
    });

  } catch (error) {
    console.error('Error fetching property by reference:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch property from database'
    });
  }
});

app.get('/api/session/:sessionId', (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const sessionData = sessionManager.getSession(sessionId);
    
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      sessionData
    });

  } catch (error) {
    console.error('Error retrieving session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.post('/api/session/:sessionId/status', async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const { status, analysisResults, propertyData } = req.body;
    
    const sessionData = sessionManager.getSession(sessionId);
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Update session
    const updates = {
      status: status,
      updatedAt: new Date().toISOString()
    };
    
    if (analysisResults) {
      updates.analysisResults = analysisResults;
    }
    
    // Update property data if provided (for additional user info)
    if (propertyData) {
      // FIXED: Merge with existing property data instead of overwriting
      updates.propertyData = {
        ...sessionData.propertyData, // Preserve existing property data
        ...propertyData             // Add new fields (like additionalInfo)
      };
      console.log(`Session ${sessionId} property data updated with additional info:`, propertyData.additionalInfo || 'No additional info');
      
      // ENHANCED: Process user's additional text with AI location intelligence
      if (propertyData.additionalInfo && propertyData.additionalInfo.trim().length > 0) {
        try {
          console.log(`🤖 Processing user's additional location details: "${propertyData.additionalInfo}"`);
          
          // Run AI extraction on user's additional text
          const additionalLocationContext = await locationIntelligenceService.resolveLocationWithLogging(
            propertyData.additionalInfo,
            {
              city: sessionData.propertyData?.city,
              propertyData: sessionData.propertyData,
              userInput: true // Flag to indicate this is user-provided text
            }
          );
          
          if (additionalLocationContext && additionalLocationContext.confidence > 0.6) {
            console.log(`✅ Enhanced location found from user input: ${additionalLocationContext.location} (${(additionalLocationContext.confidence * 100).toFixed(1)}% confidence)`);
            
            // Update the session's location context with enhanced information
            if (sessionData.locationContext) {
              // Merge with existing location context, giving priority to user input
              updates.locationContext = {
                ...sessionData.locationContext,
                enhancedLocation: additionalLocationContext,
                userProvidedEnhancement: propertyData.additionalInfo,
                coordinates: additionalLocationContext.coordinates || sessionData.locationContext.coordinates,
                landmarks: additionalLocationContext.landmarks,
                proximityClues: additionalLocationContext.proximityClues,
                confidence: Math.max(sessionData.locationContext.confidence, additionalLocationContext.confidence),
                method: `${sessionData.locationContext.method} + user_input_ai`
              };
            } else {
              // Create new location context from user input
              updates.locationContext = additionalLocationContext;
            }
            
            console.log(`🎯 Session location context enhanced with user input`);
          }
        } catch (locationError) {
          console.error('❌ Error processing additional location info:', locationError);
          // Don't fail the entire request if location processing fails
        }
      }
    }

    sessionManager.updateSession(sessionId, updates);

    res.json({
      success: true,
      message: 'Session updated successfully'
    });

  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// New comparable properties endpoint
app.get('/api/comparables/:sessionId', async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    
    // Load session data
    const sessionData = sessionManager.getSession(sessionId);
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (!comparableService) {
      return res.status(503).json({
        success: false,
        error: 'Comparable service not available'
      });
    }

    // Find comparable properties
    const result = await comparableService.findComparables(sessionId, sessionData.propertyData);
    
    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Error finding comparable properties:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// PDF Generation endpoint
app.post('/api/generate-pdf/:sessionId', async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    console.log(`PDF generation requested for session: ${sessionId}`);

    // Get session data
    const sessionData = sessionManager.getSession(sessionId);
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Get analysis data
    const analysisData = await comparableService.findComparables(sessionId, sessionData.propertyData);
    
    // Generate PDF
    const PDFGenerationService = require('./services/pdfGenerationService');
    const pdfService = new PDFGenerationService();
    
    const pdfResult = await pdfService.generatePropertyReport(
      sessionId,
      sessionData.propertyData,
      analysisData
    );

    if (pdfResult.success) {
      res.json({
        success: true,
        filename: pdfResult.filename,
        downloadUrl: `/api/download-pdf/${encodeURIComponent(pdfResult.filename)}`,
        size: pdfResult.size,
        timestamp: pdfResult.timestamp
      });
    } else {
      res.status(500).json({
        success: false,
        error: pdfResult.error
      });
    }

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF report'
    });
  }
});

// PDF Download endpoint
app.get('/api/download-pdf/:filename', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const path = require('path');
    const fs = require('fs');
    
    const filepath = path.join(__dirname, '../reports', filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: 'PDF file not found'
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download PDF'
    });
  }
});

// XML Feed management endpoints
app.post('/api/admin/feed/update', async (req, res) => {
  try {
    if (!xmlFeedService) {
      return res.status(503).json({
        success: false,
        error: 'XML feed service not available'
      });
    }

    const result = await xmlFeedService.forceUpdate();
    
    res.json({
      success: true,
      message: 'Feed update completed',
      ...result
    });

  } catch (error) {
    console.error('Error updating XML feed:', error);
    res.status(500).json({
      success: false,
      error: 'Feed update failed',
      message: error.message
    });
  }
});

app.get('/api/admin/feed/status', (req, res) => {
  try {
    const status = {
      xmlFeedService: xmlFeedService ? xmlFeedService.getStatus() : null,
      database: propertyDatabase ? propertyDatabase.getFeedStats() : null,
      cache: comparableService ? comparableService.getCacheStats() : null
    };

    res.json({
      success: true,
      status
    });

  } catch (error) {
    console.error('Error getting feed status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Cache management endpoint
app.post('/api/admin/cache/clean', (req, res) => {
  try {
    if (comparableService) {
      const cleanedCount = comparableService.cleanCache();
      res.json({
        success: true,
        message: `Cleaned ${cleanedCount} expired cache entries`
      });
    } else {
      res.status(503).json({
        success: false,
        error: 'Cache service not available'
      });
    }
  } catch (error) {
    console.error('Error cleaning cache:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Location intelligence metrics endpoint
app.get('/api/admin/location/metrics', (req, res) => {
  try {
    if (!locationIntelligenceService) {
      return res.status(503).json({
        success: false,
        error: 'Location intelligence service not available'
      });
    }

    const metrics = locationIntelligenceService.getMetrics();
    res.json({
      success: true,
      metrics: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting location metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Location resolution endpoint
app.post('/api/resolve-location', async (req, res) => {
  try {
    const { location, propertyContext } = req.body;
    
    if (!location) {
      return res.status(400).json({
        success: false,
        error: 'Location is required'
      });
    }

    console.log(`🔍 Location resolution request: "${location}"`);
    
    const result = await locationIntelligenceService.resolveLocationWithLogging(location, propertyContext);
    
    console.log(`✅ Location resolved: ${result.location} (${result.confidence * 100}% confidence via ${result.method})`);
    
    res.json({
      success: true,
      result: result,
      metrics: locationIntelligenceService.getMetrics()
    });
  } catch (error) {
    console.error('❌ Location resolution error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Location learning analytics endpoint
app.get('/api/admin/location/analytics', async (req, res) => {
  try {
    if (!locationIntelligenceService) {
      return res.status(503).json({
        success: false,
        error: 'Location intelligence service not available'
      });
    }

    const days = parseInt(req.query.days) || 30;
    const analytics = await locationIntelligenceService.getLearningAnalytics(days);
    
    res.json({
      success: true,
      analytics: analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting location analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Feedback endpoint for AI learning
app.post('/api/feedback', async (req, res) => {
  try {
    const { sessionId, stepId, helpful, propertyReference } = req.body;
    
    // Validation
    if (!sessionId || !stepId || helpful === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId, stepId, helpful'
      });
    }

    if (!['market', 'comparables', 'insights', 'report'].includes(stepId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid stepId. Must be one of: market, comparables, insights, report'
      });
    }

    // Get session data for property context
    const sessionData = sessionManager.getSession(sessionId);
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Process feedback through AI learning service
    const result = await aiLearningService.processFeedback(
      sessionId,
      stepId,
      helpful,
      sessionData.propertyData
    );
    
    console.log(`📊 Feedback processed: ${sessionId} - ${stepId} - ${helpful ? '👍' : '👎'}`);
    
    res.json({
      success: true,
      message: 'Feedback recorded and processed',
      learningUpdate: result
    });

  } catch (error) {
    console.error('Error processing feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process feedback'
    });
  }
});

// Learning analytics endpoint for admin dashboard
app.get('/api/admin/learning/stats', async (req, res) => {
  try {
    if (!aiLearningService) {
      return res.status(503).json({
        success: false,
        error: 'AI learning service not available'
      });
    }

    const stats = await aiLearningService.getLearningStats();
    
    res.json({
      success: true,
      ...stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting learning stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get learning statistics'
    });
  }
});

// Learning insights endpoint for specific area
app.get('/api/admin/learning/insights/:area', async (req, res) => {
  try {
    const { area } = req.params;
    
    if (!aiLearningService) {
      return res.status(503).json({
        success: false,
        error: 'AI learning service not available'
      });
    }

    const insights = await aiLearningService.getAreaLearningInsights(area);
    const feedbackPatterns = await aiLearningService.getFeedbackPatterns(area);
    const optimizedWeights = aiLearningService.getOptimizedWeights(area);
    
    res.json({
      success: true,
      area,
      insights,
      feedbackPatterns,
      optimizedWeights,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting area insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get area insights'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  
  if (propertyDatabase) {
    propertyDatabase.close();
  }
  
  process.exit(0);
});

// Start server
async function startServer() {
  // Initialize session manager
  sessionManager.init();
  
  await initializeServices();
  
  app.listen(port, () => {
    console.log(`AI Property Research Agent listener running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/api/health`);
    console.log(`Admin panel: http://localhost:${port}/api/admin/feed/status`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 