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

    // PropertyList.es property type mappings (must match database values exactly)
    this.propertyTypeMappings = {
      0: 'apartment',
      1: 'villa', 
      2: 'townhouse',
      3: 'penthouse',
      4: 'plot',
      5: 'commercial',
      6: 'office',
      7: 'garage',
      8: 'warehouse',
      9: 'country-house'
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

    // ENHANCED: Preserve original values if they exist and are valid
    // Only do ID-based mapping if the original values are missing

    // Map city_id to city name (only if city doesn't already exist)
    if (!transformed.city && propertyData.city_id && this.cityMappings[propertyData.city_id]) {
      transformed.city = this.cityMappings[propertyData.city_id];
    }

    // Map suburb_id to suburb name (only if suburb doesn't already exist)
    if (!transformed.suburb && propertyData.suburb_id && this.suburbMappings[propertyData.suburb_id]) {
      transformed.suburb = this.suburbMappings[propertyData.suburb_id];
    }

    // Handle urbanization_name (preserve existing urbanization if present)
    if (!transformed.urbanization && propertyData.urbanization_name) {
      transformed.urbanization = propertyData.urbanization_name;
    }

    // FIXED: Ensure street_address is preserved for direct geocoding
    if (propertyData.street_address && !transformed.street_address) {
      transformed.street_address = propertyData.street_address;
    }
    // Also handle potential field variations
    if (!transformed.street_address && propertyData.address) {
      transformed.street_address = propertyData.address;
    }

    // Map property_type if it's numeric (preserve existing string property_type)
    // FIXED: Handle both 'type' and 'property_type' field names
    const propertyType = propertyData.property_type || propertyData.type;
    console.log(`🔍 DEBUG: Property type transformation - Input: ${propertyType} (type: ${typeof propertyType})`);
    
    if (typeof propertyType === 'number' && this.propertyTypeMappings[propertyType]) {
      transformed.property_type = this.propertyTypeMappings[propertyType];
      transformed.propertyTypeName = this.propertyTypeMappings[propertyType]; // For compatibility
      console.log(`🔄 Property type mapped: ${propertyType} → "${transformed.property_type}"`);
    } else if (typeof propertyType === 'string') {
      // Keep the original string property_type and ensure it's lowercase to match database
      transformed.property_type = propertyType.toLowerCase();
      console.log(`🔄 Property type kept as string: "${propertyType}" → "${transformed.property_type}"`);
    } else {
      console.log(`⚠️ Property type not mapped: ${propertyType} (no mapping found or invalid type)`);
    }

    // Handle features - preserve existing features array or map from feature_ids
    if (propertyData.features && Array.isArray(propertyData.features)) {
      transformed.features = propertyData.features;
    } else if (propertyData.feature_ids && Array.isArray(propertyData.feature_ids)) {
      transformed.features = propertyData.feature_ids;
    }

    // Map XML field names to frontend compatibility (preserve existing values)
    if (propertyData.build_size && !transformed.build_square_meters) {
      transformed.build_square_meters = propertyData.build_size;        // XML field → frontend
    }
    if (propertyData.plot_size && !transformed.plot_square_meters) {
      transformed.plot_square_meters = propertyData.plot_size;
    }
    if (propertyData.terrace_size && !transformed.terrace_square_meters) {
      transformed.terrace_square_meters = propertyData.terrace_size;    // XML field → frontend
    }
    if (propertyData.sale_price && !transformed.price) {
      transformed.price = propertyData.sale_price;
    }

    // ENHANCED: Ensure we don't lose any original data
    // Preserve all original fields that might be needed
    const preserveFields = [
      'reference', 'price', 'bedrooms', 'bathrooms', 'build_area', 'plot_size', 
      'terrace_area', 'city', 'suburb', 'urbanization', 'property_type', 
      'latitude', 'longitude', 'images', 'features', 'userProvidedDetails', 'street_address'
    ];
    
    preserveFields.forEach(field => {
      if (propertyData[field] !== undefined && propertyData[field] !== null) {
        transformed[field] = propertyData[field];
      }
    });

    // Add derived fields for better analysis
    transformed.totalCost = this.calculateTotalCost(transformed);
    transformed.pricePerSqm = transformed.price && (transformed.build_square_meters || transformed.build_area) ? 
      Math.round(transformed.price / (transformed.build_square_meters || transformed.build_area)) : null;

    // Log the transformation for debugging
    console.log('🔄 PropertyList.es data transformed:');
    console.log(`   Input sale_price: ${propertyData.sale_price}`);
    console.log(`   Transformed price: ${transformed.price}`);
    console.log(`   City: ${propertyData.city_id || propertyData.city} → ${transformed.city}`);
    console.log(`   Suburb: ${propertyData.suburb_id || propertyData.suburb} → ${transformed.suburb}`);
    console.log(`   Urbanization: "${propertyData.urbanization_name || propertyData.urbanization}" → "${transformed.urbanization}"`);
    const inputPropertyType = propertyData.property_type || propertyData.type;
    console.log(`   Property Type: ${inputPropertyType} → ${transformed.property_type || transformed.propertyTypeName}`);
    console.log(`   Features: ${(propertyData.features || propertyData.feature_ids || []).length} features`);
    console.log(`   Build Area: ${transformed.build_square_meters || transformed.build_area || 'N/A'}m²`);
    console.log(`   Plot Size: ${transformed.plot_square_meters || transformed.plot_size || 'N/A'}m²`);
    console.log(`   Terrace: ${transformed.terrace_square_meters || transformed.terrace_area || 'N/A'}m²`);
    console.log(`   Price: €${transformed.price?.toLocaleString() || 'N/A'}`);

    console.log(`🔍 FINAL TRANSFORMED KEYS:`, Object.keys(transformed));
    console.log(`🔍 FINAL PROPERTY_TYPE:`, transformed.property_type);
    
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