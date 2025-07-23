const NodeCache = require('node-cache');
const OpenAI = require('openai');

class LocationIntelligenceService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    this.cache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache
    
    // Initialize OpenAI for description parsing
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else {
      this.openai = null;
      console.log('OpenAI API key not found - AI description parsing will be disabled');
    }
    
    // Confidence thresholds for automatic matching
    this.thresholds = {
      exact: 1.0,           // Perfect match
      trigram: 0.85,        // pg_trgm similarity  
      fuzzy: 0.75,          // Levenshtein distance
      ai_fallback: 0.60     // AI extraction minimum
    };
    
    // Performance metrics
    this.metrics = {
      exactHits: 0,
      trigramHits: 0,
      fuzzyHits: 0,
      aiCalls: 0,
      totalQueries: 0,
      cacheHits: 0
    };
    
    // Initialize knowledge base
    this.urbanizationKnowledge = new Map();
    this.landmarkKnowledge = new Map();
    this.aliasKnowledge = new Map();
    
    // Warm cache on initialization
    this.warmSpanishCache();
    
    // Build knowledge base on initialization
    this.populateUrbanizationKnowledge();
  }

  /**
   * Main location resolution method - automatically finds best match
   */
  async resolveLocation(userInput, propertyContext = {}) {
    try {
      this.metrics.totalQueries++;
      
      console.log(`🔍 Resolving location: "${userInput}"`);
      
      // Clean and normalize input
      const normalizedInput = this.normalizeLocationInput(userInput);
      
      // Check cache first
      const cacheKey = `location:${normalizedInput.toLowerCase()}`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        console.log(`⚡ Cache hit: ${cached.location}`);
        return cached;
      }
      
      // 1. Try exact matches (fastest)
      const exactMatch = await this.findExactMatch(normalizedInput);
      if (exactMatch.confidence >= this.thresholds.exact) {
        this.metrics.exactHits++;
        this.cache.set(cacheKey, exactMatch);
        return exactMatch;
      }
      
      // 2. Try trigram similarity (your secret weapon!)
      const trigramMatch = await this.findTrigramMatch(normalizedInput);
      if (trigramMatch.confidence >= this.thresholds.trigram) {
        this.metrics.trigramHits++;
        this.cache.set(cacheKey, trigramMatch);
        return trigramMatch;
      }
      
      // 3. Try fuzzy matching with known aliases
      const fuzzyMatch = await this.findFuzzyMatch(normalizedInput);
      if (fuzzyMatch.confidence >= this.thresholds.fuzzy) {
        this.metrics.fuzzyHits++;
        this.cache.set(cacheKey, fuzzyMatch);
        return fuzzyMatch;
      }
      
      // 4. Parse structured address components
      const structuredMatch = await this.parseStructuredAddress(normalizedInput);
      if (structuredMatch.confidence >= this.thresholds.fuzzy) {
        this.cache.set(cacheKey, structuredMatch);
        return structuredMatch;
      }
      
      // 5. AI extraction as last resort
      const aiMatch = await this.extractWithAI(normalizedInput, propertyContext);
      if (aiMatch.confidence >= this.thresholds.ai_fallback) {
        this.metrics.aiCalls++;
        this.cache.set(cacheKey, aiMatch);
        return aiMatch;
      }
      
      // Return best available match even if confidence is low
      const bestMatch = this.selectBestMatch([exactMatch, trigramMatch, fuzzyMatch, structuredMatch, aiMatch]);
      this.cache.set(cacheKey, bestMatch);
      return bestMatch;
      
    } catch (error) {
      console.error('❌ Location resolution error:', error);
      return {
        location: userInput,
        confidence: 0.3,
        method: 'fallback',
        coordinates: null,
        urbanization: null,
        address: userInput,
        error: error.message
      };
    }
  }

  /**
   * Find exact matches in the database
   */
  async findExactMatch(input) {
    try {
      const result = await this.propertyDb.query(`
        SELECT 
          urbanization,
          suburb,
          city,
          latitude,
          longitude,
          COUNT(*) as property_count
        FROM properties 
        WHERE is_active = true 
          AND (
            LOWER(urbanization) = LOWER($1) OR
            LOWER(suburb) = LOWER($1) OR
            LOWER(address) = LOWER($1)
          )
        GROUP BY urbanization, suburb, city, latitude, longitude
        ORDER BY property_count DESC
        LIMIT 1
      `, [input]);

      if (result.rows.length > 0) {
        const match = result.rows[0];
        return {
          location: match.urbanization || match.suburb || input,
          confidence: 1.0,
          method: 'exact_match',
          coordinates: match.latitude && match.longitude ? {
            lat: parseFloat(match.latitude),
            lng: parseFloat(match.longitude)
          } : null,
          urbanization: match.urbanization,
          suburb: match.suburb,
          city: match.city,
          address: input,
          propertyCount: match.property_count
        };
      }

      return { confidence: 0, method: 'exact_match' };
    } catch (error) {
      console.error('❌ Exact match error:', error);
      return { confidence: 0, method: 'exact_match', error: error.message };
    }
  }

  /**
   * Find matches using PostgreSQL trigram similarity
   */
  async findTrigramMatch(input) {
    try {
      const result = await this.propertyDb.query(`
        SELECT 
          urbanization,
          suburb,
          city,
          latitude,
          longitude,
          similarity(urbanization, $1) as urbanization_score,
          similarity(COALESCE(suburb, ''), $1) as suburb_score,
          COUNT(*) as property_count
        FROM properties 
        WHERE is_active = true 
          AND (urbanization % $1 OR suburb % $1)
        GROUP BY urbanization, suburb, city, latitude, longitude
        ORDER BY GREATEST(
          similarity(urbanization, $1),
          similarity(COALESCE(suburb, ''), $1)
        ) DESC, property_count DESC
        LIMIT 5
      `, [input]);

      if (result.rows.length > 0) {
        const match = result.rows[0];
        const confidence = Math.max(match.urbanization_score || 0, match.suburb_score || 0);
        
        return {
          location: match.urbanization || match.suburb || input,
          confidence: confidence,
          method: 'trigram_similarity',
          coordinates: match.latitude && match.longitude ? {
            lat: parseFloat(match.latitude),
            lng: parseFloat(match.longitude)
          } : null,
          urbanization: match.urbanization,
          suburb: match.suburb,
          city: match.city,
          address: input,
          propertyCount: match.property_count,
          alternatives: result.rows.slice(1, 3).map(r => ({
            location: r.urbanization || r.suburb,
            confidence: Math.max(r.urbanization_score || 0, r.suburb_score || 0)
          }))
        };
      }

      return { confidence: 0, method: 'trigram_similarity' };
    } catch (error) {
      console.error('❌ Trigram match error:', error);
      return { confidence: 0, method: 'trigram_similarity', error: error.message };
    }
  }

  /**
   * Fuzzy matching with known aliases and common variations
   */
  async findFuzzyMatch(input) {
    try {
      // Check known aliases first
      const alias = this.aliasKnowledge.get(input.toLowerCase());
      if (alias) {
        return await this.findExactMatch(alias);
      }

      // Levenshtein distance matching
      const result = await this.propertyDb.query(`
        SELECT 
          urbanization,
          suburb,
          city,
          latitude,
          longitude,
          COUNT(*) as property_count
        FROM properties 
        WHERE is_active = true 
          AND (
            levenshtein(LOWER(urbanization), LOWER($1)) <= 3 OR
            levenshtein(LOWER(COALESCE(suburb, '')), LOWER($1)) <= 3
          )
        GROUP BY urbanization, suburb, city, latitude, longitude
        ORDER BY LEAST(
          levenshtein(LOWER(urbanization), LOWER($1)),
          levenshtein(LOWER(COALESCE(suburb, '')), LOWER($1))
        ) ASC, property_count DESC
        LIMIT 1
      `, [input]);

      if (result.rows.length > 0) {
        const match = result.rows[0];
        const distance = Math.min(
          this.levenshteinDistance(input.toLowerCase(), (match.urbanization || '').toLowerCase()),
          this.levenshteinDistance(input.toLowerCase(), (match.suburb || '').toLowerCase())
        );
        const confidence = Math.max(0, 1 - (distance / Math.max(input.length, 1)));
        
        return {
          location: match.urbanization || match.suburb || input,
          confidence: confidence,
          method: 'fuzzy_match',
          coordinates: match.latitude && match.longitude ? {
            lat: parseFloat(match.latitude),
            lng: parseFloat(match.longitude)
          } : null,
          urbanization: match.urbanization,
          suburb: match.suburb,
          city: match.city,
          address: input,
          propertyCount: match.property_count
        };
      }

      return { confidence: 0, method: 'fuzzy_match' };
    } catch (error) {
      console.error('❌ Fuzzy match error:', error);
      return { confidence: 0, method: 'fuzzy_match', error: error.message };
    }
  }

  /**
   * Parse structured Spanish address formats
   */
  parseStructuredAddress(input) {
    const patterns = [
      // "Urbanización Nueva Andalucía, Marbella"
      /(?:urbanización|urb\.?)\s+([^,]+)(?:,\s*([^,]+))?/i,
      // "Calle Real 123, Puerto Banús"
      /(?:calle|c\/)\s+([^,\d]+)\s*(\d+)?(?:,\s*([^,]+))?/i,
      // "Villa 15, Los Arqueros"
      /villa\s+(\d+)(?:,\s*([^,]+))?/i,
      // "Avenida del Mar, Nueva Andalucía"
      /(?:avenida|av\.?|avda\.?)\s+([^,]+)(?:,\s*([^,]+))?/i
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        const location = match[2] || match[1];
        return this.findExactMatch(location.trim()).then(result => ({
          ...result,
          method: 'structured_parse',
          address: input
        }));
      }
    }

    return Promise.resolve({ confidence: 0, method: 'structured_parse' });
  }

  /**
   * AI extraction with description analysis and geocoding fallback
   */
  async extractWithAI(input, context) {
    try {
      console.log(`🤖 AI extraction for: "${input}"`);
      
      // ENHANCED: If this is user input, prioritize proximity and landmark extraction
      if (context.userInput) {
        console.log(`👤 Processing user-provided location details`);
        
        // Extract proximity and landmark clues from user input
        const proximityClues = this.extractProximityClues(input);
        const landmarks = this.extractLandmarksFromDescription(input);
        
        console.log(`🚶 Found proximity clues:`, proximityClues);
        console.log(`🏛️ Found landmarks:`, landmarks);
        
        // Try to geocode the most relevant proximity clue or landmark
        if (proximityClues.length > 0) {
          const bestProximity = await this.geocodeProximityWithContext(proximityClues[0], context);
          if (bestProximity.coordinates) {
            return {
              location: bestProximity.location,
              coordinates: bestProximity.coordinates,
              confidence: 0.85, // High confidence for user input
              method: 'user_input_proximity',
              proximityClues: proximityClues,
              analysisMethod: 'user_proximity_analysis',
              userProvidedText: input
            };
          }
        }
        
        if (landmarks.length > 0) {
          const bestLandmark = await this.geocodeLandmarkWithContext(landmarks[0], context);
          if (bestLandmark.coordinates) {
            return {
              location: bestLandmark.location,
              coordinates: bestLandmark.coordinates,
              confidence: 0.85, // High confidence for user input
              method: 'user_input_landmark',
              landmarks: landmarks,
              analysisMethod: 'user_landmark_analysis',
              userProvidedText: input
            };
          }
        }
      }
      
      // Basic pattern extraction first
      const extracted = this.extractLocationPatterns(input);
      if (extracted) {
        try {
          const result = await this.findTrigramMatch(extracted);
          if (result.coordinates) {
            return {
              ...result,
              method: 'ai_extraction',
              confidence: Math.max(0.6, result.confidence),
              extracted: extracted
            };
          }
        } catch (dbError) {
          console.log(`⚠️ Database query failed, continuing with geocoding fallback`);
        }
      }

      // If no good location found and we have property description, analyze it for landmarks
      if (context.propertyData?.descriptions && (!extracted || extracted.length < 3)) {
        console.log(`🔍 Analyzing property description for location clues...`);
        const descriptionAnalysis = await this.analyzePropertyDescription(context.propertyData, context);
        if (descriptionAnalysis.coordinates) {
          return {
            ...descriptionAnalysis,
            method: 'ai_description_analysis',
            confidence: Math.max(0.7, descriptionAnalysis.confidence)
          };
        }
      }

      // ENHANCED: Use AI-powered multi-query geocoding for better results
      console.log(`🌍 Attempting enhanced geocoding for: "${input}"`);
      const geocoded = await this.geocodeLocationEnhanced(input, context);
      if (geocoded.coordinates) {
        return {
          location: geocoded.location,
          confidence: geocoded.confidence || geocoded.geocodingConfidence || (context.userInput ? 0.8 : 0.75),
          method: geocoded.method || (context.userInput ? 'user_input_enhanced_geocoding' : 'ai_enhanced_geocoding'),
          coordinates: geocoded.coordinates,
          address: input,
          geocoded: true,
          userProvidedText: context.userInput ? input : undefined,
          enhancedMetadata: {
            queryUsed: geocoded.queryUsed,
            queryIndex: geocoded.queryIndex,
            totalQueries: geocoded.totalQueries,
            locationDetails: geocoded.locationDetails,
            locationType: geocoded.locationType,
            placeId: geocoded.placeId
          }
        };
      }

      return { 
        confidence: 0.5, 
        method: 'ai_extraction', 
        location: extracted || input,
        coordinates: null,
        userProvidedText: context.userInput ? input : undefined
      };
    } catch (error) {
      console.error('❌ AI extraction error:', error);
      return { 
        confidence: 0.3, 
        method: 'ai_extraction', 
        error: error.message,
        userProvidedText: context.userInput ? input : undefined
      };
    }
  }

  /**
   * AI-powered comprehensive description parsing (Enhanced from old app)
   * Extracts structured location details: streets, urbanizations, landmarks, proximity clues
   */
  async analyzeDescriptionWithAI(userInput, propertyContext = {}) {
    try {
      if (!this.openai) {
        console.log('🔑 OpenAI API key not available for AI description parsing');
        return this.extractLocationPatterns(userInput); // Fallback to pattern matching
      }

      console.log(`🤖 AI-powered description analysis for: "${userInput}"`);

      const prompt = `Analyze this Spanish property location description to extract specific location details for accurate geocoding:

LOCATION INPUT: "${userInput}"

PROPERTY CONTEXT:
- City: ${propertyContext.city || 'Unknown'}
- Province: ${propertyContext.province || 'Unknown'}  
- Urbanization: ${propertyContext.urbanization || 'Not provided'}
- Suburb: ${propertyContext.suburb || 'Not provided'}

TASK: Extract structured location information that can help with precise geocoding and mapping.

EXTRACTION PRIORITIES:
1. URBANIZATIONS: Look for "Urbanización [Name]", "Urb. [Name]", or development names
2. SPECIFIC STREETS: Extract street names with or without numbers (e.g., "Avenida del Mar 15", "Calle Mayor")
3. NEIGHBORHOODS: Identify area names (e.g., "Puerto Banús", "Golden Mile", "Nueva Andalucía") 
4. LANDMARKS: Notable places with DISTANCE info (e.g., "next to golf club", "10 meters from [restaurant]")
5. PROXIMITY CLUES: Distance-based references (e.g., "walking distance to beach", "5 minutes from shopping")

IMPORTANT GUIDELINES:
- Preserve all Spanish characters (á, é, í, ó, ú, ñ, ü) exactly as they appear
- Extract only information explicitly mentioned in the description
- For landmarks, include both the place name AND distance information
- Distinguish between exact addresses vs. area references
- If multiple location types are mentioned, rank by specificity (street > urbanization > neighborhood)

Return a JSON response with this structure:
{
  "specificStreets": ["exact street names or addresses"],
  "urbanizations": ["development or urbanization names"], 
  "neighborhoods": ["area or neighborhood names"],
  "landmarks": [{"name": "landmark name", "distance": "distance info", "type": "landmark category"}],
  "proximityClues": [{"place": "reference point", "distance": "distance", "context": "full context"}],
  "enhancedAddress": "most complete address possible",
  "searchQueries": ["ordered list of optimal geocoding queries"],
  "confidence": 0.8
}

Focus on creating the most accurate search queries for Spanish property geocoding.`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system", 
            content: "You are a Spanish real estate location intelligence expert. Extract precise location details for accurate geocoding."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 1500
      });

      const response = completion.choices[0].message.content.trim();
      
      // Clean and parse JSON response
      let cleanedResponse = response;
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const locationDetails = JSON.parse(cleanedResponse);
      
      console.log(`🎯 AI extracted location details:`, locationDetails);
      
      return {
        ...locationDetails,
        method: 'ai_description_parsing',
        originalInput: userInput,
        aiProcessed: true
      };

    } catch (error) {
      console.error('❌ AI description parsing failed:', error);
      // Fallback to existing pattern matching
      return this.extractLocationPatterns(userInput);
    }
  }

  /**
   * Generate optimal geocoding queries from AI-parsed location details
   */
  generateOptimalGeocodingQueries(locationDetails, originalInput, context = {}) {
    const queries = [];
    const city = context.city || 'Marbella';
    const province = context.province || 'Málaga';
    
    // Handle case where locationDetails is null (AI parsing failed)
    if (!locationDetails) {
      locationDetails = {
        specificStreets: [],
        urbanizations: [],
        neighborhoods: [],
        landmarks: [],
        proximityClues: [],
        enhancedAddress: null,
        searchQueries: []
      };
    }
    
    // Priority 1: Specific streets (highest accuracy)
    if (locationDetails.specificStreets?.length > 0) {
      locationDetails.specificStreets.forEach(street => {
        queries.push(`${street}, ${city}, ${province}, Spain`);
      });
    }

    // Priority 2: Urbanization + context
    if (locationDetails.urbanizations?.length > 0) {
      locationDetails.urbanizations.forEach(urbanization => {
        queries.push(`${urbanization}, ${city}, ${province}, Spain`);
        
        // Combine with landmarks if available
        if (locationDetails.landmarks?.length > 0) {
          const landmark = locationDetails.landmarks[0];
          queries.push(`${urbanization} near ${landmark.name}, ${city}, ${province}, Spain`);
        }
      });
    }

    // Priority 3: Neighborhood + landmarks
    if (locationDetails.neighborhoods?.length > 0 && locationDetails.landmarks?.length > 0) {
      const neighborhood = locationDetails.neighborhoods[0];
      const landmark = locationDetails.landmarks[0];
      queries.push(`${neighborhood} near ${landmark.name}, ${city}, ${province}, Spain`);
    }

    // Priority 4: Proximity clues (for landmark-based locations)
    if (locationDetails.proximityClues?.length > 0) {
      locationDetails.proximityClues.forEach(clue => {
        queries.push(`${clue.place}, ${city}, ${province}, Spain`);
      });
    }

    // Priority 5: Enhanced address from AI
    if (locationDetails.enhancedAddress) {
      queries.push(locationDetails.enhancedAddress);
    }

    // Priority 6: Use AI's suggested queries
    if (locationDetails.searchQueries?.length > 0) {
      queries.push(...locationDetails.searchQueries);
    }

    // Fallback: Original input
    if (queries.length === 0) {
      queries.push(`${originalInput}, ${city}, ${province}, Spain`);
    }

    // Remove duplicates while preserving order
    const uniqueQueries = [...new Set(queries)];
    
    console.log(`🔍 Generated ${uniqueQueries.length} optimal geocoding queries:`, uniqueQueries);
    
    return uniqueQueries;
  }

  /**
   * Analyze property description for location landmarks and contextual clues
   */
  async analyzePropertyDescription(propertyData, context) {
    try {
      // Extract description text
      let description = '';
      if (typeof propertyData.descriptions === 'string') {
        description = propertyData.descriptions;
      } else if (typeof propertyData.descriptions === 'object') {
        // Try different language descriptions
        description = propertyData.descriptions.en || 
                     propertyData.descriptions.es || 
                     Object.values(propertyData.descriptions)[0] || '';
      }

      if (!description || description.length < 20) {
        console.log('📝 No meaningful description found for analysis');
        return { coordinates: null, confidence: 0 };
      }

      console.log(`📝 Analyzing description: "${description.substring(0, 100)}..."`);

      // Extract landmark and location clues
      const landmarks = this.extractLandmarksFromDescription(description);
      console.log(`🏛️ Found landmarks:`, landmarks);

      // If we have landmarks, try to geocode them with context
      if (landmarks.length > 0) {
        const bestLandmark = await this.geocodeLandmarkWithContext(landmarks[0], context);
        if (bestLandmark.coordinates) {
          return {
            location: bestLandmark.location,
            coordinates: bestLandmark.coordinates,
            confidence: 0.8,
            landmarks: landmarks,
            analysisMethod: 'description_landmarks',
            originalDescription: description.substring(0, 200)
          };
        }
      }

      // Try to extract walking distances and nearby places
      const proximityClues = this.extractProximityClues(description);
      console.log(`🚶 Found proximity clues:`, proximityClues);

      if (proximityClues.length > 0) {
        const bestProximity = await this.geocodeProximityWithContext(proximityClues[0], context);
        if (bestProximity.coordinates) {
          return {
            location: bestProximity.location,
            coordinates: bestProximity.coordinates,
            confidence: 0.75,
            proximityClues: proximityClues,
            analysisMethod: 'description_proximity',
            originalDescription: description.substring(0, 200)
          };
        }
      }

      return { coordinates: null, confidence: 0 };

    } catch (error) {
      console.error('❌ Description analysis error:', error);
      return { coordinates: null, confidence: 0, error: error.message };
    }
  }

  /**
   * Extract landmarks from property description
   */
  extractLandmarksFromDescription(description) {
    const landmarks = [];
    const text = description.toLowerCase();

    // Common Spanish/English landmark patterns
    const landmarkPatterns = [
      // Golf courses
      /(?:golf|campo de golf)\s+([^.,!?]+)/gi,
      // Beaches and coast
      /(?:playa|beach|costa)\s+([^.,!?]+)/gi,
      // Clubs and facilities  
      /(?:club|paddle club|tennis club|beach club)\s+([^.,!?]+)/gi,
      // Shopping and commercial
      /(?:centro comercial|shopping center|mall|plaza)\s+([^.,!?]+)/gi,
      // Restaurants and establishments
      /(?:restaurante|restaurant|hotel)\s+([^.,!?]+)/gi,
      // Schools and facilities
      /(?:colegio|school|hospital)\s+([^.,!?]+)/gi,
      // Specific proper nouns (landmarks)
      /(?:cerca de|next to|junto a|near)\s+([A-Z][a-zA-Z\s]+)/gi
    ];

    for (const pattern of landmarkPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        if (match[1] && match[1].trim().length > 3) {
          landmarks.push({
            type: this.categorizeLandmark(match[0]),
            name: match[1].trim(),
            context: match[0]
          });
        }
      }
    }

    // Remove duplicates and sort by relevance
    return landmarks
      .filter((landmark, index, self) => 
        index === self.findIndex(l => l.name === landmark.name)
      )
      .slice(0, 3); // Top 3 most relevant
  }

  /**
   * Extract proximity and walking distance clues
   */
  extractProximityClues(description) {
    const proximityClues = [];
    const text = description.toLowerCase();

    // Proximity patterns with distances
    const proximityPatterns = [
      // Walking distances
      /(\d+)\s*(?:min|minute|minuto)s?\s*(?:walk|walking|caminando|a pie)\s*(?:to|a|de)\s+([^.,!?]+)/gi,
      // Meter distances  
      /(\d+)\s*(?:m|meter|metro)s?\s*(?:from|de|to|a)\s+([^.,!?]+)/gi,
      // General proximity
      /(?:close to|cerca de|próximo a|next to|junto a)\s+([^.,!?]+)/gi,
      // View references
      /(?:view|vista|overlooking|vistas a)\s+(?:to|of|a|de)?\s*([^.,!?]+)/gi
    ];

    for (const pattern of proximityPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const distance = match[1] || null;
        const place = match[2] || match[1];
        
        if (place && place.trim().length > 3) {
          proximityClues.push({
            place: place.trim(),
            distance: distance,
            context: match[0],
            relevance: this.calculateProximityRelevance(match[0], distance)
          });
        }
      }
    }

    // Sort by relevance and return top clues
    return proximityClues
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 3);
  }

  /**
   * Categorize landmark type for better geocoding
   */
  categorizeLandmark(landmarkText) {
    const text = landmarkText.toLowerCase();
    if (text.includes('golf')) return 'golf_course';
    if (text.includes('playa') || text.includes('beach')) return 'beach';
    if (text.includes('club')) return 'club';
    if (text.includes('centro') || text.includes('mall')) return 'shopping';
    if (text.includes('hotel')) return 'hotel';
    if (text.includes('restaurante') || text.includes('restaurant')) return 'restaurant';
    return 'landmark';
  }

  /**
   * Calculate relevance score for proximity clues
   */
  calculateProximityRelevance(context, distance) {
    let score = 5; // Base score
    
    // Boost for specific distances
    if (distance) {
      const dist = parseInt(distance);
      if (dist <= 5) score += 3; // Very close
      else if (dist <= 15) score += 2; // Close
      else if (dist <= 30) score += 1; // Moderate
    }
    
    // Boost for walking references
    if (context.includes('walk') || context.includes('caminando')) score += 2;
    
    // Boost for specific landmark types
    if (context.includes('beach') || context.includes('playa')) score += 2;
    if (context.includes('golf')) score += 2;
    if (context.includes('centro') || context.includes('plaza')) score += 1;
    
    return score;
  }

  /**
   * Geocode landmark with city context
   */
  async geocodeLandmarkWithContext(landmark, context) {
    const city = context.city || context.propertyData?.city || '';
    const searchQuery = `${landmark.name}, ${city}, Spain`;
    
    console.log(`🏛️ Geocoding landmark: "${searchQuery}"`);
    
    const result = await this.geocodeLocation(searchQuery, context);
    if (result.coordinates) {
      return {
        location: `Near ${landmark.name}`,
        coordinates: result.coordinates,
        landmark: landmark,
        searchQuery: searchQuery
      };
    }
    
    return { coordinates: null };
  }

  /**
   * Geocode proximity clue with context
   */
  async geocodeProximityWithContext(proximityClue, context) {
    const city = context.city || context.propertyData?.city || '';
    const searchQuery = `${proximityClue.place}, ${city}, Spain`;
    
    console.log(`🚶 Geocoding proximity: "${searchQuery}"`);
    
    const result = await this.geocodeLocation(searchQuery, context);
    if (result.coordinates) {
      return {
        location: `Near ${proximityClue.place}`,
        coordinates: result.coordinates,
        proximityClue: proximityClue,
        searchQuery: searchQuery
      };
    }
    
    return { coordinates: null };
  }

  /**
   * Geocode location using Google Geocoding API
   */
  /**
   * Enhanced multi-query geocoding with AI-powered fallbacks (from old app)
   */
  async geocodeLocationEnhanced(userInput, context = {}) {
    try {
      console.log(`🎯 Enhanced geocoding for: "${userInput}"`);

      // Step 1: Try AI-powered description parsing first
      const locationDetails = await this.analyzeDescriptionWithAI(userInput, context);
      
      // Step 2: Generate optimal geocoding queries
      const queries = this.generateOptimalGeocodingQueries(locationDetails, userInput, context);
      
      // Step 3: Try each query with confidence-based selection
      let fallbackResult = null;
      
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        console.log(`🔍 Trying query ${i + 1}/${queries.length}: "${query}"`);
        
        const result = await this.geocodeLocation(query, context);
        
        if (result.coordinates && result.geocodingConfidence > 0.8) {
          console.log(`✅ High-confidence geocoding success with query ${i + 1}`);
          return {
            ...result,
            method: 'enhanced_multi_query',
            queryUsed: query,
            queryIndex: i + 1,
            totalQueries: queries.length,
            locationDetails: locationDetails,
            confidence: Math.min(0.95, result.geocodingConfidence + 0.1) // Boost confidence for multi-query success
          };
        } else if (result.coordinates && result.geocodingConfidence > 0.5) {
          // Store medium confidence result as fallback
          console.log(`🟡 Medium-confidence result found, continuing to try better options`);
          fallbackResult = {
            ...result,
            method: 'enhanced_multi_query_fallback',
            queryUsed: query,
            queryIndex: i + 1,
            totalQueries: queries.length,
            locationDetails: locationDetails
          };
        }
      }

      // Return fallback result if we found one
      if (fallbackResult) {
        console.log(`📍 Using fallback result from enhanced geocoding`);
        return fallbackResult;
      }

      // Final fallback: try original input with basic geocoding
      console.log(`🔄 All enhanced queries failed, trying basic geocoding`);
      const basicResult = await this.geocodeLocation(userInput, context);
      if (basicResult.coordinates) {
        return {
          ...basicResult,
          method: 'basic_fallback',
          locationDetails: locationDetails
        };
      }

      return { 
        coordinates: null, 
        location: userInput,
        method: 'enhanced_geocoding_failed',
        locationDetails: locationDetails
      };

    } catch (error) {
      console.error('❌ Enhanced geocoding error:', error);
      // Final fallback to basic geocoding
      return await this.geocodeLocation(userInput, context);
    }
  }

  /**
   * Basic geocoding method (Google Geocoding API) with enhanced confidence scoring
   */
  async geocodeLocation(locationName, context = {}) {
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.log('🔑 Google Maps API key not available for geocoding');
        return { coordinates: null, location: locationName };
      }

      // Build search query with context
      let searchQuery = locationName;
      if (context.city && !locationName.toLowerCase().includes(context.city.toLowerCase())) {
        searchQuery += `, ${context.city}`;
      }
      searchQuery += ', Spain'; // Default to Spain for our use case

      console.log(`🌍 Geocoding: "${searchQuery}"`);

      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        const location = result.geometry.location;
        
        // Extract components for better location info
        const components = result.address_components;
        const locality = components.find(c => c.types.includes('locality'))?.long_name;
        const sublocality = components.find(c => c.types.includes('sublocality'))?.long_name;
        const adminLevel2 = components.find(c => c.types.includes('administrative_area_level_2'))?.long_name;

        const resolvedLocation = sublocality || locality || adminLevel2 || locationName;

        // Enhanced confidence calculation
        const confidence = this.calculateEnhancedGeocodingConfidence(result, searchQuery);

        console.log(`✅ Geocoded "${searchQuery}" to ${location.lat}, ${location.lng} (${resolvedLocation}) - Confidence: ${(confidence * 100).toFixed(1)}%`);

        return {
          location: resolvedLocation,
          coordinates: {
            lat: location.lat,
            lng: location.lng
          },
          formattedAddress: result.formatted_address,
          placeId: result.place_id,
          geocodingConfidence: confidence,
          locationType: result.geometry.location_type,
          addressComponents: result.address_components,
          types: result.types
        };
      } else {
        console.log(`❌ Geocoding failed for "${searchQuery}": ${data.status}`);
        return { coordinates: null, location: locationName, geocodingConfidence: 0 };
      }

    } catch (error) {
      console.error('❌ Geocoding error:', error);
      return { coordinates: null, location: locationName, error: error.message, geocodingConfidence: 0 };
    }
  }

  /**
   * Enhanced confidence scoring with precision analysis (from old app)
   */
  calculateEnhancedGeocodingConfidence(geocodingResult, originalQuery) {
    let confidence = 0.6; // Lower base confidence, build up based on quality indicators

    // Primary factor: Location precision type (Google's accuracy indicator)
    switch (geocodingResult.geometry.location_type) {
      case 'ROOFTOP':
        confidence += 0.35; // Highest accuracy - exact address
        break;
      case 'RANGE_INTERPOLATED':
        confidence += 0.25; // High accuracy - interpolated along street
        break;
      case 'GEOMETRIC_CENTER':
        confidence += 0.15; // Medium accuracy - center of result (polygon)
        break;
      case 'APPROXIMATE':
        confidence += 0.05; // Low accuracy - approximate location
        break;
    }

    // Secondary factor: Address component specificity
    const types = geocodingResult.types || [];
    
    // Boost for specific address types
    if (types.includes('street_address')) {
      confidence += 0.15;
    } else if (types.includes('premise')) {
      confidence += 0.12;
    } else if (types.includes('subpremise')) {
      confidence += 0.10;
    } else if (types.includes('establishment')) {
      confidence += 0.08;
    } else if (types.includes('point_of_interest')) {
      confidence += 0.06;
    }

    // Tertiary factor: Administrative level specificity  
    if (types.includes('sublocality')) {
      confidence += 0.05;
    } else if (types.includes('locality')) {
      confidence += 0.03;
    } else if (types.includes('administrative_area_level_3')) {
      confidence += 0.02;
    }

    // Quality indicators from address components
    const components = geocodingResult.address_components || [];
    
    // Boost if we have detailed components
    if (components.some(c => c.types.includes('street_number'))) {
      confidence += 0.08; // Has street number
    }
    if (components.some(c => c.types.includes('route'))) {
      confidence += 0.05; // Has street name
    }
    if (components.some(c => c.types.includes('postal_code'))) {
      confidence += 0.03; // Has postal code
    }

    // Penalize very generic results
    if (types.includes('country') && types.length === 1) {
      confidence -= 0.4; // Country-level only
    } else if (types.includes('administrative_area_level_1') && types.length <= 2) {
      confidence -= 0.3; // Province-level only
    } else if (types.includes('administrative_area_level_2') && types.length <= 3) {
      confidence -= 0.2; // Municipality-level only
    }

    // Boost for Spanish real estate relevant types
    if (types.includes('colloquial_area') || types.includes('neighborhood')) {
      confidence += 0.04; // Neighborhood/urbanization match
    }

    // Query-result matching analysis
    const queryLower = originalQuery.toLowerCase();
    const formattedLower = geocodingResult.formatted_address.toLowerCase();
    
    // Boost if query terms appear in result
    const queryWords = queryLower.split(/[\s,]+/).filter(w => w.length > 2);
    const matchingWords = queryWords.filter(word => formattedLower.includes(word));
    const matchRatio = queryWords.length > 0 ? matchingWords.length / queryWords.length : 0;
    
    confidence += matchRatio * 0.1; // Up to 10% boost for query-result alignment

    // Ensure confidence stays within bounds
    confidence = Math.max(0.1, Math.min(0.98, confidence));

    return confidence;
  }

  /**
   * Legacy confidence calculation (kept for backward compatibility)
   */
  calculateGeocodingConfidence(geocodingResult) {
    // Use enhanced calculation
    return this.calculateEnhancedGeocodingConfidence(geocodingResult, '');
  }

  /**
   * Extract location patterns from text
   */
  extractLocationPatterns(text) {
    // Common Spanish location indicators
    const patterns = [
      /(?:cerca de|near|próximo a)\s+([^,.]+)/i,
      /(?:en|in)\s+([A-Z][a-z\s]+)/g,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        return matches[1] || matches[0];
      }
    }
    return null;
  }

  /**
   * Select best match from multiple candidates
   */
  selectBestMatch(candidates) {
    const validCandidates = candidates.filter(c => c.confidence > 0);
    if (validCandidates.length === 0) {
      return { confidence: 0.2, method: 'no_match', location: 'Unknown location' };
    }

    return validCandidates.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
  }

  /**
   * Warm cache with top Spanish urbanizations from your 4,743 properties
   */
  async warmSpanishCache() {
    try {
      console.log('🔥 Warming location cache from property database...');
      
      const topUrbanizations = await this.propertyDb.query(`
        SELECT 
          urbanization,
          city,
          AVG(latitude) as avg_lat,
          AVG(longitude) as avg_lng,
          COUNT(*) as property_count
        FROM properties 
        WHERE urbanization IS NOT NULL 
          AND urbanization != ''
          AND is_active = true
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
        GROUP BY urbanization, city
        ORDER BY COUNT(*) DESC 
        LIMIT 100
      `);

      for (const urb of topUrbanizations.rows) {
        const cacheKey = `location:${urb.urbanization.toLowerCase()}`;
        this.cache.set(cacheKey, {
          location: urb.urbanization,
          confidence: 1.0,
          method: 'cached',
          coordinates: {
            lat: parseFloat(urb.avg_lat),
            lng: parseFloat(urb.avg_lng)
          },
          urbanization: urb.urbanization,
          city: urb.city,
          propertyCount: urb.property_count
        });
      }

      // Build common aliases for Spanish locations
      this.buildSpanishAliases();
      
      console.log(`✅ Cache warmed with ${topUrbanizations.rows.length} urbanizations`);
    } catch (error) {
      console.error('❌ Cache warming error:', error);
    }
  }

  /**
   * Build aliases for common Spanish location variations
   */
  buildSpanishAliases() {
    const aliases = {
      'nueva andalucia': 'Nueva Andalucía',
      'nueva andalusia': 'Nueva Andalucía',
      'puerto banus': 'Puerto Banús',
      'san pedro': 'San Pedro de Alcántara',
      'la quinta': 'La Quinta Golf',
      'los arqueros': 'Los Arqueros Golf',
      'guadalmina': 'Guadalmina Baja',
      'sotogrande': 'Sotogrande Alto'
    };

    for (const [alias, canonical] of Object.entries(aliases)) {
      this.aliasKnowledge.set(alias, canonical);
    }
  }

  /**
   * Normalize location input for better matching
   */
  normalizeLocationInput(input) {
    return input
      .trim()
      .replace(/[^\w\sáéíóúñü]/gi, ' ')  // Keep Spanish characters
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  /**
   * Simple Levenshtein distance calculation
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const total = this.metrics.totalQueries;
    return {
      ...this.metrics,
      cacheHitRate: total > 0 ? (this.metrics.cacheHits / total * 100).toFixed(1) + '%' : '0%',
      systemResolveRate: total > 0 ? ((total - this.metrics.aiCalls) / total * 100).toFixed(1) + '%' : '0%'
    };
  }

  /**
   * Populate urbanization knowledge base from existing properties
   */
  async populateUrbanizationKnowledge() {
    try {
      console.log('🏗️ Building urbanization knowledge base from property database...');
      
      const urbanizations = await this.propertyDb.query(`
        SELECT 
          urbanization,
          city,
          COUNT(*) as property_count,
          AVG(latitude) as avg_lat,
          AVG(longitude) as avg_lng,
          array_agg(DISTINCT suburb) FILTER (WHERE suburb IS NOT NULL) as related_suburbs
        FROM properties 
        WHERE urbanization IS NOT NULL 
          AND urbanization != ''
          AND is_active = true
          AND latitude IS NOT NULL 
          AND longitude IS NOT NULL
        GROUP BY urbanization, city
        HAVING COUNT(*) >= 2  -- Only urbanizations with multiple properties
        ORDER BY COUNT(*) DESC
      `);

      console.log(`📊 Found ${urbanizations.rows.length} urbanizations to process`);
      
      for (const urb of urbanizations.rows) {
        const normalizedName = urb.urbanization.toLowerCase().trim();
        
        // Create aliases from common variations
        const aliases = this.generateAliases(urb.urbanization);
        
        try {
          await this.propertyDb.query(`
            INSERT INTO urbanization_knowledge 
            (name, name_normalized, city, latitude, longitude, property_count, aliases, landmarks)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (name_normalized, city) 
            DO UPDATE SET 
              property_count = EXCLUDED.property_count,
              latitude = EXCLUDED.latitude,
              longitude = EXCLUDED.longitude,
              updated_at = NOW()
          `, [
            urb.urbanization,
            normalizedName,
            urb.city,
            parseFloat(urb.avg_lat),
            parseFloat(urb.avg_lng),
            urb.property_count,
            aliases,
            urb.related_suburbs || []
          ]);
        } catch (insertError) {
          console.error(`⚠️  Failed to insert ${urb.urbanization}:`, insertError.message);
        }
      }

      console.log(`✅ Urbanization knowledge base populated with ${urbanizations.rows.length} entries`);
    } catch (error) {
      console.error('❌ Error populating urbanization knowledge:', error);
    }
  }

  /**
   * Generate aliases for urbanization names
   */
  generateAliases(name) {
    const aliases = [];
    const normalized = name.toLowerCase();
    
    // Remove accents
    const withoutAccents = normalized
      .replace(/á/g, 'a')
      .replace(/é/g, 'e')
      .replace(/í/g, 'i')
      .replace(/ó/g, 'o')
      .replace(/ú/g, 'u')
      .replace(/ñ/g, 'n');
    
    if (withoutAccents !== normalized) {
      aliases.push(withoutAccents);
    }
    
    // Common abbreviations
    if (normalized.includes('urbanización')) {
      aliases.push(normalized.replace('urbanización', 'urb'));
      aliases.push(normalized.replace('urbanización ', ''));
    }
    
    if (normalized.includes('nueva')) {
      aliases.push(normalized.replace('nueva', 'new'));
    }
    
    if (normalized.includes('los ')) {
      aliases.push(normalized.replace('los ', ''));
    }
    
    if (normalized.includes('la ')) {
      aliases.push(normalized.replace('la ', ''));
    }
    
    return [...new Set(aliases)]; // Remove duplicates
  }

  /**
   * Log location resolution attempt for learning
   */
  async logLocationResolution(inputText, result, processingTime, success = true, error = null) {
    try {
      await this.propertyDb.query(`
        INSERT INTO location_resolution_log 
        (input_text, method, confidence, result, processing_time_ms, success, error_message)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        inputText,
        result.method || 'unknown',
        result.confidence || 0,
        JSON.stringify(result),
        processingTime,
        success,
        error?.message || null
      ]);

      // If AI was used and successful, consider adding to knowledge base
      if (result.method === 'ai_extraction' && result.confidence > 0.8 && success) {
        await this.addToKnowledgeBase(result);
      }
    } catch (logError) {
      console.error('⚠️  Failed to log location resolution:', logError);
    }
  }

  /**
   * Add successful AI extraction to knowledge base
   */
  async addToKnowledgeBase(result) {
    if (!result.urbanization || !result.city) return;
    
    try {
      const normalizedName = result.urbanization.toLowerCase().trim();
      
      // Check if we already know this urbanization
      const existing = await this.propertyDb.query(`
        SELECT id FROM urbanization_knowledge 
        WHERE name_normalized = $1 AND city = $2
      `, [normalizedName, result.city]);
      
      if (existing.rows.length === 0) {
        // Add new urbanization from AI learning
        await this.propertyDb.query(`
          INSERT INTO urbanization_knowledge 
          (name, name_normalized, city, latitude, longitude, property_count, confidence_score)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          result.urbanization,
          normalizedName,
          result.city,
          result.coordinates?.lat || null,
          result.coordinates?.lng || null,
          1, // Start with count of 1
          result.confidence
        ]);
        
        console.log(`🧠 AI learned new urbanization: ${result.urbanization}, ${result.city}`);
      }
    } catch (error) {
      console.error('⚠️  Failed to add AI result to knowledge base:', error);
    }
  }

  /**
   * Enhanced resolve method with logging
   */
  async resolveLocationWithLogging(userInput, propertyContext = {}) {
    const startTime = Date.now();
    let result = null;
    let success = true;
    let error = null;

    try {
      result = await this.resolveLocation(userInput, propertyContext);
      success = result.confidence > 0.3; // Consider low confidence as partial failure
    } catch (err) {
      success = false;
      error = err;
      result = {
        location: userInput,
        confidence: 0,
        method: 'error',
        error: err.message
      };
    } finally {
      const processingTime = Date.now() - startTime;
      
      // Log the resolution attempt
      await this.logLocationResolution(userInput, result, processingTime, success, error);
    }

    return result;
  }

  /**
   * Get learning analytics
   */
  async getLearningAnalytics(days = 30) {
    try {
      const analytics = await this.propertyDb.query(`
        SELECT 
          method,
          COUNT(*) as attempts,
          AVG(confidence) as avg_confidence,
          AVG(processing_time_ms) as avg_processing_time,
          COUNT(*) FILTER (WHERE success = true) as successful_attempts,
          COUNT(*) FILTER (WHERE confidence >= 0.8) as high_confidence_attempts
        FROM location_resolution_log 
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY method
        ORDER BY attempts DESC
      `);

      const knowledgeStats = await this.propertyDb.query(`
        SELECT 
          COUNT(*) as total_urbanizations,
          AVG(property_count) as avg_properties_per_urbanization,
          COUNT(*) FILTER (WHERE property_count >= 10) as well_known_urbanizations
        FROM urbanization_knowledge
      `);

      return {
        resolutionMethods: analytics.rows,
        knowledgeBase: knowledgeStats.rows[0],
        timeframe: `${days} days`
      };
    } catch (error) {
      console.error('❌ Error getting learning analytics:', error);
      return { error: error.message };
    }
  }
}

module.exports = LocationIntelligenceService; 