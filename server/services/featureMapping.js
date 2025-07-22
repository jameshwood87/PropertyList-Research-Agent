/**
 * PropertyList.es Feature Mapping
 * Maps numeric feature IDs to human-readable names and categories
 */

// Feature categories
const FEATURE_CATEGORIES = {
  1: 'Location',
  2: 'Orientation', 
  3: 'Condition',
  4: 'Pool',
  5: 'Amenities',
  6: 'Climate Control',
  7: 'Views',
  8: 'Interior Features',
  9: 'Furnishing',
  10: 'Kitchen',
  11: 'Garden',
  12: 'Security',
  13: 'Parking',
  14: 'Utilities',
  15: 'Property Type'
};

// Feature definitions: [ID, name, category]
const FEATURES = {
  // Location Features (Category 1)
  1: { name: 'Beach Front', category: 1, slug: 'beach-front' },
  2: { name: 'Golf Front', category: 1, slug: 'golf-front' },
  3: { name: 'Town Centre', category: 1, slug: 'town-centre' },
  4: { name: 'Countryside', category: 1, slug: 'countryside' },
  5: { name: 'Commercial District', category: 1, slug: 'commercial-district' },
  6: { name: 'Port Marina', category: 1, slug: 'port-marina' },
  7: { name: 'Village', category: 1, slug: 'village' },
  8: { name: 'Mountain', category: 1, slug: 'mountain' },
  9: { name: 'Close to Golf', category: 1, slug: 'close-to-golf' },
  10: { name: 'Close to Marina', category: 1, slug: 'close-to-marina' },
  11: { name: 'Close to Shops', category: 1, slug: 'close-to-shops' },
  12: { name: 'Close to Restaurants', category: 1, slug: 'close-to-restaurants' },
  13: { name: 'Close to Beach', category: 1, slug: 'close-to-beach' },
  14: { name: 'Close to Town Centre', category: 1, slug: 'close-to-town-centre' },
  15: { name: 'Close to Schools', category: 1, slug: 'close-to-schools' },
  16: { name: 'Close to Ski Resort', category: 1, slug: 'close-to-ski-resort' },
  17: { name: 'Surrounded by Nature', category: 1, slug: 'surrounded-by-nature' },
  18: { name: 'Near Public Transport', category: 1, slug: 'near-public-transport' },
  129: { name: 'Walking Distance to Amenities', category: 1, slug: 'walking-amenities' },
  130: { name: 'Walking Distance to Beach', category: 1, slug: 'walking-beach' },

  // Orientation Features (Category 2)
  19: { name: 'North', category: 2, slug: 'north' },
  20: { name: 'North East', category: 2, slug: 'north-east' },
  21: { name: 'East', category: 2, slug: 'east' },
  22: { name: 'South East', category: 2, slug: 'south-east' },
  23: { name: 'South', category: 2, slug: 'south' },
  24: { name: 'South West', category: 2, slug: 'south-west' },
  25: { name: 'West', category: 2, slug: 'west' },
  26: { name: 'North West', category: 2, slug: 'north-west' },

  // Condition Features (Category 3)
  27: { name: 'Excellent Condition', category: 3, slug: 'excellent-condition' },
  28: { name: 'Good Condition', category: 3, slug: 'good-condition' },
  29: { name: 'Fair Condition', category: 3, slug: 'fair-condition' },
  30: { name: 'Requires Renovation', category: 3, slug: 'requires-renovation' },
  31: { name: 'Recently Renovated', category: 3, slug: 'recently-renovated' },
  32: { name: 'Recently Refurbished', category: 3, slug: 'recently-refurbished' },

  // Pool Features (Category 4)
  33: { name: 'Communal Pool', category: 4, slug: 'pool-communal' },
  34: { name: 'Private Pool', category: 4, slug: 'pool-private' },
  35: { name: 'Indoor Pool', category: 4, slug: 'pool-indoor' },
  36: { name: 'Heated Pool', category: 4, slug: 'pool-heated' },
  37: { name: 'Room for Pool', category: 4, slug: 'pool-room-for' },
  38: { name: 'Children\'s Pool', category: 4, slug: 'pool-childrens' },

  // Amenities Features (Category 5)
  39: { name: 'Lift', category: 5, slug: 'lift' },
  40: { name: 'Satellite TV', category: 5, slug: 'satellite-tv' },
  41: { name: 'WiFi', category: 5, slug: 'wifi' },
  42: { name: 'Gym', category: 5, slug: 'gym' },
  43: { name: 'Sauna', category: 5, slug: 'sauna' },
  44: { name: 'Games Room', category: 5, slug: 'games-room' },
  45: { name: 'Paddle Court', category: 5, slug: 'paddle-court' },
  46: { name: 'Tennis Court', category: 5, slug: 'tennis-court' },
  47: { name: 'Jacuzzi', category: 5, slug: 'jacuzzi' },
  48: { name: 'Bar', category: 5, slug: 'bar' },
  49: { name: 'Barbeque Area', category: 5, slug: 'barbeque-area' },
  50: { name: 'Home Automation', category: 5, slug: 'home-automation' },
  51: { name: '24 Hour Reception', category: 5, slug: 'reception-24-hour' },
  52: { name: 'On-Site Restaurant', category: 5, slug: 'on-site-restaurant' },
  54: { name: 'Staff Accommodation', category: 5, slug: 'staff-accommodation' },

  // Climate Control Features (Category 6)
  55: { name: 'Pre-installed AC', category: 6, slug: 'pre-installed-ac' },
  56: { name: 'Ducted Central AC', category: 6, slug: 'ducted-central-ac' },
  57: { name: 'Hot/Cold AC Units', category: 6, slug: 'cold-hot-ac-units' },
  58: { name: 'Central Heating', category: 6, slug: 'central-heating' },
  59: { name: 'Fireplace', category: 6, slug: 'fireplace' },
  60: { name: 'Underfloor Heating', category: 6, slug: 'underfloor-heating' },
  61: { name: 'Heated Bathroom Floors', category: 6, slug: 'heated-bathroom-floors' },

  // Views Features (Category 7)
  62: { name: 'Sea Views', category: 7, slug: 'views-sea' },
  63: { name: 'Mountain Views', category: 7, slug: 'views-mountain' },
  64: { name: 'Golf Views', category: 7, slug: 'views-golf' },
  65: { name: 'Beach Views', category: 7, slug: 'views-beach' },
  66: { name: 'Marina Views', category: 7, slug: 'views-marina' },
  67: { name: 'Countryside Views', category: 7, slug: 'views-countryside' },
  68: { name: 'Panoramic Views', category: 7, slug: 'views-panoramic' },
  69: { name: 'Garden Views', category: 7, slug: 'views-garden' },
  70: { name: 'Pool Views', category: 7, slug: 'views-pool' },
  71: { name: 'Lake Views', category: 7, slug: 'views-lake' },
  72: { name: 'City Views', category: 7, slug: 'views-city' },
  73: { name: 'Ski Resort Views', category: 7, slug: 'views-ski-resort' },
  74: { name: 'Forest Views', category: 7, slug: 'views-forest' },

  // Interior Features (Category 8)
  75: { name: 'Private Terrace', category: 8, slug: 'private-terrace' },
  76: { name: 'Covered Terrace', category: 8, slug: 'covered-terrace' },
  77: { name: 'Solarium', category: 8, slug: 'solarium' },
  78: { name: 'Fitted Wardrobes', category: 8, slug: 'fitted-wardrobes' },
  79: { name: 'Guest Apartment', category: 8, slug: 'guest-apartment' },
  80: { name: 'Guest House', category: 8, slug: 'guest-house' },
  81: { name: 'Storage Room', category: 8, slug: 'storage-room' },
  82: { name: 'Utility Room', category: 8, slug: 'utility-room' },
  83: { name: 'Ensuite Bathroom', category: 8, slug: 'ensuite-bathroom' },
  84: { name: 'Urban Living', category: 15, slug: 'urban-living' },
  85: { name: 'Disabled Access', category: 8, slug: 'disabled-access' },
  86: { name: 'Marble Flooring', category: 8, slug: 'marble-flooring' },
  87: { name: 'Double Glazing', category: 8, slug: 'double-glazing' },
  88: { name: 'Stables', category: 8, slug: 'stables' },
  89: { name: 'Basement', category: 8, slug: 'basement' },
  90: { name: 'Fibre Internet', category: 8, slug: 'fibre-internet' },
  158: { name: 'Wooden Flooring', category: 8, slug: 'wooden-flooring' },

  // Furnishing Features (Category 9)
  91: { name: 'Fully Furnished', category: 9, slug: 'fully-furnished' },
  92: { name: 'Partially Furnished', category: 9, slug: 'partially-furnished' },
  93: { name: 'Unfurnished', category: 9, slug: 'unfurnished' },

  // Kitchen Features (Category 10)
  94: { name: 'Fully Equipped Kitchen', category: 10, slug: 'fully-equipped-kitchen' },
  95: { name: 'Partially Equipped Kitchen', category: 10, slug: 'partially-equipped-kitchen' },
  96: { name: 'Kitchen Not Equipped', category: 10, slug: 'kitchen-not-equipped' },
  97: { name: 'Open Plan Kitchen/Lounge', category: 10, slug: 'open-plan-kitchen-lounge' },

  // Garden Features (Category 11)
  98: { name: 'Communal Garden', category: 11, slug: 'garden-communal' },
  99: { name: 'Private Garden', category: 11, slug: 'garden-private' },
  100: { name: 'Landscaped Garden', category: 11, slug: 'garden-landscaped' },

  // Security Features (Category 12)
  101: { name: 'Gated Complex', category: 12, slug: 'gated-complex' },
  102: { name: 'Electric Blinds', category: 12, slug: 'electric-blinds' },
  103: { name: 'Entry Phone System', category: 12, slug: 'entry-phone-system' },
  104: { name: 'Alarm System', category: 12, slug: 'alarm-system' },
  155: { name: '24 Hour Security', category: 12, slug: 'security-24-hour' },

  // Parking Features (Category 13)
  131: { name: 'Underground Parking', category: 13, slug: 'parking-underground' },
  132: { name: 'Garage', category: 13, slug: 'garage' },
  133: { name: 'Covered Parking', category: 13, slug: 'parking-covered' },
  134: { name: 'Multiple Parking', category: 13, slug: 'parking-multiple' },
  135: { name: 'Communal Parking', category: 13, slug: 'parking-communal' },
  136: { name: 'Private Parking Space', category: 13, slug: 'parking-private-space' },

  // Utilities Features (Category 14)
  137: { name: 'All Electric Home', category: 14, slug: 'all-electric-home' },
  138: { name: 'Drinkable Water', category: 14, slug: 'drinkable-water' },
  139: { name: 'Private Well', category: 14, slug: 'private-well' },
  140: { name: 'Gas', category: 14, slug: 'gas' },
  141: { name: 'Solar Power', category: 14, slug: 'solar-power' },
  142: { name: 'Solar Water Heating', category: 14, slug: 'solar-water-heating' },
  143: { name: 'Smart Home', category: 14, slug: 'smart-home' },

  // Property Type Features (Category 15)
  144: { name: 'Distressed Property', category: 15, slug: 'distressed-property' },
  145: { name: 'Investment Opportunity', category: 15, slug: 'investment-opportunity' },
  146: { name: 'Luxury Property', category: 15, slug: 'luxury-property' },
  147: { name: 'Off Plan Project', category: 15, slug: 'off-plan-project' },
  148: { name: 'Bank Repossession', category: 15, slug: 'bank-repossession' },
  149: { name: 'New Development', category: 15, slug: 'new-development' },
  150: { name: 'With Planning Permission', category: 15, slug: 'with-planning-permission' },
  151: { name: 'Modern', category: 15, slug: 'modern' },
  152: { name: 'Rustic Style', category: 15, slug: 'style-rustic' },
  153: { name: 'Andalucian Style', category: 15, slug: 'style-andalucian' },
  154: { name: 'Historic Property', category: 15, slug: 'historic-property' },
  156: { name: 'Newly Built', category: 15, slug: 'newly-built' },
  157: { name: 'Suburban Area', category: 15, slug: 'suburban-area' }
};

// Province mapping (to be added when codes are provided)
const PROVINCES = {
  // TODO: Add province codes when provided
  // Example: 1: 'Madrid', 2: 'Barcelona', etc.
};

class FeatureMappingService {
  /**
   * Get feature by ID
   */
  static getFeature(featureId) {
    const feature = FEATURES[featureId];
    if (!feature) {
      return null;
    }

    return {
      id: featureId,
      name: feature.name,
      slug: feature.slug,
      category: feature.category,
      categoryName: FEATURE_CATEGORIES[feature.category]
    };
  }

  /**
   * Get multiple features by IDs
   */
  static getFeatures(featureIds) {
    if (!Array.isArray(featureIds)) {
      return [];
    }

    return featureIds
      .map(id => this.getFeature(id))
      .filter(feature => feature !== null);
  }

  /**
   * Get features grouped by category
   */
  static getFeaturesGrouped(featureIds) {
    const features = this.getFeatures(featureIds);
    const grouped = {};

    features.forEach(feature => {
      const categoryName = feature.categoryName;
      if (!grouped[categoryName]) {
        grouped[categoryName] = [];
      }
      grouped[categoryName].push(feature);
    });

    return grouped;
  }

  /**
   * Get province name by code
   */
  static getProvince(provinceCode) {
    return PROVINCES[provinceCode] || `Province ${provinceCode}`;
  }

  /**
   * Search features by name
   */
  static searchFeatures(searchTerm) {
    const term = searchTerm.toLowerCase();
    const results = [];

    Object.entries(FEATURES).forEach(([id, feature]) => {
      if (feature.name.toLowerCase().includes(term) || 
          feature.slug.includes(term)) {
        results.push(this.getFeature(parseInt(id)));
      }
    });

    return results;
  }

  /**
   * Get all features in a category
   */
  static getFeaturesByCategory(categoryId) {
    const results = [];

    Object.entries(FEATURES).forEach(([id, feature]) => {
      if (feature.category === categoryId) {
        results.push(this.getFeature(parseInt(id)));
      }
    });

    return results;
  }

  /**
   * Get all categories
   */
  static getCategories() {
    return FEATURE_CATEGORIES;
  }
}

module.exports = {
  FeatureMappingService,
  FEATURES,
  FEATURE_CATEGORIES,
  PROVINCES
}; 