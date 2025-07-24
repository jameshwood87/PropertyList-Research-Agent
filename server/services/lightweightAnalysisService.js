const OpenAI = require('openai');

class LightweightAnalysisService {
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else {
      this.openai = null;
    }
    
    // Performance tracking
    this.metrics = {
      totalProcessed: 0,
      patternMatches: 0,
      aiCalls: 0,
      totalCost: 0
    };
    
    // Known location patterns for free extraction
    this.locationPatterns = [
      /urbanización\s+([^,]{3,40})/gi,
      /cerca de\s+([^,]{3,30})/gi,
      /próximo a\s+([^,]{3,30})/gi,
      /(?:en|in)\s+([A-Z][a-záéíóúñü\s]{3,25})/g,
      /(?:golf|club)\s+([^,]{3,30})/gi
    ];
    
    // Condition keywords for free analysis  
    this.conditionKeywords = {
      excellent: ['excelente', 'impecable', 'perfecto', 'nuevo'],
      'very-good': ['muy bueno', 'buen estado', 'reformado'],
      good: ['bueno', 'habitable', 'conservado'],
      fair: ['para reformar', 'necesita', 'antiguo'],
      'needs-renovation': ['reform', 'renovar', 'actualizar']
    };
  }

  /**
   * Ultra-lightweight analysis for batch processing
   * Target: < €0.01 per property
   */
  async analyzeBatch(properties) {
    console.log(`🔄 Starting lightweight batch analysis of ${properties.length} properties`);
    const results = [];
    
    for (const property of properties) {
      const result = await this.analyzeProperty(property);
      results.push(result);
      
      // Cost tracking
      this.metrics.totalProcessed++;
      if (result.method === 'pattern_match') {
        this.metrics.patternMatches++;
      } else if (result.method === 'lightweight_ai') {
        this.metrics.aiCalls++;
        this.metrics.totalCost += 0.0002; // €0.0002 per AI call
      }
    }
    
    this.logMetrics();
    return results;
  }

  /**
   * Analyze single property with cost optimization
   */
  async analyzeProperty(property) {
    // Step 1: Try pattern matching (FREE)
    const patternResult = this.extractWithPatterns(property);
    if (patternResult.confidence >= 0.7) {
      return {
        ...property,
        ...patternResult,
        method: 'pattern_match',
        cost: 0
      };
    }

    // Step 2: Lightweight AI only if needed (€0.0002)
    if (this.openai && this.hasDescription(property)) {
      return await this.lightweightAI(property);
    }

    // Step 3: Fallback to basic data
    return {
      ...property,
      location: property.suburb || property.city || 'Unknown',
      condition: null,
      confidence: 0.3,
      method: 'fallback',
      cost: 0
    };
  }

  /**
   * Pattern-based extraction (FREE)
   */
  extractWithPatterns(property) {
    const description = this.getDescription(property);
    if (!description) return { confidence: 0 };

    let bestLocation = null;
    let maxConfidence = 0;

    // Extract location with patterns
    for (const pattern of this.locationPatterns) {
      const matches = [...description.matchAll(pattern)];
      for (const match of matches) {
        const location = match[1]?.trim();
        if (location && location.length > 3 && location.length < 40) {
          const confidence = this.calculatePatternConfidence(location, description);
          if (confidence > maxConfidence) {
            bestLocation = location;
            maxConfidence = confidence;
          }
        }
      }
    }

    // Extract condition with keywords
    const condition = this.extractCondition(description);

    return {
      location: bestLocation || property.suburb || property.city,
      condition: condition.rating,
      conditionDetails: condition.details,
      confidence: Math.max(maxConfidence, condition.confidence),
      extractedFeatures: {
        locationFound: !!bestLocation,
        conditionFound: !!condition.rating
      }
    };
  }

  /**
   * Ultra-lightweight AI analysis (€0.0002 target)
   */
  async lightweightAI(property) {
    const description = this.getDescription(property).substring(0, 150); // Limit input
    
    const prompt = `Location+condition from: "${description}"
JSON: {"loc":"place name or null","cond":"excellent|good|fair|poor|null","conf":1-5}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 30, // Minimal output
        temperature: 0
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      return {
        ...property,
        location: result.loc || property.suburb || property.city,
        condition: result.cond,
        confidence: (result.conf || 3) / 5,
        method: 'lightweight_ai',
        cost: 0.0002,
        tokensUsed: response.usage?.total_tokens || 0
      };

    } catch (error) {
      console.log(`⚠️ Lightweight AI failed: ${error.message}`);
      return {
        ...property,
        location: property.suburb || property.city,
        condition: null,
        confidence: 0.2,
        method: 'ai_failed',
        cost: 0
      };
    }
  }

  /**
   * Extract condition from description using keywords
   */
  extractCondition(description) {
    const text = description.toLowerCase();
    
    for (const [rating, keywords] of Object.entries(this.conditionKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          return {
            rating: rating,
            details: `Found keyword: ${keyword}`,
            confidence: 0.6
          };
        }
      }
    }
    
    return { rating: null, details: null, confidence: 0 };
  }

  /**
   * Get description text from property
   */
  getDescription(property) {
    if (typeof property.descriptions === 'string') {
      return property.descriptions;
    } else if (typeof property.descriptions === 'object') {
      return property.descriptions?.en || property.descriptions?.english || '';
    }
    return '';
  }

  /**
   * Check if property has meaningful description
   */
  hasDescription(property) {
    const desc = this.getDescription(property);
    return desc && desc.length > 20;
  }

  /**
   * Calculate confidence for pattern matches
   */
  calculatePatternConfidence(location, description) {
    let confidence = 0.5;
    
    // Boost for proper nouns
    if (/^[A-Z]/.test(location)) confidence += 0.2;
    
    // Boost for known location types
    if (/urbanización|golf|club|plaza/i.test(location)) confidence += 0.2;
    
    // Reduce for marketing words
    if (/beautiful|stunning|luxury/i.test(location)) confidence -= 0.3;
    
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Log performance metrics
   */
  logMetrics() {
    const { totalProcessed, patternMatches, aiCalls, totalCost } = this.metrics;
    const patternRate = ((patternMatches / totalProcessed) * 100).toFixed(1);
    const avgCost = totalProcessed > 0 ? (totalCost / totalProcessed).toFixed(6) : 0;
    
    console.log(`\n📊 LIGHTWEIGHT ANALYSIS METRICS:`);
    console.log(`   Total processed: ${totalProcessed}`);
    console.log(`   Pattern matches: ${patternMatches} (${patternRate}%)`);
    console.log(`   AI calls: ${aiCalls}`);
    console.log(`   Average cost per property: €${avgCost}`);
    console.log(`   Total cost: €${totalCost.toFixed(4)}`);
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      avgCostPerProperty: this.metrics.totalProcessed > 0 
        ? this.metrics.totalCost / this.metrics.totalProcessed 
        : 0
    };
  }
}

module.exports = LightweightAnalysisService;