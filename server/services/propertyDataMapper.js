/**
 * PropertyList.es Data Mapper Service
 * Maps PropertyList.es specific IDs and formats to standard property analysis format
 */

class PropertyDataMapper {
  constructor() {
    // PropertyList.es city mappings (from your system)
    this.cityMappings = {
      1: 'Málaga',
      2: 'Marbella', 
      3: 'Estepona',
      4: 'Benalmádena',
      5: 'Fuengirola',
      6: 'Torremolinos',
      7: 'Mijas',
      8: 'Nerja',
      9: 'Vélez-Málaga',
      10: 'Antequera'
    };

    // PropertyList.es suburb mappings (common ones)
    this.suburbMappings = {
      120: 'Puerto Banús',
      121: 'Nueva Andalucía',
      122: 'San Pedro de Alcántara',
      123: 'Golden Mile',
      124: 'Elviria',
      125: 'Cabopino',
      126: 'La Quinta',
      127: 'Benahavís',
      128: 'Sierra Blanca',
      129: 'Nagüeles'
    };

    // PropertyList.es property type mappings
    this.propertyTypeMappings = {
      0: 'Apartment',
      1: 'Villa', 
      2: 'Townhouse',
      3: 'Penthouse',
      4: 'Plot',
      5: 'Commercial',
      6: 'Office',
      7: 'Garage',
      8: 'Warehouse',
      9: 'Other'
    };
  }

  /**
   * Transform PropertyList.es JSON to standard format for comparable analysis
   */
  transformPropertyListData(propertyData) {
    if (!propertyData || typeof propertyData !== 'object') {
      return propertyData;
    }

    // Create a copy to avoid modifying the original
    const transformed = { ...propertyData };

    // Map city_id to city name
    if (propertyData.city_id && this.cityMappings[propertyData.city_id]) {
      transformed.city = this.cityMappings[propertyData.city_id];
    }

    // Map suburb_id to suburb name  
    if (propertyData.suburb_id && this.suburbMappings[propertyData.suburb_id]) {
      transformed.suburb = this.suburbMappings[propertyData.suburb_id];
    }

    // Handle urbanization_name (already in correct format)
    if (propertyData.urbanization_name) {
      transformed.urbanization = propertyData.urbanization_name;
    }

    // Map property_type if it's numeric
    if (typeof propertyData.property_type === 'number' && this.propertyTypeMappings[propertyData.property_type]) {
      transformed.propertyTypeName = this.propertyTypeMappings[propertyData.property_type];
    }

    // Ensure feature_ids is properly formatted
    if (propertyData.feature_ids && Array.isArray(propertyData.feature_ids)) {
      transformed.features = propertyData.feature_ids;
    }

    // Map database field names to frontend expected names
    if (propertyData.build_area) {
      transformed.build_square_meters = propertyData.build_area;
    }
    if (propertyData.plot_size) {
      transformed.plot_square_meters = propertyData.plot_size;
    }
    if (propertyData.terrace_area) {
      transformed.terrace_square_meters = propertyData.terrace_area;
    }
    if (propertyData.sale_price) {
      transformed.price = propertyData.sale_price;
    }

    // Add derived fields for better analysis
    transformed.totalCost = this.calculateTotalCost(propertyData);
    transformed.pricePerSqm = propertyData.price && (propertyData.build_square_meters || propertyData.build_area) ? 
      Math.round(propertyData.price / (propertyData.build_square_meters || propertyData.build_area)) : null;

    // Log the transformation for debugging
    console.log('🔄 PropertyList.es data transformed:');
    console.log(`   City: ${propertyData.city_id} → ${transformed.city}`);
    console.log(`   Suburb: ${propertyData.suburb_id} → ${transformed.suburb}`);
    console.log(`   Urbanization: "${propertyData.urbanization_name}" → "${transformed.urbanization}"`);
    console.log(`   Property Type: ${propertyData.property_type} → ${transformed.propertyTypeName}`);
    console.log(`   Features: ${propertyData.feature_ids?.length || 0} features`);
    console.log(`   Build Area: ${transformed.build_square_meters || propertyData.build_area || 'N/A'}m²`);
    console.log(`   Plot Size: ${transformed.plot_square_meters || propertyData.plot_size || 'N/A'}m²`);
    console.log(`   Terrace: ${transformed.terrace_square_meters || propertyData.terrace_area || 'N/A'}m²`);
    console.log(`   Price: €${propertyData.price?.toLocaleString() || 'N/A'}`);

    return transformed;
  }

  /**
   * Calculate total property cost including fees
   */
  calculateTotalCost(propertyData) {
    if (!propertyData.price) return null;

    let totalCost = propertyData.price;

    // Add annual costs if available
    const annualCosts = (propertyData.ibi || 0) + 
                       (propertyData.basura || 0) + 
                       (propertyData.community_fees ? propertyData.community_fees * 12 : 0);

    return {
      purchasePrice: propertyData.price,
      annualCosts: annualCosts,
      totalFirstYear: totalCost + annualCosts,
      breakdown: {
        ibi: propertyData.ibi || 0,
        basura: propertyData.basura || 0,
        communityFees: propertyData.community_fees || 0
      }
    };
  }

  /**
   * Get city name from ID
   */
  getCityName(cityId) {
    return this.cityMappings[cityId] || `City_${cityId}`;
  }

  /**
   * Get suburb name from ID  
   */
  getSuburbName(suburbId) {
    return this.suburbMappings[suburbId] || `Suburb_${suburbId}`;
  }

  /**
   * Get property type name from ID
   */
  getPropertyTypeName(propertyTypeId) {
    return this.propertyTypeMappings[propertyTypeId] || `Type_${propertyTypeId}`;
  }

  /**
   * Validate if property data has sufficient information for analysis
   */
  validatePropertyData(propertyData) {
    const issues = [];

    if (!propertyData.price) {
      issues.push('Missing property price');
    }

    if (!propertyData.build_square_meters) {
      issues.push('Missing build area');
    }

    if (!propertyData.bedrooms) {
      issues.push('Missing bedroom count');
    }

    if (!propertyData.city_id && !propertyData.city) {
      issues.push('Missing city information');
    }

    if (typeof propertyData.property_type === 'undefined') {
      issues.push('Missing property type');
    }

    return {
      isValid: issues.length === 0,
      issues: issues,
      completeness: Math.round(((5 - issues.length) / 5) * 100)
    };
  }

  /**
   * Extract coordinates if available (for future GPS integration)
   */
  extractCoordinates(propertyData) {
    // PropertyList.es might have coordinates in various formats
    const lat = propertyData.latitude || propertyData.lat;
    const lng = propertyData.longitude || propertyData.lng || propertyData.lon;

    if (lat && lng) {
      return {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        source: 'PropertyList.es'
      };
    }

    return null;
  }

  /**
   * Add missing city mappings (for when new cities are added to PropertyList.es)
   */
  addCityMapping(cityId, cityName) {
    this.cityMappings[cityId] = cityName;
    console.log(`Added city mapping: ${cityId} → ${cityName}`);
  }

  /**
   * Add missing suburb mappings
   */
  addSuburbMapping(suburbId, suburbName) {
    this.suburbMappings[suburbId] = suburbName;
    console.log(`Added suburb mapping: ${suburbId} → ${suburbName}`);
  }

  /**
   * Get all available mappings for debugging
   */
  getAllMappings() {
    return {
      cities: this.cityMappings,
      suburbs: this.suburbMappings,
      propertyTypes: this.propertyTypeMappings
    };
  }
}

module.exports = PropertyDataMapper; 