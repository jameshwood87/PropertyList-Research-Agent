const OpenAI = require('openai');
const crypto = require('crypto');
const Bottleneck = require('bottleneck'); // OPTIMIZATION 5: Rate limiting

class OptimizedLocationService {
  constructor() {
    // Make OpenAI optional - only initialize if API key is available
    this.openai = null;
    if (process.env.OPENAI_API_KEY) {
      try {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        console.log('✅ OpenAI service initialized for location analysis');
      } catch (error) {
        console.log('⚠️ OpenAI service failed to initialize:', error.message);
      }
    } else {
      console.log('⚠️ OpenAI API key not found - location AI analysis will be disabled');
    }
    
    // OPTIMIZATION 5: Throttling & Rate Limiting for API resilience
    this.openaiLimiter = new Bottleneck({
      maxConcurrent: 5, // Max 5 concurrent OpenAI calls
      minTime: 100, // Minimum 100ms between calls
      reservoir: 50, // Start with 50 tokens
      reservoirRefreshAmount: 50, // Refresh 50 tokens
      reservoirRefreshInterval: 60 * 1000, // Every minute
      // Exponential backoff on failures
      retryCount: 3,
      timeout: 30000, // 30 second timeout
    });
    
    // Handle rate limit events
    this.openaiLimiter.on('failed', async (error, jobInfo) => {
      const id = jobInfo.options.id;
      console.log(`🚫 OpenAI call failed (${id}): ${error.message}`);
      
      if (error.status === 429) { // Rate limit error
        console.log(`⏳ Rate limited - waiting before retry...`);
        return 2000; // Wait 2 seconds before retry
      } else if (error.status >= 500) { // Server error
        console.log(`🚨 Server error - waiting before retry...`);
        return 5000; // Wait 5 seconds for server errors
      }
      
      return null; // Don't retry for other errors
    });
    
    this.openaiLimiter.on('retry', (error, jobInfo) => {
      const id = jobInfo.options.id;
      console.log(`🔄 Retrying OpenAI call (${id}) after error: ${error.message}`);
    });
    
    // Dual-tier precise caching system
    this.descriptionCache = new Map(); // hash -> AI result
    this.preciseLocationCache = new Map(); // street|urbanization|suburb -> AI result
    this.geocodeCache = new Map(); // location -> coordinates
    
    // Performance metrics
    this.metrics = {
      totalQueries: 0,
      cacheHits: 0,
      descriptionCacheHits: 0,
      preciseLocationCacheHits: 0,
      aiCalls: 0,
      geocodeCalls: 0
    };
  }

  /**
   * OPTIMIZED: Main location analysis with precise location caching
   */
  async analyzePropertyLocation(property) {
    this.metrics.totalQueries++;
    
    console.log(`🔍 Analyzing location for ${property.reference}`);
    
    // OPTIMIZATION 4: Check permanent cache first (95%+ confidence results)
    const permanentCacheResult = await this.checkPermanentCache(property);
    if (permanentCacheResult) {
      console.log(`   🎯 PERMANENT CACHE: Never needs re-analysis!`);
      return permanentCacheResult;
    }
    
    // Tier 1: Exact description cache (SHA-256 hash)
    const descriptionCacheResult = this.checkDescriptionCache(property);
    if (descriptionCacheResult) {
      this.metrics.cacheHits++;
      this.metrics.descriptionCacheHits++;
      console.log(`   ⚡ Description cache hit`);
      return descriptionCacheResult;
    }
    
    // Tier 2: Precise location cache (same street or urbanization)
    const preciseLocationResult = this.checkPreciseLocationCache(property);
    if (preciseLocationResult) {
      this.metrics.cacheHits++;
      this.metrics.preciseLocationCacheHits++;
      console.log(`   ⚡ Precise location cache hit`);
      return preciseLocationResult;
    }
    
    // Fresh AI analysis for non-cached properties
    console.log(`   🤖 Running fresh AI analysis`);
    const aiResult = await this.runOptimizedAIAnalysis(property);
    
    // Cache the result in both tiers
    this.cacheResult(property, aiResult);
    
    // OPTIMIZATION 4: Permanent caching for high-confidence results (95%+)
    await this.handlePermanentCaching(property, aiResult);
    
    return aiResult;
  }

  /**
   * OPTIMIZATION 2: Smart Model Selection - Choose optimal AI model based on description
   * Routes simple cases to cheaper models, complex cases to more powerful ones
   */
  selectOptimalModel(description) {
    const descLength = description.length;
    
    // Count location keywords that suggest complexity
    const locationKeywords = [
      'near', 'next to', 'close to', 'walking distance', 'minutes from',
      'between', 'opposite', 'facing', 'overlooking', 'behind',
      'meters from', 'km from', 'minutes walk', 'short drive'
    ];
    
    const keywordCount = locationKeywords.filter(keyword => 
      description.toLowerCase().includes(keyword)
    ).length;
    
    // Count specific Spanish location indicators
    const spanishLocationWords = [
      'urbanización', 'urbanizacion', 'calle', 'avenida', 'carretera',
      'plaza', 'paseo', 'puerto banús', 'nueva andalucia', 'marbella',
      'golf', 'club', 'hotel', 'playa', 'centro'
    ];
    
    const spanishLocationCount = spanishLocationWords.filter(word =>
      description.toLowerCase().includes(word)
    ).length;

    // Decision logic for model selection
    if (descLength < 100 && keywordCount === 0) {
      // Very simple, short descriptions → Ultra-cheap model
      return {
        model: "gpt-4o-mini",
        reason: `Simple description (${descLength} chars, no location keywords)`,
        tokensLimit: 150,
        temperature: 0
      };
    } else if (descLength < 200 && keywordCount <= 1 && spanishLocationCount >= 1) {
      // Medium descriptions with clear Spanish location words → Standard cheap model
      return {
        model: "gpt-3.5-turbo",
        reason: `Standard description (${descLength} chars, ${keywordCount} keywords, ${spanishLocationCount} Spanish locations)`,
        tokensLimit: 250,
        temperature: 0
      };
    } else if (keywordCount >= 2 || (descLength > 300 && spanishLocationCount >= 2)) {
      // Complex descriptions with multiple proximity clues → Powerful model
      return {
        model: "gpt-4o-mini", // Still cost-optimized but better reasoning
        reason: `Complex description (${descLength} chars, ${keywordCount} proximity keywords)`,
        tokensLimit: 300,
        temperature: 0.1
      };
    } else {
      // Default to standard model
      return {
        model: "gpt-3.5-turbo",
        reason: `Default routing (${descLength} chars, ${keywordCount} keywords)`,
        tokensLimit: 250,
        temperature: 0
      };
    }
  }

  /**
   * OPTIMIZED: Concise prompt design for GPT-3.5-Turbo + CONDITION ANALYSIS
   */
  async runOptimizedAIAnalysis(property) {
    this.metrics.aiCalls++;
    
    // Check if OpenAI is available
    if (!this.openai) {
      console.log(`   ⚠️ OpenAI not available, using basic location`);
      return this.createBasicResult(property, 'OpenAI service not available');
    }
    
    const descriptions = property.descriptions || {};
    // FIXED: Use English descriptions only (as per user preference)
    const combinedDesc = descriptions.en || descriptions.english || '';
    
    if (!combinedDesc || combinedDesc.length < 20) {
      console.log(`   ⚠️ Description too short, using basic location`);
      return this.createBasicResult(property, 'Description too short');
    }

    // OPTIMIZATION 2: Smart Model Selection Based on Description Characteristics
    const modelChoice = this.selectOptimalModel(combinedDesc);
    console.log(`   🧠 Selected model: ${modelChoice.model} (reason: ${modelChoice.reason})`);

    // OPTIMIZATION 3: Compact Function-Driven Prompt (saves ~40 tokens)
    const prompt = `Extract location and condition from Spanish property description.

Property: ${property.suburb || 'Unknown'}, ${property.city || 'Unknown'}

Description: "${combinedDesc}"

Extract ONLY actual place names (urbanizations, streets, landmarks), NOT marketing text.`;

    // OPTIMIZATION 3: Function Definition (enforces structure, saves tokens)
    const extractLocationFunction = {
      name: "extract_location_and_condition",
      description: "Extract location and property condition from Spanish property descriptions",
      parameters: {
        type: "object",
        properties: {
          hasSpecific: {
            type: "boolean",
            description: "True if specific location names are found"
          },
          location: {
            type: "string",
            description: "Exact place name only (urbanization, street, area) or null if none found"
          },
          landmarks: {
            type: "array",
            items: { type: "string" },
            description: "Actual landmark names only"
          },
          proximity: {
            type: "array", 
            items: { type: "string" },
            description: "Distance phrases with specific places"
          },
          condition: {
            type: "object",
            properties: {
              rating: {
                type: "string",
                enum: ["excellent", "very-good", "good", "fair", "needs-renovation"],
                description: "Property condition rating"
              },
              details: {
                type: "string",
                description: "Brief condition description"
              },
              keywords: {
                type: "array",
                items: { type: "string" },
                description: "Condition keywords found"
              },
              confidence: {
                type: "integer",
                minimum: 1,
                maximum: 10,
                description: "Confidence in condition assessment"
              }
            }
          },
          confidence: {
            type: "integer",
            minimum: 1,
            maximum: 10,
            description: "Overall confidence in location extraction"
          },
          reason: {
            type: "string",
            description: "Brief explanation of extraction"
          }
        },
        required: ["hasSpecific", "confidence", "reason"]
      }
    };

    try {
      // OPTIMIZATION 5: Throttled OpenAI call with resilience
      const response = await this.openaiLimiter.schedule(
        { id: `location-${property.reference || 'unknown'}` },
        async () => {
          return await this.openai.chat.completions.create({
            model: modelChoice.model, // OPTIMIZATION 2: Dynamic model selection
            messages: [
              {
                role: "system", 
                content: "Extract specific place names from Spanish property descriptions. Ignore marketing language."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            functions: [extractLocationFunction], // OPTIMIZATION 3: Function calling
            function_call: { name: "extract_location_and_condition" }, // Force function use
            temperature: modelChoice.temperature, // OPTIMIZATION 2: Dynamic temperature
            max_tokens: modelChoice.tokensLimit // OPTIMIZATION 2: Dynamic token limit
          });
        }
      );

      // OPTIMIZATION 3: Parse function call response instead of JSON
      const functionCall = response.choices[0].message.function_call;
      const analysis = JSON.parse(functionCall.arguments);
      
      // VALIDATION: Reject marketing text and invalid locations
      const isValidLocation = this.validateLocationExtraction(analysis.location);
      if (!isValidLocation) {
        console.log(`   ❌ Invalid location rejected: "${analysis.location}"`);
        analysis.location = null;
        analysis.hasSpecific = false;
        analysis.confidence = Math.max(1, analysis.confidence - 5); // Reduce confidence
      }
      
      console.log(`   📍 AI Result: ${analysis.location || 'No valid location'} (confidence: ${analysis.confidence}/10)`);
      if (analysis.condition) {
        console.log(`   🏠 Condition: ${analysis.condition.rating} (confidence: ${analysis.condition.confidence}/10)`);
      }
      
      return {
        ...property,
        aiEnhanced: analysis.hasSpecific && analysis.location,
        enhancedLocation: analysis.location,
        landmarks: analysis.landmarks || [],
        proximityClues: analysis.proximity || [],
        aiConfidence: analysis.confidence,
        enhancementReason: analysis.reason,
        // NEW: Condition analysis
        conditionAnalysis: analysis.condition || null,
        conditionRating: analysis.condition?.rating || null,
        conditionDetails: analysis.condition?.details || null,
        conditionKeywords: analysis.condition?.keywords || [],
        conditionConfidence: analysis.condition?.confidence || null,
        method: 'optimized_ai_gpt35_with_condition',
        tokensUsed: response.usage?.total_tokens || 0
      };

    } catch (error) {
      console.log(`   ❌ AI error: ${error.message}`);
      return this.createBasicResult(property, `AI failed: ${error.message}`);
    }
  }

  /**
   * CACHING: Check exact description hash cache
   */
  checkDescriptionCache(property) {
    if (!property.descriptions) return null;
    
    const descHash = crypto.createHash('sha256')
      .update(JSON.stringify(property.descriptions))
      .digest('hex');
    
    const cached = this.descriptionCache.get(descHash);
    if (cached) {
      // Return cached result with current property data
      return {
        ...property,
        ...cached,
        cacheType: 'description_hash'
      };
    }
    
    return null;
  }

  /**
   * CACHING: Check precise location cache (same urbanization + suburb only)
   */
  checkPreciseLocationCache(property) {
    // Only cache if we have BOTH urbanization AND suburb
    if (!property.urbanization || !property.suburb) {
      console.log(`   🚫 Missing urbanization or suburb - skipping precise cache`);
      return null;
    }

    // Create cache key: urbanization + suburb (no street extraction)
    const cacheKey = `urb:${property.urbanization.toLowerCase()}|suburb:${property.suburb.toLowerCase()}`;
    const cached = this.preciseLocationCache.get(cacheKey);

    if (cached) {
      console.log(`   ✅ Precise location cache hit: ${cacheKey}`);
      // Return cached result with current property data
      return {
        ...property,
        ...cached,
        cacheType: 'precise_location'
      };
    }

    return null;
  }

  /**
   * CACHING: Store result in both cache tiers
   */
  cacheResult(property, result) {
    // Cache by description hash (exact matching) - always safe and accurate
    if (property.descriptions) {
      const descHash = crypto.createHash('sha256')
        .update(JSON.stringify(property.descriptions))
        .digest('hex');
      
      const cacheableData = {
        aiEnhanced: result.aiEnhanced,
        enhancedLocation: result.enhancedLocation,
        landmarks: result.landmarks,
        proximityClues: result.proximityClues,
        aiConfidence: result.aiConfidence,
        enhancementReason: result.enhancementReason,
        method: result.method,
        // Include condition data in cache
        conditionAnalysis: result.conditionAnalysis,
        conditionRating: result.conditionRating,
        conditionDetails: result.conditionDetails,
        conditionKeywords: result.conditionKeywords,
        conditionConfidence: result.conditionConfidence,
        cachedAt: new Date().toISOString()
      };
      
      this.descriptionCache.set(descHash, cacheableData);
      console.log(`   💾 Cached by description hash`);
    }

    // Cache by precise location ONLY if we have urbanization + suburb AND AI found useful intelligence
    if (property.urbanization && property.suburb) {
      const aiFoundUsefulIntelligence = result.aiEnhanced && 
        (result.landmarks?.length > 0 || result.proximityClues?.length > 0 || result.aiConfidence >= 7);
      
      if (aiFoundUsefulIntelligence) {
        const cacheKey = `urb:${property.urbanization.toLowerCase()}|suburb:${property.suburb.toLowerCase()}`;
        const cacheableData = {
          aiEnhanced: result.aiEnhanced,
          enhancedLocation: result.enhancedLocation,
          landmarks: result.landmarks,
          proximityClues: result.proximityClues,
          aiConfidence: result.aiConfidence,
          enhancementReason: result.enhancementReason,
          method: result.method,
          // Include condition data in cache
          conditionAnalysis: result.conditionAnalysis,
          conditionRating: result.conditionRating,
          conditionDetails: result.conditionDetails,
          conditionKeywords: result.conditionKeywords,
          conditionConfidence: result.conditionConfidence,
          cachedAt: new Date().toISOString(),
          originalUrbanization: property.urbanization,
          originalSuburb: property.suburb
        };
        
        this.preciseLocationCache.set(cacheKey, cacheableData);
        console.log(`   🏠 Cached by precise location: ${cacheKey}`);
      } else {
        console.log(`   🚫 Not caching - AI intelligence not useful enough`);
      }
    } else {
      console.log(`   🚫 Not caching - missing urbanization or suburb`);
    }
  }

  /**
   * ANALYTICS: Get performance metrics
   */
  getMetrics() {
    const cacheHitRate = this.metrics.totalQueries > 0 
      ? (this.metrics.cacheHits / this.metrics.totalQueries * 100).toFixed(1)
      : 0;
    
    return {
      ...this.metrics,
      cacheHitRate: `${cacheHitRate}%`,
      descriptionCacheRate: `${(this.metrics.descriptionCacheHits / this.metrics.totalQueries * 100).toFixed(1)}%`,
      preciseLocationCacheRate: `${(this.metrics.preciseLocationCacheHits / this.metrics.totalQueries * 100).toFixed(1)}%`
    };
  }

  /**
   * MAINTENANCE: Clear caches (for testing)
   */
  clearCaches() {
    this.descriptionCache.clear();
    this.preciseLocationCache.clear();
    this.geocodeCache.clear();
    console.log('🧹 All caches cleared');
  }

  /**
   * MAINTENANCE: Warm cache with high-frequency locations
   */
  async warmLocationCache(commonLocations) {
    console.log(`🔥 Warming location cache with ${commonLocations.length} common patterns`);
    // This would be called with the top location patterns from our analysis
    // For now, just log the intent
    commonLocations.forEach(location => {
      console.log(`   📍 Pre-warming: ${location.suburb}, ${location.city} (${location.count} properties)`);
    });
  }

  /**
   * BASIC RESULT: For properties without sufficient description data
   */
  createBasicResult(property, reason) {
    return {
      ...property,
      aiEnhanced: false,
      enhancedLocation: property.suburb || property.city || 'Unknown location',
      landmarks: [],
      proximityClues: [],
      aiConfidence: 3,
      enhancementReason: reason,
      method: 'basic_fallback'
    };
  }

  /**
   * VALIDATION: Reject marketing text but accept valid location references
   */
  validateLocationExtraction(location) {
    if (!location || location.trim().length === 0) return false; // Empty location is invalid
    
    const locationLower = location.toLowerCase().trim();
    
    // Reject if too long (likely marketing text)
    if (location.length > 80) return false;
    
    // ACCEPT proximity phrases that contain actual place names
    const knownPlaces = [
      'puerto banús', 'puerto banus', 'nueva andalucía', 'nueva andalucia',
      'marbella', 'estepona', 'mijas', 'fuengirola', 'benalmádena',
      'las chapas', 'hacienda las chapas', 'golden mile', 'marbella east',
      'nueva andalucía', 'guadalmina', 'san pedro', 'benahavís',
      'la quinta', 'los monteros', 'elviria', 'cabopino', 'calahonda'
    ];
    
    const containsKnownPlace = knownPlaces.some(place => 
      locationLower.includes(place.toLowerCase())
    );
    
    if (containsKnownPlace) {
      console.log(`   ✅ Valid location with known place: "${location}"`);
      return true; // Accept if it mentions a real place
    }
    
    // Reject pure marketing fluff without specific places
    const marketingPatterns = [
      /beautiful surroundings.*unforgettable.*experience/i,
      /luxury.*lifestyle.*comfort/i,
      /stunning.*views.*magnificent/i,
      /golf courses.*living.*such.*beautiful/i,
      /will definitely become.*unforgettable/i,
      /comfort.*relaxation.*magnificent.*nature/i,
      /living.*such.*beautiful.*surroundings.*will.*definitely/i
    ];
    
    if (marketingPatterns.some(pattern => pattern.test(location))) {
      return false;
    }
    
    // Reject if contains too many marketing words
    const marketingWords = ['beautiful', 'stunning', 'magnificent', 'luxury', 'unforgettable', 'definitely', 'experience', 'lifestyle'];
    const words = location.split(/\s+/);
    const marketingWordCount = words.filter(word => 
      marketingWords.some(mw => word.toLowerCase().includes(mw.toLowerCase()))
    ).length;
    
    if (marketingWordCount > 2) return false; // Too many marketing words
    
    // Accept reasonable length location names
    return words.length <= 10; // Allow up to 10 words for proximity descriptions
  }

  /**
   * OPTIMIZATION 4: Check for permanently cached high-confidence results
   */
  async checkPermanentCache(property) {
    try {
      if (!this.propertyDb || !property.reference) return null;
      
      const result = await this.propertyDb.query(
        `SELECT analysis_cache 
         FROM properties 
         WHERE reference = $1 
           AND analysis_cache IS NOT NULL 
           AND (analysis_cache->>'permanent_cache')::boolean = true
           AND (analysis_cache->>'confidence')::float >= 0.95`,
        [property.reference]
      );
      
      if (result.rows.length > 0) {
        const cachedData = result.rows[0].analysis_cache;
        console.log(`   ⚡ PERMANENT CACHE HIT: "${property.reference}" (confidence: ${cachedData.confidence})`);
        this.metrics.cacheHits++;
        this.optimizationStats.aiCallsAvoided++;
        return {
          ...cachedData,
          cacheType: 'permanent_high_confidence',
          method: 'permanent_cache'
        };
      }
      
      return null;
    } catch (error) {
      console.log(`   ⚠️ Permanent cache check failed: ${error.message}`);
      return null;
    }
  }

  /**
   * OPTIMIZATION 4: Handle permanent caching for high-confidence results
   */
  async handlePermanentCaching(property, aiResult) {
    try {
      // Only cache results with 95%+ confidence permanently
      const confidence = aiResult.aiConfidence / 10; // Convert to 0-1 scale
      if (confidence < 0.95 || !this.propertyDb || !property.reference) {
        return;
      }
      
      console.log(`   💾 PERMANENT CACHE: Storing high-confidence result (${confidence * 100}%) for "${property.reference}"`);
      
      // Prepare permanent cache data
      const permanentCacheData = {
        ...aiResult,
        permanent_cache: true,
        confidence: confidence,
        cached_at: new Date().toISOString(),
        cache_version: '1.0',
        optimization_source: 'high_confidence_permanent'
      };
      
      // Store in database
      await this.propertyDb.query(
        `UPDATE properties 
         SET analysis_cache = $1
         WHERE reference = $2`,
        [JSON.stringify(permanentCacheData), property.reference]
      );
      
      console.log(`   ✅ Permanently cached analysis for "${property.reference}" - will never need re-analysis`);
      
    } catch (error) {
      console.log(`   ⚠️ Permanent caching failed: ${error.message}`);
    }
  }
}

module.exports = OptimizedLocationService; 