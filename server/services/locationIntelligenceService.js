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
    
    // CORRECTED: Based on actual PropertyList.es XML data analysis
    // OPTIMIZATION 1: Regex Pre-Filter Patterns (saves ~25% of AI calls)
    this.spanishAddressPatterns = {
      // Spanish street patterns
      streets: [
        /\b(Calle|C\/)\s+([A-Za-zÁÉÍÓÚÑñüáéíóú\s]+)\s*(\d+)?\b/gi,
        /\b(Avenida|Av\.?|Avda\.?)\s+([A-Za-zÁÉÍÓÚÑñüáéíóú\s]+)\s*(\d+)?\b/gi,
        /\b(Carretera|Ctra\.?)\s+([A-Za-zÁÉÍÓÚÑñüáéíóú\s\-0-9]+)\s*(\d+)?\b/gi,
        /\b(Paseo|Pseo\.?)\s+([A-Za-zÁÉÍÓÚÑñüáéíóú\s]+)\s*(\d+)?\b/gi,
        /\b(Plaza|Pl\.?)\s+([A-Za-zÁÉÍÓÚÑñüáéíóú\s]+)\s*(\d+)?\b/gi
      ],
      
      // Urbanization patterns
      urbanizations: [
        /\b(Urbanización|Urbanizacion|Urb\.?)\s+([A-Za-zÁÉÍÓÚÑñüáéíóú\s]+)/gi,
        /\b(Residencial)\s+([A-Za-zÁÉÍÓÚÑñüáéíóú\s]+)/gi,
        /\b(Hacienda|Villa|Villas)\s+([A-Za-zÁÉÍÓÚÑñüáéíóú\s]+)/gi
      ],
      
      // Known area patterns
      knownAreas: [
        /\b(Puerto\s+Banús|Puerto\s+Banus)/gi,
        /\b(Nueva\s+Andalucía|Nueva\s+Andalucia)/gi,
        /\b(Golden\s+Mile)/gi,
        /\b(Marbella\s+Club)/gi,
        /\b(Las\s+Chapas)/gi,
        /\b(San\s+Pedro)/gi,
        /\b(Estepona)/gi
      ]
    };
    
    // Optimization tracking
    this.optimizationStats = {
      regexHits: 0,
      aiCallsAvoided: 0,
      totalQueries: 0
    };

    this.knownUrbanizations = new Set([
      // Real specific residential developments (from database analysis)
      'el chaparral', 'selwo', 'altos de los monteros', 'los altos de los monteros',
      'bel air', 'cascada de camojan', 'calanova golf', 'boladilla village',
      'la campana', 'real de la quinta', 'doña julia', 'costalita',
      'aloha', 'santa clara golf', 'valle romano', 'hacienda las chapas',
      'las lomas del marbella club', 'la cerquilla', 'las brisas golf',
      'los naranjos golf', 'guadalpín banús', 'lomas del marqués',
      'casablanca', 'gray d\'albion', 'altos de valderrama',
      'azahar de marbella', 'el olivar', 'reserva de marbella',
      'caserio', 'calle jerusalen ur la cantera 1 la victoriosa',
      // Golf developments
      'rio real golf', 'marbella club golf resort', 'villa padierna',
      'flamingos golf', 'alcaidesa golf', 'finca cortesin',
      // Other known developments
      'puente romano', 'altos de puente romano', 'los arqueros',
      'la reserva', 'reserva de marbella', 'la reserva de marbella'
    ]);
    
    this.knownSuburbs = new Set([
      // Broader neighborhood areas (from database analysis - these have hundreds of properties)
      'nueva andalucia', 'nueva andalucía',           // 490 properties
      'marbella golden mile', 'golden mile',          // 206 properties  
      'new golden mile',                              // 136 properties
      'puerto banus', 'puerto banús',                 // 119 properties
      'la cala de mijas', 'la cala',                  // 113 properties
      'la quinta',                                    // 81 properties
      'los monteros',                                 // 78 properties
      'elviria',                                      // 73 properties
      'los flamingos',                                // 60 properties
      'calahonda', 'el paraiso', 'las chapas',
      'guadalmina alta', 'guadalmina baja', 'sierra blanca',
      'atalaya', 'la mairena', 'marbesa', 'mijas golf',
      'el rosario', 'san pedro alcantara', 'san pedro de alcántara',
      'cabopino', 'nagüeles', 'benahavís', 'benahavis',
      'riviera del sol', 'guadalmina', 'estepona center',
      'cancelada', 'la alqueria', 'sotogrande alto', 'churriana'
    ]);
    
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
    this.populateLocationAliases();
  }

  /**
   * Validate if a location name is truly an urbanization (residential development)
   */
  isKnownUrbanization(locationName) {
    if (!locationName) return false;
    const normalized = locationName.toLowerCase().trim();
    return this.knownUrbanizations.has(normalized);
  }

  /**
   * Validate if a location name is a suburb/neighborhood
   */
  isKnownSuburb(locationName) {
    if (!locationName) return false;
    const normalized = locationName.toLowerCase().trim();
    return this.knownSuburbs.has(normalized);
  }

  /**
   * Get the correct location hierarchy for a given name
   */
  getLocationHierarchy(locationName) {
    if (!locationName) return { type: 'unknown', name: locationName };
    
    const normalized = locationName.toLowerCase().trim();
    
    if (this.knownUrbanizations.has(normalized)) {
      return { type: 'urbanization', name: locationName };
    }
    
    if (this.knownSuburbs.has(normalized)) {
      return { type: 'suburb', name: locationName };
    }
    
    // Default assumption for unknown locations
    return { type: 'suburb', name: locationName };
  }

  /**
   * Populate location aliases and fallback coordinates
   */
  populateLocationAliases() {
    // CRITICAL FIXES based on database analysis
    
    // Fix 1: Golden Mile → Marbella Golden Mile (304 properties in DB)
    // IMPORTANT: Be precise to avoid matching "New Golden Mile" (Estepona)
    this.aliasKnowledge.set('golden mile', 'Marbella Golden Mile');
    this.aliasKnowledge.set('the golden mile', 'Marbella Golden Mile');
    this.aliasKnowledge.set('marbella golden mile', 'Marbella Golden Mile');
    
    // Explicitly define New Golden Mile as separate (Estepona)
    this.aliasKnowledge.set('new golden mile', 'New Golden Mile');
    this.aliasKnowledge.set('the new golden mile', 'New Golden Mile');
    this.aliasKnowledge.set('nuevo golden mile', 'New Golden Mile');
    
    // Add specific location exclusions to prevent cross-matching
    this.locationExclusions = new Map([
      // When searching for "Golden Mile", exclude "New Golden Mile" properties
      ['golden mile', ['New Golden Mile', 'Nuevo Golden Mile']],
      ['marbella golden mile', ['New Golden Mile', 'Nuevo Golden Mile']],
      // When searching for "New Golden Mile", exclude regular "Golden Mile" properties  
      ['new golden mile', ['Marbella Golden Mile', 'Golden Mile']]
    ]);
    
    // Add fallback coordinates for areas with properties but no coordinates
    this.locationFallbacks = new Map([
      // Marbella Golden Mile - Premium area between Marbella center and Puerto Banús
      ['marbella golden mile', {
        lat: 36.5095,
        lng: -4.9004,
        confidence: 0.85,
        source: 'known_premium_area'
      }],
      // New Golden Mile - Different area in Estepona
      ['new golden mile', {
        lat: 36.4400,
        lng: -5.1500,
        confidence: 0.85,
        source: 'known_estepona_area'
      }],
      // Nueva Andalucía - More central coordinates covering residential areas  
      ['nueva andalucia', {
        lat: 36.5015,
        lng: -4.9550,
        confidence: 0.90,
        source: 'central_residential_area'
      }],
      ['nueva andalucía', {
        lat: 36.5015,
        lng: -4.9550,
        confidence: 0.90,
        source: 'central_residential_area'
      }]
    ]);
    
    console.log('🗺️ Location aliases and fallbacks populated with precision exclusions');
  }

  /**
   * Check if a location should be excluded from results
   */
  shouldExcludeLocation(searchTerm, resultLocation) {
    if (!searchTerm || !resultLocation) return false;
    
    const normalizedSearch = searchTerm.toLowerCase().trim();
    const normalizedResult = resultLocation.toLowerCase().trim();
    
    // If they're the same location, never exclude
    if (normalizedSearch === normalizedResult) return false;
    
    const exclusions = this.locationExclusions.get(normalizedSearch);
    if (exclusions) {
      return exclusions.some(excluded => 
        normalizedResult.includes(excluded.toLowerCase())
      );
    }
    
    return false;
  }

  /**
   * OPTIMIZATION 1: Regex Pre-Filter - Extract addresses without AI calls
   * Saves ~25% of AI calls by catching obvious Spanish addresses
   */
  extractAddressWithRegex(input) {
    this.optimizationStats.totalQueries++;
    
    const results = {
      streetAddress: null,
      urbanization: null,
      knownArea: null,
      confidence: 0,
      method: 'regex_extraction',
      extractedComponents: []
    };

    // Check for street addresses (highest priority)
    for (const pattern of this.spanishAddressPatterns.streets) {
      const matches = [...input.matchAll(pattern)];
      if (matches.length > 0) {
        const match = matches[0];
        const streetType = match[1]; // Calle, Avenida, etc.
        const streetName = match[2]; // Street name
        const streetNumber = match[3] || ''; // Optional number
        
        results.streetAddress = `${streetType} ${streetName}${streetNumber ? ' ' + streetNumber : ''}`.trim();
        results.confidence = 0.95; // Very high confidence for street addresses
        results.extractedComponents.push({
          type: 'street',
          value: results.streetAddress,
          pattern: pattern.source
        });
        
        console.log(`🎯 REGEX HIT - Street: "${results.streetAddress}" (confidence: 95%)`);
        this.optimizationStats.regexHits++;
        this.optimizationStats.aiCallsAvoided++;
        
        return results;
      }
    }

    // Check for urbanizations (medium priority)
    for (const pattern of this.spanishAddressPatterns.urbanizations) {
      const matches = [...input.matchAll(pattern)];
      if (matches.length > 0) {
        const match = matches[0];
        const urbType = match[1]; // Urbanización, Residencial, etc.
        const urbName = match[2]; // Urbanization name
        
        results.urbanization = `${urbType} ${urbName}`.trim();
        results.confidence = 0.85; // High confidence for urbanizations
        results.extractedComponents.push({
          type: 'urbanization',
          value: results.urbanization,
          pattern: pattern.source
        });
        
        console.log(`🎯 REGEX HIT - Urbanization: "${results.urbanization}" (confidence: 85%)`);
        this.optimizationStats.regexHits++;
        this.optimizationStats.aiCallsAvoided++;
        
        return results;
      }
    }

    // Check for known areas (lower priority)
    for (const pattern of this.spanishAddressPatterns.knownAreas) {
      const matches = [...input.matchAll(pattern)];
      if (matches.length > 0) {
        const match = matches[0];
        
        results.knownArea = match[0].trim();
        results.confidence = 0.80; // Good confidence for known areas
        results.extractedComponents.push({
          type: 'known_area',
          value: results.knownArea,
          pattern: pattern.source
        });
        
        console.log(`🎯 REGEX HIT - Known Area: "${results.knownArea}" (confidence: 80%)`);
        this.optimizationStats.regexHits++;
        this.optimizationStats.aiCallsAvoided++;
        
        return results;
      }
    }

    // No regex matches found
    return null;
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats() {
    const hitRate = this.optimizationStats.totalQueries > 0 
      ? (this.optimizationStats.regexHits / this.optimizationStats.totalQueries * 100).toFixed(1)
      : '0.0';
      
    return {
      ...this.optimizationStats,
      hitRate: `${hitRate}%`,
      costSavingsEstimate: `$${(this.optimizationStats.aiCallsAvoided * 0.0008).toFixed(4)}`
    };
  }

  /**
   * Main location resolution method - automatically finds best match
   */
  async resolveLocation(userInput, propertyContext = {}) {
    try {
      this.metrics.totalQueries++;
      
      console.log(`🔍 Resolving location: "${userInput}"`);
      
      // OPTIMIZATION 1: Try regex pre-filter first (saves ~25% of AI calls)
      console.log(`🎯 Checking regex patterns for obvious addresses...`);
      const regexResult = this.extractAddressWithRegex(userInput);
      if (regexResult && regexResult.confidence >= 0.80) {
        console.log(`⚡ REGEX SUCCESS: Skipping AI call - found "${regexResult.streetAddress || regexResult.urbanization || regexResult.knownArea}"`);
        
        // Convert regex result to standard format and geocode directly
        const extractedLocation = regexResult.streetAddress || regexResult.urbanization || regexResult.knownArea;
        
        // Try to geocode the extracted location
        const geocodeResult = await this.geocodeLocation(extractedLocation, propertyContext);
        if (geocodeResult.coordinates) {
          return {
            location: extractedLocation,
            coordinates: geocodeResult.coordinates,
            confidence: regexResult.confidence,
            method: 'regex_extraction_geocoded',
            extractedComponents: regexResult.extractedComponents,
            geocodingConfidence: geocodeResult.geocodingConfidence,
            formattedAddress: geocodeResult.formattedAddress
          };
        } else {
          console.log(`⚠️ Regex extracted "${extractedLocation}" but geocoding failed, continuing with AI...`);
        }
      }
      
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
        
        let coordinates = null;
        
        // Try database coordinates first
        if (match.latitude && match.longitude) {
          coordinates = {
            lat: parseFloat(match.latitude),
            lng: parseFloat(match.longitude)
          };
        } else {
          // Use fallback coordinates if available
          const locationKey = (match.urbanization || match.suburb || input).toLowerCase();
          const fallback = this.locationFallbacks?.get(locationKey);
          if (fallback) {
            coordinates = {
              lat: fallback.lat,
              lng: fallback.lng
            };
            console.log(`🎯 Using fallback coordinates for "${locationKey}": ${fallback.lat}, ${fallback.lng}`);
          }
        }
        
        return {
          location: match.urbanization || match.suburb || input,
          confidence: confidence,
          method: 'trigram_similarity',
          coordinates: coordinates,
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

      // FIXED: PostgreSQL levenshtein has 255 character limit
      if (input.length > 250) {
        console.log(`❌ Input too long for levenshtein (${input.length} chars), truncating to first 100 chars`);
        input = input.substring(0, 100);
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
        
        let coordinates = null;
        
        // Try database coordinates first
        if (match.latitude && match.longitude) {
          coordinates = {
            lat: parseFloat(match.latitude),
            lng: parseFloat(match.longitude)
          };
        } else {
          // Use fallback coordinates if available
          const locationKey = (match.urbanization || match.suburb || input).toLowerCase();
          const fallback = this.locationFallbacks?.get(locationKey);
          if (fallback) {
            coordinates = {
              lat: fallback.lat,
              lng: fallback.lng
            };
            console.log(`🎯 Using fallback coordinates for "${locationKey}": ${fallback.lat}, ${fallback.lng}`);
          }
        }
        
        return {
          location: match.urbanization || match.suburb || input,
          confidence: confidence,
          method: 'fuzzy_match',
          coordinates: coordinates,
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
        model: "gpt-4o",
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
        max_tokens: 1000 // Optimized for location extraction
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
    // PRIORITY: Use suburb if available, then city (suburb is more specific)
    const suburb = context.propertyData?.suburb || context.suburb;
    const city = context.city || context.propertyData?.city || 'Marbella';
    const location = suburb || city;
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
        queries.push(`${street}, ${location}, ${province}, Spain`);
      });
    }

    // Priority 2: Urbanization + context
    if (locationDetails.urbanizations?.length > 0) {
      locationDetails.urbanizations.forEach(urbanization => {
        queries.push(`${urbanization}, ${location}, ${province}, Spain`);
        
        // Combine with landmarks if available
        if (locationDetails.landmarks?.length > 0) {
          const landmark = locationDetails.landmarks[0];
          queries.push(`${urbanization} near ${landmark.name}, ${location}, ${province}, Spain`);
        }
      });
    }

    // Priority 3: Neighborhood + landmarks
    if (locationDetails.neighborhoods?.length > 0 && locationDetails.landmarks?.length > 0) {
      const neighborhood = locationDetails.neighborhoods[0];
      const landmark = locationDetails.landmarks[0];
      queries.push(`${neighborhood} near ${landmark.name}, ${location}, ${province}, Spain`);
    }

    // Priority 4: Proximity clues (for landmark-based locations)
    if (locationDetails.proximityClues?.length > 0) {
      locationDetails.proximityClues.forEach(clue => {
        queries.push(`${clue.place}, ${location}, ${province}, Spain`);
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
      queries.push(`${originalInput}, ${location}, ${province}, Spain`);
    }

    // Remove duplicates while preserving order
    const uniqueQueries = [...new Set(queries)];
    
    console.log(`🔍 Generated ${uniqueQueries.length} optimal geocoding queries (using ${suburb ? 'suburb' : 'city'}: ${location}):`, uniqueQueries);
    
    return uniqueQueries;
  }

  /**
   * Analyze property description for location landmarks and contextual clues
   */
  async analyzePropertyDescription(propertyData, context) {
    try {
      // Extract description text - ENGLISH ONLY (as per user preference)
      let description = '';
      if (typeof propertyData.descriptions === 'string') {
        description = propertyData.descriptions;
      } else if (typeof propertyData.descriptions === 'object') {
        // Use English descriptions only
        description = propertyData.descriptions.en || 
                     propertyData.descriptions.english || '';
      }

      if (!description || description.length < 20) {
        console.log('📝 No meaningful description found for analysis');
        return { coordinates: null, confidence: 0 };
      }

      console.log(`📝 Analyzing description: "${description.substring(0, 100)}..."`);

      // ENHANCED: Check for Puerto Banús proximity patterns first
      const puertoBanusPatterns = [
        /walking distance.*puerto ban[uú]s/i,
        /close to puerto ban[uú]s/i, 
        /near puerto ban[uú]s/i,
        /minutes.*puerto ban[uú]s/i
      ];
      
      const hasPuertoBanusProximity = puertoBanusPatterns.some(pattern => 
        pattern.test(description)
      );
      
      if (hasPuertoBanusProximity) {
        console.log(`🎯 PUERTO BANÚS PROXIMITY detected! Using location-based search instead of coordinates`);
        
        // Use location-based search instead of coordinates to find more properties
        // This will search by area name rather than geographic coordinates
        return {
          location: 'Nueva Andalucia',
          coordinates: null,  // No coordinates = falls back to location-based search
          confidence: 0.95, // High confidence for proximity clues
          analysisMethod: 'puerto_banus_proximity',
          originalDescription: description.substring(0, 200),
          proximityClue: 'Walking distance to Puerto Banús suggests Nueva Andalucía location',
          urbanization: 'Nueva Andalucia',
          suburb: 'Nueva Andalucia',
          searchStrategy: 'location_based'  // Forces location-based instead of coordinate search
        };
      }

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
   * Geocode landmark with context - prioritizes suburb over city
   */
  async geocodeLandmarkWithContext(landmark, context) {
    // PRIORITY: Use suburb if available, then city (suburb is more specific)
    const suburb = context.propertyData?.suburb || context.suburb;
    const city = context.city || context.propertyData?.city || '';
    const location = suburb || city;
    
    // STEP 1: Check for known precise coordinates first
    const preciseCoords = this.getPreciseKnownLandmarkCoordinates(landmark.name, suburb, city);
    if (preciseCoords) {
      console.log(`🎯 Using PRECISE known coordinates for landmark "${landmark.name}": ${preciseCoords.lat}, ${preciseCoords.lng}`);
      return {
        location: `Near ${preciseCoords.name}`,
        coordinates: {
          lat: preciseCoords.lat,
          lng: preciseCoords.lng
        },
        confidence: preciseCoords.confidence,
        landmark: landmark,
        searchQuery: `Known landmark: ${preciseCoords.name}`,
        locationContext: 'precise_known_landmark',
        method: 'precise_coordinates'
      };
    }
    
    // STEP 2: Fall back to geocoding API
    // ENHANCED: More specific search for bull ring
    let searchQuery;
    if (landmark.name.toLowerCase().includes('bull ring') || landmark.name.toLowerCase().includes('bullring')) {
      if (suburb && suburb.toLowerCase().includes('nueva andaluc')) {
        searchQuery = `Plaza de Toros Nueva Andalucía, ${suburb}, ${city}, Spain`;
        console.log(`🎯 Using SPECIFIC bull ring search: "${searchQuery}"`);
      } else {
        searchQuery = `Plaza de Toros, ${landmark.name}, ${location}, Spain`;
      }
    } else {
      searchQuery = `${landmark.name}, ${location}, Spain`;
    }
    
    console.log(`🏛️ Geocoding landmark: "${searchQuery}" (using ${suburb ? 'suburb' : 'city'}: ${location})`);
    console.log(`🔍 Context - Suburb: "${suburb}", City: "${city}", Selected: "${location}"`);
    
    const result = await this.geocodeLocation(searchQuery, context);
    if (result.coordinates) {
      return {
        location: `Near ${landmark.name}`,
        coordinates: result.coordinates,
        landmark: landmark,
        searchQuery: searchQuery,
        locationContext: suburb ? 'suburb' : 'city'
      };
    }
    
    return { coordinates: null };
  }

  /**
   * Get precise coordinates for known landmarks
   */
  getPreciseKnownLandmarkCoordinates(place, suburb, city) {
    const placeKey = place.toLowerCase();
    const suburbKey = suburb?.toLowerCase() || '';
    const cityKey = city?.toLowerCase() || '';
    
    // PRECISE COORDINATES for known landmarks
    const knownLandmarks = {
      // Plaza de Toros Nueva Andalucía - EXACT coordinates
      'bull ring nueva andalucia': {
        lat: 36.492075,
        lng: -4.952039,
        confidence: 0.99,
        name: 'Plaza de Toros Nueva Andalucía'
      },
      'the bull ring nueva andalucia': {
        lat: 36.492075,
        lng: -4.952039,
        confidence: 0.99,
        name: 'Plaza de Toros Nueva Andalucía'
      },
      'bullring nueva andalucia': {
        lat: 36.492075,
        lng: -4.952039,
        confidence: 0.99,
        name: 'Plaza de Toros Nueva Andalucía'
      },
      'plaza de toros nueva andalucia': {
        lat: 36.492075,
        lng: -4.952039,
        confidence: 0.99,
        name: 'Plaza de Toros Nueva Andalucía'
      }
    };
    
    // Try exact matches first
    const exactKey = `${placeKey} ${suburbKey}`.trim();
    if (knownLandmarks[exactKey]) {
      console.log(`🎯 EXACT landmark match found: ${exactKey} -> ${knownLandmarks[exactKey].name}`);
      return knownLandmarks[exactKey];
    }
    
    // Try partial matches for bull ring in Nueva Andalucía area
    if (placeKey.includes('bull ring') || placeKey.includes('bullring')) {
      if (suburbKey.includes('nueva andaluc') || cityKey.includes('marbella')) {
        console.log(`🎯 BULL RING match found for Nueva Andalucía area`);
        return {
          lat: 36.492075,
          lng: -4.952039,
          confidence: 0.95,
          name: 'Plaza de Toros Nueva Andalucía'
        };
      }
    }
    
    return null;
  }

  /**
   * Geocode proximity clue with context - prioritizes suburb over city
   */
  async geocodeProximityWithContext(proximityClue, context) {
    // PRIORITY: Use suburb if available, then city (suburb is more specific)
    const suburb = context.propertyData?.suburb || context.suburb;
    const city = context.city || context.propertyData?.city || '';
    const location = suburb || city;
    
    // STEP 1: Check for known precise coordinates first
    const preciseCoords = this.getPreciseKnownLandmarkCoordinates(proximityClue.place, suburb, city);
    if (preciseCoords) {
      console.log(`🎯 Using PRECISE known coordinates for "${proximityClue.place}": ${preciseCoords.lat}, ${preciseCoords.lng}`);
      return {
        location: `Near ${preciseCoords.name}`,
        coordinates: {
          lat: preciseCoords.lat,
          lng: preciseCoords.lng
        },
        confidence: preciseCoords.confidence,
        proximityClue: proximityClue,
        searchQuery: `Known landmark: ${preciseCoords.name}`,
        locationContext: 'precise_known_landmark',
        method: 'precise_coordinates'
      };
    }
    
    // STEP 2: Fall back to geocoding API
    // ENHANCED: More specific search for bull ring proximity
    let searchQuery;
    if (proximityClue.place.toLowerCase().includes('bull ring') || proximityClue.place.toLowerCase().includes('bullring')) {
      if (suburb && suburb.toLowerCase().includes('nueva andaluc')) {
        searchQuery = `Plaza de Toros Nueva Andalucía, ${suburb}, ${city}, Spain`;
        console.log(`🎯 Using SPECIFIC bull ring proximity search: "${searchQuery}"`);
      } else {
        searchQuery = `Plaza de Toros, ${proximityClue.place}, ${location}, Spain`;
      }
    } else {
      searchQuery = `${proximityClue.place}, ${location}, Spain`;
    }
    
    console.log(`🚶 Geocoding proximity: "${searchQuery}" (using ${suburb ? 'suburb' : 'city'}: ${location})`);
    console.log(`🔍 Context - Suburb: "${suburb}", City: "${city}", Selected: "${location}"`);
    
    const result = await this.geocodeLocation(searchQuery, context);
    if (result.coordinates) {
      return {
        location: `Near ${proximityClue.place}`,
        coordinates: result.coordinates,
        proximityClue: proximityClue,
        searchQuery: searchQuery,
        locationContext: suburb ? 'suburb' : 'city'
      };
    }
    
    return { coordinates: null };
  }

  /**
   * Enhanced multi-query geocoding with OpenCage primary and Google fallback
   */
  async geocodeLocationEnhanced(userInput, context = {}) {
    try {
      // Step 1: Try AI-powered description parsing first
      const locationDetails = await this.analyzeDescriptionWithAI(userInput, context);
      
      // Step 2: Generate optimal geocoding queries
      const queries = this.generateOptimalGeocodingQueries(locationDetails, userInput, context);
      
      // Step 3: Try each query with confidence-based selection
      let fallbackResult = null;
      
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        
        // Try OpenCage first (free tier), then Google Maps as fallback
        const result = await this.geocodeLocationWithFallback(query, context);
        
        if (result.coordinates) {
          // Enhanced confidence scoring based on query specificity
          const querySpecificity = this.calculateQuerySpecificity(query, userInput);
          const adjustedConfidence = result.geocodingConfidence * querySpecificity;
          
          // Accept if confidence is high enough
          if (adjustedConfidence >= 0.7) {
            return {
              ...result,
              finalConfidence: adjustedConfidence,
              queryUsed: query,
              queryIndex: i + 1,
              locationDetails: locationDetails
            };
          }
          
          // Store as fallback for lower confidence results
          if (!fallbackResult || adjustedConfidence > fallbackResult.finalConfidence) {
            fallbackResult = {
              ...result,
              finalConfidence: adjustedConfidence,
              queryUsed: query,
              queryIndex: i + 1,
              locationDetails: locationDetails
            };
          }
        }
      }
      
      // Return best fallback result if no high-confidence match
      if (fallbackResult) {
        return fallbackResult;
      }
      
      // No results found - silent handling
      return {
        coordinates: null,
        location: userInput,
        geocodingConfidence: 0,
        error: 'All geocoding queries failed',
        method: 'enhanced_failed',
        locationDetails: locationDetails
      };

    } catch (error) {
      // Silent error handling
      return {
        coordinates: null,
        location: userInput,
        geocodingConfidence: 0,
        error: error.message,
        method: 'enhanced_error'
      };
    }
  }

  /**
   * Geocode with OpenCage primary and Google Maps fallback (silent operation)
   */
  async geocodeLocationWithFallback(locationName, context = {}) {
    // Try OpenCage first (free tier compliant)
    const opencageResult = await this.geocodeWithOpenCage(locationName, context);
    if (opencageResult.coordinates) {
      return opencageResult;
    }
    
    // Silent fallback to Google Maps if OpenCage fails
    return await this.geocodeLocation(locationName, context);
  }

  /**
   * OpenCage geocoding with free tier compliance (silent operation)
   */
  async geocodeWithOpenCage(locationName, context = {}) {
    try {
      const OPENCAGE_API_KEY = process.env.OPENCAGE_API_KEY;
      if (!OPENCAGE_API_KEY) {
        // Silent fallback when no API key
        return { coordinates: null, location: locationName };
      }

      // Check daily quota (silent)
      const dailyCount = await this.getOpenCageDailyCount();
      if (dailyCount >= 2500) {
        // Silent fallback when quota exceeded
        return { coordinates: null, location: locationName, error: 'Daily quota exceeded' };
      }

      // Build search query with context
      let searchQuery = locationName;
      if (context.city && !locationName.toLowerCase().includes(context.city.toLowerCase())) {
        searchQuery += `, ${context.city}`;
      }
      searchQuery += ', Spain'; // Default to Spain for our use case

      // Rate limiting (silent)
      await this.enforceOpenCageRateLimit();

      const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(searchQuery)}&key=${OPENCAGE_API_KEY}&limit=1&countrycode=es&language=en`;
      
      const response = await fetch(url);
      const data = await response.json();

      // Increment daily counter (silent)
      await this.incrementOpenCageDailyCount();

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        const location = result.geometry;
        
        // Extract components for better location info
        const components = result.components;
        const locality = components.city || components.town || components.village;
        const sublocality = components.suburb || components.neighbourhood;
        const adminLevel2 = components.state;

        const resolvedLocation = sublocality || locality || adminLevel2 || locationName;

        // Enhanced confidence calculation
        const confidence = (result.confidence || 50) / 100; // Convert to 0-1 scale

        return {
          location: resolvedLocation,
          coordinates: {
            lat: location.lat,
            lng: location.lng
          },
          formattedAddress: result.formatted,
          geocodingConfidence: confidence,
          method: 'opencage',
          components: result.components
        };
      } else {
        // Silent fallback when no results
        return { coordinates: null, location: locationName, geocodingConfidence: 0 };
      }

    } catch (error) {
      if (error.response?.status === 402) {
        // Silent fallback when quota exceeded
        return { coordinates: null, location: locationName, error: 'Quota exceeded', geocodingConfidence: 0 };
      }
      if (error.response?.status === 401) {
        // Silent fallback when invalid API key
        return { coordinates: null, location: locationName, error: 'Invalid API key', geocodingConfidence: 0 };
      }
      
      // Silent fallback for any errors
      return { coordinates: null, location: locationName, error: error.message, geocodingConfidence: 0 };
    }
  }

  /**
   * Get today's OpenCage request count (silent)
   */
  async getOpenCageDailyCount() {
    try {
      if (!this.propertyDb?.pool) return 0;
      
      const today = new Date().toISOString().split('T')[0];
      const result = await this.propertyDb.pool.query(
        'SELECT request_count FROM opencage_daily_quota WHERE date = $1',
        [today]
      );
      
      return result.rows.length > 0 ? result.rows[0].request_count : 0;
    } catch (error) {
      return 0; // Safe fallback
    }
  }

  /**
   * Increment today's OpenCage request count (silent)
   */
  async incrementOpenCageDailyCount() {
    try {
      if (!this.propertyDb?.pool) return;
      
      const today = new Date().toISOString().split('T')[0];
      
      await this.propertyDb.pool.query(`
        INSERT INTO opencage_daily_quota (date, request_count) 
        VALUES ($1, 1)
        ON CONFLICT (date) 
        DO UPDATE SET request_count = opencage_daily_quota.request_count + 1
      `, [today]);
      
    } catch (error) {
      // Silent fail - quota tracking is non-critical
    }
  }

  /**
   * Enforce OpenCage rate limiting (silent)
   */
  async enforceOpenCageRateLimit() {
    if (!this.lastOpenCageRequest) {
      this.lastOpenCageRequest = 0;
    }
    
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastOpenCageRequest;
    const minInterval = 1100; // 1.1 seconds to be safe
    
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      // Silent wait - no output to users
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastOpenCageRequest = Date.now();
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

      // Silent geocoding operation

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
        return { coordinates: null, location: locationName, geocodingConfidence: 0 };
      }

    } catch (error) {
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