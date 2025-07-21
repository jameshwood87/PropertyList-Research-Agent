// Enhanced Feed System Initialization for Node.js Server
const fs = require('fs');
const path = require('path');

// Simple property database loader
class SimplePropertyDatabase {
  constructor() {
    this.properties = new Map();
    this.index = {
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
    this.isLoaded = false;
  }

  loadDatabase() {
    try {
      const propertiesFile = path.join(__dirname, '..', 'data', 'properties.json');
      const indexFile = path.join(__dirname, '..', 'data', 'index.json');

      if (fs.existsSync(propertiesFile)) {
        const data = fs.readFileSync(propertiesFile, 'utf8');
        const propertiesArray = JSON.parse(data);
        
        this.properties.clear();
        let debugCount = 0;
        propertiesArray.forEach(prop => {
          // Generate ID in the same format as the index: {refNumber}-{hash}
          let id = prop.id;
          if (!id) {
            // Generate hash from key property data
            const keyData = {
              refNumber: prop.refNumber || '',
              address: prop.address,
              city: prop.city,
              province: prop.province,
              propertyType: prop.propertyType,
              bedrooms: prop.bedrooms,
              bathrooms: prop.bathrooms,
              buildArea: prop.buildArea || 0,
              price: prop.price || 0
            };
            const dataString = JSON.stringify(keyData);
            const hash = Buffer.from(dataString).toString('base64').replace(/[/+=]/g, '').substring(0, 12);
            id = prop.refNumber ? `${prop.refNumber}-${hash}` : hash;
          }
          this.properties.set(id, prop);
          
          // Debug: Show first few IDs to verify format
          if (debugCount < 5) {
            console.log(`🔍 Debug ID ${debugCount + 1}: ${id} for refNumber: ${prop.refNumber}`);
            debugCount++;
          }
        });

        console.log(`📊 Loaded ${this.properties.size} properties from database`);
      }

      if (fs.existsSync(indexFile)) {
        const indexData = fs.readFileSync(indexFile, 'utf8');
        this.index = { ...this.index, ...JSON.parse(indexData) };
        console.log('📋 Loaded enhanced indexes');
      }

      this.isLoaded = true;
      return true;
    } catch (error) {
      console.error('❌ Error loading database:', error.message);
      return false;
    }
  }

  findComparableProperties(criteria) {
    if (!this.isLoaded) {
      this.loadDatabase();
    }

    console.log(`🔍 Enhanced search with criteria:`, {
      propertyType: criteria.propertyType,
      city: criteria.city,
      province: criteria.province,
      bedrooms: criteria.bedrooms,
      bathrooms: criteria.bathrooms,
      maxResults: criteria.maxResults
    });

    let candidateIds = [];

    // COMPREHENSIVE CASE-INSENSITIVE SEARCH
    // 1. City matching (case-insensitive)
    const cityKey = criteria.city.toLowerCase();
    const cityIds = this.index.byCity[cityKey] || [];
    console.log(`🔍 City '${criteria.city}' (key: '${cityKey}') has ${cityIds.length} properties`);
    if (cityIds.length > 0) {
      console.log(`🔍 First 3 city IDs: ${cityIds.slice(0, 3).join(', ')}`);
    }
    
    // 2. Property type matching (case-insensitive with fallbacks)
    const propertyTypeLower = criteria.propertyType.toLowerCase();
    let typeIds = [];
    
    // Try exact match first
    if (this.index.byType[criteria.propertyType]) {
      typeIds = this.index.byType[criteria.propertyType];
      console.log(`🔍 Exact property type match '${criteria.propertyType}' has ${typeIds.length} properties`);
    } else {
      // Find case-insensitive match
      for (const [type, ids] of Object.entries(this.index.byType)) {
        if (type.toLowerCase() === propertyTypeLower) {
          typeIds = ids;
          console.log(`🔍 Case-insensitive property type match '${type}' has ${typeIds.length} properties`);
          break;
        }
      }
    }
    
    // 3. Partial matching fallback for property types
    if (typeIds.length === 0) {
      for (const [type, ids] of Object.entries(this.index.byType)) {
        if (type.toLowerCase().includes(propertyTypeLower) || propertyTypeLower.includes(type.toLowerCase())) {
          typeIds = ids;
          console.log(`🔍 Using partial property type match: ${type} for ${criteria.propertyType}`);
          break;
        }
      }
    }
    
    // 4. Intersect city and property type
    candidateIds = cityIds.filter(id => typeIds.includes(id));
    console.log(`🔍 After city + type intersection: ${candidateIds.length} candidates`);
    if (candidateIds.length > 0) {
      console.log(`🔍 First 3 candidate IDs: ${candidateIds.slice(0, 3).join(', ')}`);
    }



    if (candidateIds.length === 0) {
      return [];
    }

    // Filter candidates by criteria
    const candidates = [];
    let filteredByProvince = 0;
    let filteredByBedrooms = 0;
    let filteredByBathrooms = 0;
    let filteredByPrice = 0;
    let filteredByArea = 0;
    let filteredByExcludeId = 0;

    console.log(`🔍 Starting detailed filtering of ${candidateIds.length} candidates...`);

    for (const id of candidateIds) {
      const property = this.properties.get(id);
      if (!property) {
        console.log(`🔍 Property not found in Map for ID: ${id}`);
        continue;
      }

      // Exclude current property from comparable search (prevents self-comparison)
      if (criteria.excludeId && property.id === criteria.excludeId) {
        filteredByExcludeId++;
        continue;
      }

      // Apply basic filters with province code mapping
      if (criteria.province) {
        const propertyProvince = property.province;
        const criteriaProvince = criteria.province;
        
        // Map province codes to full names
        const provinceMap = {
          'MA': 'Málaga',
          'CA': 'Cádiz',
          'GR': 'Granada',
          'A': 'Alicante',
          'T': 'Tarragona',
          'PM': 'Palma',
          'GI': 'Girona',
          'CO': 'Córdoba',
          'AL': 'Almería',
          'M': 'Madrid',
          'SE': 'Sevilla',
          'B': 'Barcelona',
          'J': 'Jaén',
          'CS': 'Castellón'
        };
        
        const mappedPropertyProvince = provinceMap[propertyProvince] || propertyProvince;
        const mappedCriteriaProvince = provinceMap[criteriaProvince] || criteriaProvince;
        
        if (mappedPropertyProvince !== mappedCriteriaProvince) {
          filteredByProvince++;
          continue;
        }
      }

      if (criteria.bedrooms) {
        const bedroomRange = [Math.max(1, criteria.bedrooms - 1), criteria.bedrooms + 1];
        if (property.bedrooms < bedroomRange[0] || property.bedrooms > bedroomRange[1]) {
          filteredByBedrooms++;
          continue;
        }
      }

      if (criteria.bathrooms) {
        const bathroomRange = [Math.max(1, criteria.bathrooms - 1), criteria.bathrooms + 1];
        if (property.bathrooms < bathroomRange[0] || property.bathrooms > bathroomRange[1]) {
          filteredByBathrooms++;
          continue;
        }
      }

      if (criteria.minPrice && property.price < criteria.minPrice) {
        filteredByPrice++;
        continue;
      }
      if (criteria.maxPrice && property.price > criteria.maxPrice) {
        filteredByPrice++;
        continue;
      }

      // Get the appropriate area for comparison (use build_area, plot_area, or terrace_area_m2)
      const getPropertyArea = (prop) => {
        // For villas, use build_area as primary but consider plot_area for analysis
        if (prop.property_type?.toLowerCase() === 'villa') {
          // For villas, prefer build_area but fallback to plot_area if build_area is very small
          if (prop.build_area && prop.build_area > 0) {
            // If build area is very small relative to plot area, consider using plot area
            if (prop.plot_area && prop.plot_area > 0 && prop.build_area < prop.plot_area * 0.3) {
              return prop.plot_area; // Use plot area for very small builds on large plots
            }
            return prop.build_area;
          }
          // For villas without build area, use plot area
          if (prop.plot_area && prop.plot_area > 0) {
            return prop.plot_area;
          }
        } else {
          // For non-villas, prefer build_area first
          if (prop.build_area && prop.build_area > 0) {
            return prop.build_area;
          }
          // Fallback to plot_area if build_area not available
          if (prop.plot_area && prop.plot_area > 0) {
            return prop.plot_area;
          }
        }
        // Last fallback to terrace area
        return prop.terrace_area_m2 || 0;
      };
      
      const propertyArea = getPropertyArea(property);
      
      // Dynamic area filtering with intelligent tolerance based on property type and size
      const getDynamicAreaTolerance = (propertyType, buildArea) => {
        // For villas with very small build areas (< 100m²), use very relaxed tolerance
        if (propertyType?.toLowerCase() === 'villa' && buildArea < 100) {
          return 1.0 // 100% tolerance for small villas
        }
        // For villas with small build areas (100-150m²), use relaxed tolerance
        if (propertyType?.toLowerCase() === 'villa' && buildArea < 150) {
          return 0.75 // 75% tolerance for medium villas
        }
        // For apartments and other properties, use standard tolerance
        return 0.3 // 30% tolerance for standard properties
      }
      
      const areaTolerance = getDynamicAreaTolerance(property.property_type, property.build_area || 0)
      
      if (criteria.minAreaM2) {
        const minArea = criteria.minAreaM2 * areaTolerance;
        if (propertyArea < minArea) {
          filteredByArea++;
          continue;
        }
      }
      if (criteria.maxAreaM2) {
        const maxArea = criteria.maxAreaM2 * (2 - areaTolerance); // Inverse for max area
        if (propertyArea > maxArea) {
          filteredByArea++;
          continue;
        }
      }

      // Calculate basic score
      let score = 1.0;
      if (criteria.bedrooms && property.bedrooms === criteria.bedrooms) score += 0.4;
      if (criteria.bathrooms && property.bathrooms === criteria.bathrooms) score += 0.3;

      candidates.push({ ...property, score });
    }

    console.log(`🔍 Filtering summary:`);
    console.log(`  - Filtered by province: ${filteredByProvince}`);
    console.log(`  - Filtered by bedrooms: ${filteredByBedrooms}`);
    console.log(`  - Filtered by bathrooms: ${filteredByBathrooms}`);
    console.log(`  - Filtered by price: ${filteredByPrice}`);
    console.log(`  - Filtered by area: ${filteredByArea}`);
    console.log(`  - Filtered by exclude ID: ${filteredByExcludeId}`);
    console.log(`  - Final candidates: ${candidates.length}`);



    // Sort by score and limit results
    candidates.sort((a, b) => b.score - a.score);
    const maxResults = criteria.maxResults || 20;
    
    return candidates.slice(0, maxResults).map(candidate => {
      // Get the appropriate area for display (use build_area, plot_area, or terrace_area_m2)
      const getDisplayArea = (prop) => {
        // For villas, use build_area as primary but consider plot_area for analysis
        if (prop.property_type?.toLowerCase() === 'villa') {
          // For villas, prefer build_area but fallback to plot_area if build_area is very small
          if (prop.build_area && prop.build_area > 0) {
            // If build area is very small relative to plot area, consider using plot area
            if (prop.plot_area && prop.plot_area > 0 && prop.build_area < prop.plot_area * 0.3) {
              return prop.plot_area; // Use plot area for very small builds on large plots
            }
            return prop.build_area;
          }
          // For villas without build area, use plot area
          if (prop.plot_area && prop.plot_area > 0) {
            return prop.plot_area;
          }
        } else {
          // For non-villas, prefer build_area first
          if (prop.build_area && prop.build_area > 0) {
            return prop.build_area;
          }
          // Fallback to plot_area if build_area not available
          if (prop.plot_area && prop.plot_area > 0) {
            return prop.plot_area;
          }
        }
        // Last fallback to terrace area
        return prop.terrace_area_m2 || 0;
      };
      
      const displayArea = getDisplayArea(candidate);
      
      return {
        address: candidate.address,
        price: candidate.price,
        m2: Math.round(displayArea),
        bedrooms: candidate.bedrooms,
        bathrooms: candidate.bathrooms,
        saleDate: candidate.date_listed,
        distance: 0,
        pricePerM2: Math.round(candidate.price / displayArea),
        propertyType: candidate.property_type,
        daysOnMarket: this.calculateDaysOnMarket(candidate.date_listed),
        adjustedPrice: candidate.price,
        build_area: candidate.build_area,
        plot_area: candidate.plot_area,
        terrace_area_m2: candidate.terrace_area_m2,
        features: candidate.features || []
      };
    });
  }

  calculateDaysOnMarket(dateListedStr) {
    const listedDate = new Date(dateListedStr);
    const now = new Date();
    return Math.floor((now - listedDate) / (1000 * 60 * 60 * 24));
  }

  getTotalProperties() {
    return this.properties.size;
  }

  getStats() {
    const stats = {
      totalProperties: this.properties.size,
      byCities: {},
      byPropertyType: {},
      lastUpdated: this.index.lastUpdated
    };

    for (const property of Array.from(this.properties.values())) {
      stats.byCities[property.city] = (stats.byCities[property.city] || 0) + 1;
      stats.byPropertyType[property.property_type] = (stats.byPropertyType[property.property_type] || 0) + 1;
    }

    return stats;
  }
}

async function initializeFeedSystem() {
  try {
    console.log('🔄 Initializing Enhanced Property Feed System...');
    
    // Create simple database instance
    const db = new SimplePropertyDatabase();
    const loaded = db.loadDatabase();
    
    if (loaded) {
      console.log('📊 Feed system available: true');
      console.log('📋 Database loaded: true');
      console.log('📊 Total properties in database:', db.getTotalProperties());
      
      // Get stats
      const stats = db.getStats();
      console.log('📈 Database stats:', {
        totalProperties: stats.totalProperties,
        cities: Object.keys(stats.byCities).length,
        propertyTypes: Object.keys(stats.byPropertyType).length
      });
      
      // Skip test search to avoid hanging during initialization
      console.log('📊 Database loaded successfully - test search skipped for faster startup');
      
      // Store database instance globally for use in the server
      global.propertyDatabase = db;
      
      console.log('✅ Enhanced Property Feed System initialized successfully');
      return true;
    } else {
      console.log('❌ Feed system not available');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize Enhanced Property Feed System:', error.message);
    console.log('⚠️ Property analysis will continue without comparable properties');
    return false;
  }
}

// Lazy loading function - loads database only when needed
async function ensureDatabaseLoaded() {
  if (global.propertyDatabase) {
    return global.propertyDatabase;
  }
  
  console.log('🔄 Loading property database on first use...');
  const success = await initializeFeedSystem();
  
  if (success) {
    return global.propertyDatabase;
  } else {
    console.log('⚠️ Failed to load database - comparable properties will not be available');
    return null;
  }
}

module.exports = { initializeFeedSystem, ensureDatabaseLoaded }; 