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
const imageProxyRouter = require('./routes/imageProxy');

const app = express();
const port = process.env.PORT || 3004;

// Initialize services
let propertyDatabase;
let xmlFeedService;
let comparableService;
let propertyDataMapper;

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
    
    // Initialize XML feed service
    xmlFeedService = new XMLFeedService(propertyDatabase);
    xmlFeedService.startCronJob();
    
    // Initialize comparable service
    comparableService = new ComparableService(propertyDatabase);
    
    // Initialize PropertyList.es data mapper
    propertyDataMapper = new PropertyDataMapper();
    
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Data storage
const dataDir = path.join(__dirname, 'data');
const sessionsDir = path.join(dataDir, 'sessions');

// Ensure data directories exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

// Helper functions
function saveSession(sessionId, sessionData) {
  const filePath = path.join(sessionsDir, `${sessionId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
}

function loadSession(sessionId) {
  try {
    const filePath = path.join(sessionsDir, `${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading session:', error);
  }
  return null;
}

function cleanupOldSessions() {
  try {
    const files = fs.readdirSync(sessionsDir);
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const filePath = path.join(sessionsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up old session: ${file}`);
        }
      }
    });
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
  }
}

// API Routes
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

app.post('/api/property', (req, res) => {
  try {
    const rawPropertyData = req.body;
    
    // Validate required fields
    if (!rawPropertyData || typeof rawPropertyData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid property data'
      });
    }

    // Transform PropertyList.es data to standard format
    const propertyData = propertyDataMapper ? 
      propertyDataMapper.transformPropertyListData(rawPropertyData) : 
      rawPropertyData;

    // Generate session ID
    const sessionId = uuidv4();
    
    // Create session data
    const sessionData = {
      id: sessionId,
      propertyData: propertyData,
      status: 'created',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      analysisResults: null
    };

    // Save session
    saveSession(sessionId, sessionData);
    
    // Create session URL
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
    console.error('Error processing property data:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/session/:sessionId', (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const sessionData = loadSession(sessionId);
    
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

app.post('/api/session/:sessionId/status', (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const { status, analysisResults, propertyData } = req.body;
    
    const sessionData = loadSession(sessionId);
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Update session
    sessionData.status = status;
    sessionData.updatedAt = new Date().toISOString();
    
    if (analysisResults) {
      sessionData.analysisResults = analysisResults;
    }
    
    // Update property data if provided (for additional user info)
    if (propertyData) {
      sessionData.propertyData = propertyData;
      console.log(`Session ${sessionId} property data updated with additional info:`, propertyData.additionalInfo || 'No additional info');
    }

    saveSession(sessionId, sessionData);

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
    const sessionData = loadSession(sessionId);
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

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Cleanup old sessions on startup and periodically
cleanupOldSessions();
setInterval(cleanupOldSessions, 24 * 60 * 60 * 1000); // Daily cleanup

// Clean cache periodically
if (comparableService) {
  setInterval(() => {
    const cleaned = comparableService.cleanCache();
    if (cleaned > 0) {
      console.log(`Cleaned ${cleaned} expired cache entries`);
    }
  }, 60 * 60 * 1000); // Hourly cache cleanup
}

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