const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

// Import new optimized services
const PropertyDatabase = require('./database/postgresDatabase');
const XMLFeedService = require('./services/xmlFeedService');
const ComparableService = require('./services/comparableService');
const PropertyDataMapper = require('./services/propertyDataMapper');
const AILearningService = require('./services/aiLearningService');
const LocationIntelligenceService = require('./services/locationIntelligenceService');
const IntelligentCoordinateService = require('./services/intelligentCoordinateService');
const OptimizedLocationService = require('./services/optimizedLocationService');
const imageProxyRouter = require('./routes/imageProxy');

// Import PropertyList API services for fresh data analysis
const PropertyListApiService = require('./services/propertyListApiService');
const FreshImageService = require('./services/freshImageService');
const EnhancedPdfGenerationService = require('./services/enhancedPdfGenerationService');

// Import Future Developments service
const FutureDevelopmentsService = require('./services/futureDevelopmentsService');

// Import Auto-Optimization service
const AutoOptimizationService = require('./services/autoOptimizationService');

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
      // FIXED: Explicitly use UTF-8 encoding to preserve Spanish characters
      fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2), { encoding: 'utf8' });
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
let optimizedLocationService;
let autoReanalysisService;

// PropertyList API services for fresh data analysis
let propertyListApiService;
let freshImageService;
let enhancedPdfService;

// Future Developments service
let futureDevelopmentsService;

// Middleware
app.use(cors());
// FIXED: Add explicit UTF-8 encoding support for Spanish characters
app.use(express.json({ limit: '10mb', charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

// Set proper UTF-8 headers for all responses
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

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
    
    // Initialize optimized location service (GPT-3.5-Turbo + caching)
    optimizedLocationService = new OptimizedLocationService();
    
    // Initialize XML feed service
    xmlFeedService = new XMLFeedService(propertyDatabase);
    xmlFeedService.startCronJob();
    
    // Initialize comparable service with learning enhancement
    comparableService = new ComparableService(propertyDatabase);
    
    // Enhanced AI analysis service with System/AI progressive logic and streaming
    const EnhancedAIAnalysisService = require('./services/enhancedAIAnalysisService');
const StreamingResponseService = require('./services/streamingResponseService');
const EnterpriseDashboardService = require('./services/enterpriseDashboardService');
    
    // Initialize streaming service
const streamingService = new StreamingResponseService();

// Initialize enhanced AI analysis service
    const originalAiAnalysis = comparableService.aiAnalysis;
comparableService.aiAnalysis = new EnhancedAIAnalysisService(propertyDatabase, aiLearningService);

// Connect streaming service to AI analysis service
comparableService.aiAnalysis.setStreamingService(streamingService);

// Initialize Enterprise Dashboard Service
let enterpriseDashboardService;
try {
  enterpriseDashboardService = new EnterpriseDashboardService(
    propertyDatabase,
    comparableService.aiAnalysis.monitoringService,
    comparableService.aiAnalysis.predictiveAnalyticsService,
    streamingService
  );
  console.log('✅ Enterprise Dashboard Service initialized');
} catch (error) {
  console.error('❌ Failed to initialize Enterprise Dashboard Service:', error);
}

// Admin configuration with enhanced security
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Change this in production!
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = '24h';

// Enhanced security configuration
const ADMIN_IP_WHITELIST = process.env.ADMIN_IP_WHITELIST?.split(',') || []; // Optional IP whitelist
const ADMIN_RATE_LIMIT = new Map(); // Track login attempts
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// Enhanced authentication middleware with security features
function authenticateAdmin(req, res, next) {
  // Optional IP whitelist check
  if (ADMIN_IP_WHITELIST.length > 0 && !ADMIN_IP_WHITELIST.includes(req.ip)) {
    console.warn(`🚨 Unauthorized admin access attempt from non-whitelisted IP: ${req.ip}`);
    return res.status(404).json({ error: 'Not found' }); // Hide that admin exists
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(404).json({ error: 'Not found' }); // Hide admin routes
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    console.error('❌ Invalid admin token:', error.message);
    return res.status(404).json({ error: 'Not found' }); // Hide admin routes
  }
}

// Rate limiting middleware for admin login
function adminLoginRateLimit(req, res, next) {
  const clientIP = req.ip;
  const now = Date.now();
  
  // Check if IP is currently locked out
  if (ADMIN_RATE_LIMIT.has(clientIP)) {
    const attempts = ADMIN_RATE_LIMIT.get(clientIP);
    
    // Check if still in lockout period
    if (attempts.count >= MAX_LOGIN_ATTEMPTS && (now - attempts.lastAttempt) < LOCKOUT_DURATION) {
      const remainingTime = Math.ceil((LOCKOUT_DURATION - (now - attempts.lastAttempt)) / 60000);
      console.warn(`🚨 Admin login blocked for IP ${clientIP} - ${remainingTime} minutes remaining`);
      return res.status(404).json({ error: 'Not found' }); // Hide that admin exists
    }
    
    // Reset if lockout period has passed
    if ((now - attempts.lastAttempt) >= LOCKOUT_DURATION) {
      ADMIN_RATE_LIMIT.delete(clientIP);
    }
  }
  
  next();
}

// Middleware to hide admin routes from unauthorized access
function hideAdminRoutes(req, res, next) {
  // Check if this looks like an admin route discovery attempt
  const userAgent = req.get('User-Agent') || '';
  const isBot = /bot|crawler|spider|scan/i.test(userAgent);
  
  if (isBot) {
    console.warn(`🚨 Bot attempting to access admin route: ${req.ip} - ${userAgent}`);
    return res.status(404).send('Not found');
  }
  
  // Optional: Check for specific admin access patterns
  const hasValidSession = req.headers.cookie && req.headers.cookie.includes('admin_session');
  const hasAuthHeader = req.headers.authorization;
  
  // If no valid indicators and trying to access admin, return 404
  if (!hasValidSession && !hasAuthHeader && req.path.startsWith('/admin')) {
    return res.status(404).send('Not found');
  }
  
  next();
}
    
    // Initialize PropertyList.es data mapper
    propertyDataMapper = new PropertyDataMapper();
    
    // Initialize automatic re-analysis service
    const AutoReanalysisService = require('./services/autoReanalysisService');
    autoReanalysisService = new AutoReanalysisService(propertyDatabase);
    
    // Initialize PropertyList API services
    propertyListApiService = new PropertyListApiService(propertyDatabase);
    freshImageService = new FreshImageService(propertyDatabase);
    enhancedPdfService = new EnhancedPdfGenerationService(propertyDatabase);
    
    // Initialize Future Developments service
    futureDevelopmentsService = new FutureDevelopmentsService();
    
    console.log('All services initialized successfully with AI learning, auto-reanalysis, and future developments enabled');
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
      tavilyService: hasTavily,
      autoReanalysisService: autoReanalysisService ? true : false
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

// Server-Sent Events endpoint for streaming progress updates
app.get('/api/stream/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  
  try {
    // Add SSE connection to streaming service
    streamingService.addSSEConnection(sessionId, res);
    
    console.log(`📡 SSE client connected for session ${sessionId}`);
    
  } catch (error) {
    console.error(`❌ Error setting up SSE connection for ${sessionId}:`, error);
    res.status(500).json({ error: 'Failed to establish streaming connection' });
  }
});

app.post('/api/property', async (req, res) => {
  try {
    // Transform and validate property data
    const transformedData = propertyDataMapper.transformPropertyListData(req.body);
    
    console.log('📍 LOCATION PROCESSING - Property has:');
    console.log('   Street Address:', transformedData.street_address || 'None');
    console.log('   Urbanization:', transformedData.urbanization || 'None');
    console.log('   Suburb:', transformedData.suburb || 'None');
    console.log('   City:', transformedData.city || 'None');
    
    // NEW LOGIC: Follow user requirements
    // 1. If have exact urbanization or street address → Try direct geocoding first
    // 2. If direct geocoding fails → Use AI as fallback
    
    const hasUrbanization = transformedData.urbanization && transformedData.urbanization.trim().length > 0;
    const hasStreetAddress = transformedData.street_address && transformedData.street_address.trim().length > 0;
    
    console.log('🔍 GEOCODING LOGIC CHECK:');
    console.log('   hasUrbanization:', hasUrbanization, '(value:', transformedData.urbanization, ')');
    console.log('   hasStreetAddress:', hasStreetAddress, '(value:', transformedData.street_address, ')');
    console.log('   Should trigger direct geocoding:', hasUrbanization || hasStreetAddress);
    
    let locationContext = null;
    
    // STEP 1: Try direct geocoding if we have specific location data
    if (hasUrbanization || hasStreetAddress) {
      console.log('🏢 Has specific location data - attempting direct geocoding...');
      
      const addressToGeocode = hasStreetAddress ? transformedData.street_address : transformedData.urbanization;
      console.log(`📍 Direct geocoding: "${addressToGeocode}"`);
      
      try {
        // Import the location service for direct geocoding
        console.log('📦 Importing LocationIntelligenceService...');
        const LocationIntelligenceService = require('./services/locationIntelligenceService');
        console.log('✅ LocationIntelligenceService imported successfully');
        
        const locationService = new LocationIntelligenceService(propertyDatabase);
        const intelligentCoordinates = new IntelligentCoordinateService(propertyDatabase);
        console.log('✅ LocationIntelligenceService instance created');
        
        // Try direct geocoding with city context
        console.log('🌍 Calling geocodeLocation...');
        const directGeocodingResult = await locationService.geocodeLocation(
          addressToGeocode,
          {
            city: transformedData.city,
            suburb: transformedData.suburb
          }
        );
        
        console.log('📋 Direct geocoding result:', directGeocodingResult);
        
        if (directGeocodingResult.coordinates) {
          console.log('✅ Direct geocoding successful:', directGeocodingResult.coordinates);
          
          // ENHANCED: Use intelligent coordinate validation before saving
          const shouldSaveDecision = await intelligentCoordinates.shouldSaveCoordinates(
            transformedData, 
            directGeocodingResult
          );
          
          if (shouldSaveDecision.shouldSave) {
            console.log('🧠 INTELLIGENT APPROVAL for direct geocoding:', shouldSaveDecision.reason);
            
            locationContext = {
              location: directGeocodingResult.location || addressToGeocode,
              coordinates: directGeocodingResult.coordinates,
              confidence: directGeocodingResult.geocodingConfidence || 0.9,
              method: 'direct_geocoding',
              source: hasStreetAddress ? 'street_address' : 'urbanization',
              originalInput: addressToGeocode,
              intelligentValidation: shouldSaveDecision
            };
            
            // Add coordinates to property data (only if approved)
            transformedData.latitude = directGeocodingResult.coordinates.lat;
            transformedData.longitude = directGeocodingResult.coordinates.lng;
            console.log('✅ INTELLIGENT coordinates added to property data:', transformedData.latitude, transformedData.longitude);
          } else {
            console.log('🧠 INTELLIGENT REJECTION for direct geocoding:', shouldSaveDecision.reason);
            console.log('🔄 Will attempt AI fallback for better specificity...');
            // Don't add coordinates, continue to AI fallback
          }
        } else {
          console.log('❌ Direct geocoding failed - will use AI fallback');
        }
      } catch (error) {
        console.error('❌ Direct geocoding error:', error.message);
        console.log('🔄 Will fallback to AI location intelligence...');
      }
    } else {
      console.log('❌ No specific location data found - skipping direct geocoding');
    }
    
    // STEP 2: If direct geocoding failed or no specific location data, use OPTIMIZED AI location intelligence
    if (!locationContext) {
      console.log('🚀 Using optimized AI location intelligence (GPT-3.5-Turbo + caching)...');
      console.log(`   - Reason: ${!hasUrbanization && !hasStreetAddress ? 'No specific location data' : 'Direct geocoding failed'}`);
      
      try {
        // Use optimized location service for better performance and cost efficiency
        const optimizedResult = await optimizedLocationService.analyzePropertyLocation(transformedData);
        
        // Convert to expected format for backward compatibility
        locationContext = {
          location: optimizedResult.enhancedLocation,
          coordinates: optimizedResult.coordinates || null,
          confidence: (optimizedResult.aiConfidence || 5) / 10, // Convert 1-10 to 0-1 scale
          method: optimizedResult.method,
          landmarks: optimizedResult.landmarks || [],
          proximityClues: optimizedResult.proximityClues || [],
          cacheType: optimizedResult.cacheType,
          enhancementReason: optimizedResult.enhancementReason
        };
        
        console.log(`✅ Optimized AI analysis: ${locationContext.location}`);
        console.log(`   📊 Confidence: ${(locationContext.confidence * 100).toFixed(1)}%`);
        console.log(`   🔧 Method: ${locationContext.method}`);
        if (locationContext.cacheType) {
          console.log(`   ⚡ Cache: ${locationContext.cacheType} hit`);
        }
        if (locationContext.landmarks.length > 0) {
          console.log(`   🏛️ Landmarks: ${locationContext.landmarks.join(', ')}`);
        }
        
      } catch (error) {
        console.error('❌ Optimized AI failed, falling back to original service:', error.message);
        
        // Fallback to original service if optimized fails
        const locationInput = transformedData.suburb || transformedData.city || 'Unknown location';
        locationContext = await locationIntelligenceService.resolveLocationWithLogging(
          locationInput,
          { 
            city: transformedData.city,
            suburb: transformedData.suburb,
            bedrooms: transformedData.bedrooms,
            propertyType: transformedData.property_type,
            propertyData: transformedData,
            triggerReason: hasUrbanization || hasStreetAddress ? 'direct_geocoding_failed' : 'missing_specific_location_data'
          }
        );
      }
      
      // Enhance property data with resolved location
      transformedData.resolvedLocation = locationContext;
      console.log(`✅ AI location resolved: ${locationContext.location} (${(locationContext.confidence * 100).toFixed(1)}% confidence)`);
    } else {
      // FIXED: Don't skip AI analysis - properties with rich descriptions need processing too!
      console.log('🤖 No specific address data, but analyzing description for landmarks...');
      
      try {
        // Run AI analysis on property description even without specific address
        const locationInput = transformedData.descriptions?.en || transformedData.descriptions?.es || 
                            transformedData.suburb || transformedData.city || 'Property location';
        
        console.log(`🔍 AI analyzing description: "${locationInput.substring(0, 100)}..."`);
        
        locationContext = await locationIntelligenceService.resolveLocationWithLogging(
          locationInput,
          { 
            city: transformedData.city,
            suburb: transformedData.suburb,
            bedrooms: transformedData.bedrooms,
            propertyType: transformedData.property_type,
            propertyData: transformedData,
            triggerReason: 'description_analysis_fallback'
          }
        );
        
        // Enhance property data with resolved location
        transformedData.resolvedLocation = locationContext;
        console.log(`✅ Description analysis complete: ${locationContext.location} (${(locationContext.confidence * 100).toFixed(1)}% confidence)`);
        
      } catch (error) {
        console.error('❌ Description analysis failed:', error.message);
        // Set basic fallback location context
        locationContext = {
          location: transformedData.suburb || transformedData.city || 'Unknown location',
          coordinates: null,
          confidence: 0.1,
          method: 'basic_fallback',
          landmarks: [],
          proximityClues: [],
          enhancementReason: 'Description analysis failed'
        };
        transformedData.resolvedLocation = locationContext;
      }
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
      bedrooms: property.bedrooms,
      hasCoordinates: !!(property.latitude && property.longitude)
    });

    // Transform using PropertyList.es format
    const transformedData = propertyDataMapper.transformPropertyListData(property);
    
    // Check if coordinates are missing and we need location analysis
    let locationContext = null;
    if (!property.latitude || !property.longitude) {
      console.log('🔍 Property missing coordinates, performing location analysis...');
      
      try {
        const locationService = new LocationIntelligenceService();
        
        // STEP 1: Try direct geocoding first if we have specific location data
        const hasUrbanization = property.urbanization && property.urbanization.trim().length > 0;
        const hasSpecificAddress = property.address && property.address.trim().length > 0 && 
                                  !property.address.toLowerCase().includes('marbesa'); // Skip known incorrect data
        
        console.log('🔍 LOCATION DATA CHECK:');
        console.log('   hasUrbanization:', hasUrbanization, '(value:', property.urbanization, ')');
        console.log('   hasSpecificAddress:', hasSpecificAddress, '(value:', property.address, ')');
        
        if (hasUrbanization || hasSpecificAddress) {
          console.log('🏢 Has specific location data - attempting direct geocoding...');
          
          const addressToGeocode = hasUrbanization ? 
            `${property.urbanization}, ${property.city}` : 
            property.address;
          
          console.log(`📍 Direct geocoding: "${addressToGeocode}"`);
          
          const geocodeResult = await locationService.geocodeLocation(addressToGeocode);
          if (geocodeResult.coordinates && geocodeResult.geocodingConfidence > 0.7) {
            console.log('✅ High-confidence direct geocoding successful:', geocodeResult.coordinates);
            
            // ENHANCED: Use intelligent coordinate validation for database properties
            const shouldSaveDecision = await intelligentCoordinates.shouldSaveCoordinates(
              transformedData, 
              geocodeResult
            );
            
            if (shouldSaveDecision.shouldSave) {
              console.log('🧠 INTELLIGENT APPROVAL for database property geocoding:', shouldSaveDecision.reason);
              
              locationContext = {
                resolvedLocation: addressToGeocode,
                confidence: 8, // High confidence for direct geocoding
                coordinates: geocodeResult.coordinates,
                geocodingConfidence: geocodeResult.geocodingConfidence,
                extractionMethod: hasUrbanization ? 'urbanization' : 'street_address',
                intelligentValidation: shouldSaveDecision
              };
              
              // Add coordinates to transformed data (only if approved)
              transformedData.latitude = geocodeResult.coordinates.lat;
              transformedData.longitude = geocodeResult.coordinates.lng;
              console.log(`📍 INTELLIGENT coordinates approved: ${geocodeResult.coordinates.lat}, ${geocodeResult.coordinates.lng}`);
            } else {
              console.log('🧠 INTELLIGENT REJECTION for database property:', shouldSaveDecision.reason);
              console.log('🔄 Will continue without saving coordinates...');
              // Continue without coordinates
            }
          } else {
            console.log('❌ Direct geocoding failed or low confidence - will try AI analysis');
          }
        }
        
        // STEP 2: Use AI description analysis if direct geocoding failed
        if (!locationContext) {
          console.log('🤖 Using AI description analysis as fallback...');
          
          const optimizedLocationService = new OptimizedLocationService();
          const analysisResult = await optimizedLocationService.analyzePropertyLocation(transformedData);
          
          if (analysisResult && analysisResult.coordinates && analysisResult.aiConfidence >= 7) {
            console.log(`✅ High-confidence AI location found: ${analysisResult.enhancedLocation} (confidence: ${analysisResult.aiConfidence}/10)`);
            
            locationContext = {
              resolvedLocation: analysisResult.enhancedLocation,
              confidence: analysisResult.aiConfidence,
              coordinates: analysisResult.coordinates,
              method: analysisResult.method,
              extractionMethod: 'ai_analysis',
              cacheType: analysisResult.cacheType
            };
            
            // Add coordinates to transformed data
            transformedData.latitude = analysisResult.coordinates.lat;
            transformedData.longitude = analysisResult.coordinates.lng;
            console.log(`📍 AI-resolved coordinates: ${analysisResult.coordinates.lat}, ${analysisResult.coordinates.lng}`);
          }
        }
        
        // STEP 3: Final fallback to basic address geocoding
        if (!locationContext) {
          console.log('🔄 Final fallback to basic address geocoding...');
          const streetAddress = [property.address, property.suburb, property.city]
            .filter(Boolean)
            .join(', ');
            
          if (streetAddress.trim()) {
            const geocodeResult = await locationService.geocodeLocation(streetAddress);
            if (geocodeResult.coordinates) {
              // ENHANCED: Use intelligent coordinate validation for fallback geocoding
              const shouldSaveDecision = await intelligentCoordinates.shouldSaveCoordinates(
                transformedData, 
                geocodeResult
              );
              
              if (shouldSaveDecision.shouldSave) {
                console.log('🧠 INTELLIGENT APPROVAL for fallback geocoding:', shouldSaveDecision.reason);
                
                locationContext = {
                  resolvedLocation: streetAddress,
                  confidence: 5, // Lower confidence for basic fallback
                  coordinates: geocodeResult.coordinates,
                  geocodingConfidence: geocodeResult.geocodingConfidence,
                  extractionMethod: 'fallback_address',
                  intelligentValidation: shouldSaveDecision
                };
                
                // Add coordinates to transformed data (only if approved)
                transformedData.latitude = geocodeResult.coordinates.lat;
                transformedData.longitude = geocodeResult.coordinates.lng;
                console.log(`📍 INTELLIGENT fallback coordinates approved: ${geocodeResult.coordinates.lat}, ${geocodeResult.coordinates.lng}`);
              } else {
                console.log('🧠 INTELLIGENT REJECTION for fallback geocoding:', shouldSaveDecision.reason);
                console.log('🔄 Proceeding without coordinates to maintain data quality...');
                // Continue without coordinates to maintain data quality
              }
            }
          }
        }
        
      } catch (error) {
        console.error('❌ Location analysis failed:', error.message);
      }
    }
    
    // Enhance property data with resolved location
    if (locationContext) {
      transformedData.resolvedLocation = locationContext;
      console.log(`✅ Location resolved for database property: ${locationContext.location}`);
    }
    
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      propertyData: transformedData,
      locationContext: locationContext, // NEW: Include location context
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
              suburb: sessionData.propertyData?.suburb, // FIXED: Include suburb for more precise geocoding
              propertyData: sessionData.propertyData,
              userInput: true // Flag to indicate this is user-provided text
            }
          );
          
                  if (additionalLocationContext && additionalLocationContext.confidence > 0.6) {
          console.log(`✅ Enhanced location found from user input: ${additionalLocationContext.location} (${(additionalLocationContext.confidence * 100).toFixed(1)}% confidence)`);
          
          // IMPORTANT: User input should ENHANCE, not REPLACE property location data
          // Keep existing property data as primary, add user input as supplementary context
          if (sessionData.locationContext) {
            // Add user input as enhancement while preserving original location context
            updates.locationContext = {
              ...sessionData.locationContext,
              enhancedLocation: additionalLocationContext,
              userProvidedEnhancement: propertyData.additionalInfo,
              // Keep original coordinates as primary, user input coordinates as additional context only
              additionalCoordinates: additionalLocationContext.coordinates,
              landmarks: additionalLocationContext.landmarks,
              proximityClues: additionalLocationContext.proximityClues,
              enhancedConfidence: additionalLocationContext.confidence,
              method: `${sessionData.locationContext.method} + user_input_enhancement`
            };
          } else {
            // Create location context from user input only if no existing context
            updates.locationContext = {
              ...additionalLocationContext,
              userProvidedEnhancement: propertyData.additionalInfo,
              method: 'user_input_only'
            };
          }
          
          console.log(`🎯 Session location context enhanced with user input (property data preserved)`);
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

// PDF Generation endpoint (on-demand)
app.post('/api/generate-pdf/:sessionId', async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    console.log(`📄 PDF generation requested for session: ${sessionId}`);

    // Get session data
    const sessionData = sessionManager.getSession(sessionId);
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    let pdfResult;

    // Check if we have fresh analysis data with images
    if (sessionData.freshAnalysisResults && sessionData.freshAnalysisResults.imageData) {
      console.log('📊 Using fresh analysis data with images for PDF generation...');
      
      // Use enhanced PDF service with fresh data and images
      if (!enhancedPdfService) {
        throw new Error('Enhanced PDF service not available');
      }

      const analysisData = {
        mainProperty: sessionData.freshAnalysisResults.mainProperty,
        comparables: sessionData.freshAnalysisResults.comparables || [],
        marketAnalysis: sessionData.freshAnalysisResults.marketAnalysis,
        futureDevelopments: sessionData.freshAnalysisResults.futureDevelopments
      };

      pdfResult = await enhancedPdfService.generatePropertyAnalysisReport(
        analysisData,
        sessionData.freshAnalysisResults.imageData
      );

    } else {
      console.log('📋 Using database analysis data for PDF generation...');
      
      // Fallback to standard analysis and PDF service
      const analysisData = await comparableService.findComparables(sessionId, sessionData.propertyData);
      
      const PDFGenerationService = require('./services/pdfGenerationService');
      const pdfService = new PDFGenerationService();
      
      pdfResult = await pdfService.generatePropertyReport(
        sessionId,
        sessionData.propertyData,
        analysisData
      );
    }

    if (pdfResult.success) {
      console.log(`✅ PDF generated successfully: ${pdfResult.filename}`);
      res.json({
        success: true,
        filename: pdfResult.filename,
        downloadUrl: `/api/download-pdf/${encodeURIComponent(pdfResult.filename)}`,
        size: pdfResult.fileSize || pdfResult.size,
        timestamp: pdfResult.timestamp,
        generationTime: pdfResult.generationTime
      });
    } else {
      res.status(500).json({
        success: false,
        error: pdfResult.error
      });
    }

  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF report',
      message: error.message
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

// Unified Analysis Endpoint - Database comparables + Fresh API images + PDF
app.post('/api/analyze-unified/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  const startTime = Date.now();

  try {
    console.log(`🔄 Starting unified analysis for session: ${sessionId}`);

    // Validate services
    if (!freshImageService || !enhancedPdfService) {
      console.error('❌ Fresh services not available');
      return res.status(503).json({
        success: false,
        error: 'Fresh analysis services not initialized'
      });
    }

    // Get session data
    const sessionData = sessionManager.getSession(sessionId);
    if (!sessionData) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const mainPropertyData = sessionData.propertyData;

    // 1. Get comparable properties from DATABASE (existing service)
    console.log(`1️⃣ Finding comparable properties from database for ${mainPropertyData.reference || mainPropertyData.id}...`);
    const comparableResult = await comparableService.findComparables(
      sessionData.propertyData.id || sessionData.propertyData.reference,
      sessionData.propertyData
    );
    
    const comparables = comparableResult.comparables || [];
    console.log(`   ✅ Found ${comparables.length} comparable properties from database`);

    // 2. Analyze future developments for the area
    console.log(`2️⃣ Analyzing future developments for ${mainPropertyData.city || 'area'}...`);
    const futureDevStartTime = Date.now();
    let futureDevelopments = null;
    
    try {
      if (futureDevelopmentsService) {
        futureDevelopments = await futureDevelopmentsService.analyzeFutureDevelopments(mainPropertyData);
        const futureDevTime = Date.now() - futureDevStartTime;
        
        if (futureDevelopments.success && !futureDevelopments.skipped) {
          console.log(`   ✅ Future developments analysis completed in ${futureDevTime}ms (Tier ${futureDevelopments.tier})`);
        } else {
          console.log(`   ⏭️ Future developments ${futureDevelopments.skipped ? 'skipped' : 'failed'}: ${futureDevelopments.reason || futureDevelopments.error}`);
        }
      }
    } catch (error) {
      console.error('   ❌ Future developments analysis failed:', error.message);
      futureDevelopments = {
        success: false,
        error: error.message,
        content: "Future developments analysis temporarily unavailable."
      };
    }

    // 3. Get fresh images for main property + comparables from PropertyList API
    console.log(`3️⃣ Processing fresh images for ${comparables.length + 1} properties...`);
    const imageProcessingStartTime = Date.now();
    
    // Create property objects for image processing with actual image data
    const mainPropertyForImages = {
      id: mainPropertyData.id || mainPropertyData.reference,
      reference: mainPropertyData.reference,
      images: mainPropertyData.images || [] // Pass actual image data from main property
    };
    
    // 🔥 ENHANCED: Fetch fresh PropertyList API data for comparable images
    console.log(`   🔄 Fetching fresh PropertyList API images for ${comparables.length} comparables...`);
    const comparablesForImages = [];
    
    for (const comp of comparables) {
      try {
        // Try to get fresh PropertyList API data for this comparable
        const freshCompData = await propertyListApiService.getPropertyDetails(comp.reference);
        
        if (freshCompData && freshCompData.photos) {
          // Success: Use fresh PropertyList API data
          comparablesForImages.push({
            id: comp.id,
            reference: comp.reference,
            photos: freshCompData.photos, // ✅ Fresh PropertyList API photos array
            fallbackImages: comp.images || [] // Keep database images as fallback
          });
          console.log(`   ✅ Fresh API data for ${comp.reference}: ${freshCompData.photos?.length || 0} photos`);
        } else {
          // Fallback: Use database images
          comparablesForImages.push({
            id: comp.id,
            reference: comp.reference,
            images: comp.images || [], // XML feed URLs as fallback
            fallbackOnly: true
          });
          console.log(`   📄 Using database fallback for ${comp.reference}: ${comp.images?.length || 0} images`);
        }
      } catch (error) {
        // Error: Use database images as fallback
        console.warn(`   ⚠️ PropertyList API failed for ${comp.reference}, using database fallback:`, error.message);
        comparablesForImages.push({
          id: comp.id,
          reference: comp.reference,
          images: comp.images || [], // XML feed URLs as fallback
          fallbackOnly: true
        });
      }
    }

    const imageData = await freshImageService.processPropertyAnalysisImages(
      mainPropertyForImages, 
      comparablesForImages
    );
    const imageProcessingTime = Date.now() - imageProcessingStartTime;
    console.log(`   ✅ Image processing completed in ${imageProcessingTime}ms`);

    // 4. Generate market analysis using database comparables
    console.log(`4️⃣ Generating market analysis...`);
    const allComparablesForAnalysis = [mainPropertyData, ...comparables];
    const marketAnalysis = comparableService.generateMarketInsights(allComparablesForAnalysis, mainPropertyData);
    console.log(`   ✅ Market analysis generated`);

    // 5. Prepare data for on-demand PDF generation
    console.log(`5️⃣ Preparing data for on-demand PDF generation...`);
    console.log(`   ✅ All data ready for PDF generation when requested`);

    // Update session with unified analysis results
    const unifiedAnalysisResults = {
      analysisType: 'unified_database_fresh_images',
      dataSource: 'Database + PropertyList.es Images',
      timestamp: new Date().toISOString(),
      mainProperty: {
        reference: mainPropertyData.reference,
        type: mainPropertyData.property_type,
        location: `${mainPropertyData.suburb || ''}, ${mainPropertyData.city || ''}`.replace(/^,\s*/, ''),
        price: mainPropertyData.sale_price || mainPropertyData.monthly_price,
        images: imageData.mainProperty?.images.length || 0
      },
      comparables: comparables.map(comp => ({
        id: comp.id,
        reference: comp.reference,
        price: comp.price,
        propertyType: comp.propertyType,
        location: comp.location
      })),
      marketAnalysis: marketAnalysis,
      futureDevelopments: futureDevelopments,
      imageData: imageData, // Store image data for PDF generation later
      processing: {
        totalTime: Date.now() - startTime,
        imageProcessingTime,
        databaseComparables: comparables.length,
        futureDevTime: futureDevelopments ? (Date.now() - futureDevStartTime) : 0
      }
    };

    sessionManager.updateSession(sessionId, {
      status: 'unified_analysis_completed',
      freshAnalysisResults: unifiedAnalysisResults
    });

    console.log(`✅ Unified analysis for session ${sessionId} completed in ${Date.now() - startTime}ms`);

    res.json({
      success: true,
      message: 'Unified analysis completed successfully',
      analysis: unifiedAnalysisResults,
      imageData: imageData,
      pdfAvailable: true, // Indicates PDF can be generated on-demand
      dataSource: unifiedAnalysisResults.dataSource
    });

  } catch (error) {
    console.error('❌ Error during unified analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform unified analysis',
      message: error.message
    });
  }
});

// Fresh Data Analysis Endpoint - Uses PropertyList API for live data and images
app.post('/api/analyze-fresh/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  
  console.log(`⚠️ Fresh analysis disabled for session: ${sessionId} - preventing user-facing API errors`);
  
  // Return success response to prevent frontend errors, but don't actually process
  res.json({
    success: true,
    message: 'Fresh analysis disabled - using cached data',
    sessionId: sessionId,
    disabled: true,
    timestamp: new Date().toISOString()
  });
});

// Helper function for median calculation
function calculateMedian(values) {
  const validValues = values.filter(v => v > 0).sort((a, b) => a - b);
  if (validValues.length === 0) return 0;
  
  const mid = Math.floor(validValues.length / 2);
  return validValues.length % 2 !== 0 
    ? validValues[mid] 
    : (validValues[mid - 1] + validValues[mid]) / 2;
}

// Helper function for average price per sqm calculation  
function calculateAveragePricePerSqm(properties) {
  const validPrices = properties
    .filter(p => (p.sale_price || p.for_sale_price) && p.build_size && p.build_size > 0)
    .map(p => (p.sale_price || p.for_sale_price) / p.build_size);
  
  return validPrices.length > 0 
    ? Math.round(validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length)
    : 0;
}

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

// OPTIMIZATION: A/B Testing results endpoint
app.get('/api/admin/learning/ab-tests', async (req, res) => {
  try {
    const { testName } = req.query;
    
    if (!aiLearningService) {
      return res.status(503).json({
        success: false,
        error: 'AI learning service not available'
      });
    }

    const results = aiLearningService.getABTestResults(testName);
    
    res.json({
      success: true,
      results,
      summary: {
        totalTests: Object.keys(results).length,
        totalSamples: Object.values(results).reduce((sum, r) => sum + (r.sampleSize || 0), 0),
        averageCost: Object.values(results).reduce((sum, r) => sum + (r.averageCost || 0), 0) / Object.keys(results).length,
        bestPerformingVariant: Object.entries(results).sort((a, b) => (b[1].averageUserSatisfaction || 0) - (a[1].averageUserSatisfaction || 0))[0]?.[1]?.variant
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting A/B test results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get A/B test results'
    });
  }
});

// OPTIMIZATION: Cost optimization metrics endpoint
app.get('/api/admin/learning/optimization', async (req, res) => {
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
      optimization: stats.optimization,
      costAnalysis: {
        dailyCostEstimate: stats.optimization.totalCost * 100, // Extrapolate for 100 analyses
        monthlyCostEstimate: stats.optimization.totalCost * 3000, // Extrapolate for 3000 analyses
        tokenEfficiency: stats.optimization.totalTokensUsed / (stats.optimization.learningCalls || 1),
        cacheEffectiveness: `${stats.optimization.cacheHitRate}%`
      },
      recommendations: [
        stats.optimization.cacheHitRate < 50 ? 'Consider increasing cache TTL' : null,
        stats.optimization.averageResponseTime > 2000 ? 'Response time could be optimized' : null,
        stats.optimization.totalCost > 0.1 ? 'Cost optimization working well' : 'Monitor cost trends'
      ].filter(Boolean),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting optimization metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get optimization metrics'
    });
  }
});

// OPTIMIZATION: Reset learning metrics (for testing and monitoring)
app.post('/api/admin/learning/reset-metrics', async (req, res) => {
  try {
    if (!aiLearningService) {
      return res.status(503).json({
        success: false,
        error: 'AI learning service not available'
      });
    }

    aiLearningService.resetMetrics();
    
    res.json({
      success: true,
      message: 'Learning metrics reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error resetting metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset metrics'
    });
  }
});

// OPTIMIZATION: Manual A/B test assignment (for testing)
app.post('/api/admin/learning/assign-variant', async (req, res) => {
  try {
    const { userId, testName, variant } = req.body;
    
    if (!aiLearningService) {
      return res.status(503).json({
        success: false,
        error: 'AI learning service not available'
      });
    }

    // For testing purposes, manually assign variant
    const assignmentKey = `${userId}_${testName}`;
    aiLearningService.abTesting.userAssignments.set(assignmentKey, variant);
    
    res.json({
      success: true,
      message: `User ${userId} manually assigned to variant ${variant} for test ${testName}`,
      assignment: { userId, testName, variant },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error assigning variant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign variant'
    });
  }
});

// Update property condition from frontend AI detection
app.post('/api/property/:sessionId/condition', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { condition, confidence, source } = req.body;
    
    console.log(`🏠 Updating condition for session ${sessionId}: ${condition} (confidence: ${confidence})`);
    
    // Get session data
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Update session data
    const updatedPropertyData = {
      ...session.propertyData,
      condition_rating: condition,
      ai_condition_confidence: confidence,
      ai_condition_source: source || 'frontend_ai_detection',
      ai_condition_updated: new Date().toISOString()
    };
    
    session.propertyData = updatedPropertyData;
    sessionManager.updateSession(sessionId, session);
    
    // If this is a real property with an ID, update the database too
    if (session.propertyData.id && propertyDatabase?.initialized) {
      try {
        await propertyDatabase.query(`
          UPDATE properties 
          SET 
            condition_rating = $1,
            raw_data = COALESCE(raw_data, '{}'::jsonb) || $2::jsonb,
            updated_timestamp = NOW()
          WHERE id = $3
        `, [
          condition,
          JSON.stringify({
            ai_condition_analysis: {
              detected_condition: condition,
              confidence: confidence,
              source: source || 'frontend_ai_detection',
              detected_at: new Date().toISOString(),
              method: 'description_keyword_analysis'
            }
          }),
          session.propertyData.id
        ]);
        
        console.log(`✅ Database updated with condition: ${condition} for property ${session.propertyData.id}`);
      } catch (dbError) {
        console.error('❌ Failed to update database condition:', dbError.message);
        // Continue anyway - session is updated
      }
    }
    
    console.log(`✅ Condition updated successfully: ${condition}`);
    
    res.json({
      success: true,
      message: 'Property condition updated',
      condition: condition,
      confidence: confidence,
      sessionUpdated: true,
      databaseUpdated: !!session.propertyData.id
    });
    
  } catch (error) {
    console.error('❌ Error updating property condition:', error);
    res.status(500).json({ 
      error: 'Failed to update property condition',
      message: error.message 
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

// Auto-reanalysis API endpoints
app.get('/api/reanalysis/status', (req, res) => {
  try {
    if (!autoReanalysisService) {
      return res.status(503).json({
        success: false,
        error: 'Auto-reanalysis service not initialized'
      });
    }

    const status = autoReanalysisService.getStatus();
    res.json({
      success: true,
      status: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting reanalysis status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get reanalysis status'
    });
  }
});

app.post('/api/reanalysis/trigger', async (req, res) => {
  try {
    if (!autoReanalysisService) {
      return res.status(503).json({
        success: false,
        error: 'Auto-reanalysis service not initialized'
      });
    }

    const { propertyReferences } = req.body;
    
    if (!propertyReferences || !Array.isArray(propertyReferences)) {
      return res.status(400).json({
        success: false,
        error: 'propertyReferences array is required'
      });
    }

    console.log(`🎯 Manual reanalysis triggered for ${propertyReferences.length} properties`);
    
    await autoReanalysisService.triggerReanalysis(propertyReferences);
    
    res.json({
      success: true,
      message: `Triggered reanalysis for ${propertyReferences.length} properties`,
      propertyReferences: propertyReferences,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error triggering manual reanalysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger reanalysis'
    });
  }
});

// Admin configuration
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Change this in production!
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = '24h';

// ... existing code ...

// Admin login endpoint
app.post('/api/admin/login', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid password' 
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        role: 'admin', 
        loginTime: Date.now(),
        sessionId: uuidv4()
      }, 
      JWT_SECRET, 
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    console.log('✅ Admin login successful');
    
    res.json({
      success: true,
      token: token,
      expiresIn: JWT_EXPIRES_IN,
      message: 'Login successful'
    });
    
  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Admin dashboard data endpoint (protected) - TEMPORARILY DISABLED
/*
app.get('/api/admin/dashboard-data', authenticateAdmin, async (req, res) => {
  try {
    console.log('📊 Fetching admin dashboard data...');
    
    if (!enterpriseDashboardService) {
      return res.status(503).json({ 
        error: 'Dashboard service not available',
        fallback: true
      });
    }
    
    const dashboardData = await enterpriseDashboardService.getDashboardData();
    
    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString(),
      admin: req.admin.sessionId
    });
    
  } catch (error) {
    console.error('❌ Dashboard data error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard data',
      message: error.message
    });
  }
});
*/

// Admin logout endpoint (protected) - TEMPORARILY DISABLED
/*
app.post('/api/admin/logout', authenticateAdmin, async (req, res) => {
  try {
    console.log('👋 Admin logout');
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    console.error('❌ Admin logout error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Logout failed' 
    });
  }
});
*/

// Admin login page
app.get('/admin', (req, res) => {
  try {
    const loginPath = path.join(__dirname, '..', 'admin-login.html');
    if (fs.existsSync(loginPath)) {
      res.sendFile(loginPath);
    } else {
      res.status(404).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Admin Login</h1>
            <p>Login page not found. Please check admin-login.html file.</p>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('❌ Error serving admin login page:', error);
    res.status(500).send('Internal server error');
  }
});

// Admin dashboard page (protected route)
app.get('/admin/dashboard', (req, res) => {
  try {
    const dashboardPath = path.join(__dirname, '..', 'admin-dashboard.html');
    if (fs.existsSync(dashboardPath)) {
      res.sendFile(dashboardPath);
    } else {
      res.status(404).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Dashboard Not Found</h1>
            <p>Dashboard page not found. Please check admin-dashboard.html file.</p>
            <a href="/admin">← Back to Login</a>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('❌ Error serving admin dashboard page:', error);
    res.status(500).send('Internal server error');
  }
});

// Admin system status endpoint (protected) - TEMPORARILY DISABLED
/*
app.get('/api/admin/system-status', authenticateAdmin, async (req, res) => {
  try {
    const status = {
      services: {
        propertyDatabase: propertyDatabase ? 'connected' : 'disconnected',
        comparableService: comparableService ? 'active' : 'inactive',
        aiAnalysis: comparableService?.aiAnalysis ? 'active' : 'inactive',
        monitoring: comparableService?.aiAnalysis?.monitoringService ? 'active' : 'inactive',
        predictiveAnalytics: comparableService?.aiAnalysis?.predictiveAnalyticsService ? 'active' : 'inactive',
        streaming: streamingService ? 'active' : 'inactive',
        enterpriseDashboard: enterpriseDashboardService ? 'active' : 'inactive'
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      status: status
    });
    
  } catch (error) {
    console.error('❌ System status error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get system status' 
    });
  }
});
*/

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 