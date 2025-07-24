const OpenAI = require('openai');

class AIAnalysisService {
  constructor(propertyDatabase, learningService = null) {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else {
      this.openai = null;
      console.log('OpenAI API key not found - AI analysis will be disabled');
    }
    
    this.learningService = learningService;
  }

  /**
   * Generate comprehensive AI-powered property analysis with learning enhancement - FUNCTION CALLING VERSION
   */
  async generatePropertyAnalysis(propertyData, comparablesData, chartData) {
    try {
      if (!this.openai) {
        return {
          analysis: "AI analysis requires OpenAI API key configuration. Please refer to the comparable properties data for market insights.",
          confidence: 0,
          recommendations: [],
          marketTrends: [],
          timestamp: new Date().toISOString(),
          error: "OpenAI API key not configured"
        };
      }

      // OPTIMIZATION: Use function calling for structured output
      let completion;
      if (this.learningService) {
        console.log('🧠 Using function calling for learning-enhanced analysis');
        completion = await this.generateAnalysisWithFunctionCalling(propertyData, comparablesData, chartData);
      } else {
        completion = await this.generateStandardAnalysis(propertyData, comparablesData, chartData);
      }
      
      // OPTIMIZATION: Parse function call response for structured analysis
      let analysis;
      let structuredData = null;
      
      if (completion.choices[0].message.function_call) {
        // Function calling response
        const functionCall = completion.choices[0].message.function_call;
        structuredData = JSON.parse(functionCall.arguments);
        
        // Convert structured data to readable analysis
        analysis = this.formatStructuredAnalysis(structuredData);
      } else {
        // Legacy text response (for learning enhancement)
        analysis = completion.choices[0].message.content;
      }
      
      const result = {
        analysis,
        confidence: this.calculateConfidenceScore(comparablesData),
        recommendations: this.extractRecommendations(analysis),
        marketTrends: this.extractMarketTrends(analysis),
        timestamp: new Date().toISOString(),
        learningEnhanced: !!this.learningService,
        // OPTIMIZATION: Add function calling metadata and structured data
        method: this.learningService ? 'function_calling' : (structuredData ? 'structured_function_calling' : 'standard'),
        structuredData: structuredData, // Include raw structured data for frontend use
        marketSummary: structuredData?.marketSummary || null // Bundled market summary
      };

      return result;

    } catch (error) {
      console.error('Error generating AI analysis:', error);
      return {
        analysis: "AI analysis temporarily unavailable. Please refer to the comparable properties data for market insights.",
        confidence: 0,
        recommendations: [],
        marketTrends: [],
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * OPTIMIZATION: Generate analysis using function calling for learning insights
   */
  async generateAnalysisWithFunctionCalling(propertyData, comparablesData, chartData) {
    // Get structured learning insights using specific location (urbanization > suburb > city)
    const specificLocation = this.learningService.getSpecificLocation(propertyData);
    const learningInsights = await this.learningService.generateStructuredLearningInsights(specificLocation);
    
    console.log(`🧠 Using learning insights for ${specificLocation}: ${JSON.stringify(learningInsights)}`);
    
    // Build compressed base prompt
    const basePrompt = this.learningService.buildBasePrompt(propertyData, comparablesData, chartData);

    // OPTIMIZATION: Define function for applying learning insights
    const applyLearningFunction = {
      name: "apply_learning_insights",
      description: "Apply historical learning insights to property analysis",
      parameters: {
        type: "object",
        properties: {
          overprice_bias_pct: {
            type: "number",
            description: "Historical price bias percentage for this area (-50 to 50)"
          },
          location_weight: {
            type: "number", 
            description: "Importance weight for location factors (20 to 60)"
          },
          focus_areas: {
            type: "array",
            items: { type: "string" },
            description: "Areas requiring special attention based on feedback"
          },
          confidence_boost: {
            type: "number",
            description: "Confidence adjustment based on learning (0 to 20)"
          }
        },
        required: ["overprice_bias_pct", "location_weight"]
      }
    };

    return await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional real estate analyst specializing in ${specificLocation}. Use the apply_learning_insights function to incorporate historical data, then provide detailed property analysis. Use British English throughout.`
        },
        {
          role: "user",
          content: basePrompt
        }
      ],
      functions: [applyLearningFunction],
      function_call: {
        name: "apply_learning_insights",
        arguments: JSON.stringify(learningInsights)
      },
      max_tokens: 1800,
      temperature: 0.3
    });
  }

  /**
   * OPTIMIZATION: Standard analysis with function calling for structured output
   */
  async generateStandardAnalysis(propertyData, comparablesData, chartData) {
    // OPTIMIZATION: Function calling schema for structured analysis
    const generateComparableAnalysis = {
      name: "generateComparableAnalysis",
      description: "Generate structured property analysis with market summary",
      parameters: {
        type: "object",
        properties: {
          marketPosition: {
            type: "string",
            description: "Market positioning assessment (2-3 sentences)"
          },
          pricingVerdict: {
            type: "string", 
            description: "Pricing assessment and value conclusion (2-3 sentences)"
          },
          investmentOutlook: {
            type: "string",
            description: "Investment potential and ROI outlook (2-3 sentences)"
          },
          locationEdge: {
            type: "string",
            description: "Location advantages and market appeal (2-3 sentences)"
          },
          recommendations: {
            type: "string",
            description: "Specific actionable recommendations (2-3 sentences)"
          },
          marketSummary: {
            type: "string",
            description: "Brief market conditions summary (1-2 sentences)"
          }
        },
        required: ["marketPosition", "pricingVerdict", "investmentOutlook", "locationEdge", "recommendations", "marketSummary"]
      }
    };

    const compressedPrompt = this.buildCompressedPrompt(propertyData, comparablesData, chartData);
    
    return await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Use function generateComparableAnalysis to output structured JSON analysis only. Use British English throughout."
        },
        {
          role: "user",
          content: compressedPrompt
        }
      ],
      functions: [generateComparableAnalysis],
      function_call: { name: "generateComparableAnalysis" },
      max_tokens: 1200, // OPTIMIZATION: Reduced from 1800
      temperature: 0.3
    });
  }

  /**
   * OPTIMIZATION: Build compressed prompt using bulletized facts (saves ~40 tokens)
   */
  buildCompressedPrompt(propertyData, comparablesData, chartData) {
    const { comparables, summary } = comparablesData;
    const { priceComparison, marketPosition } = chartData;

    return `Analyze Ref ${propertyData.reference || 'N/A'}
• Price: €${propertyData.price?.toLocaleString() || 'N/A'}
• Size: ${propertyData.build_square_meters || propertyData.build_area}m²
• Beds/Baths: ${propertyData.bedrooms}/${propertyData.bathrooms}
• Location: ${this.formatLocation(propertyData)}
• Comparables: avg €${priceComparison.average?.toLocaleString()}, range €${priceComparison.min?.toLocaleString()}–€${priceComparison.max?.toLocaleString()}
• Market position: ${marketPosition.percentile}th percentile
• Sample: ${comparables.length} properties

${this.compressComparablesData(summary)}

Provide structured analysis covering market position, pricing, investment outlook, location advantages, and recommendations.`;
  }

  /**
   * OPTIMIZATION: Compress comparables data for prompt efficiency
   */
  compressComparablesData(summary) {
    // Extract key insights and compress verbose summary
    if (!summary || summary.length < 100) return summary;
    
    // Simple compression - take key sentences
    const sentences = summary.split('. ');
    const keyInsights = sentences.slice(0, 3).join('. ') + '.';
    return keyInsights.length > 200 ? keyInsights.substring(0, 197) + '...' : keyInsights;
  }

  /**
   * Build comprehensive analysis prompt for OpenAI (LEGACY - for learning enhancement)
   */
  buildAnalysisPrompt(propertyData, comparablesData, chartData) {
    const { comparables, summary, criteria } = comparablesData;
    const { priceComparison, marketPosition, sizeComparison } = chartData;

    // ENHANCED: Extract location intelligence data
    const locationIntelligence = this.buildLocationIntelligenceSection(propertyData);

    return `
Please provide a comprehensive property analysis for this Spanish property:

SUBJECT PROPERTY:
- Reference: ${propertyData.reference || 'N/A'}
- Location: ${this.formatLocation(propertyData)}
- Type: ${this.getPropertyTypeName(propertyData.property_type)}
- Price: €${propertyData.price?.toLocaleString() || 'N/A'}
- Size: ${propertyData.build_square_meters || propertyData.build_area}m²
- Bedrooms: ${propertyData.bedrooms}
- Bathrooms: ${propertyData.bathrooms}${propertyData.additionalInfo ? `
- Additional Details: ${propertyData.additionalInfo}` : ''}${locationIntelligence}

COMPARABLE PROPERTIES ANALYSIS:
${summary}

MARKET DATA:
- Found ${comparables.length} comparable properties
- Average market price: €${priceComparison.average?.toLocaleString()}
- Price range: €${priceComparison.min?.toLocaleString()} - €${priceComparison.max?.toLocaleString()}
- Subject property percentile: ${marketPosition.percentile}th
- Average similarity to comparables: ${Math.round(comparables.reduce((sum, c) => sum + c.overallPercent, 0) / comparables.length)}%

TOP 3 COMPARABLES:
${comparables.slice(0, 3).map((comp, i) => `
${i + 1}. ${comp.reference} - €${comp.price?.toLocaleString()}
   Location: ${comp.address}
   Size: ${comp.buildArea}m², ${comp.bedrooms} beds
   Similarity: ${comp.overallPercent}% (Distance: ${comp.distancePercent}%, Size: ${comp.sizePercent}%, Price: ${comp.pricePercent}%)
`).join('')}

Please provide analysis covering:
1. MARKET POSITIONING: How this property compares to the local market
2. PRICING ANALYSIS: Is the property fairly priced, overpriced, or underpriced?
3. INVESTMENT POTENTIAL: Rental yield potential, capital appreciation prospects
4. LOCATION ADVANTAGES: Highlight specific location benefits and nearby amenities
5. RECOMMENDATIONS: Specific advice for buyers/sellers/investors

${locationIntelligence ? 'IMPORTANT: Pay special attention to the location intelligence data and specific landmarks/proximity details provided above.' : ''}
    `;
  }

  /**
   * Build location intelligence section for AI analysis
   */
  buildLocationIntelligenceSection(propertyData) {
    let locationSection = '';
    
    // Check for enhanced location data from user input
    const enhancedLocation = propertyData.resolvedLocation?.enhancedLocation;
    const locationContext = propertyData.resolvedLocation;
    
    if (enhancedLocation || locationContext) {
      locationSection += `

LOCATION INTELLIGENCE:`;
      
      // Add enhanced location details (supplementary to main property location)
      if (enhancedLocation) {
        locationSection += `
- Additional Location Context: ${enhancedLocation.location || 'N/A'}
- Context Method: ${enhancedLocation.method || 'N/A'} (${Math.round((enhancedLocation.confidence || 0) * 100)}% confidence)`;
        
        // Add proximity clues from user input
        if (enhancedLocation.proximityClues && enhancedLocation.proximityClues.length > 0) {
          locationSection += `
- Additional Proximity Details:`;
          enhancedLocation.proximityClues.forEach(clue => {
            locationSection += `
  • ${clue.distance ? clue.distance + ' meters from' : 'Close to'} ${clue.place}`;
          });
        }
        
        // Add landmarks from user input
        if (enhancedLocation.landmarks && enhancedLocation.landmarks.length > 0) {
          locationSection += `
- Additional Nearby Landmarks:`;
          enhancedLocation.landmarks.forEach(landmark => {
            locationSection += `
  • ${landmark.name} (${landmark.type})`;
          });
        }
        
        // Add user provided text as supplementary context
        if (propertyData.resolvedLocation?.userProvidedEnhancement) {
          locationSection += `
- Supplementary Location Details (User Provided): "${propertyData.resolvedLocation.userProvidedEnhancement}"`;
        }
      }
      
      // Add general location context
      if (locationContext && locationContext.location) {
        locationSection += `
- Resolved Location: ${locationContext.location} (${Math.round((locationContext.confidence || 0) * 100)}% confidence)`;
        
        if (locationContext.coordinates) {
          locationSection += `
- Precise Coordinates: ${locationContext.coordinates.lat.toFixed(6)}, ${locationContext.coordinates.lng.toFixed(6)}`;
        }
      }
    }
    
    return locationSection;
  }

  /**
   * Calculate confidence score based on comparable data quality
   */
  calculateConfidenceScore(comparablesData) {
    const { comparables } = comparablesData;
    
    if (comparables.length === 0) return 0;
    
    let score = 0;
    
    // Base score from number of comparables (max 40 points)
    score += Math.min(comparables.length * 4, 40);
    
    // Average similarity score (max 30 points)
    const avgSimilarity = comparables.reduce((sum, c) => sum + c.overallPercent, 0) / comparables.length;
    score += (avgSimilarity / 100) * 30;
    
    // Price data availability (max 20 points)
    const withPrices = comparables.filter(c => c.price > 0).length;
    score += (withPrices / comparables.length) * 20;
    
    // Location precision (max 10 points)
    const withCoordinates = comparables.filter(c => c.latitude && c.longitude).length;
    score += (withCoordinates / comparables.length) * 10;
    
    return Math.round(Math.min(score, 100));
  }

  /**
   * Extract key recommendations from AI analysis
   */
  extractRecommendations(analysis) {
    const recommendations = [];
    const lines = analysis.split('\n').filter(line => line.trim());
    
    // Look for recommendation sections
    let inRecommendations = false;
    for (const line of lines) {
      if (line.toLowerCase().includes('recommendation')) {
        inRecommendations = true;
        continue;
      }
      
      if (inRecommendations && (line.startsWith('- ') || line.startsWith('• ') || line.match(/^\d+\./))) {
        recommendations.push(line.trim());
      }
    }
    
    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  /**
   * Extract market trends from AI analysis
   */
  extractMarketTrends(analysis) {
    const trends = [];
    const trendKeywords = ['growing', 'declining', 'stable', 'increasing', 'decreasing', 'demand', 'supply', 'trend'];
    
    const sentences = analysis.split('.').filter(s => s.trim());
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      if (trendKeywords.some(keyword => lowerSentence.includes(keyword))) {
        trends.push(sentence.trim() + '.');
      }
    }
    
    return trends.slice(0, 3); // Limit to top 3 trends
  }

  /**
   * Format property location for display
   */
  formatLocation(propertyData) {
    const components = [];
    
    if (propertyData.urbanization) components.push(propertyData.urbanization);
    if (propertyData.suburb) components.push(propertyData.suburb);
    if (propertyData.city) components.push(propertyData.city);
    
    return components.join(', ') || 'Location not specified';
  }

  /**
   * Get human-readable property type name
   */
  getPropertyTypeName(propertyType) {
    const types = {
      1: 'Apartment',
      2: 'Villa',
      3: 'Townhouse',
      4: 'Plot',
      5: 'Commercial',
      6: 'Office',
      7: 'Garage',
      8: 'Hotel',
      9: 'Industrial'
    };
    
    return types[propertyType] || 'Property';
  }

  /**
   * OPTIMIZATION: Format structured JSON analysis into readable text
   */
  formatStructuredAnalysis(structuredData) {
    return `
## Market Position
${structuredData.marketPosition}

## Pricing Assessment  
${structuredData.pricingVerdict}

## Investment Outlook
${structuredData.investmentOutlook}

## Location Advantages
${structuredData.locationEdge}

## Recommendations
${structuredData.recommendations}

${structuredData.marketSummary ? `\n## Market Summary\n${structuredData.marketSummary}` : ''}
    `.trim();
  }

  /**
   * Generate market summary for quick insights (LEGACY - now bundled in main analysis)
   */
  async generateMarketSummary(comparablesData) {
    try {
      if (!this.openai) {
        return "Market summary requires OpenAI API key configuration.";
      }

      const { comparables, criteria } = comparablesData;
      
      if (comparables.length === 0) {
        return "No comparable properties found for market analysis.";
      }

      const prompt = `
Provide a brief 2-3 sentence market summary for these ${comparables.length} comparable properties in ${criteria.city || 'the area'}:

Average Price: €${Math.round(comparables.reduce((sum, c) => sum + c.price, 0) / comparables.length).toLocaleString()}
Price Range: €${Math.min(...comparables.map(c => c.price)).toLocaleString()} - €${Math.max(...comparables.map(c => c.price)).toLocaleString()}
Average Size: ${Math.round(comparables.reduce((sum, c) => sum + c.buildArea, 0) / comparables.length)}m²

Focus on market conditions and pricing trends. Use British English.
      `;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a property market analyst. Provide concise market summaries."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.3
      });

      return completion.choices[0].message.content.trim();

    } catch (error) {
      console.error('Error generating market summary:', error);
      return "Market summary temporarily unavailable.";
    }
  }
}

module.exports = AIAnalysisService; 