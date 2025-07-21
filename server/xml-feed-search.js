// On-Demand XML Feed Search System
// This replaces the pre-loaded database approach for better scalability

const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');

class XMLFeedSearcher {
  constructor() {
    this.xmlCache = null;
    this.lastCacheTime = null;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  }

  // Load XML feed on-demand
  async loadXMLFeed() {
    try {
      const xmlPath = path.join(__dirname, '..', 'data', 'feed-cache.xml');
      
      if (!fs.existsSync(xmlPath)) {
        console.log('⚠️ XML feed cache not found, using empty dataset');
        return [];
      }

      // Check if cache is still valid
      const stats = fs.statSync(xmlPath);
      if (this.lastCacheTime && (Date.now() - this.lastCacheTime) < this.cacheTimeout) {
        console.log('📦 Using cached XML feed data');
        return this.xmlCache;
      }

      console.log('📥 Loading XML feed on-demand...');
      const xmlData = fs.readFileSync(xmlPath, 'utf8');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
      
      // Parse properties from XML
      const properties = this.parseXMLProperties(xmlDoc);
      
      // Cache the results
      this.xmlCache = properties;
      this.lastCacheTime = Date.now();
      
      console.log(`✅ Loaded ${properties.length} properties from XML feed`);
      return properties;
      
    } catch (error) {
      console.error('❌ Error loading XML feed:', error.message);
      return [];
    }
  }

  // Parse properties from XML document
  parseXMLProperties(xmlDoc) {
    const properties = [];
    const propertyNodes = xmlDoc.getElementsByTagName('property');
    
    for (let i = 0; i < propertyNodes.length; i++) {
      const node = propertyNodes[i];
      const property = this.parsePropertyNode(node);
      if (property) {
        properties.push(property);
      }
    }
    
    return properties;
  }

  // Parse individual property node
  parsePropertyNode(node) {
    try {
      const getText = (tagName) => {
        const element = node.getElementsByTagName(tagName)[0];
        return element ? element.textContent.trim() : '';
      };

      const getNumber = (tagName) => {
        const text = getText(tagName);
        return text ? parseFloat(text) : 0;
      };

      const getBoolean = (tagName) => {
        const text = getText(tagName);
        return text === 'true' || text === '1';
      };

      const property = {
        id: getText('id') || getText('ref_number') || `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        refNumber: getText('ref_number'),
        address: getText('address'),
        city: getText('city'),
        province: getText('province'),
        propertyType: getText('property_type'),
        bedrooms: getNumber('bedrooms'),
        bathrooms: getNumber('bathrooms'),
        buildArea: getNumber('build_area'),
        plotArea: getNumber('plot_area'),
        terraceAreaM2: getNumber('terrace_area'),
        price: getNumber('price'),
        isSale: getBoolean('is_sale'),
        isShortTerm: getBoolean('is_short_term'),
        isLongTerm: getBoolean('is_long_term'),
        monthlyPrice: getNumber('monthly_price'),
        weeklyPriceFrom: getNumber('weekly_price_from'),
        weeklyPriceTo: getNumber('weekly_price_to'),
        description: getText('description'),
        features: this.parseFeatures(node),
        images: this.parseImages(node),
        urbanization: getText('urbanization'),
        neighbourhood: getText('neighbourhood'),
        yearBuilt: getNumber('year_built'),
        condition: getText('condition'),
        architecturalStyle: getText('architectural_style')
      };

      return property;
    } catch (error) {
      console.error('❌ Error parsing property node:', error.message);
      return null;
    }
  }

  // Parse features array
  parseFeatures(node) {
    const features = [];
    const featureNodes = node.getElementsByTagName('feature');
    
    for (let i = 0; i < featureNodes.length; i++) {
      const feature = featureNodes[i].textContent.trim();
      if (feature) {
        features.push(feature);
      }
    }
    
    return features;
  }

  // Parse images array
  parseImages(node) {
    const images = [];
    const photoNodes = node.getElementsByTagName('photo');
    
    for (let i = 0; i < photoNodes.length; i++) {
      const photo = photoNodes[i].textContent.trim();
      if (photo) {
        images.push(photo);
      }
    }
    
    return images;
  }

  // Search for comparable properties on-demand
  async findComparableProperties(criteria) {
    try {
      console.log('🔍 Searching XML feed for comparables with criteria:', {
        propertyType: criteria.propertyType,
        city: criteria.city,
        bedrooms: criteria.bedrooms,
        bathrooms: criteria.bathrooms,
        maxResults: criteria.maxResults
      });

      // Load properties from XML feed
      const properties = await this.loadXMLFeed();
      
      if (properties.length === 0) {
        console.log('❌ No properties found in XML feed');
        return { comparables: [], totalFound: 0 };
      }

      // Filter properties based on criteria
      let candidates = properties.filter(prop => {
        // Basic filtering
        const cityMatch = !criteria.city || 
          prop.city.toLowerCase().includes(criteria.city.toLowerCase());
        
        const typeMatch = !criteria.propertyType || 
          prop.propertyType.toLowerCase().includes(criteria.propertyType.toLowerCase());
        
        const bedroomMatch = !criteria.bedrooms || 
          prop.bedrooms >= criteria.bedrooms - 1 && prop.bedrooms <= criteria.bedrooms + 1;
        
        const bathroomMatch = !criteria.bathrooms || 
          prop.bathrooms >= criteria.bathrooms - 1 && prop.bathrooms <= criteria.bathrooms + 1;

        // Exclude the target property if ID is provided
        const notTarget = !criteria.excludeId || prop.id !== criteria.excludeId;

        return cityMatch && typeMatch && bedroomMatch && bathroomMatch && notTarget;
      });

      // Sort by relevance (price similarity, then location)
      if (criteria.price) {
        candidates.sort((a, b) => {
          const aPriceDiff = Math.abs(a.price - criteria.price);
          const bPriceDiff = Math.abs(b.price - criteria.price);
          return aPriceDiff - bPriceDiff;
        });
      }

      // Limit results
      const maxResults = criteria.maxResults || 10;
      const comparables = candidates.slice(0, maxResults);

      console.log(`✅ Found ${comparables.length} comparable properties out of ${candidates.length} candidates`);

      return {
        comparables: comparables.map(prop => ({
          id: prop.id,
          address: prop.address,
          city: prop.city,
          province: prop.province,
          propertyType: prop.propertyType,
          bedrooms: prop.bedrooms,
          bathrooms: prop.bathrooms,
          buildArea: prop.buildArea,
          plotArea: prop.plotArea,
          terraceAreaM2: prop.terraceAreaM2,
          price: prop.price,
          pricePerM2: prop.buildArea ? prop.price / prop.buildArea : 0,
          isSale: prop.isSale,
          isShortTerm: prop.isShortTerm,
          isLongTerm: prop.isLongTerm,
          monthlyPrice: prop.monthlyPrice,
          weeklyPriceFrom: prop.weeklyPriceFrom,
          weeklyPriceTo: prop.weeklyPriceTo,
          description: prop.description,
          features: prop.features,
          images: prop.images,
          image: prop.images && prop.images.length > 0 ? prop.images[0] : null,
          urbanization: prop.urbanization,
          neighbourhood: prop.neighbourhood,
          yearBuilt: prop.yearBuilt,
          condition: prop.condition,
          architecturalStyle: prop.architecturalStyle
        })),
        totalFound: candidates.length
      };

    } catch (error) {
      console.error('❌ Error finding comparable properties:', error.message);
      return { comparables: [], totalFound: 0 };
    }
  }

  // Get market statistics for a specific area
  async getMarketStatistics(city, propertyType) {
    try {
      const properties = await this.loadXMLFeed();
      
      const areaProperties = properties.filter(prop => 
        prop.city.toLowerCase().includes(city.toLowerCase()) &&
        prop.propertyType.toLowerCase().includes(propertyType.toLowerCase()) &&
        prop.price > 0
      );

      if (areaProperties.length === 0) {
        return {
          averagePrice: 0,
          averagePricePerM2: 0,
          totalProperties: 0,
          priceRange: { min: 0, max: 0 }
        };
      }

      const prices = areaProperties.map(p => p.price);
      const pricesPerM2 = areaProperties
        .filter(p => p.buildArea > 0)
        .map(p => p.price / p.buildArea);

      return {
        averagePrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        averagePricePerM2: pricesPerM2.length > 0 ? 
          pricesPerM2.reduce((a, b) => a + b, 0) / pricesPerM2.length : 0,
        totalProperties: areaProperties.length,
        priceRange: {
          min: Math.min(...prices),
          max: Math.max(...prices)
        }
      };

    } catch (error) {
      console.error('❌ Error getting market statistics:', error.message);
      return {
        averagePrice: 0,
        averagePricePerM2: 0,
        totalProperties: 0,
        priceRange: { min: 0, max: 0 }
      };
    }
  }
}

// Create singleton instance
const xmlFeedSearcher = new XMLFeedSearcher();

module.exports = {
  XMLFeedSearcher,
  xmlFeedSearcher,
  findComparableProperties: (criteria) => xmlFeedSearcher.findComparableProperties(criteria),
  getMarketStatistics: (city, propertyType) => xmlFeedSearcher.getMarketStatistics(city, propertyType)
}; 