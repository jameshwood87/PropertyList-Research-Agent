const { XMLParser } = require('fast-xml-parser');
const axios = require('axios');
const cron = require('node-cron');
const geohash = require('ngeohash');
const { FeatureMappingService } = require('./featureMapping');

class XMLFeedService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      parseTagValue: true,
      trimValues: true,
      parseTrueNumberOnly: false,
      arrayMode: false,
      alwaysCreateTextNode: false,
      isArray: (name, jpath, isLeafNode, isAttribute) => {
        // Ensure these are always arrays
        return ['property', 'photo', 'feature'].includes(name);
      }
    });
    
    this.feedUrl = process.env.XML_FEED_URL || 'https://propertylist.es/files/property_list_v1.xml';
    this.isProcessing = false;
  }

  /**
   * Start the daily cron job for XML feed updates
   */
  startCronJob() {
    console.log('Starting XML feed cron job at 2:30 AM daily');
    
    cron.schedule('30 2 * * *', async () => {
      console.log('Daily XML feed update triggered');
      try {
        await this.updateFeed();
        console.log('Daily XML feed update completed successfully');
      } catch (error) {
        console.error('Daily XML feed update failed:', error.message);
      }
    }, {
      timezone: 'Europe/Madrid'
    });
  }

  /**
   * Update XML feed manually or via cron
   */
  async updateFeed() {
    if (this.isProcessing) {
      console.log('XML feed update already in progress, skipping...');
      return;
    }

    this.isProcessing = true;
    
    try {
      console.log('Starting XML feed update from PropertyList.es...');
      
      // 1. Download XML feed
      const xmlData = await this.downloadXMLFeed();
      
      // 2. Parse XML data
      const properties = await this.parseXMLData(xmlData);
      
      // 3. Process and normalize properties
      const normalizedProperties = await this.normalizeProperties(properties);
      
      // 4. Batch update database
      await this.propertyDb.batchUpsertProperties(normalizedProperties);
      
      // 5. Get updated statistics
      const stats = this.propertyDb.getFeedStats();
      
      console.log('XML feed update completed:', {
        totalProcessed: normalizedProperties.length,
        databaseStats: stats
      });
      
      return {
        success: true,
        processedCount: normalizedProperties.length,
        stats
      };
      
    } catch (error) {
      console.error('XML feed update failed:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Download XML feed from PropertyList.es
   */
  async downloadXMLFeed() {
    try {
      console.log('Downloading XML feed from:', this.feedUrl);
      
      const response = await axios.get(this.feedUrl, {
        timeout: 120000, // 2 minutes timeout for large feeds
        headers: {
          'User-Agent': 'PropertyList-Research-Agent/1.0',
          'Accept': 'application/xml, text/xml, */*'
        },
        maxContentLength: 200 * 1024 * 1024, // 200MB max
        maxBodyLength: 200 * 1024 * 1024 // 200MB max
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('XML feed downloaded successfully:', {
        size: response.data.length,
        contentType: response.headers['content-type']
      });

      return response.data;
    } catch (error) {
      console.error('Failed to download XML feed:', {
        url: this.feedUrl,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Parse XML data into property objects
   */
  async parseXMLData(xmlData) {
    try {
      console.log('Parsing PropertyList.es XML data...');
      
      const parsed = this.xmlParser.parse(xmlData);
      
      // Extract properties from PropertyList.es XML structure
      let properties = [];
      
      if (parsed.properties && parsed.properties.property) {
        properties = Array.isArray(parsed.properties.property) 
          ? parsed.properties.property 
          : [parsed.properties.property];
      }

      console.log(`XML parsing completed: ${properties.length} properties found`);
      return properties;
      
    } catch (error) {
      console.error('Failed to parse XML data:', {
        error: error.message,
        xmlPreview: xmlData.substring(0, 500)
      });
      throw error;
    }
  }

  /**
   * Normalize properties from PropertyList.es XML format
   */
  async normalizeProperties(xmlProperties) {
    console.log('Normalizing properties from PropertyList.es format...');
    
    const normalized = [];
    const batchSize = 100;
    
    for (let i = 0; i < xmlProperties.length; i += batchSize) {
      const batch = xmlProperties.slice(i, i + batchSize);
      const batchNormalized = batch
        .map(prop => this.normalizeProperty(prop))
        .filter(prop => prop !== null);
      
      normalized.push(...batchNormalized);
      
      if (i % 500 === 0) {
        console.log(`Normalized ${i + batch.length}/${xmlProperties.length} properties`);
      }
    }

    console.log(`Property normalization completed: ${normalized.length} valid properties`);
    return normalized;
  }

  /**
   * Normalize single property from PropertyList.es XML format
   */
  normalizeProperty(xmlProperty) {
    try {
      const reference = this.extractValue(xmlProperty, ['reference']);
      if (!reference) {
        return null; // Skip properties without reference
      }

      // Extract coordinates and generate geohash
      const latitude = this.extractNumericValue(xmlProperty, ['lat', 'latitude']);
      const longitude = this.extractNumericValue(xmlProperty, ['lng', 'longitude']);
      const geoHash = (latitude && longitude) ? geohash.encode(latitude, longitude, 6) : null;

      // Extract features from PropertyList.es format
      const featureData = this.extractFeatures(xmlProperty);
      
      // Extract images from PropertyList.es format
      const images = this.extractImages(xmlProperty);
      
      // Extract descriptions from PropertyList.es format
      const descriptions = this.extractDescriptions(xmlProperty);

      // Generate unique ID combining reference with other identifiers
      const uniqueId = this.generateUniqueId(xmlProperty, reference);

      // Build normalized property object
      const property = {
        id: uniqueId, // Use unique generated ID
        reference: reference,
        created_at: this.extractValue(xmlProperty, ['@_created_at', 'created_at']),
        last_updated_at: this.extractValue(xmlProperty, ['@_last_updated_at', 'last_updated_at']),
        direct: this.extractBooleanValue(xmlProperty, ['@_direct', 'direct']),
        
        // Listing type
        is_sale: this.extractBooleanValue(xmlProperty, ['is_sale']),
        is_short_term: this.extractBooleanValue(xmlProperty, ['is_short_term']),
        is_long_term: this.extractBooleanValue(xmlProperty, ['is_long_term']),
        
        // Property details
        property_type: this.extractValue(xmlProperty, ['property_type']),
        province: this.extractValue(xmlProperty, ['province']),
        city: this.extractValue(xmlProperty, ['city']),
        suburb: this.extractValue(xmlProperty, ['suburb']),
        urbanization: this.extractValue(xmlProperty, ['urbanization']),
        address: this.buildAddress(xmlProperty),
        
        // Location
        latitude: latitude,
        longitude: longitude,
        geohash: geoHash,
        
        // Size and layout
        plot_size: this.extractNumericValue(xmlProperty, ['plot_size']),
        build_area: this.extractNumericValue(xmlProperty, ['build_area', 'built_area']),
        terrace_area: this.extractNumericValue(xmlProperty, ['terrace_area']),
        total_area: this.extractNumericValue(xmlProperty, ['total_area']),
        bedrooms: this.extractNumericValue(xmlProperty, ['bedrooms']),
        bathrooms: this.extractNumericValue(xmlProperty, ['bathrooms']),
        parking_spaces: this.extractNumericValue(xmlProperty, ['parking_spaces', 'parking']),
        floor_number: this.extractNumericValue(xmlProperty, ['floor', 'floor_number']),
        
        // Property characteristics
        orientation: this.ensureString(this.extractValue(xmlProperty, ['orientation'])),
        condition_rating: this.ensureString(this.extractValue(xmlProperty, ['condition', 'condition_rating'])),
        year_built: this.extractNumericValue(xmlProperty, ['year_built', 'built_year']),
        energy_rating: this.ensureString(this.extractValue(xmlProperty, ['energy_rating', 'energy_certificate'])),
        
        // Pricing
        sale_price: this.extractNumericValue(xmlProperty, ['sale_price', 'price']),
        monthly_price: this.extractNumericValue(xmlProperty, ['monthly_price', 'rent_price']),
        weekly_price_from: this.extractNumericValue(xmlProperty, ['weekly_price_from']),
        weekly_price_to: this.extractNumericValue(xmlProperty, ['weekly_price_to']),
        
        // JSON fields
        features: JSON.stringify(featureData.featureNames || []), // Store human-readable names
        feature_ids: JSON.stringify(featureData.featureIds || []), // Store numeric IDs for indexing
        descriptions: JSON.stringify(descriptions || {}),
        images: JSON.stringify(images || []),
        virtual_tour_url: this.ensureString(this.extractValue(xmlProperty, ['virtual_tour', 'virtual_tour_url'])),
        
        // Metadata
        last_seen: new Date().toISOString(),
        is_active: true,
        raw_data: JSON.stringify(xmlProperty)
      };

      return property;
      
    } catch (error) {
      console.error('Failed to normalize property:', {
        reference: xmlProperty.reference || 'unknown',
        error: error.message
      });
      return null;
    }
  }

  /**
   * Extract value from nested object using multiple possible keys
   */
  extractValue(obj, keys) {
    for (const key of keys) {
      if (obj && typeof obj === 'object' && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        return String(obj[key]).trim();
      }
    }
    return null;
  }

  /**
   * Extract numeric value
   */
  extractNumericValue(obj, keys) {
    const value = this.extractValue(obj, keys);
    if (value === null) return null;
    
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  /**
   * Extract boolean value
   */
  extractBooleanValue(obj, keys) {
    const value = this.extractValue(obj, keys);
    if (value === null) return false;
    
    const lowerValue = value.toLowerCase();
    return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes';
  }

  /**
   * Ensure value is a string, handle null/undefined safely
   */
  ensureString(value) {
    if (value === null || value === undefined) return null;
    return String(value).trim() || null;
  }

  /**
   * Extract features from PropertyList.es format
   */
  extractFeatures(xmlProperty) {
    const features = [];
    const featureIds = [];
    
    // Check for features array with numeric IDs
    if (xmlProperty.features && xmlProperty.features.feature) {
      const featureList = Array.isArray(xmlProperty.features.feature) 
        ? xmlProperty.features.feature 
        : [xmlProperty.features.feature];
      
      // Convert to numbers and filter valid IDs
      const numericFeatures = featureList
        .map(f => parseInt(String(f).trim()))
        .filter(id => !isNaN(id) && id > 0);
      
      featureIds.push(...numericFeatures);
      
      // Convert numeric IDs to human-readable names using FeatureMappingService
      const mappedFeatures = FeatureMappingService.getFeatures(numericFeatures);
      features.push(...mappedFeatures.map(f => f.name));
      
      // Also keep string features that aren't numeric (legacy support)
      const stringFeatures = featureList
        .map(f => String(f).trim())
        .filter(f => f && isNaN(parseInt(f)));
      features.push(...stringFeatures);
    }
    
    // Add other boolean features (legacy XML structure)
    const booleanFeatures = [
      { key: 'pool', feature: 'Swimming Pool' },
      { key: 'garden', feature: 'Garden' },
      { key: 'terrace', feature: 'Terrace' },
      { key: 'balcony', feature: 'Balcony' },
      { key: 'garage', feature: 'Garage' },
      { key: 'air_conditioning', feature: 'Air Conditioning' },
      { key: 'heating', feature: 'Heating' },
      { key: 'fireplace', feature: 'Fireplace' },
      { key: 'alarm', feature: 'Security Alarm' },
      { key: 'furnished', feature: 'Furnished' }
    ];
    
    for (const { key, feature } of booleanFeatures) {
      if (this.extractBooleanValue(xmlProperty, [key])) {
        features.push(feature);
      }
    }
    
    return {
      featureIds: [...new Set(featureIds)], // Numeric IDs for indexing
      featureNames: [...new Set(features)] // Human-readable names
    };
  }

  /**
   * Extract images from PropertyList.es format
   */
  extractImages(xmlProperty) {
    const images = [];
    
    if (xmlProperty.photos && xmlProperty.photos.photo) {
      const photoList = Array.isArray(xmlProperty.photos.photo) 
        ? xmlProperty.photos.photo 
        : [xmlProperty.photos.photo];
      
      for (const photo of photoList) {
        let imageUrl = null;
        
        if (typeof photo === 'string') {
          imageUrl = photo;
        } else if (photo && typeof photo === 'object') {
          imageUrl = photo['#text'] || photo.url || photo.src;
        }
        
        if (imageUrl && typeof imageUrl === 'string') {
          images.push(imageUrl.trim());
        }
      }
    }
    
    return images;
  }

  /**
   * Extract descriptions from PropertyList.es format
   */
  extractDescriptions(xmlProperty) {
    const descriptions = {};
    
    if (xmlProperty.descriptions && xmlProperty.descriptions.description) {
      const descList = Array.isArray(xmlProperty.descriptions.description) 
        ? xmlProperty.descriptions.description 
        : [xmlProperty.descriptions.description];
      
      for (const desc of descList) {
        if (desc && typeof desc === 'object') {
          const language = desc['@_language'] || 'en';
          const text = desc.text || desc['#text'] || '';
          
          if (text && typeof text === 'string') {
            descriptions[language] = text.trim();
          }
        }
      }
    }
    
    return descriptions;
  }

  /**
   * Build address from available components
   */
  buildAddress(xmlProperty) {
    const components = [];
    
    const street = this.extractValue(xmlProperty, ['street', 'address_line_1']);
    const number = this.extractValue(xmlProperty, ['number', 'street_number']);
    const urbanization = this.extractValue(xmlProperty, ['urbanization']);
    const suburb = this.extractValue(xmlProperty, ['suburb']);
    const city = this.extractValue(xmlProperty, ['city']);
    
    if (street) {
      components.push(number ? `${street} ${number}` : street);
    }
    if (urbanization && urbanization !== suburb) {
      components.push(urbanization);
    }
    if (suburb && suburb !== city) {
      components.push(suburb);
    }
    if (city) {
      components.push(city);
    }
    
    return components.join(', ') || null;
  }

  /**
   * Get current feed processing status
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      feedUrl: this.feedUrl,
      lastUpdate: null // Will be populated from database
    };
  }

  /**
   * Force immediate feed update (for testing/manual trigger)
   */
  async forceUpdate() {
    return await this.updateFeed();
  }

  /**
   * Generate unique ID for property
   * Multiple properties can have same reference, so we add a robust alphanumeric unique suffix
   */
  generateUniqueId(xmlProperty, reference) {
    // Get created_at timestamp for uniqueness
    const createdAt = this.extractValue(xmlProperty, ['@_created_at', 'created_at']);
    
    if (createdAt) {
      // Convert timestamp to base36 (alphanumeric) for compact unique code
      const timestamp = createdAt.replace(/[^\d]/g, ''); // Remove non-digits
      const numericTimestamp = parseInt(timestamp.substring(-10)) || Date.now(); // Last 10 digits or current time
      const alphanumericCode = numericTimestamp.toString(36).toUpperCase(); // Base36 = 0-9, A-Z
      return `${reference}-${alphanumericCode}`;
    }
    
    // Fallback: use property type and generate random alphanumeric code
    const propertyType = this.extractValue(xmlProperty, ['property_type']) || '1';
    const randomCode = this.generateRandomAlphanumeric(6); // 6 chars = 36^6 = 2+ billion combinations
    
    return `${reference}-${propertyType}${randomCode}`;
  }

  /**
   * Generate random alphanumeric string
   */
  generateRandomAlphanumeric(length) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

module.exports = XMLFeedService; 