const OpenAI = require('openai');

class FutureDevelopmentsService {
  constructor() {
    this.openai = process.env.OPENAI_API_KEY ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    }) : null;
    
    // In-memory hierarchical cache
    this.cache = new Map();
    this.timers = new Map();
    
    // Progressive tier tracking
    this.clickCounters = new Map();
    this.dataBuckets = new Map();
    
    // Cache TTLs (in milliseconds)
    this.cacheTTL = {
      urbanisation: 24 * 60 * 60 * 1000, // 24 hours
      suburb: 12 * 60 * 60 * 1000,       // 12 hours
      city: 6 * 60 * 60 * 1000           // 6 hours
    };
    
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      apiCalls: 0,
      totalCost: 0
    };
  }

  /**
   * Main method: Analyze future developments for a property
   */
  async analyzeFutureDevelopments(propertyData) {
    try {
      console.log('🏗️ Starting Future Developments analysis...');
      
      // Step 1: Smart trigger logic - check if we should run analysis
      const shouldAnalyze = this.shouldRunAnalysis(propertyData);
      if (!shouldAnalyze.run) {
        console.log(`⏭️ Skipping Future Developments: ${shouldAnalyze.reason}`);
        return {
          success: true,
          skipped: true,
          reason: shouldAnalyze.reason,
          content: "Future developments data not available for this location."
        };
      }

      // Step 2: Generate area keys for cache lookup
      const areaKeys = this.generateAreaKeys(propertyData);
      console.log(`🗝️ Generated area keys:`, areaKeys);

      // Step 3: Check hierarchical cache
      const cachedResult = this.checkHierarchicalCache(areaKeys);
      if (cachedResult) {
        console.log(`⚡ Cache hit! Returning cached developments`);
        return cachedResult;
      }

      // Step 4: Determine current tier and what data to fetch
      const tierInfo = this.getTierInfo(areaKeys);
      console.log(`📊 Current tier: ${tierInfo.tier}, fetching: ${tierInfo.categoriesToFetch.join(', ')}`);

      // Step 5: Check if we need fresh data or can skip
      if (tierInfo.categoriesToFetch.length === 0) {
        console.log(`✅ All data already cached for tier ${tierInfo.tier}`);
        return this.assembleCachedResult(areaKeys, tierInfo.tier);
      }

      // Step 6: Perform Tavily searches for missing categories
      const searchResults = await this.performTavilySearches(propertyData, tierInfo.categoriesToFetch);
      
      // Step 7: Generate AI analysis if we have sufficient data
      let developmentsData = null;
      if (searchResults.length >= 2) {
        developmentsData = await this.generateAIAnalysis(propertyData, searchResults, tierInfo.categoriesToFetch);
        this.metrics.apiCalls++;
      } else {
        console.log(`📉 Insufficient search results (${searchResults.length}), skipping AI analysis`);
        developmentsData = {
          infrastructure: [],
          commercial: [],
          residential: [],
          timeline: [],
          summary: "No significant future developments found in this area."
        };
      }

      // Step 8: Update cache and tier data
      this.updateCacheAndTiers(areaKeys, developmentsData, tierInfo);

      // Step 9: Return formatted result
      return {
        success: true,
        skipped: false,
        tier: tierInfo.tier,
        content: this.formatDevelopmentsContent(developmentsData),
        metadata: {
          searchResults: searchResults.length,
          categories: tierInfo.categoriesToFetch,
          cached: false
        }
      };

    } catch (error) {
      console.error('❌ Future Developments analysis failed:', error);
      return {
        success: false,
        error: error.message,
        content: "Future developments analysis temporarily unavailable."
      };
    }
  }

  /**
   * Smart trigger logic - determine if analysis should run
   */
  shouldRunAnalysis(propertyData) {
    // Always run if we have specific location data
    if (propertyData.urbanization || propertyData.suburb || 
        (propertyData.address && propertyData.address.includes(','))) {
      return { run: true, reason: 'Has specific location context' };
    }

    // Run at city level if confidence >= 50%
    if (propertyData.city) {
      // Simple confidence check - assume good confidence if we have other location indicators
      const confidence = (propertyData.province ? 30 : 0) + 
                       (propertyData.latitude ? 30 : 0) + 
                       (propertyData.longitude ? 30 : 0);
      
      if (confidence >= 50) {
        return { run: true, reason: `City-level analysis (confidence: ${confidence}%)` };
      }
    }

    // Skip if no usable location context
    return { run: false, reason: 'Insufficient location context for development search' };
  }

  /**
   * Generate cache keys for different area levels
   */
  generateAreaKeys(propertyData) {
    const keys = {};
    
    if (propertyData.urbanization) {
      keys.urbanisation = `futureDev:${propertyData.urbanization.toLowerCase().replace(/\s+/g, '_')}`;
    }
    
    if (propertyData.suburb) {
      keys.suburb = `futureDev:${propertyData.suburb.toLowerCase().replace(/\s+/g, '_')}`;
    }
    
    if (propertyData.city) {
      keys.city = `futureDev:${propertyData.city.toLowerCase().replace(/\s+/g, '_')}`;
    }

    return keys;
  }

  /**
   * Check hierarchical cache in order: urbanisation → suburb → city
   */
  checkHierarchicalCache(areaKeys) {
    const checkOrder = ['urbanisation', 'suburb', 'city'];
    
    for (const level of checkOrder) {
      if (areaKeys[level]) {
        const cached = this.cache.get(areaKeys[level]);
        if (cached && cached.expires > Date.now()) {
          this.metrics.cacheHits++;
          return {
            success: true,
            skipped: false,
            content: cached.content,
            tier: cached.tier,
            metadata: {
              cached: true,
              cacheLevel: level,
              expiresIn: Math.round((cached.expires - Date.now()) / 1000 / 60) // minutes
            }
          };
        }
      }
    }
    
    this.metrics.cacheMisses++;
    return null;
  }

  /**
   * Get current tier and determine what categories need fetching
   */
  getTierInfo(areaKeys) {
    // Use the most specific area key available
    const primaryKey = areaKeys.urbanisation || areaKeys.suburb || areaKeys.city;
    
    // Increment click counter (max 5)
    const currentCount = this.clickCounters.get(primaryKey) || 0;
    const newCount = Math.min(currentCount + 1, 5);
    this.clickCounters.set(primaryKey, newCount);
    
    // Check monthly reset (30 days)
    this.checkMonthlyReset(primaryKey);
    
    // Determine what categories to fetch based on tier
    const tierCategories = {
      1: ['infrastructure'],
      2: ['commercial'],
      3: ['residential'],
      4: ['timeline'],
      5: [] // All data cached
    };
    
    const existingBuckets = this.dataBuckets.get(primaryKey) || {};
    const categoriesToFetch = [];
    
    for (let tier = 1; tier <= newCount; tier++) {
      const categories = tierCategories[tier] || [];
      for (const category of categories) {
        if (!existingBuckets[category] || existingBuckets[category].length === 0) {
          categoriesToFetch.push(category);
        }
      }
    }
    
    return {
      tier: newCount,
      categoriesToFetch: [...new Set(categoriesToFetch)], // Remove duplicates
      primaryKey
    };
  }

  /**
   * Check and handle monthly reset
   */
  checkMonthlyReset(primaryKey) {
    const timestampKey = `${primaryKey}:ts`;
    const lastReset = this.dataBuckets.get(timestampKey);
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    
    if (!lastReset || (now - lastReset) > thirtyDays) {
      console.log(`🔄 Monthly reset for ${primaryKey}`);
      this.clickCounters.delete(primaryKey);
      this.dataBuckets.delete(primaryKey);
      this.dataBuckets.set(timestampKey, now);
    }
  }

  /**
   * Perform batched Tavily searches
   */
  async performTavilySearches(propertyData, categories) {
    if (!process.env.TAVILY_API_KEY) {
      console.log('⚠️ Tavily API key not available');
      return [];
    }

    const searchQueries = this.generateSearchQueries(propertyData, categories);
    console.log(`🔍 Performing ${searchQueries.length} Tavily searches...`);
    
    try {
      // Perform all searches in parallel
      const searchPromises = searchQueries.map(query => this.performSingleSearch(query));
      const results = await Promise.all(searchPromises);
      
      // Deduplicate results by URL and headline
      const deduplicatedResults = this.deduplicateResults(results.flat());
      console.log(`📋 Deduplicated to ${deduplicatedResults.length} unique results`);
      
      return deduplicatedResults.slice(0, 5); // Limit to top 5 results
      
    } catch (error) {
      console.error('❌ Tavily search failed:', error);
      return [];
    }
  }

  /**
   * Generate targeted search queries based on area and categories
   */
  generateSearchQueries(propertyData, categories) {
    const area = propertyData.urbanization || propertyData.suburb || propertyData.city;
    const city = propertyData.city || '';
    const queries = [];

    const categoryQueries = {
      infrastructure: [
        `"${area}" ${city} metro extension new infrastructure 2024 2025`,
        `proyectos infraestructura ${area} ${city} transporte`,
      ],
      commercial: [
        `"${area}" ${city} shopping centre commercial development`,
        `nuevos centros comerciales ${area} ${city}`,
      ],
      residential: [
        `"${area}" ${city} residential projects new housing development`,
        `nuevas urbanizaciones ${area} ${city}`,
      ],
      timeline: [
        `"${area}" ${city} construction timeline completion 2024 2025 2026`,
        `proyectos aprobados ${area} ${city} fechas construcción`,
      ]
    };

    for (const category of categories) {
      if (categoryQueries[category]) {
        queries.push(...categoryQueries[category]);
      }
    }

    return queries;
  }

  /**
   * Perform single Tavily search
   */
  async performSingleSearch(query) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`
        },
        body: JSON.stringify({
          query: query,
          search_depth: 'basic',
          include_answer: false,
          include_images: false,
          include_raw_content: false,
          max_results: 3
        })
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
      }

      const data = await response.json();
      return data.results || [];
      
    } catch (error) {
      console.error(`❌ Single search failed for "${query}":`, error);
      return [];
    }
  }

  /**
   * Deduplicate search results by URL and content similarity
   */
  deduplicateResults(results) {
    const seen = new Set();
    const unique = [];
    
    for (const result of results) {
      const key = result.url || result.title;
      if (key && !seen.has(key) && result.content && result.content.length > 100) {
        seen.add(key);
        unique.push(result);
      }
    }
    
    return unique;
  }

  /**
   * Generate AI analysis using OpenAI function calling
   */
  async generateAIAnalysis(propertyData, searchResults, categories) {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const area = propertyData.urbanization || propertyData.suburb || propertyData.city;
    const fullAddress = `${propertyData.address || ''}, ${area}, ${propertyData.city || ''}`.trim();
    
    // Function schema for structured output
    const futureDevelopmentsFunction = {
      name: "future_developments",
      description: "Analyze future developments impact on property values",
      parameters: {
        type: "object",
        properties: {
          infrastructure: {
            type: "array",
            items: { type: "string" },
            description: "Infrastructure projects (metro, roads, hospitals)"
          },
          commercial: {
            type: "array",
            items: { type: "string" },
            description: "Commercial developments (shopping centres, offices)"
          },
          residential: {
            type: "array", 
            items: { type: "string" },
            description: "Residential projects affecting property values"
          },
          timeline: {
            type: "array",
            items: {
              type: "object",
              properties: {
                project: { type: "string" },
                completion: { type: "string" }
              }
            },
            description: "Project timelines with completion dates"
          }
        },
        required: ["infrastructure", "commercial", "residential", "timeline"]
      }
    };

    const searchResultsText = searchResults
      .map(r => `${r.title}: ${r.content}`)
      .join('\n\n')
      .substring(0, 2000); // Limit context to 2000 chars

    const prompt = `You are a Spanish property market analyst. Analyse these search results to identify future developments that could impact property values in ${area}.

SEARCH RESULTS:
${searchResultsText}

PROPERTY CONTEXT:
- Location: ${fullAddress}
- Type: ${propertyData.property_type || 'Property'}
- Price: €${propertyData.sale_price || propertyData.price || 'N/A'}

ANALYSE AND PROVIDE using the future_developments function:
1. **Major Infrastructure Projects** (metro extensions, new roads, hospitals)
2. **Commercial Developments** (shopping centres, business parks)  
3. **Residential Projects** (new communities, urban regeneration)
4. **Timeline & Impact** (completion dates, positive/negative effects)

REQUIREMENTS:
- Only include verified, planned developments (not speculation)
- Focus on projects within 2-5km that affect property values
- Include estimated completion dates where available
- Mention if projects are approved, under construction, or planned
- Keep each item concise but informative (max 50 words)
- Use British English

If no significant developments found, return empty arrays.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system", 
            content: "You are a property development analyst. Use the future_developments function to output structured JSON analysis."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        functions: [futureDevelopmentsFunction],
        function_call: { name: "future_developments" },
        max_tokens: 800,
        temperature: 0.3
      });

      if (completion.choices[0].message.function_call) {
        const result = JSON.parse(completion.choices[0].message.function_call.arguments);
        console.log('🤖 AI analysis completed with structured output');
        
        // Calculate cost (GPT-4o-mini pricing)
        const cost = (completion.usage.total_tokens / 1000) * 0.0015; // $0.0015 per 1K tokens
        this.metrics.totalCost += cost;
        
        return result;
      }
      
      throw new Error('No function call response received');
      
    } catch (error) {
      console.error('❌ OpenAI function call failed:', error);
      throw error;
    }
  }

  /**
   * Update cache and tier data buckets
   */
  updateCacheAndTiers(areaKeys, developmentsData, tierInfo) {
    const { primaryKey, tier, categoriesToFetch } = tierInfo;
    
    // Update data buckets with new categories
    const existingBuckets = this.dataBuckets.get(primaryKey) || {};
    for (const category of categoriesToFetch) {
      existingBuckets[category] = developmentsData[category] || [];
    }
    this.dataBuckets.set(primaryKey, existingBuckets);
    
    // Update all cache levels with assembled result
    const assembledResult = this.assembleResultFromBuckets(existingBuckets, tier);
    const content = this.formatDevelopmentsContent(assembledResult);
    
    // Cache at all levels with respective TTLs
    for (const [level, key] of Object.entries(areaKeys)) {
      if (key) {
        const ttl = this.cacheTTL[level] || this.cacheTTL.city;
        this.cache.set(key, {
          content,
          tier,
          expires: Date.now() + ttl,
          timestamp: new Date().toISOString()
        });
        
        // Set cleanup timer
        if (this.timers.has(key)) {
          clearTimeout(this.timers.get(key));
        }
        
        const timer = setTimeout(() => {
          this.cache.delete(key);
          this.timers.delete(key);
        }, ttl);
        
        this.timers.set(key, timer);
      }
    }
    
    console.log(`💾 Updated cache for tier ${tier}, expires in ${Math.round(this.cacheTTL.city / 1000 / 60)} minutes`);
  }

  /**
   * Assemble cached result from existing buckets
   */
  assembleCachedResult(areaKeys, tier) {
    const primaryKey = areaKeys.urbanisation || areaKeys.suburb || areaKeys.city;
    const existingBuckets = this.dataBuckets.get(primaryKey) || {};
    
    const assembledData = this.assembleResultFromBuckets(existingBuckets, tier);
    const content = this.formatDevelopmentsContent(assembledData);
    
    return {
      success: true,
      skipped: false,
      tier,
      content,
      metadata: {
        cached: true,
        fromBuckets: true
      }
    };
  }

  /**
   * Assemble result from data buckets based on tier
   */
  assembleResultFromBuckets(buckets, tier) {
    const tierCategories = {
      1: ['infrastructure'],
      2: ['infrastructure', 'commercial'], 
      3: ['infrastructure', 'commercial', 'residential'],
      4: ['infrastructure', 'commercial', 'residential', 'timeline'],
      5: ['infrastructure', 'commercial', 'residential', 'timeline']
    };
    
    const categories = tierCategories[tier] || ['infrastructure'];
    const result = {
      infrastructure: [],
      commercial: [],
      residential: [],
      timeline: []
    };
    
    for (const category of categories) {
      result[category] = buckets[category] || [];
    }
    
    return result;
  }

  /**
   * Format developments data into readable content
   */
  formatDevelopmentsContent(developmentsData) {
    const sections = [];
    
    if (developmentsData.infrastructure?.length > 0) {
      sections.push(`**Major Infrastructure:**\n${developmentsData.infrastructure.map(item => `• ${item}`).join('\n')}`);
    }
    
    if (developmentsData.commercial?.length > 0) {
      sections.push(`**Commercial Projects:**\n${developmentsData.commercial.map(item => `• ${item}`).join('\n')}`);
    }
    
    if (developmentsData.residential?.length > 0) {
      sections.push(`**Residential Developments:**\n${developmentsData.residential.map(item => `• ${item}`).join('\n')}`);
    }
    
    if (developmentsData.timeline?.length > 0) {
      sections.push(`**Project Timeline:**\n${developmentsData.timeline.map(item => `• ${item.project} (${item.completion})`).join('\n')}`);
    }
    
    if (sections.length === 0) {
      return "No significant future developments found in this area.";
    }
    
    return sections.join('\n\n');
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      activeTimers: this.timers.size,
      estimatedCostPer1000Analyses: this.metrics.totalCost * 1000 / Math.max(this.metrics.apiCalls, 1)
    };
  }

  /**
   * Clear all caches (for testing or reset)
   */
  clearCache() {
    this.cache.clear();
    this.clickCounters.clear();
    this.dataBuckets.clear();
    
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    
    console.log('🧹 All caches cleared');
  }
}

module.exports = FutureDevelopmentsService; 