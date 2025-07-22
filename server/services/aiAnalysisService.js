const OpenAI = require('openai');

class AIAnalysisService {
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else {
      this.openai = null;
      console.log('OpenAI API key not found - AI analysis will be disabled');
    }
  }

  /**
   * Generate comprehensive AI-powered property analysis
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

      const analysisPrompt = this.buildAnalysisPrompt(propertyData, comparablesData, chartData);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a professional real estate analyst specializing in Spanish property markets. Provide detailed, accurate, and actionable property analysis based on comparable sales data. Use British English throughout."
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      });

      const analysis = completion.choices[0].message.content;
      
      return {
        analysis,
        confidence: this.calculateConfidenceScore(comparablesData),
        recommendations: this.extractRecommendations(analysis),
        marketTrends: this.extractMarketTrends(analysis),
        timestamp: new Date().toISOString()
      };

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
   * Build comprehensive analysis prompt for OpenAI
   */
  buildAnalysisPrompt(propertyData, comparablesData, chartData) {
    const { comparables, summary, criteria } = comparablesData;
    const { priceComparison, marketPosition, sizeComparison } = chartData;

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
- Additional Details: ${propertyData.additionalInfo}` : ''}

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
4. LOCATION INSIGHTS: Neighbourhood characteristics and growth potential
5. RECOMMENDATIONS: Specific advice for buyers/sellers/investors

Focus on actionable insights and professional market analysis. Be specific about the Spanish property market context.
    `;
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
   * Generate market summary for quick insights
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