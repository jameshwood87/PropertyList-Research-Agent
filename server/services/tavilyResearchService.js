const axios = require('axios');

class TavilyResearchService {
  constructor() {
    this.apiKey = process.env.TAVILY_API_KEY;
    this.baseUrl = 'https://api.tavily.com/search';
  }

  /**
   * Conduct comprehensive neighborhood research
   */
  async conductNeighborhoodResearch(propertyData) {
    try {
      if (!this.apiKey) {
        return {
          marketTrends: [],
          developmentPlans: [],
          infrastructure: [],
          amenities: [],
          error: "Tavily API key not configured",
          timestamp: new Date().toISOString()
        };
      }

      const location = this.formatLocation(propertyData);
      const searches = [
        this.searchMarketTrends(location),
        this.searchDevelopmentPlans(location), 
        this.searchInfrastructure(location),
        this.searchAmenities(location)
      ];

      const results = await Promise.allSettled(searches);
      
      return {
        marketTrends: this.extractResults(results[0]),
        developmentPlans: this.extractResults(results[1]),
        infrastructure: this.extractResults(results[2]),
        amenities: this.extractResults(results[3]),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error conducting neighborhood research:', error);
      return {
        marketTrends: [],
        developmentPlans: [],
        infrastructure: [],
        amenities: [],
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Search for market trends and pricing data
   */
  async searchMarketTrends(location) {
    const query = `${location} property market trends 2024 prices real estate analysis`;
    return this.performSearch(query, {
      include_domains: ['idealista.com', 'fotocasa.es', 'pisos.com', 'propertylist.es'],
      max_results: 5
    });
  }

  /**
   * Search for development and infrastructure plans
   */
  async searchDevelopmentPlans(location) {
    const query = `${location} urban development plans infrastructure projects 2024 city planning`;
    return this.performSearch(query, {
      include_domains: ['madrid.es', 'valencia.es', 'barcelona.cat', 'gov.es'],
      max_results: 3
    });
  }

  /**
   * Search for transport and infrastructure information
   */
  async searchInfrastructure(location) {
    const query = `${location} transport metro bus connectivity infrastructure access`;
    return this.performSearch(query, {
      max_results: 4
    });
  }

  /**
   * Search for local amenities and lifestyle factors
   */
  async searchAmenities(location) {
    const query = `${location} schools restaurants shopping centers parks amenities lifestyle`;
    return this.performSearch(query, {
      max_results: 4
    });
  }

  /**
   * Perform Tavily search with specified parameters
   */
  async performSearch(query, options = {}) {
    if (!this.apiKey) {
      throw new Error('Tavily API key not configured');
    }

    const payload = {
      api_key: this.apiKey,
      query: query,
      search_depth: 'basic',
      include_answer: true,
      include_images: false,
      include_raw_content: false,
      max_results: options.max_results || 5,
      ...options
    };

    const response = await axios.post(this.baseUrl, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  /**
   * Generate property investment insights
   */
  async generateInvestmentInsights(propertyData, comparablesData) {
    try {
      const location = this.formatLocation(propertyData);
      const propertyType = this.getPropertyTypeName(propertyData.property_type);
      
      const query = `${location} ${propertyType} investment rental yield capital appreciation 2024 property investment`;
      
      const searchResult = await this.performSearch(query, {
        include_domains: ['kyero.com', 'spainhouses.net', 'idealista.com'],
        max_results: 5
      });

      return {
        insights: searchResult.answer || "Investment insights not available",
        sources: searchResult.results || [],
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error generating investment insights:', error);
      return {
        insights: "Investment research temporarily unavailable",
        sources: [],
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Research price trends for specific area
   */
  async researchPriceTrends(propertyData) {
    try {
      const location = this.formatLocation(propertyData);
      const propertyType = this.getPropertyTypeName(propertyData.property_type);
      
      const query = `${location} ${propertyType} price trends 2024 cost per square meter market analysis`;
      
      const searchResult = await this.performSearch(query, {
        include_domains: ['idealista.com', 'fotocasa.es', 'pisos.com'],
        max_results: 4
      });

      return {
        trends: searchResult.answer || "Price trend data not available",
        marketData: searchResult.results || [],
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error researching price trends:', error);
      return {
        trends: "Price trend research temporarily unavailable",
        marketData: [],
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Extract results from Promise.allSettled
   */
  extractResults(promiseResult) {
    if (promiseResult.status === 'fulfilled') {
      return promiseResult.value.results || [];
    } else {
      console.error('Search failed:', promiseResult.reason);
      return [];
    }
  }

  /**
   * Format property location for searches
   */
  formatLocation(propertyData) {
    const components = [];
    
    if (propertyData.suburb) components.push(propertyData.suburb);
    if (propertyData.city) components.push(propertyData.city);
    if (propertyData.province) components.push(propertyData.province);
    
    const location = components.join(', ');
    return location || 'Spain';
  }

  /**
   * Get human-readable property type name
   */
  getPropertyTypeName(propertyType) {
    const types = {
      1: 'apartment',
      2: 'villa',
      3: 'townhouse',
      4: 'plot',
      5: 'commercial',
      6: 'office',
      7: 'garage',
      8: 'hotel',
      9: 'industrial'
    };
    
    return types[propertyType] || 'property';
  }

  /**
   * Generate comprehensive area report
   */
  async generateAreaReport(propertyData) {
    try {
      const [neighborhood, investment, pricing] = await Promise.allSettled([
        this.conductNeighborhoodResearch(propertyData),
        this.generateInvestmentInsights(propertyData),
        this.researchPriceTrends(propertyData)
      ]);

      return {
        neighborhood: neighborhood.status === 'fulfilled' ? neighborhood.value : null,
        investment: investment.status === 'fulfilled' ? investment.value : null,
        pricing: pricing.status === 'fulfilled' ? pricing.value : null,
        location: this.formatLocation(propertyData),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error generating area report:', error);
      return {
        neighborhood: null,
        investment: null,
        pricing: null,
        location: this.formatLocation(propertyData),
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = TavilyResearchService; 