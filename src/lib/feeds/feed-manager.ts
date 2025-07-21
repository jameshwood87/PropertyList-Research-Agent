// Feed Manager - Orchestrates XML feed fetching, parsing, and database updates
import { PropertyPortalParser } from './property-portal-parser'
import { getCurrentFeedConfig, getActiveFeedProvider, FeedProvider } from './feed-config'
import { AIPropertyEnhancer, EnhancedPropertyData } from '../ai-property-enhancer'
import { Comparable } from '@/types'
import * as cron from 'node-cron'
import * as fs from 'fs'
import * as path from 'path'
import { gzip, gunzip } from 'zlib'
import { promisify } from 'util'

// Promisify zlib functions for async/await usage
const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

// Simple property database loader (same as in feed-init.js)
class SimplePropertyDatabase {
  private properties: Map<string, any> = new Map();
  private index: any = {
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
  private isLoaded: boolean = false;

  constructor() {
    // Constructor is now empty since properties are declared above
  }

  loadDatabase() {
    try {
      const propertiesFile = path.join(process.cwd(), 'data', 'properties.json');
      const indexFile = path.join(process.cwd(), 'data', 'index.json');

      if (fs.existsSync(propertiesFile)) {
        const data = fs.readFileSync(propertiesFile, 'utf8');
        const propertiesArray = JSON.parse(data);
        
        this.properties.clear();
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
        });

        console.log(`📊 Loaded ${this.properties.size} properties from database`);
      }

      // Rebuild index from actual property data to ensure accuracy
      this.rebuildIndex();

      this.isLoaded = true;
      return true;
    } catch (error) {
      console.error('❌ Error loading database:', error.message);
      return false;
    }
  }

  rebuildIndex() {
    console.log('🔧 Rebuilding property indexes...');
    
    // Clear existing indexes
    this.index.byCity = {};
    this.index.byType = {};
    this.index.bySale = {};
    this.index.byRental = {};
    this.index.byShortTerm = {};
    this.index.byLongTerm = {};
    this.index.byLocation = {};
    this.index.byPriceRange = {};
    this.index.byNeighbourhood = {};
    this.index.byUrbanisation = {};
    this.index.byZone = {};
    this.index.byCondition = {};
    this.index.byArchitecturalStyle = {};
    this.index.bySizeCategory = {};
    this.index.byAgeCategory = {};
    this.index.byViewType = {};
    this.index.byDevelopmentName = {};
    this.index.byFeature = {};
    
    // Build indexes from actual property data
    this.properties.forEach((property, id) => {
      // Index by city
      if (property.city) {
        const cityKey = property.city.toLowerCase();
        if (!this.index.byCity[cityKey]) {
          this.index.byCity[cityKey] = [];
        }
        this.index.byCity[cityKey].push(id);
      }
      
      // Index by property type
      if (property.propertyType) {
        const typeKey = property.propertyType.toLowerCase();
        if (!this.index.byType[typeKey]) {
          this.index.byType[typeKey] = [];
        }
        this.index.byType[typeKey].push(id);
      }
      
      // Index by province
      if (property.province) {
        const provinceKey = property.province.toLowerCase();
        if (!this.index.byLocation[provinceKey]) {
          this.index.byLocation[provinceKey] = [];
        }
        this.index.byLocation[provinceKey].push(id);
      }
      
      // Index by transaction type (sale vs rental)
      if (property.isSale === true) {
        const saleCityKey = property.city ? property.city.toLowerCase() : '';
        if (!this.index.bySale[saleCityKey]) {
          this.index.bySale[saleCityKey] = [];
        }
        this.index.bySale[saleCityKey].push(id);
      } else if (property.isSale === false) {
        const rentalCityKey = property.city ? property.city.toLowerCase() : '';
        if (!this.index.byRental[rentalCityKey]) {
          this.index.byRental[rentalCityKey] = [];
        }
        this.index.byRental[rentalCityKey].push(id);
        
        // Index by rental type
        if (property.isShortTerm === true) {
          if (!this.index.byShortTerm[rentalCityKey]) {
            this.index.byShortTerm[rentalCityKey] = [];
          }
          this.index.byShortTerm[rentalCityKey].push(id);
        } else if (property.isLongTerm === true) {
          if (!this.index.byLongTerm[rentalCityKey]) {
            this.index.byLongTerm[rentalCityKey] = [];
          }
          this.index.byLongTerm[rentalCityKey].push(id);
        }
      }
      
      // Index by rental type (short-term vs long-term)
      if (property.isShortTerm === true) {
        if (!this.index.byShortTerm[property.city]) {
          this.index.byShortTerm[property.city] = [];
        }
        this.index.byShortTerm[property.city].push(id);
      } else if (property.isLongTerm === true) {
        if (!this.index.byLongTerm[property.city]) {
          this.index.byLongTerm[property.city] = [];
        }
        this.index.byLongTerm[property.city].push(id);
      }
    });
    
    console.log(`📋 Rebuilt indexes: ${Object.keys(this.index.byCity).length} cities, ${Object.keys(this.index.byType).length} property types`);
  }

  findComparableProperties(criteria) {
    if (!this.isLoaded) {
      this.loadDatabase();
    }

    let candidateIds = [];

    // Map camelCase propertyType to snake_case property_type for database lookup
    const propertyType = criteria.propertyType?.toLowerCase() || '';

    // Start with city and type intersection
    const cityIds = this.index.byCity[criteria.city?.toLowerCase()] || [];
    const typeIds = this.index.byType[propertyType] || [];
    
    // Filter by transaction type - STRICT MATCHING RULES
    let transactionIds = [];
    const cityKey = criteria.city?.toLowerCase() || '';
    
    if (criteria.isSale === true) {
      // Looking for sale properties - ONLY match with sale properties
      transactionIds = this.index.bySale[cityKey] || [];
      console.log(`🔍 Sale property search: Found ${transactionIds.length} sale properties in ${criteria.city}`);
    } else if (criteria.isSale === false) {
      // Looking for rental properties
      if (criteria.isShortTerm === true) {
        // Short-term rentals - ONLY match with short-term rentals
        transactionIds = this.index.byShortTerm[cityKey] || [];
        console.log(`🔍 Short-term rental search: Found ${transactionIds.length} short-term rentals in ${criteria.city}`);
      } else if (criteria.isLongTerm === true) {
        // Long-term rentals - ONLY match with long-term rentals
        transactionIds = this.index.byLongTerm[cityKey] || [];
        console.log(`🔍 Long-term rental search: Found ${transactionIds.length} long-term rentals in ${criteria.city}`);
      } else {
        // All rentals - match with any rental property
        transactionIds = this.index.byRental[cityKey] || [];
        console.log(`🔍 General rental search: Found ${transactionIds.length} rental properties in ${criteria.city}`);
      }
    } else {
      // No transaction type filter specified - use all properties (fallback)
      transactionIds = cityIds;
      console.log(`🔍 No transaction type filter: Using all ${transactionIds.length} properties in ${criteria.city}`);
    }
    
    // Intersect all three: city, type, and transaction type
    candidateIds = cityIds.filter(id => typeIds.includes(id) && transactionIds.includes(id));
    console.log(`🔍 After transaction type filtering: ${candidateIds.length} candidates (city: ${cityIds.length}, type: ${typeIds.length}, transaction: ${transactionIds.length})`);

    if (candidateIds.length === 0) {
      return { comparables: [], totalFound: 0 };
    }

    // Filter candidates by criteria
    const candidates = [];
    let filteredByProvince = 0;
    let filteredByBedrooms = 0;
    let filteredByBathrooms = 0;
    let filteredByPrice = 0;
    let filteredByArea = 0;
    let filteredByExcludeId = 0;

    for (const id of candidateIds) {
      const property = this.properties.get(id);
      if (!property) continue;

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
        const provinceMap: { [key: string]: string } = {
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
        }
        // Last fallback to terrace area
        return prop.terrace_area_m2 || 0;
      };
      
      const propertyArea = getPropertyArea(property);
      
      // Dynamic area filtering with intelligent tolerance based on property type and size
      const getDynamicAreaTolerance = (propertyType: string, buildArea: number): number => {
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

      // Apply location hierarchy filtering (urbanisation, street, suburb)
      if (criteria.urbanisation) {
        const propertyAddress = (property.address || '').toLowerCase();
        const criteriaUrbanisation = criteria.urbanisation.toLowerCase();
        
        // Check if property address contains the urbanisation
        if (!propertyAddress.includes(criteriaUrbanisation)) {
          continue; // Skip this property as it's not in the same urbanisation
        }
      }
      
      if (criteria.street) {
        const propertyAddress = (property.address || '').toLowerCase();
        const criteriaStreet = criteria.street.toLowerCase();
        
        // For street matching, look for the street name specifically in the address
        // This handles cases like "Calle Benahavis" where we want to find properties on that street
        const streetPatterns = [
          new RegExp(`calle\\s+${criteriaStreet.replace(/\s+/g, '\\s+')}`, 'i'),
          new RegExp(`avenida\\s+${criteriaStreet.replace(/\s+/g, '\\s+')}`, 'i'),
          new RegExp(`plaza\\s+${criteriaStreet.replace(/\s+/g, '\\s+')}`, 'i'),
          new RegExp(`paseo\\s+${criteriaStreet.replace(/\s+/g, '\\s+')}`, 'i'),
          new RegExp(`camino\\s+${criteriaStreet.replace(/\s+/g, '\\s+')}`, 'i'),
          new RegExp(`\\b${criteriaStreet.replace(/\s+/g, '\\s+')}\\b`, 'i') // Word boundary match
        ];
        
        const hasStreetMatch = streetPatterns.some(pattern => pattern.test(propertyAddress));
        if (!hasStreetMatch) {
          continue; // Skip this property as it's not on the same street
        }
      }
      
      if (criteria.suburb) {
        const propertyAddress = (property.address || '').toLowerCase();
        const criteriaSuburb = criteria.suburb.toLowerCase();
        
        // Check if property address contains the suburb
        if (!propertyAddress.includes(criteriaSuburb)) {
          continue; // Skip this property as it's not in the same suburb
        }
      }
      
      // Apply transaction type filtering during detailed filtering
      if (criteria.isSale === true) {
        // For sale properties, exclude properties that are explicitly marked as rentals
        if (property.is_short_term === true || property.is_long_term === true) {
          continue; // Skip this property as it's explicitly a rental
        }
      } else if (criteria.isSale === false) {
        // For rental properties, only include properties that are explicitly marked as rentals
        if (criteria.isShortTerm && property.is_short_term !== true) {
          continue; // Skip this property as it's not a short-term rental
        }
        if (criteria.isLongTerm && property.is_long_term !== true) {
          continue; // Skip this property as it's not a long-term rental
        }
      }

      // Calculate sophisticated similarity score
      let score = 1.0;
      
      // 1. EXACT MATCHES (highest weight)
      if (criteria.bedrooms && property.bedrooms === criteria.bedrooms) score += 2.0;
      if (criteria.bathrooms && property.bathrooms === criteria.bathrooms) score += 1.5;
      
      // 2. PROPERTY CONDITION MATCHING (critical for accurate comparison)
      const conditionScore = this.calculateConditionSimilarity(criteria.condition, property.condition);
      score += conditionScore;
      
      // 3. AREA SIMILARITY (weighted by property type)
      const areaScore = this.calculateAreaSimilarity(criteria, property);
      score += areaScore;
      
      // 4. PRICE SIMILARITY (within reasonable range)
      const priceScore = this.calculatePriceSimilarity(criteria, property);
      score += priceScore;
      
      // 5. FEATURE SIMILARITY (shared amenities)
      const featureScore = this.calculateFeatureSimilarity(criteria.features, property.features);
      score += featureScore;
      
      // 6. LOCATION SIMILARITY (same area/neighborhood)
      const locationScore = this.calculateLocationSimilarity(criteria, property);
      score += locationScore;
      
      // 7. PROPERTY TYPE EXACT MATCH
      if (criteria.propertyType && property.property_type?.toLowerCase() === criteria.propertyType.toLowerCase()) {
        score += 1.0;
      }
      
      // 8. RECENCY BONUS (newer properties get slight bonus for market relevance)
      const recencyScore = this.calculateRecencyScore(property.date_listed);
      score += recencyScore;

      candidates.push({ ...property, score });
    }

    // Sort by score - compare with ALL candidates for best results
    candidates.sort((a, b) => b.score - a.score);
    console.log(`🔍 Comparing with ALL ${candidates.length} candidates for best matches`);
    
    // Convert candidates to comparable format
    const comparables = candidates.map(candidate => {
      // Get the appropriate area for display (use build_area, plot_area, or terrace_area_m2)
      const getDisplayArea = (prop) => {
        // For villas, use build_area as primary but consider plot_area for analysis
        if (prop.property_type?.toLowerCase() === 'villa') {
          // For villas, prefer build_area but fallback to plot_area if build_area is very small
          if (prop.build_area && prop.build_area > 0) {
            // If build area is very small relative to plot area, consider using plot area
            if (prop.plot_area && prop.plot_area > 0 && prop.build_area < prop.plot_area * 0.3) {
              return { area: prop.plot_area, type: 'plot' }; // Use plot area for very small builds on large plots
            }
            return { area: prop.build_area, type: 'build' };
          }
          // For villas without build area, use plot area
          if (prop.plot_area && prop.plot_area > 0) {
            return { area: prop.plot_area, type: 'plot' };
          }
        } else {
          // For non-villas, prefer build_area first
          if (prop.build_area && prop.build_area > 0) {
            return { area: prop.build_area, type: 'build' };
          }
        }
        // Last fallback to terrace area
        return { area: prop.terrace_area_m2 || 0, type: 'terrace' };
      };
      
      const displayArea = getDisplayArea(candidate);
      
      // Convert feature codes to human-readable strings
      const mappedFeatures = (candidate.features || []).map(featureCode => {
        const FEATURE_CODE_MAP = {
          'alarm-system': 'Alarm System',
          'all-electric-home': 'All Electric Home',
          'air_conditioning': 'Air Conditioning',
          'bank-repossession': 'Bank Repossession',
          'bar': 'Beachside',
          'barbeque-area': 'BBQ Area',
          'basement': 'Basement',
          'beach-front': 'Beachfront',
          'central-heating': 'Central Heating',
          'close-to-beach': 'Close to Beach',
          'close-to-golf': 'Close to Golf',
          'close-to-marina': 'Close to Marina',
          'close-to-restaurants': 'Close to Restaurants',
          'close-to-schools': 'Close to Schools',
          'close-to-shops': 'Close to Shops',
          'close-to-ski-resort': 'Close to Ski Resort',
          'close-to-town-centre': 'Close to Town Centre',
          'cold-hot-ac-units': 'Hot & Cold AC',
          'commercial-district': 'Commercial District',
          'countryside': 'Countryside',
          'covered-terrace': 'Covered Terrace',
          'disabled-access': 'Disabled Access',
          'distressed-property': 'Distressed Property',
          'double-glazing': 'Double Glazing',
          'drinkable-water': 'Drinkable Water',
          'ducted-central-ac': 'Central AC',
          'east': 'East-facing',
          'electric-blinds': 'Electric Blinds',
          'ensuite-bathroom': 'Ensuite Bathroom',
          'entry-phone-system': 'Entry Phone System',
          'excellent-condition': 'Excellent Condition',
          'fair-condition': 'Fair Condition',
          'fibre-internet': 'Fibre Internet',
          'fireplace': 'Fireplace',
          'fitted-wardrobes': 'Fitted Wardrobes',
          'fully-equipped-kitchen': 'Fully Equipped Kitchen',
          'fully-furnished': 'Fully Furnished',
          'games-room': 'Games Room',
          'garage': 'Garage',
          'garden-communal': 'Communal Garden',
          'garden-landscaped': 'Landscaped Garden',
          'garden-private': 'Private Garden',
          'gas': 'Gas',
          'gated-complex': 'Gated Complex',
          'golf-front': 'Golf-front',
          'good-condition': 'Good Condition',
          'guest-apartment': 'Guest Apartment',
          'guest-house': 'Guest House',
          'gym': 'Gym',
          'heated-bathroom-floors': 'Heated Bathroom Floors',
          'historic-property': 'Historic Property',
          'home-automation': 'Home Automation',
          'investment-opportunity': 'Investment Opportunity',
          'jacuzzi': 'Jacuzzi',
          'kitchen-not-equipped': 'Kitchen Not Equipped',
          'lift': 'Lift',
          'luxury-property': 'Luxury Property',
          'marble-flooring': 'Marble Flooring',
          'modern': 'Modern',
          'mountain': 'Mountain Views',
          'near-public-transport': 'Near Public Transport',
          'new-development': 'New Development',
          'newly-built': 'Newly Built',
          'north': 'North-facing',
          'north-east': 'North-east-facing',
          'north-west': 'North-west-facing',
          'off-plan-project': 'Off-plan Project',
          'on-site-restaurant': 'On-site Restaurant',
          'open-plan-kitchen-lounge': 'Open-plan Kitchen/Lounge',
          'paddle-court': 'Paddle Court',
          'parking-communal': 'Communal Parking',
          'parking-covered': 'Covered Parking',
          'parking-multiple': 'Multiple Parking Spaces',
          'parking-private-space': 'Private Parking Space',
          'parking-underground': 'Underground Parking',
          'partially-equipped-kitchen': 'Partially Equipped Kitchen',
          'partially-furnished': 'Partially Furnished',
          'pool-childrens': "Children's Pool",
          'pool-communal': 'Communal Pool',
          'pool-heated': 'Heated Pool',
          'pool-indoor': 'Indoor Pool',
          'pool-private': 'Private Pool',
          'pool-room-for': 'Pool Room',
          'port-marina': 'Port/Marina',
          'pre-installed-ac': 'Pre-installed A/C',
          'private-terrace': 'Private Terrace',
          'private-well': 'Private Water Well',
          'recently-refurbished': 'Recently Refurbished',
          'recently-renovated': 'Recently Renovated',
          'reception-24-hour': '24-hour Reception',
          'requires-renovation': 'Requires Renovation',
          'satellite-tv': 'Satellite TV',
          'sauna': 'Sauna',
          'security-24-hour': '24-hour Security',
          'smart-home': 'Smart Home',
          'solar-power': 'Solar Power',
          'solar-water-heating': 'Solar Water Heating',
          'solarium': 'Solarium',
          'south': 'South-facing',
          'south-east': 'South-east-facing',
          'south-west': 'South-west-facing',
          'stables': 'Stables',
          'staff-accommodation': 'Staff Accommodation',
          'storage-room': 'Storage Room',
          'style-andalucian': 'Andalusian Style',
          'style-rustic': 'Rustic Style',
          'suburban-area': 'Suburban Area',
          'surrounded-by-nature': 'Surrounded by Nature',
          'tennis-court': 'Tennis Court',
          'town-centre': 'Town Centre',
          'underfloor-heating': 'Underfloor Heating',
          'unfurnished': 'Unfurnished',
          'urban-living': 'Urban Living',
          'utility-room': 'Utility Room',
          'views-beach': 'Beach Views',
          'views-city': 'City Views',
          'views-countryside': 'Countryside Views',
          'views-forest': 'Forest Views',
          'views-garden': 'Garden Views',
          'views-golf': 'Golf Views',
          'views-lake': 'Lake Views',
          'views-marina': 'Marina Views',
          'views-mountain': 'Mountain Views',
          'views-panoramic': 'Panoramic Views',
          'views-pool': 'Pool Views',
          'views-sea': 'Sea Views',
          'views-ski-resort': 'Ski Resort Views',
          'village': 'Village',
          'walking-amenities': 'Walking Distance to Amenities',
          'walking-beach': 'Walking Distance to Beach',
          'west': 'West-facing',
          'wifi': 'WiFi',
          'with-planning-permission': 'With Planning Permission',
          'wooden-flooring': 'Wooden Flooring'
        };
        
        return FEATURE_CODE_MAP[featureCode] || featureCode;
      });

      // Extract condition from features or use direct condition field
      let condition: Comparable['condition'] | undefined
      if (candidate.condition) {
        condition = candidate.condition as Comparable['condition']
      } else if (candidate.features) {
        const features = candidate.features.join(' ').toLowerCase()
        if (features.includes('excellent-condition') || features.includes('luxury') || features.includes('new-build')) {
          condition = 'excellent'
        } else if (features.includes('good-condition') || features.includes('well-maintained')) {
          condition = 'good'
        } else if (features.includes('fair-condition') || features.includes('needs-renovation')) {
          condition = 'fair'
        } else if (features.includes('needs-work') || features.includes('renovation-project')) {
          condition = 'needs work'
        } else if (features.includes('rebuild') || features.includes('distressed-property')) {
          condition = 'rebuild'
        }
      }
      
      return {
        address: candidate.address,
        price: candidate.price,
        m2: Math.round(displayArea.area),
        areaType: displayArea.type,
        bedrooms: candidate.bedrooms,
        bathrooms: candidate.bathrooms,
        saleDate: candidate.date_listed,
        distance: 0,
        pricePerM2: Math.round(candidate.price / displayArea.area),
        propertyType: candidate.property_type,
        daysOnMarket: this.calculateDaysOnMarket(candidate.date_listed),
        adjustedPrice: candidate.price,
        condition: condition, // Include property condition
        // Property age and timing
        yearBuilt: candidate.year_built || candidate.yearBuilt,
        listingDate: candidate.date_listed,
        lastUpdated: candidate.last_updated || candidate.lastUpdated,
        images: candidate.images && candidate.images.length > 0
          ? candidate.images
          : candidate.image
            ? [candidate.image]
            : [],
        buildArea: candidate.build_area,
        plotArea: candidate.plot_area,
        terraceArea: candidate.terrace_area_m2,
        features: mappedFeatures,
        // Reference number for display
        refNumber: candidate.ref_number || candidate.refNumber
      };
    });
    
    return { comparables, totalFound: candidates.length };
  }

  calculateDaysOnMarket(dateListedStr) {
    const listedDate = new Date(dateListedStr);
    const now = new Date();
    return Math.floor((now.getTime() - listedDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  getTotalProperties() {
    return this.properties.size;
  }

  getStats() {
    return {
      totalProperties: this.properties.size,
      byCities: this.index.byCity,
      byPropertyType: this.index.byType,
      lastUpdated: this.index.lastUpdated
    };
  }

  // Additional methods needed for FeedManager compatibility
  getPropertyCount(feedSource?: string): number {
    return this.properties.size;
  }

  cleanOldProperties(feedSource: string, cutoffDate: string): number {
    // Simple implementation - return 0 for now
    return 0;
  }

  async upsertProperty(property: any, feedSource: string): Promise<{ isUpdate: boolean }> {
    const existingProperty = this.properties.get(property.id);
    const isUpdate = existingProperty !== undefined;
    
    // Add or update the property
    this.properties.set(property.id, property);
    
    return { isUpdate };
  }

  saveNow(): void {
    // Simple implementation - no saving needed for read-only database
  }

  // Similarity calculation methods for sophisticated property matching
  calculateConditionSimilarity(criteriaCondition: string[], propertyCondition: string): number {
    if (!criteriaCondition || !propertyCondition) return 0;
    
    // Condition hierarchy (from best to worst)
    const conditionHierarchy = ['Excellent', 'Good', 'Fair', 'Needs Renovation', 'New Build'];
    
    const criteriaConditions = criteriaCondition.map(c => c.toLowerCase());
    const propertyConditionLower = propertyCondition.toLowerCase();
    
    // Exact match gets highest score
    if (criteriaConditions.includes(propertyConditionLower)) {
      return 2.0;
    }
    
    // Find positions in hierarchy
    const criteriaPositions = criteriaConditions.map(c => 
      conditionHierarchy.findIndex(h => h.toLowerCase() === c)
    ).filter(pos => pos !== -1);
    
    const propertyPosition = conditionHierarchy.findIndex(h => 
      h.toLowerCase() === propertyConditionLower
    );
    
    if (propertyPosition === -1 || criteriaPositions.length === 0) return 0;
    
    // Calculate distance penalty
    const minDistance = Math.min(...criteriaPositions.map(pos => Math.abs(pos - propertyPosition)));
    
    // Score based on distance: 1.5 for adjacent, 1.0 for 2 steps away, 0.5 for 3+ steps
    if (minDistance === 1) return 1.5;
    if (minDistance === 2) return 1.0;
    if (minDistance === 3) return 0.5;
    return 0.1; // Very different conditions
  }

  calculateAreaSimilarity(criteria: any, property: any): number {
    const getPropertyArea = (prop) => {
      if (prop.property_type?.toLowerCase() === 'villa') {
        if (prop.build_area && prop.build_area > 0) {
          if (prop.plot_area && prop.plot_area > 0 && prop.build_area < prop.plot_area * 0.3) {
            return prop.plot_area;
          }
          return prop.build_area;
        }
        if (prop.plot_area && prop.plot_area > 0) {
          return prop.plot_area;
        }
      } else {
        if (prop.build_area && prop.build_area > 0) {
          return prop.build_area;
        }
      }
      return prop.terrace_area_m2 || 0;
    };
    
    const criteriaArea = criteria.minAreaM2 || criteria.maxAreaM2 || 0;
    const propertyArea = getPropertyArea(property);
    
    if (!criteriaArea || !propertyArea) return 0;
    
    const areaDiff = Math.abs(criteriaArea - propertyArea);
    const areaRatio = areaDiff / criteriaArea;
    
    // Perfect match (within 5%)
    if (areaRatio <= 0.05) return 1.5;
    // Very similar (within 15%)
    if (areaRatio <= 0.15) return 1.0;
    // Similar (within 30%)
    if (areaRatio <= 0.30) return 0.5;
    // Acceptable (within 50%)
    if (areaRatio <= 0.50) return 0.2;
    
    return 0; // Too different
  }

  calculatePriceSimilarity(criteria: any, property: any): number {
    const criteriaPrice = criteria.minPrice || criteria.maxPrice || 0;
    if (!criteriaPrice || !property.price) return 0;
    
    const priceDiff = Math.abs(criteriaPrice - property.price);
    const priceRatio = priceDiff / criteriaPrice;
    
    // Perfect match (within 5%)
    if (priceRatio <= 0.05) return 1.5;
    // Very similar (within 15%)
    if (priceRatio <= 0.15) return 1.0;
    // Similar (within 30%)
    if (priceRatio <= 0.30) return 0.5;
    // Acceptable (within 50%)
    if (priceRatio <= 0.50) return 0.2;
    
    return 0; // Too different
  }

  calculateFeatureSimilarity(criteriaFeatures: string[], propertyFeatures: string[]): number {
    if (!criteriaFeatures || !propertyFeatures || criteriaFeatures.length === 0) return 0;
    
    const criteriaFeaturesLower = criteriaFeatures.map(f => f.toLowerCase());
    const propertyFeaturesLower = propertyFeatures.map(f => f.toLowerCase());
    
    // Count matching features
    const matchingFeatures = criteriaFeaturesLower.filter(f => 
      propertyFeaturesLower.includes(f)
    ).length;
    
    // Calculate similarity ratio
    const similarityRatio = matchingFeatures / criteriaFeatures.length;
    
    // Score based on feature overlap
    if (similarityRatio >= 0.8) return 1.0; // 80%+ match
    if (similarityRatio >= 0.6) return 0.7; // 60%+ match
    if (similarityRatio >= 0.4) return 0.4; // 40%+ match
    if (similarityRatio >= 0.2) return 0.2; // 20%+ match
    
    return 0; // Less than 20% match
  }

  calculateLocationSimilarity(criteria: any, property: any): number {
    // Simple location similarity based on address components
    const criteriaAddress = (criteria.address || '').toLowerCase();
    const propertyAddress = (property.address || '').toLowerCase();
    
    // Extract key location terms
    const locationTerms = ['nueva andalucia', 'puerto banús', 'golden mile', 'rio real', 'cabopino', 'marbella centre'];
    
    for (const term of locationTerms) {
      if (criteriaAddress.includes(term) && propertyAddress.includes(term)) {
        return 1.0; // Same area
      }
    }
    
    // Check for urbanization matches
    if (criteria.urbanization && property.urbanization) {
      if (criteria.urbanization.toLowerCase() === property.urbanization.toLowerCase()) {
        return 1.5; // Same urbanization
      }
    }
    
    return 0; // Different areas
  }

  calculateRecencyScore(dateListed: string): number {
    if (!dateListed) return 0;
    
    const listedDate = new Date(dateListed);
    const now = new Date();
    const daysSinceListed = (now.getTime() - listedDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Bonus for recent listings (within 30 days)
    if (daysSinceListed <= 30) return 0.3;
    // Small bonus for listings within 90 days
    if (daysSinceListed <= 90) return 0.1;
    
    return 0; // Older listings
  }
}

export interface FeedUpdateResult {
  success: boolean
  provider: string
  propertiesProcessed: number
  propertiesAdded: number
  propertiesUpdated: number
  propertiesRemoved: number
  propertiesEnhanced?: number
  duration: number
  error?: string
}

export interface FeedManagerStats {
  totalProperties: number
  lastUpdate: string
  nextUpdate: string
  activeFeed: string
  updateHistory: FeedUpdateResult[]
}

export class FeedManager {
  private database: SimplePropertyDatabase
  private isSchedulerRunning: boolean = false
  private scheduledTask?: cron.ScheduledTask
  private updateHistory: FeedUpdateResult[] = []
  private compressionEnabled: boolean = true // Enable compression by default
  private feedCacheDir: string = './data'

  constructor(enableCompression: boolean = true) {
    this.database = new SimplePropertyDatabase()
    this.compressionEnabled = enableCompression
    this.ensureCacheDirectory()
    // Database will be loaded lazily when first needed
    console.log('Feed Manager initialized - database will load on first use')
  }

  // Compression helper methods
  private async compressXMLData(xmlData: string): Promise<Buffer> {
    if (!this.compressionEnabled) {
      return Buffer.from(xmlData, 'utf8')
    }
    
    try {
      const compressed = await gzipAsync(xmlData, { level: 6 }) // Balanced compression
      console.log(`📦 Compressed XML: ${xmlData.length} → ${compressed.length} bytes (${Math.round((1 - compressed.length / xmlData.length) * 100)}% reduction)`)
      return compressed
    } catch (error) {
      console.warn('⚠️ XML compression failed, falling back to uncompressed:', error)
      return Buffer.from(xmlData, 'utf8')
    }
  }

  private async decompressXMLData(buffer: Buffer): Promise<string> {
    try {
      // Try to decompress first
      const decompressed = await gunzipAsync(buffer)
      return decompressed.toString('utf8')
    } catch (error) {
      // If decompression fails, try as regular string
      try {
        return buffer.toString('utf8')
      } catch (parseError) {
        throw new Error(`Failed to parse XML data: ${parseError}`)
      }
    }
  }

  private getCompressedCachePath(filename: string): string {
    const cachePath = path.join(this.feedCacheDir, filename)
    return this.compressionEnabled ? `${cachePath}.gz` : cachePath
  }

  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.feedCacheDir)) {
      fs.mkdirSync(this.feedCacheDir, { recursive: true })
    }
  }

  // Manual feed update
  public async updateFeed(providerName?: string): Promise<FeedUpdateResult> {
    const startTime = Date.now()
    const provider = providerName 
      ? getCurrentFeedConfig().providers[providerName]
      : getActiveFeedProvider()

    if (!provider) {
      const error = `Feed provider not found: ${providerName || 'active provider'}`
      console.error(error)
      return {
        success: false,
        provider: providerName || 'unknown',
        propertiesProcessed: 0,
        propertiesAdded: 0,
        propertiesUpdated: 0,
        propertiesRemoved: 0,
        duration: Date.now() - startTime,
        error
      }
    }

    console.log(`Starting feed update for: ${provider.name}`)

    try {
      // Fetch XML feed
      const xmlData = await this.fetchFeedData(provider)
      
      // Parse XML based on provider type
      const properties = await this.parseFeedData(xmlData, provider)
      
      // Update database with AI enhancement
      const updateStats = await this.updateDatabaseWithAIEnhancement(properties, provider.name)
      
      // Clean old properties (older than 7 days)
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const removedCount = this.database.cleanOldProperties(provider.name, cutoffDate)
      
      const result: FeedUpdateResult = {
        success: true,
        provider: provider.name,
        propertiesProcessed: properties.length,
        propertiesAdded: updateStats.added,
        propertiesUpdated: updateStats.updated,
        propertiesRemoved: removedCount,
        propertiesEnhanced: updateStats.enhanced,
        duration: Date.now() - startTime
      }

      this.updateHistory.push(result)
      this.updateHistory = this.updateHistory.slice(-10) // Keep last 10 updates

      // Reduced logging for production

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Feed update failed for ${provider.name}:`, errorMessage)
      
      const result: FeedUpdateResult = {
        success: false,
        provider: provider.name,
        propertiesProcessed: 0,
        propertiesAdded: 0,
        propertiesUpdated: 0,
        propertiesRemoved: 0,
        duration: Date.now() - startTime,
        error: errorMessage
      }

      this.updateHistory.push(result)
      this.updateHistory = this.updateHistory.slice(-10)

      return result
    }
  }

  // Fetch XML data from feed URL
  private async fetchFeedData(provider: FeedProvider): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000) // 90 second timeout (reduced from 120s)

    try {
      console.log(`Fetching feed data from: ${provider.url}`)
      
      // Check for cached XML data first
      const cachePath = this.getCompressedCachePath('feed-cache.xml')
      if (fs.existsSync(cachePath)) {
        const cacheAge = Date.now() - fs.statSync(cachePath).mtime.getTime()
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours
        
        if (cacheAge < maxAge) {
          console.log(`📦 Using cached XML data (${Math.round(cacheAge / (60 * 60 * 1000))} hours old)`)
          const cachedData = fs.readFileSync(cachePath)
          return await this.decompressXMLData(cachedData)
        }
      }
      
      const response = await fetch(provider.url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'PropertyList.es Research Agent/1.0',
          'Accept': 'application/xml, text/xml, */*',
          'Accept-Encoding': 'gzip, deflate'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const xmlData = await response.text()
      
      if (!xmlData || xmlData.trim().length === 0) {
        throw new Error('Empty response from feed URL')
      }

      console.log(`Successfully fetched ${xmlData.length} characters of XML data`)
      
      // Cache the compressed XML data
      try {
        const compressedData = await this.compressXMLData(xmlData)
        fs.writeFileSync(cachePath, compressedData)
        console.log(`💾 Cached compressed XML data to: ${cachePath}`)
      } catch (cacheError) {
        console.warn('⚠️ Failed to cache XML data:', cacheError)
      }
      
      return xmlData
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Feed request timed out after 90 seconds')
      }
      
      throw error
    }
  }

  // Parse feed data based on provider type
  private async parseFeedData(xmlData: string, provider: FeedProvider) {
    console.log(`Parsing feed data using: ${provider.parser}`)
    
    switch (provider.parser) {
      case 'PropertyPortalParser':
        return await PropertyPortalParser.parseXMLFeed(xmlData)
      
      // Add other parsers here as needed
      // case 'IdealistaParser':
      //   return await IdealistaParser.parseXMLFeed(xmlData)
      
      default:
        throw new Error(`Unknown parser type: ${provider.parser}`)
    }
  }

  // Update database with parsed properties
  private async updateDatabase(
    properties: any[], 
    feedSource: string
  ): Promise<{ added: number; updated: number }> {
    let added = 0
    let updated = 0
    const initialCount = this.database.getPropertyCount(feedSource)

    console.log(`Updating database with ${properties.length} properties`)

    for (const property of properties) {
      try {
        // Validate property data
        if (feedSource === 'Property Portal' && !PropertyPortalParser.validatePropertyData(property)) {
          console.warn('Invalid property data, skipping:', property.address)
          continue
        }

        const { isUpdate } = await this.database.upsertProperty(property, feedSource)
        
        if (isUpdate) {
          updated++;
        } else {
          added++;
        }
      } catch (error) {
        console.warn('Error updating property:', property.address, error)
      }
    }

    // Force save database after bulk update
    this.database.saveNow()

    const finalCount = this.database.getPropertyCount(feedSource)
    const actualAdded = finalCount - initialCount
    const actualUpdated = updated - actualAdded

    return { 
      added: Math.max(0, actualAdded), 
      updated: Math.max(0, actualUpdated) 
    }
  }

  /**
   * AI-enhanced database update with property description analysis
   */
  private async updateDatabaseWithAIEnhancement(
    properties: any[], 
    feedSource: string
  ): Promise<{ added: number; updated: number; enhanced: number }> {
    console.log(`🤖 Starting AI-enhanced database update with ${properties.length} properties from ${feedSource}`)
    
    let added = 0
    let updated = 0
    let enhanced = 0
    
    // Step 1: Filter properties that need AI enhancement
    console.log('🔍 Step 1: Identifying properties that need AI enhancement...')
    const propertiesNeedingEnhancement = properties.filter(p => 
      AIPropertyEnhancer.needsEnhancement(p)
    )
    
    const alreadyEnhancedProperties = properties.filter(p => 
      AIPropertyEnhancer.isPropertyAlreadyEnhanced(p)
    )
    
    console.log(`📊 Enhancement Analysis:`)
    console.log(`   - Properties needing enhancement: ${propertiesNeedingEnhancement.length}`)
    console.log(`   - Properties already enhanced: ${alreadyEnhancedProperties.length}`)
    console.log(`   - Properties without descriptions: ${properties.length - propertiesNeedingEnhancement.length - alreadyEnhancedProperties.length}`)
    
    // Step 2: AI enhancement of properties that need it
    if (propertiesNeedingEnhancement.length > 0) {
      console.log(`🤖 Step 2: AI analyzing ${propertiesNeedingEnhancement.length} properties that need enhancement...`)
      
      try {
        const enhancedProperties = await AIPropertyEnhancer.enhancePropertyBatch(propertiesNeedingEnhancement)
        enhanced = enhancedProperties.length
        
        console.log(`✅ AI enhancement completed for ${enhanced} properties`)
        
        // Step 3: Update database with all properties (enhanced + already enhanced + others)
        console.log('💾 Step 3: Updating database with all properties...')
        
        // Combine enhanced properties with already enhanced properties
        const allPropertiesToUpdate = [
          ...enhancedProperties,
          ...alreadyEnhancedProperties,
          ...properties.filter(p => !AIPropertyEnhancer.needsEnhancement(p) && !AIPropertyEnhancer.isPropertyAlreadyEnhanced(p))
        ]
        
        for (const property of allPropertiesToUpdate) {
          try {
            const result = await this.database.upsertProperty(property, feedSource)
            if (result.isUpdate) {
              updated++
            } else {
              added++
            }
          } catch (error) {
            console.error('Error upserting property:', error)
          }
        }
        
      } catch (error) {
        console.error('❌ AI enhancement failed, falling back to standard update:', error)
        // Fallback to standard update
        const result = await this.updateDatabase(properties, feedSource)
        return { ...result, enhanced: 0 }
      }
    } else {
      console.log('✅ No properties need AI enhancement, using standard update...')
      // No properties need enhancement, use standard update
      const result = await this.updateDatabase(properties, feedSource)
      return { ...result, enhanced: 0 }
    }
    
    // Save database after all updates
    this.database.saveNow()
    
    console.log(`✅ AI-enhanced database update completed: ${added} added, ${updated} updated, ${enhanced} enhanced`)
    console.log(`💰 Cost optimization: Only ${enhanced} properties required AI analysis (${((enhanced / properties.length) * 100).toFixed(1)}% of total)`)
    
    return { added, updated, enhanced }
  }

  // Start automatic scheduled updates
  public startScheduler(): boolean {
    if (this.isSchedulerRunning) {
      console.log('Scheduler is already running')
      return false
    }

    const provider = getActiveFeedProvider()
    if (!provider.updateTime) {
      console.error('No update time configured for active provider')
      return false
    }

    // Parse time (HH:MM format) and create cron expression
    const [hours, minutes] = provider.updateTime.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.error('Invalid update time format:', provider.updateTime)
      return false
    }

    const cronExpression = `${minutes} ${hours} * * *` // Daily at specified time
    
    try {
      this.scheduledTask = cron.schedule(cronExpression, async () => {
        console.log(`Scheduled feed update starting at ${new Date().toISOString()}`)
        await this.updateFeed()
      }, {
        scheduled: false,
        timezone: 'Europe/Madrid' // Adjust timezone as needed
      })

      this.scheduledTask.start()
      this.isSchedulerRunning = true

      console.log(`Scheduler started - will update ${provider.name} daily at ${provider.updateTime}`)
      return true
    } catch (error) {
      console.error('Error starting scheduler:', error)
      return false
    }
  }

  // Stop automatic scheduled updates
  public stopScheduler(): boolean {
    if (!this.isSchedulerRunning || !this.scheduledTask) {
      console.log('Scheduler is not running')
      return false
    }

    try {
      this.scheduledTask.stop()
      this.scheduledTask = undefined
      this.isSchedulerRunning = false
      console.log('Scheduler stopped')
      return true
    } catch (error) {
      console.error('Error stopping scheduler:', error)
      return false
    }
  }

  // Get feed manager statistics
  public getStats(): FeedManagerStats {
    const config = getCurrentFeedConfig()
    const provider = getActiveFeedProvider()
    
    // Load database lazily when stats are requested
    if (!this.database['isLoaded']) {
      console.log('🔄 Loading property database for stats...')
      this.database.loadDatabase()
    }
    
    const dbStats = this.database.getStats()
    
    // Calculate next update time
    let nextUpdate = 'Not scheduled'
    if (this.isSchedulerRunning && provider.updateTime) {
      const [hours, minutes] = provider.updateTime.split(':').map(Number)
      const now = new Date()
      const next = new Date()
      next.setHours(hours, minutes, 0, 0)
      
      // If time has passed today, schedule for tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1)
      }
      
      nextUpdate = next.toISOString()
    }

    return {
      totalProperties: dbStats.totalProperties,
      lastUpdate: dbStats.lastUpdated,
      nextUpdate,
      activeFeed: config.activeFeed,
      updateHistory: this.updateHistory.slice(-5) // Last 5 updates
    }
  }

  // Get comparable properties (interface to database)
  public findComparableProperties(criteria: any) {
    console.log('🔍 Feed Manager findComparableProperties called with criteria:', criteria)
    
    // Load database lazily when first needed
    if (!this.database['isLoaded']) {
      console.log('🔄 Loading property database on first comparable search...')
      this.database.loadDatabase()
    }
    
    const results = this.database.findComparableProperties(criteria)
    console.log('🔍 Feed Manager findComparableProperties returned:', results?.comparables?.length || 0, 'results out of', results?.totalFound || 0, 'total')
    
    return results
  }

  // Test feed connection
  public async testFeedConnection(providerName?: string): Promise<{
    success: boolean
    provider: string
    responseTime: number
    dataSize: number
    error?: string
  }> {
    const startTime = Date.now()
    const provider = providerName 
      ? getCurrentFeedConfig().providers[providerName]
      : getActiveFeedProvider()

    if (!provider) {
      return {
        success: false,
        provider: providerName || 'unknown',
        responseTime: 0,
        dataSize: 0,
        error: 'Provider not found'
      }
    }

    try {
      const xmlData = await this.fetchFeedData(provider)
      return {
        success: true,
        provider: provider.name,
        responseTime: Date.now() - startTime,
        dataSize: xmlData.length
      }
    } catch (error) {
      return {
        success: false,
        provider: provider.name,
        responseTime: Date.now() - startTime,
        dataSize: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Get database instance (for advanced operations)
  public getDatabase(): SimplePropertyDatabase {
    return this.database
  }

  // Shutdown feed manager
  public shutdown(): void {
    this.stopScheduler()
    console.log('Feed Manager shutdown')
  }
}

// Global feed manager instance
let globalFeedManager: FeedManager | null = null

// Get or create global feed manager instance
export function getFeedManager(): FeedManager {
  if (!globalFeedManager) {
    globalFeedManager = new FeedManager()
  }
  return globalFeedManager
}

// Initialize feed manager with scheduler
export async function initializeFeedManager(): Promise<FeedManager> {
  const manager = getFeedManager()
  
  // Start scheduler if not already running
  if (!manager['isSchedulerRunning']) {
    const started = manager.startScheduler()
    if (started) {
      console.log('Feed Manager scheduler started successfully')
    } else {
      console.warn('Feed Manager scheduler failed to start')
    }
  }
  
  return manager
} 