const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '.env.local' });

// Debug: Log environment variables
// console.log('🔍 Environment variables loaded:');
// console.log('API_TOKEN:', process.env.API_TOKEN ? 'SET' : 'NOT SET');
// console.log('NEXT_PUBLIC_API_TOKEN:', process.env.NEXT_PUBLIC_API_TOKEN ? 'SET' : 'NOT SET');
// console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');
// console.log('GOOGLE_MAPS_API_KEY:', process.env.GOOGLE_MAPS_API_KEY ? 'SET' : 'NOT SET');
// console.log('TAVILY_API_KEY:', process.env.TAVILY_API_KEY ? 'SET' : 'NOT SET');

// Initialize feed system for property comparables
async function initializeFeedSystem() {
  try {
    console.log('🔄 Initializing Property Feed System...');
    
    // Import and initialize the feed system using JavaScript version
    const { initializeFeedSystem: initFeed } = require('./feed-init.js');
    await initFeed();
    
    // Start daily XML processor for fresh data (commented out for now to avoid conflicts)
    // const { startScheduledProcessing } = require('../scripts/daily-xml-processor.js');
    // startScheduledProcessing();
    
    console.log('✅ Property Feed System initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Property Feed System:', error.message);
    console.log('⚠️ Property analysis will continue without comparable properties');
  }
}

const app = express();
const PORT = process.env.PORT || 3004;

// Session persistence file
const SESSION_FILE = path.join(__dirname, 'sessions.json');

// Proper UTF-8 body parsing to prevent encoding issues
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Ensure proper UTF-8 encoding of request body
    try {
      req.rawBody = buf;
      // Force UTF-8 interpretation
      req.body = JSON.parse(buf.toString('utf8'));
    } catch (e) {
      console.warn('JSON parsing failed, attempting UTF-8 fix:', e.message);
      // Try to fix common encoding issues
      const fixedBuffer = Buffer.from(buf.toString('latin1'), 'utf8');
      req.body = JSON.parse(fixedBuffer.toString('utf8'));
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 10000
}));

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Load existing sessions from file on startup
function loadSessions() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = fs.readFileSync(SESSION_FILE, 'utf8');
      const sessionsArray = JSON.parse(data);
      
      // Convert array back to Map and clean up old sessions
const sessions = new Map();
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      sessionsArray.forEach(session => {
        // Only keep sessions from the last 24 hours
        if (now - session.createdAt < maxAge) {
          sessions.set(session.sessionId, session);
        }
      });
      
      console.log(`📁 Loaded ${sessions.size} sessions from disk`);
      return sessions;
    }
  } catch (error) {
    console.error('⚠️ Error loading sessions:', error.message);
  }
  
  return new Map();
}

// Save sessions to file with UTF-8 encoding
function saveSessions(sessions) {
  try {
    // Convert Map to array for JSON serialization
    const sessionsArray = Array.from(sessions.values());
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionsArray, null, 2), 'utf8');
    console.log(`💾 Saved ${sessionsArray.length} sessions to disk`);
  } catch (error) {
    console.error('⚠️ Error saving sessions:', error.message);
  }
}

// Session storage with enhanced tracking and persistence
const sessions = loadSessions();

// Auto-save sessions every 5 minutes
setInterval(() => {
  if (sessions.size > 0) {
    saveSessions(sessions);
  }
}, 5 * 60 * 1000); // 5 minutes

// Clean up old sessions every hour
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  let cleanedCount = 0;
  
  for (const [sessionId, session] of sessions) {
    if (now - session.createdAt > maxAge) {
      sessions.delete(sessionId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    saveSessions(sessions);
  }
}, 60 * 60 * 1000); // 1 hour

// Set response headers for proper UTF-8 encoding
app.use((req, res, next) => {
  res.set('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Ensure proper UTF-8 console output
process.stdout.setEncoding('utf8');
process.stderr.setEncoding('utf8');

// Enhanced UTF-8 support for Windows
if (process.platform === 'win32') {
  // Set Windows console to UTF-8 mode
  try {
    // Set console code page to UTF-8
    const { spawn } = require('child_process');
    spawn('chcp', ['65001'], { stdio: 'ignore' });
    
    // Set process environment to UTF-8
    process.env.PYTHONIOENCODING = 'utf-8';
    process.env.LC_ALL = 'en_US.UTF-8';
    
    // Set window title with UTF-8 support
    process.stdout.write('\x1b]0;Property Analysis Listener - UTF-8 Enabled\x07');
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('🌐 Setting Windows console to UTF-8 mode...');
    }
  } catch (error) {
    // Ignore errors in console setup
  }
}

// Override console methods to ensure proper UTF-8 encoding
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

// Enhanced UTF-8 logging function
const logWithUTF8 = (logFn, ...args) => {
  try {
    const processedArgs = args.map(arg => {
      if (typeof arg === 'string') {
        // Double-ensure UTF-8 encoding and handle potential corruption
        try {
          // If the string contains replacement characters, try to fix it
          if (arg.includes('�')) {
            // This might be corrupted UTF-8, but we'll log it as-is for debugging
            console.warn('⚠️ Detected corrupted UTF-8 characters in log message');
          }
          return Buffer.from(arg, 'utf8').toString('utf8');
        } catch (e) {
          return arg; // Fallback to original if UTF-8 processing fails
        }
      } else if (typeof arg === 'object' && arg !== null) {
        // For objects, stringify with UTF-8 preserving replacer
        try {
          return JSON.stringify(arg, (key, value) => {
            if (typeof value === 'string') {
              try {
                return Buffer.from(value, 'utf8').toString('utf8');
              } catch (e) {
                return value; // Fallback to original if UTF-8 processing fails
              }
            }
            return value;
          }, 2);
        } catch (e) {
          return String(arg); // Fallback if JSON stringify fails
        }
      }
      return String(arg);
    });
    
    // Log with the processed arguments
    logFn(...processedArgs);
  } catch (error) {
    // Ultimate fallback to original logging if everything fails
    logFn(...args);
  }
};

console.log = (...args) => logWithUTF8(originalLog, ...args);
console.warn = (...args) => logWithUTF8(originalWarn, ...args);
console.error = (...args) => logWithUTF8(originalError, ...args);

// Import UTF-8 utilities
const { fixSpanishCharacters, fixPropertySpanishCharacters } = require('./utf8-utils');

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0 && req.path !== '/create-session') {
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    port: PORT,
    message: 'Property Analysis Listener Server',
    activeSessions: sessions.size
  });
});

// Enhanced session creation with UTF-8 root cause fix
app.post('/create-session', async (req, res) => {
  try {
    // With our global UTF-8 body parser, req.body should now have clean UTF-8 strings

    // Handle both formats: direct property data or wrapped in property object
    let property, userContext;
    
    if (req.body.address) {
      // Direct property format (like test-villa-property.json)
      property = req.body;
      userContext = '';
    } else {
      // Wrapped format: { property: {...}, userContext: "..." }
      property = req.body.property;
      userContext = req.body.userContext || '';
    }
    
    if (!property || !property.address) {
      return res.status(400).json({
        error: 'Property data is required',
        message: 'Property address is missing'
      });
    }

    // Fix Spanish characters in property data BEFORE storing
    const fixedProperty = fixPropertySpanishCharacters(property);

    // Generate unique property ID for exclusion from comparable searches
    if (!fixedProperty.id) {
      const keyData = {
        refNumber: fixedProperty.refNumber || '',
        address: fixedProperty.address,
        city: fixedProperty.city,
        province: fixedProperty.province || fixedProperty.state,
        propertyType: fixedProperty.propertyType,
        bedrooms: fixedProperty.bedrooms,
        bathrooms: fixedProperty.bathrooms,
        buildArea: fixedProperty.buildArea || 0,
        price: fixedProperty.price || 0
      }
      const dataString = JSON.stringify(keyData)
      const hash = Buffer.from(dataString).toString('base64').replace(/[/+=]/g, '').substring(0, 12)
      fixedProperty.id = fixedProperty.refNumber ? `${fixedProperty.refNumber}-${hash}` : hash
      console.log(`🔑 Generated property ID: ${fixedProperty.id}`)
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Enhanced session object with progress tracking
    const session = {
      sessionId,
      property: fixedProperty,
      userContext: userContext || '',
      status: 'pending',
      createdAt: Date.now(),
      steps: [],
      progress: {
        currentStep: 0,
        totalSteps: 7,
        completedSteps: 0,
        failedSteps: 0,
        criticalErrors: 0,
        qualityScore: 0
      },
      report: null,
      error: null,
      startedAt: null,
      completedAt: null,
      duration: null
    };
    
    sessions.set(sessionId, session);
    
    // Save sessions after creating new session
    saveSessions(sessions);
    
    // console.log(`📋 Created session: ${sessionId}`);
// console.log(`🏠 Property: ${property.address}, ${property.city}, ${property.province || property.state}`);
// console.log(`👤 User context: ${userContext || 'None'}`);
    
    // Include agentUrl in response for seamless integration
    const baseUrl = process.env.AGENT_BASE_URL || 'http://localhost:3000';
    const agentUrl = `${baseUrl}?sessionId=${sessionId}`;
    
    res.json({
      success: true,
      sessionId: sessionId,
      message: 'Session created successfully',
      timestamp: new Date().toISOString(),
      agentUrl: agentUrl,
      status: session.status,
      progress: session.progress
    });
    
  } catch (error) {
    console.error('❌ Error creating session:', error.message);
    res.status(500).json({
      error: 'Failed to create session',
      message: error.message
    });
  }
});

// Progress update endpoint for real-time step completion
app.post('/session/:sessionId/update-progress', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { completedSteps, totalSteps, currentStep } = req.body;
    
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: `Session ${sessionId} does not exist or has expired`
      });
    }
    
    // Update session progress in real-time
    session.progress.completedSteps = completedSteps;
    session.progress.totalSteps = totalSteps;
    session.progress.currentStep = currentStep;
    session.progress.qualityScore = Math.round((completedSteps / totalSteps) * 100);
    
    // console.log(`📊 Progress updated for ${sessionId}: ${completedSteps}/${totalSteps} steps completed`);
    
    // Save sessions after progress update
    saveSessions(sessions);
    
    res.json({
      success: true,
      sessionId: sessionId,
      progress: session.progress
    });
    
  } catch (error) {
    console.error('❌ Error updating session progress:', error.message);
    res.status(500).json({
      error: 'Failed to update progress',
      message: error.message
    });
  }
});

// Enhanced session retrieval with progress information
app.get('/session/:sessionId', async (req, res) => {
  try {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({
      error: 'Session not found',
        message: `Session ${sessionId} does not exist or has expired`
    });
  }
  
    // Fix Spanish characters in property data before sending response
    const fixedProperty = fixPropertySpanishCharacters(session.property);
    
    // Include detailed progress information
    const responseData = {
    sessionId: session.sessionId,
      property: fixedProperty,
      userContext: session.userContext,
    status: session.status,
    createdAt: session.createdAt,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      duration: session.duration,
      progress: session.progress,
    steps: session.steps,
      report: session.report,
      error: session.error,
      // Additional fields for dashboard
      completedSteps: session.progress.completedSteps,
      totalSteps: session.progress.totalSteps,
      criticalErrors: session.progress.criticalErrors,
      qualityScore: session.progress.qualityScore
    };

    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Error retrieving session:', error.message);
    res.status(500).json({
      error: 'Failed to retrieve session',
      message: error.message
    });
  }
});

// Enhanced analysis start with progress tracking
app.post('/start-analysis/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const session = sessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: `Session ${sessionId} does not exist`
      });
    }
    
    if (session.status !== 'pending') {
      return res.status(400).json({
        error: 'Invalid session status',
        message: `Session ${sessionId} is already ${session.status}`
      });
    }

    // console.log(`🚀 Starting analysis for session: ${sessionId}`);
// console.log(`🏠 Property: ${session.property.address}`);
    
    // Update session status and timing
    session.status = 'analyzing';
    session.startedAt = Date.now();
    session.progress.currentStep = 1;
    
    // Get API token
    const apiToken = process.env.API_TOKEN;
    if (!apiToken) {
      session.status = 'error';
      session.error = 'API token not configured';
      session.progress.criticalErrors = 1;
      
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'API token not configured'
      });
    }
    
    // Prepare enhanced property data
    const enhancedPropertyData = {
      ...session.property,
      sessionId: sessionId,
      userContext: session.userContext,
      timestamp: new Date().toISOString()
    };

    // Forward to Next.js API with enhanced error handling and progress tracking
    const nextjsApiUrl = process.env.NEXTJS_API_URL || 'http://localhost:3000';
    
    let apiResponse;
    
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const callStartTime = Date.now();
        
        apiResponse = await axios.post(`${nextjsApiUrl}/api/property-analysis`, enhancedPropertyData, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`
          },
          timeout: 300000, // 5 minutes timeout (increased for comprehensive analysis)
          maxRedirects: 0,
          validateStatus: function (status) {
            return status < 500; // Resolve for status codes less than 500
          }
        });
        
        const callDuration = Date.now() - callStartTime;
        // console.log(`🔍 DEBUG: API call completed in ${callDuration}ms with status:`, apiResponse.status);
        
        // If we get here, the request succeeded
        break;
        
      } catch (error) {
        retryCount++;
        
        if (error.code === 'ECONNRESET' && retryCount < maxRetries) {
          console.warn(`⚠️ Connection reset on attempt ${retryCount}/${maxRetries}, retrying...`);
          session.progress.currentStep = retryCount; // Show retry progress
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }
        
        // Re-throw if not a connection reset or max retries reached
        throw error;
      }
    }
    
    // Process the response and update session with detailed progress
    if (apiResponse.status === 200) {
      // All steps are done, but report is not yet attached
      session.status = 'finalizing';
      saveSessions(sessions); // Save immediately after marking as finalizing
      // Now attach the report and mark as completed
      session.status = 'completed';
      session.report = apiResponse.data;
      session.completedAt = Date.now();
      session.duration = session.completedAt - session.startedAt;
      // Use the quality metrics from the Next.js API response if available
      const report = apiResponse.data;
      let qualityScore = 100; // Default to 100% since analysis completed
      let completedSteps = 7;  // All 7 steps completed successfully
      // Check if the Next.js API provided its own quality metrics
      if (report.qualityScore !== undefined) {
        qualityScore = report.qualityScore;
      }
      if (report.completedSteps !== undefined) {
        completedSteps = report.completedSteps;
      }
      // Fallback data availability check only if no quality metrics provided
      if (report.qualityScore === undefined) {
        qualityScore = 0;
        completedSteps = 0;
        // Score based on data availability (fallback method)
        if (report.nearbyAmenities && report.nearbyAmenities.length > 0) {
          qualityScore += 15;
          completedSteps++;
        }
        if (report.comparableProperties && report.comparableProperties.length > 0) {
          qualityScore += 15;
          completedSteps++;
        }
        if (report.marketTrends && (report.marketTrends.averagePrice || report.marketTrends.medianPrice)) {
          qualityScore += 15;
          completedSteps++;
        }
        if (report.futureDevelopment && report.futureDevelopment.length > 0) {
          qualityScore += 10;
          completedSteps++;
        }
        if (report.walkabilityData || report.coordinates) {
          qualityScore += 10; // Credit for location/mobility data
          completedSteps++;
        }
        if (report.summary && report.summary.overview) {
          qualityScore += 15;
          completedSteps++;
        }
        if (report.valuationEstimate && (report.valuationEstimate.estimated || report.valuationEstimate.low)) {
          qualityScore += 20; // Higher weight for valuation
          completedSteps++;
        }
      }
      session.progress.completedSteps = completedSteps;
      session.progress.qualityScore = qualityScore;
      session.progress.currentStep = 7; // All steps completed
      // console.log(`✅ Analysis completed successfully for session: ${sessionId}`);
// console.log(`📊 Quality Score: ${qualityScore}%, Completed Steps: ${completedSteps}/7`);
      // Save session after completion
      saveSessions(sessions);
    } else if (apiResponse.status === 400) {
      // Bad request - validation error
      session.status = 'error';
      session.error = apiResponse.data.error || 'Invalid property data';
      session.progress.criticalErrors = 1;
      session.completedAt = Date.now();
      session.duration = session.completedAt - session.startedAt;
      
      // console.log(`❌ Analysis failed for session: ${sessionId} - Validation error`);
      
    } else if (apiResponse.status === 429) {
      // Rate limited
      session.status = 'error';
      session.error = 'Rate limit exceeded. Please try again later.';
      session.progress.criticalErrors = 1;
      session.completedAt = Date.now();
      session.duration = session.completedAt - session.startedAt;
      
      // console.log(`⚠️ Analysis rate limited for session: ${sessionId}`);
      
    } else {
      // Other errors - partial success possible
      session.status = 'error';
      session.error = apiResponse.data.error || 'Analysis failed';
      session.progress.criticalErrors = 1;
      session.completedAt = Date.now();
      session.duration = session.completedAt - session.startedAt;
      
      // Check if we got partial results
      if (apiResponse.data.completedSteps) {
        session.progress.completedSteps = apiResponse.data.completedSteps;
        session.progress.qualityScore = Math.round((apiResponse.data.completedSteps / 7) * 100);
        
        // If we have some data, mark as degraded instead of error
        if (apiResponse.data.completedSteps >= 3) {
          session.status = 'degraded';
          session.report = apiResponse.data; // May contain partial report
        }
      }
      
    }
    
    if (session.status === 'error') {
      // console.log(`❌ Analysis failed for session: ${sessionId} - ${session.error}`);
    }
    
    // Save session after any status change
    saveSessions(sessions);
    
    // Return the enhanced response
    res.json({
      success: session.status === 'completed' || session.status === 'degraded',
      sessionId: sessionId,
      message: session.status === 'completed' ? 'Property analysis completed' : 
               session.status === 'degraded' ? 'Property analysis partially completed' : 
               'Property analysis failed',
      timestamp: new Date().toISOString(),
      status: session.status,
      progress: session.progress,
      qualityScore: session.progress.qualityScore,
      completedSteps: session.progress.completedSteps,
      totalSteps: session.progress.totalSteps,
      criticalErrors: session.progress.criticalErrors,
      duration: session.duration,
      report: session.report,
      error: session.error
    });
    
  } catch (error) {
      console.error('❌ Error in start-analysis:', error.message);
      
      // Update session with error information
      const session = sessions.get(sessionId);
      if (session) {
        session.status = 'error';
        session.error = error.message;
        session.progress.criticalErrors = 1;
        session.completedAt = Date.now();
        if (session.startedAt) {
          session.duration = session.completedAt - session.startedAt;
        }
      }
      
      res.status(500).json({
        success: false,
        sessionId: sessionId,
        message: 'Analysis failed',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  // Legacy analyze-property endpoint (for backward compatibility)
  app.post('/analyze-property', async (req, res) => {
    console.log('⚠️ Using legacy endpoint. Consider migrating to session-based workflow.');
    
    try {
      // Create temporary session
      const tempSessionResponse = await axios.post(`http://localhost:${PORT}/create-session`, req.body);
      const { sessionId } = tempSessionResponse.data;
      
      // Start analysis immediately
      const analysisResponse = await axios.post(`http://localhost:${PORT}/start-analysis/${sessionId}`, {
        userContext: 'Legacy endpoint - no additional context provided'
      });
      
      res.json(analysisResponse.data);
      
    } catch (error) {
      console.error('❌ Legacy endpoint error:', error.message);
      res.status(500).json({
        error: 'Analysis failed',
        message: error.message
      });
    }
  });

  // PDF generation endpoint
  app.post('/generate-pdf', async (req, res) => {
    try {
      console.log('📄 Received PDF generation request');
      
      const { report } = req.body;
      
      if (!report) {
        return res.status(400).json({
          error: 'Missing report data',
          message: 'CMA report data is required to generate PDF'
        });
      }
      
      // Get API token
      const apiToken = process.env.API_TOKEN;
      if (!apiToken) {
        return res.status(500).json({
          error: 'Server configuration error',
          message: 'API token not configured'
        });
      }
      
      console.log('🔄 Forwarding PDF request to Next.js API...');
      
      // Forward to Next.js PDF API
      const nextjsApiUrl = process.env.NEXTJS_API_URL || 'http://localhost:3000';
      const apiResponse = await axios.post(`${nextjsApiUrl}/api/generate-pdf`, { report }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        responseType: 'stream',
        timeout: 60000 // 1 minute timeout
      });
      
      console.log('✅ PDF generated successfully');
      
      // Forward the PDF response
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', apiResponse.headers['content-disposition'] || 'attachment; filename="CMA-Report.pdf"');
      
      apiResponse.data.pipe(res);
      
    } catch (error) {
      console.error('❌ Error generating PDF:', error.message);
      
      if (error.response) {
        return res.status(error.response.status).json({
          error: 'PDF generation failed',
          message: error.response.data?.error || error.message
        });
      } else {
        return res.status(500).json({
          error: 'Internal server error',
          message: error.message
        });
      }
    }
  });

  // New endpoint for PropertyList format
  app.post('/api/send_property_data', async (req, res) => {
    console.log('📥 Received PropertyList format data');
    
    try {
      const propertyListData = req.body;
      console.log('Received:', propertyListData);
      
      // Convert PropertyList format to PropertyData format
      const propertyData = {
        refNumber: propertyListData.reference,
        address: `Property ${propertyListData.reference}`, // Will be enhanced by AI
        city: 'Marbella', // Default - will be enhanced by AI
        province: 'MA', // Default - will be enhanced by AI
        propertyType: propertyListData.property_type === 0 ? 'Apartment' : 'Villa',
        bedrooms: propertyListData.bedrooms,
        bathrooms: propertyListData.bathrooms,
        buildArea: propertyListData.build_square_meters,
        plotArea: propertyListData.plot_square_meters,
        terraceAreaM2: propertyListData.terrace_square_meters,
        price: propertyListData.price,
        isSale: propertyListData.is_sale,
        isShortTerm: propertyListData.is_short_term,
        isLongTerm: propertyListData.is_long_term,
        monthlyPrice: propertyListData.monthly_price,
        weeklyPriceFrom: propertyListData.weekly_price_low,
        weeklyPriceTo: propertyListData.weekly_price_high,
        parkingSpaces: propertyListData.parking_spaces,
        furnished: propertyListData.furnished,
        floorNumber: propertyListData.floor_number,
        propertyTax: propertyListData.ibi,
        garbageTax: propertyListData.basura,
        communityFees: propertyListData.community_fees,
        energyRating: propertyListData.energy_rating,
        urbanization: propertyListData.urbanization_name,
        features: [], // Will be populated from feature_ids
        images: propertyListData.images ? propertyListData.images.map(img => img.medium) : [],
        image: propertyListData.images && propertyListData.images.length > 0 ? propertyListData.images[0].medium : null,
        description: `Property ${propertyListData.reference} - ${propertyListData.bedrooms} bedroom, ${propertyListData.bathrooms} bathroom ${propertyListData.property_type === 0 ? 'apartment' : 'villa'} with ${propertyListData.build_square_meters}m² built area.`,
        // Additional context for AI enhancement
        cityId: propertyListData.city_id,
        suburbId: propertyListData.suburb_id,
        featureIds: propertyListData.feature_ids || []
      };
      
      // Generate unique property ID for exclusion from comparable searches
      if (!propertyData.id) {
        const keyData = {
          refNumber: propertyData.refNumber || '',
          address: propertyData.address,
          city: propertyData.city,
          province: propertyData.province,
          propertyType: propertyData.propertyType,
          bedrooms: propertyData.bedrooms,
          bathrooms: propertyData.bathrooms,
          buildArea: propertyData.buildArea || 0,
          price: propertyData.price || 0
        }
        const dataString = JSON.stringify(keyData)
        const hash = Buffer.from(dataString).toString('base64').replace(/[/+=]/g, '').substring(0, 12)
        propertyData.id = propertyData.refNumber ? `${propertyData.refNumber}-${hash}` : hash
        console.log(`🔑 Generated property ID for PropertyList data: ${propertyData.id}`)
      }
      
      console.log('🔄 Converted to PropertyData format:', propertyData);
      
      // Create session
      const sessionResponse = await axios.post(`http://localhost:${PORT}/create-session`, propertyData);
      const { sessionId } = sessionResponse.data;
      
      console.log('✅ Created session:', sessionId);
      
      // Start analysis
      const analysisResponse = await axios.post(`http://localhost:${PORT}/start-analysis/${sessionId}`, {
        userContext: 'PropertyList integration - AI will enhance location details'
      });
      
      // Return the session URL for the frontend
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const sessionUrl = `${frontendUrl}/?sessionId=${sessionId}`;
      
      res.json({
        success: true,
        sessionId: sessionId,
        sessionUrl: sessionUrl,
        message: 'Property analysis started successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error processing PropertyList data:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to process property data',
        message: error.message
      });
    }
  });

  // Catch-all for unsupported methods/paths
  app.all('*', (req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: `${req.method} ${req.path} is not supported`,
      availableEndpoints: {
        'GET /health': 'Server health check and active sessions count',
        'POST /create-session': 'Create new property analysis session',
        'GET /session/:sessionId': 'Get session information and status',
        'POST /session/:sessionId/update-progress': 'Update analysis progress in real-time',
        'POST /start-analysis/:sessionId': 'Start CMA analysis for a session',
        'POST /analyze-property': 'Legacy endpoint (creates session and starts analysis)',
        'POST /api/send_property_data': 'PropertyList format endpoint (creates session and starts analysis)',
        'POST /generate-pdf': 'Generate PDF from CMA report'
      }
    });
  });

  // Error handling middleware
  app.use((error, req, res, next) => {
    console.error('💥 Unhandled error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  });

  // Start server
  app.listen(PORT, async () => {
    console.log(`🚀 Property Analysis Listener Server started`);
    console.log(`📡 Listening on http://localhost:${PORT}`);
    console.log('📋 Available endpoints:');
    console.log(`   GET  http://localhost:${PORT}/health`);
    console.log(`   POST http://localhost:${PORT}/create-session`);
    console.log(`   GET  http://localhost:${PORT}/session/:sessionId`);
    console.log(`   POST http://localhost:${PORT}/session/:sessionId/update-progress`);
    console.log(`   POST http://localhost:${PORT}/start-analysis/:sessionId`);
    console.log(`   POST http://localhost:${PORT}/analyze-property (legacy)`);
    console.log(`   POST http://localhost:${PORT}/api/send_property_data (PropertyList format)`);
    console.log(`   POST http://localhost:${PORT}/generate-pdf`);
    console.log('💡 Ready to accept multi-user property analysis requests!');
    console.log('🌐 UTF-8 encoding enforced for all endpoints.');
    
    // Initialize feed system on startup
    console.log('🔄 Initializing property database...');
    try {
      await initializeFeedSystem();
      console.log('✅ Property database initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize property database:', error.message);
      console.log('⚠️ Property analysis will continue without comparable properties');
    }
  });

  // Graceful shutdown - save sessions before exit
  process.on('SIGINT', () => {
    console.log('\n🔄 Shutting down gracefully...');
    saveSessions(sessions);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🔄 Shutting down gracefully...');
    saveSessions(sessions);
    process.exit(0);
  });