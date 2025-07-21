// Daily XML Feed Processor
// Downloads XML at 2:30 AM, processes at 3:30 AM, maintains fresh database

const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');
const axios = require('axios');
const cron = require('node-cron');

// Import AI enhancement system
const { AIPropertyEnhancer } = require('../src/lib/ai-property-enhancer');

class DailyXMLProcessor {
  constructor() {
    this.dataDir = './data';
    this.xmlFeedUrl = process.env.XML_FEED_URL || 'https://your-feed-url.com/properties.xml';
    this.lastProcessedDate = null;
    this.isProcessing = false;
  }

  // Main processing function
  async processDailyXML() {
    if (this.isProcessing) {
      console.log('⚠️ XML processing already in progress, skipping...');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      console.log('🔄 Starting daily XML processing...');
      console.log(`📅 ${new Date().toISOString()}`);

      // Step 1: Download fresh XML feed
      await this.downloadXMLFeed();

      // Step 2: Parse and analyze properties
      const properties = await this.parseAndAnalyzeProperties();

      // Step 3: Update database with fresh data
      await this.updateDatabase(properties);

      // Step 4: Clean up old properties
      await this.cleanupOldProperties();

      // Step 5: Generate market insights
      await this.generateMarketInsights();

      const duration = Date.now() - startTime;
      console.log(`✅ Daily XML processing completed in ${duration}ms`);
      console.log(`📊 Processed ${properties.length} properties`);

    } catch (error) {
      console.error('❌ Daily XML processing failed:', error.message);
    } finally {
      this.isProcessing = false;
    }
  }

  // Download fresh XML feed
  async downloadXMLFeed() {
    try {
      console.log('📥 Downloading fresh XML feed...');
      
      const response = await axios.get(this.xmlFeedUrl, {
        timeout: 300000, // 5 minutes
        headers: {
          'User-Agent': 'PropertyList-Research-Agent/1.0'
        }
      });

      const xmlPath = path.join(this.dataDir, 'feed-cache.xml');
      fs.writeFileSync(xmlPath, response.data, 'utf8');

      // Create timestamped backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.dataDir, 'backups', `feed-cache-${timestamp}.xml`);
      fs.writeFileSync(backupPath, response.data, 'utf8');

      console.log('✅ XML feed downloaded and backed up');
      
    } catch (error) {
      console.error('❌ Failed to download XML feed:', error.message);
      throw error;
    }
  }

  // Parse XML and analyze properties with AI
  async parseAndAnalyzeProperties() {
    try {
      console.log('🔍 Parsing XML and analyzing properties...');
      
      const xmlPath = path.join(this.dataDir, 'feed-cache.xml');
      const xmlData = fs.readFileSync(xmlPath, 'utf8');
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
      
      const propertyNodes = xmlDoc.getElementsByTagName('property');
      const properties = [];

      console.log(`📊 Found ${propertyNodes.length} properties in XML feed`);

      // Process properties in batches for AI enhancement
      const batchSize = 10;
      for (let i = 0; i < propertyNodes.length; i += batchSize) {
        const batch = Array.from(propertyNodes).slice(i, i + batchSize);
        
        console.log(`🤖 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(propertyNodes.length/batchSize)}`);
        
        const batchProperties = await this.processPropertyBatch(batch);
        properties.push(...batchProperties);
      }

      return properties;
      
    } catch (error) {
      console.error('❌ Failed to parse and analyze properties:', error.message);
      throw error;
    }
  }

  // Process a batch of properties with AI enhancement
  async processPropertyBatch(propertyNodes) {
    const properties = [];

    for (const node of propertyNodes) {
      try {
        const property = this.parsePropertyNode(node);
        
        if (property) {
          // Enhance property with AI analysis
          const enhancedProperty = await this.enhancePropertyWithAI(property);
          properties.push(enhancedProperty);
        }
      } catch (error) {
        console.error('❌ Error processing property node:', error.message);
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
        architecturalStyle: getText('architectural_style'),
        // Processing metadata
        processedAt: new Date().toISOString(),
        dataSource: 'xml_feed',
        version: '1.0'
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
    const imageNodes = node.getElementsByTagName('image');
    
    for (let i = 0; i < imageNodes.length; i++) {
      const image = imageNodes[i].textContent.trim();
      if (image) {
        images.push(image);
      }
    }
    
    return images;
  }

  // Enhance property with AI analysis
  async enhancePropertyWithAI(property) {
    try {
      // Check if property needs AI enhancement
      if (AIPropertyEnhancer.needsEnhancement(property)) {
        console.log(`🤖 Enhancing property ${property.refNumber || property.id} with AI...`);
        
        const enhancedProperty = await AIPropertyEnhancer.enhanceProperty(property);
        
        // Add enhancement metadata
        enhancedProperty.aiEnhanced = true;
        enhancedProperty.enhancedAt = new Date().toISOString();
        
        return enhancedProperty;
      } else {
        // Property already enhanced or doesn't need enhancement
        property.aiEnhanced = false;
        return property;
      }
    } catch (error) {
      console.error(`❌ AI enhancement failed for property ${property.refNumber || property.id}:`, error.message);
      // Return original property if AI enhancement fails
      property.aiEnhanced = false;
      property.aiEnhancementError = error.message;
      return property;
    }
  }

  // Update database with fresh properties
  async updateDatabase(properties) {
    try {
      console.log('💾 Updating database with fresh properties...');
      
      const databasePath = path.join(this.dataDir, 'properties.json');
      const indexPath = path.join(this.dataDir, 'index.json');
      
      // Load existing database
      let existingProperties = [];
      if (fs.existsSync(databasePath)) {
        const data = fs.readFileSync(databasePath, 'utf8');
        existingProperties = JSON.parse(data);
        console.log(`📊 Loaded ${existingProperties.length} existing properties`);
      }

      // Create property map for fast lookup
      const existingMap = new Map();
      existingProperties.forEach(prop => existingMap.set(prop.id, prop));

      // Update properties
      let added = 0;
      let updated = 0;
      let unchanged = 0;

      for (const newProperty of properties) {
        const existing = existingMap.get(newProperty.id);
        
        if (!existing) {
          // New property
          existingProperties.push(newProperty);
          added++;
        } else {
          // Update existing property
          const index = existingProperties.findIndex(p => p.id === newProperty.id);
          existingProperties[index] = { ...existing, ...newProperty, lastUpdated: new Date().toISOString() };
          updated++;
        }
      }

      // Save updated database
      fs.writeFileSync(databasePath, JSON.stringify(existingProperties, null, 2), 'utf8');

      // Rebuild search index
      await this.rebuildSearchIndex(existingProperties);

      console.log(`✅ Database updated: ${added} added, ${updated} updated, ${unchanged} unchanged`);
      
    } catch (error) {
      console.error('❌ Failed to update database:', error.message);
      throw error;
    }
  }

  // Rebuild search index for fast queries
  async rebuildSearchIndex(properties) {
    try {
      console.log('🔍 Rebuilding search index...');
      
      const index = {
        byCity: {},
        byType: {},
        byLocation: {},
        byPriceRange: {},
        byNeighbourhood: {},
        byUrbanisation: {},
        byZone: {},
        byCondition: {},
        byArchitecturalStyle: {},
        bySizeCategory: {},
        byAgeCategory: {},
        byViewType: {},
        byDevelopmentName: {},
        byFeature: {},
        lastUpdated: new Date().toISOString()
      };

      // Build indexes
      properties.forEach(property => {
        // City index
        const cityKey = property.city?.toLowerCase() || 'unknown';
        if (!index.byCity[cityKey]) index.byCity[cityKey] = [];
        index.byCity[cityKey].push(property.id);

        // Property type index
        const typeKey = property.propertyType?.toLowerCase() || 'unknown';
        if (!index.byType[typeKey]) index.byType[typeKey] = [];
        index.byType[typeKey].push(property.id);

        // Price range index
        if (property.price) {
          const priceRange = Math.floor(property.price / 100000) * 100000; // 100k ranges
          const rangeKey = `${priceRange}-${priceRange + 99999}`;
          if (!index.byPriceRange[rangeKey]) index.byPriceRange[rangeKey] = [];
          index.byPriceRange[rangeKey].push(property.id);
        }

        // Neighbourhood index
        if (property.neighbourhood) {
          const hoodKey = property.neighbourhood.toLowerCase();
          if (!index.byNeighbourhood[hoodKey]) index.byNeighbourhood[hoodKey] = [];
          index.byNeighbourhood[hoodKey].push(property.id);
        }

        // Urbanisation index
        if (property.urbanization) {
          const urbKey = property.urbanization.toLowerCase();
          if (!index.byUrbanisation[urbKey]) index.byUrbanisation[urbKey] = [];
          index.byUrbanisation[urbKey].push(property.id);
        }

        // Feature index
        if (property.features && property.features.length > 0) {
          property.features.forEach(feature => {
            const featureKey = feature.toLowerCase();
            if (!index.byFeature[featureKey]) index.byFeature[featureKey] = [];
            index.byFeature[featureKey].push(property.id);
          });
        }
      });

      // Save index
      const indexPath = path.join(this.dataDir, 'index.json');
      fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');

      console.log('✅ Search index rebuilt');
      
    } catch (error) {
      console.error('❌ Failed to rebuild search index:', error.message);
      throw error;
    }
  }

  // Clean up old properties (older than 30 days)
  async cleanupOldProperties() {
    try {
      console.log('🧹 Cleaning up old properties...');
      
      const databasePath = path.join(this.dataDir, 'properties.json');
      const properties = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
      
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const originalCount = properties.length;
      
      const filteredProperties = properties.filter(property => {
        const lastUpdated = new Date(property.lastUpdated || property.processedAt);
        return lastUpdated > cutoffDate;
      });

      if (filteredProperties.length < originalCount) {
        fs.writeFileSync(databasePath, JSON.stringify(filteredProperties, null, 2), 'utf8');
        console.log(`✅ Cleaned up ${originalCount - filteredProperties.length} old properties`);
      } else {
        console.log('✅ No old properties to clean up');
      }
      
    } catch (error) {
      console.error('❌ Failed to cleanup old properties:', error.message);
    }
  }

  // Generate market insights
  async generateMarketInsights() {
    try {
      console.log('📈 Generating market insights...');
      
      const databasePath = path.join(this.dataDir, 'properties.json');
      const properties = JSON.parse(fs.readFileSync(databasePath, 'utf8'));

      // Calculate market statistics by city and property type
      const marketData = {};
      
      properties.forEach(property => {
        const city = property.city || 'Unknown';
        const type = property.propertyType || 'Unknown';
        const key = `${city}_${type}`;
        
        if (!marketData[key]) {
          marketData[key] = {
            city,
            propertyType: type,
            count: 0,
            totalPrice: 0,
            prices: [],
            averagePrice: 0,
            averagePricePerM2: 0,
            priceRange: { min: Infinity, max: 0 }
          };
        }
        
        if (property.price > 0) {
          marketData[key].count++;
          marketData[key].totalPrice += property.price;
          marketData[key].prices.push(property.price);
          
          if (property.price < marketData[key].priceRange.min) {
            marketData[key].priceRange.min = property.price;
          }
          if (property.price > marketData[key].priceRange.max) {
            marketData[key].priceRange.max = property.price;
          }
        }
      });

      // Calculate averages
      Object.values(marketData).forEach(market => {
        if (market.count > 0) {
          market.averagePrice = market.totalPrice / market.count;
        }
      });

      // Save market insights
      const insightsPath = path.join(this.dataDir, 'market-insights.json');
      fs.writeFileSync(insightsPath, JSON.stringify(marketData, null, 2), 'utf8');

      console.log(`✅ Generated market insights for ${Object.keys(marketData).length} markets`);
      
    } catch (error) {
      console.error('❌ Failed to generate market insights:', error.message);
    }
  }

  // Start scheduled processing
  startScheduledProcessing() {
    console.log('⏰ Starting scheduled XML processing...');
    
    // Download XML at 2:30 AM
    cron.schedule('30 2 * * *', async () => {
      console.log('📥 Scheduled XML download starting...');
      try {
        await this.downloadXMLFeed();
        console.log('✅ Scheduled XML download completed');
      } catch (error) {
        console.error('❌ Scheduled XML download failed:', error.message);
      }
    });

    // Process XML at 3:30 AM
    cron.schedule('30 3 * * *', async () => {
      console.log('🔄 Scheduled XML processing starting...');
      try {
        await this.processDailyXML();
        console.log('✅ Scheduled XML processing completed');
      } catch (error) {
        console.error('❌ Scheduled XML processing failed:', error.message);
      }
    });

    console.log('✅ Scheduled processing started');
    console.log('📅 XML download: 2:30 AM daily');
    console.log('📅 XML processing: 3:30 AM daily');
  }
}

// Create and export processor instance
const dailyProcessor = new DailyXMLProcessor();

// Export for use in other modules
module.exports = {
  DailyXMLProcessor,
  dailyProcessor,
  processDailyXML: () => dailyProcessor.processDailyXML(),
  startScheduledProcessing: () => dailyProcessor.startScheduledProcessing()
};

// If run directly, start scheduled processing
if (require.main === module) {
  dailyProcessor.startScheduledProcessing();
  
  // Also run initial processing if needed
  if (process.argv.includes('--process-now')) {
    dailyProcessor.processDailyXML();
  }
} 