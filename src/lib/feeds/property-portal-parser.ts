// Property Portal XML Feed Parser
import { PropertyData } from '@/types'
import { parseString } from 'xml2js'
import { getProvinceNameFromCode } from '../province-codes'

// Updated interfaces for PropertyList.es XML format  
export interface PropertyListProperty {
  // Direct attributes (not in $ object)
  created_at?: string[]
  last_updated_at?: string[]
  direct?: string[]
  
  // Property fields
  reference: string[]
  is_sale?: string[]
  is_short_term?: string[]
  is_long_term?: string[]
  property_type: string[]
  bedrooms: string[]
  bathrooms: string[]
  parking_spaces?: string[]
  province: string[]
  city: string[]
  suburb?: string[]
  urbanization?: string[]
  build_size: string[]
  terrace_size?: string[]
  plot_size?: string[]
  floor_number?: string[]
  orientation?: string[]
  sale_price?: string[]
  rental_price?: string[]
  monthly_price?: string[]
  weekly_price_from?: string[]
  weekly_price_to?: string[]
  rental_deposit?: string[]
  rental_commission?: string[]
  property_tax?: string[]
  garbage_tax?: string[]
  community_fees?: string[]
  available_from?: string[]
  sleeps?: string[]
  furnished?: string[]
  energy_rating?: string[]
  freehold?: string[]
  leasehold?: string[]
  descriptions?: {
    description?: {
      language: string[]
      text: string[]
    }[]
  }[]
  photos?: {
    photo?: {
      $: { main?: string }
      _: string
    }[]
  }[]
  features?: {
    feature?: string[]
  }[]
  location?: {
    latitude?: string[]
    longitude?: string[]
  }[]
}

export interface PropertyListXMLFeed {
  properties: {
    $: {
      type: string
      version: string
      created_at: string
    }
    property: PropertyListProperty[]
  }
}

// Legacy interface for backwards compatibility  
export interface PropertyPortalProperty extends PropertyListProperty {}
export interface PropertyPortalXMLFeed extends PropertyListXMLFeed {}

// --- Feature Code Mapping Table (from PropertyList XML spec) ---
const FEATURE_CODE_MAP: Record<string, string> = {
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
}

export class PropertyPortalParser {
  
  // Parse XML feed from Property Portal
  public static async parseXMLFeed(xmlData: string): Promise<PropertyData[]> {
    try {
      console.log('Parsing XML feed data...')
      const xmlFeed = await this.parseXML(xmlData)
      const properties = await this.convertToPropertyData(xmlFeed)
      
      // Validate and filter properties
      const validProperties = properties.filter(property => this.validatePropertyData(property))
      
      console.log(`Parsed ${properties.length} properties, ${validProperties.length} valid`)
      return validProperties
    } catch (error) {
      console.error('Error parsing XML feed:', error)
      return []
    }
  }

  private static parseXML(xmlData: string): Promise<PropertyPortalXMLFeed> {
    return new Promise((resolve, reject) => {
      parseString(xmlData, {
        explicitArray: true,
        mergeAttrs: true,
        normalize: true,
        normalizeTags: false, // Keep original tag case to match interface
        trim: true
      }, (err, result) => {
        if (err) {
          reject(err)
        } else {
          resolve(result)
        }
      })
    })
  }

  private static async convertToPropertyData(xmlFeed: PropertyPortalXMLFeed): Promise<PropertyData[]> {
    const properties: PropertyData[] = []

    console.log(`Processing ${xmlFeed.properties.property.length} properties from XML feed`)

    for (const xmlProperty of xmlFeed.properties.property) {
      try {
        const propertyData = await this.convertSingleProperty(xmlProperty)
        if (propertyData) {
          properties.push(propertyData)
        }
      } catch (error) {
        console.warn('Error converting property:', xmlProperty.reference?.[0] || 'Unknown', error)
        // Continue processing other properties
      }
    }

    console.log(`Successfully parsed ${properties.length} properties from XML feed`)
    return properties
  }

  private static async convertSingleProperty(xmlProperty: PropertyPortalProperty): Promise<PropertyData | null> {
    try {
      // Extract basic property information
      const city = this.extractString(xmlProperty.city)
      const province = this.extractString(xmlProperty.province) 
      const suburb = this.extractString(xmlProperty.suburb)
      const urbanization = this.extractString(xmlProperty.urbanization)
      
      if (!city || !province) {
        console.warn('Missing required location data for property:', xmlProperty.reference?.[0])
        return null
      }

      // Extract property type first (needed for validation)
      const propertyTypeRaw = this.extractString(xmlProperty.property_type)
      const propertyType = this.normalizePropertyType(propertyTypeRaw)
      if (!propertyType) {
        console.warn('Missing or invalid property type for property:', xmlProperty.reference?.[0])
        return null
      }

      // Extract rental/sale flags
      let isSale = this.extractBoolean(xmlProperty.is_sale)
      let isShortTerm = this.extractBoolean(xmlProperty.is_short_term)
      let isLongTerm = this.extractBoolean(xmlProperty.is_long_term)
      
      // Extract numeric values - handle both sale and rental properties
      const salePrice = this.extractNumber(xmlProperty.sale_price)
      const monthlyPrice = this.extractNumber(xmlProperty.monthly_price)
      const weeklyPriceFrom = this.extractNumber(xmlProperty.weekly_price_from)
      const weeklyPriceTo = this.extractNumber(xmlProperty.weekly_price_to)
      const rentalPrice = this.extractNumber(xmlProperty.rental_price) // Fallback if exists
      const price = salePrice || monthlyPrice || weeklyPriceFrom || rentalPrice
      
      // Auto-infer transaction type if flags are not set
      if (isSale === undefined && isShortTerm === undefined && isLongTerm === undefined) {
        if (salePrice && salePrice > 0) {
          isSale = true;
          isShortTerm = false;
          isLongTerm = false;
        } else if (weeklyPriceFrom && weeklyPriceFrom > 0) {
          isSale = false;
          isShortTerm = true;
          isLongTerm = false;
        } else if (monthlyPrice && monthlyPrice > 0) {
          isSale = false;
          isShortTerm = false;
          isLongTerm = true;
        } else if (rentalPrice && rentalPrice > 0) {
          isSale = false;
          isShortTerm = false;
          isLongTerm = true;
        } else {
          // Default to sale if no clear indication
          isSale = true;
          isShortTerm = false;
          isLongTerm = false;
        }
      }
      
      // Extract area data - these are the key fields that were missing
      const buildArea = this.extractNumber(xmlProperty.build_size)
      const plotArea = this.extractNumber(xmlProperty.plot_size)
      const terraceAreaM2 = this.extractNumber(xmlProperty.terrace_size)
      const bedrooms = this.extractNumber(xmlProperty.bedrooms) || 0
      const bathrooms = this.extractNumber(xmlProperty.bathrooms) || 0
      const parkingSpaces = this.extractNumber(xmlProperty.parking_spaces) || 0
      const floorNumber = this.extractNumber(xmlProperty.floor_number)
      
      // Extract location data
      const latitude = this.extractNumber(xmlProperty.location?.[0]?.latitude)
      const longitude = this.extractNumber(xmlProperty.location?.[0]?.longitude)
      
      // Extract rental-specific fields
      const rentalDeposit = this.extractNumber(xmlProperty.rental_deposit)
      const rentalCommission = this.extractNumber(xmlProperty.rental_commission)
      const propertyTax = this.extractNumber(xmlProperty.property_tax)
      const garbageTax = this.extractNumber(xmlProperty.garbage_tax)
      const communityFees = this.extractNumber(xmlProperty.community_fees)
      const sleeps = this.extractNumber(xmlProperty.sleeps)
      const furnished = this.extractBoolean(xmlProperty.furnished)
      const availableFrom = this.extractString(xmlProperty.available_from)
      
      // Extract additional property details
      const energyRating = this.extractString(xmlProperty.energy_rating)
      const orientation = this.extractString(xmlProperty.orientation)
      const freehold = this.extractBoolean(xmlProperty.freehold)
      const leasehold = this.extractBoolean(xmlProperty.leasehold)
      
      // Extract timestamps
      const createdAt = this.extractString(xmlProperty.created_at)
      const lastUpdatedAt = this.extractString(xmlProperty.last_updated_at)
      const direct = this.extractBoolean(xmlProperty.direct)

      // Area validation: require at least one valid area measurement
      const isPlot = propertyTypeRaw?.toLowerCase() === 'plot'
      // Check for at least one area measurement (build, plot, or terrace)
      const hasAnyArea = (buildArea && buildArea > 0) || (plotArea && plotArea > 0) || (terraceAreaM2 && terraceAreaM2 > 0)
      
      // More lenient validation: allow properties with descriptions even if missing price/area
      const hasDescription = xmlProperty.descriptions?.[0]?.description?.length > 0
      
      if (!price && !hasDescription) {
        console.warn('Missing required data for property:', xmlProperty.reference?.[0], 
          `price: ${price}, hasDescription: ${hasDescription}, type: ${propertyTypeRaw}`)
        return null
      }
      
      // For properties without area data, use reasonable defaults based on property type
      let finalBuildArea = buildArea
      let finalPlotArea = plotArea
      let finalTerraceArea = terraceAreaM2
      
      if (!hasAnyArea && hasDescription) {
        // Estimate area based on property type for AI enhancement
        switch (propertyType?.toLowerCase()) {
          case 'apartment':
            finalBuildArea = 80 // Default apartment size
            break
          case 'villa':
            finalBuildArea = 200 // Default villa size
            finalPlotArea = 500 // Default plot size
            break
          case 'penthouse':
            finalBuildArea = 120 // Default penthouse size
            break
          case 'townhouse':
            finalBuildArea = 150 // Default townhouse size
            break
          default:
            finalBuildArea = 100 // Default size
        }
        console.log(`📏 Using estimated area for property ${xmlProperty.reference?.[0]}: ${finalBuildArea}m²`)
      }
      
      // Extract and process features
      let features: string[] = []
      try {
        features = this.extractFeaturesFromPropertyListXML(xmlProperty.features)
      } catch (error) {
        console.warn('Feature parsing error for property:', xmlProperty.reference?.[0], error.message)
        features = []
      }
      
      // Extract description - prefer English, fallback to Spanish
      let description = ''
      try {
        const descriptions = xmlProperty.descriptions?.[0]?.description || []
        const englishDesc = descriptions.find(d => d.language?.[0] === 'en')
        const spanishDesc = descriptions.find(d => d.language?.[0] === 'es')
        description = (englishDesc?.text?.[0] || spanishDesc?.text?.[0] || '').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
        

      } catch (error) {
        // Description parsing is not critical, continue with empty description
        console.warn('Description parsing error for property:', xmlProperty.reference?.[0], error.message)
        description = ''
      }
      
      // Extract images
      let images: string[] = []
      try {
        images = this.extractImagesFromPropertyListXML(xmlProperty.photos)
        if (images.length > 0) {
          console.log(`📸 Extracted ${images.length} images for property ${xmlProperty.reference?.[0]}:`, images[0])
        } else {
          console.log(`📸 No images found for property ${xmlProperty.reference?.[0]}`)
        }
      } catch (error) {
        console.warn('Image parsing error for property:', xmlProperty.reference?.[0], error.message)
        images = []
      }
      const mainImage = images.length > 0 ? images[0] : undefined

      // Construct address
      const addressParts = [suburb, urbanization, city, province].filter(Boolean)
      const address = addressParts.join(', ')

      // Create PropertyData object with all extracted fields
      const propertyData: PropertyData = {
        refNumber: this.extractString(xmlProperty.reference)?.trim(),
        address: address,
        city: city.trim(),
        province: this.expandProvinceCode(province.trim()), // Expand MA -> Málaga, etc.
        areaCode: undefined, // Not available in this format
        propertyType,
        bedrooms,
        bathrooms,
        totalAreaM2: undefined, // Not used - XML feed only provides buildArea, plotArea, terraceAreaM2
        buildArea: finalBuildArea,
        plotArea: finalPlotArea,
        terraceAreaM2: finalTerraceArea,
        condition: undefined, // Not available in this XML format
        architecturalStyle: undefined, // Not available in this XML format
        features,
        description: description?.trim(),
        price,
        yearBuilt: undefined, // Not available in this format
        dateListed: createdAt,
        image: mainImage,
        images,
        
        // Rental-specific fields
        isSale,
        isShortTerm,
        isLongTerm,
        monthlyPrice,
        weeklyPriceFrom,
        weeklyPriceTo,
        rentalDeposit,
        rentalCommission,
        propertyTax,
        garbageTax,
        communityFees,
        availableFrom,
        sleeps,
        furnished,
        
        // Additional extracted fields
        parkingSpaces,
        floorNumber,
        latitude,
        longitude,
        energyRating,
        orientation,
        freehold,
        leasehold,
        urbanization,
        lastUpdatedAt,
        direct
      }

      return propertyData
    } catch (error) {
      console.warn('Error converting property:', xmlProperty.reference?.[0] || 'Unknown', error)
      return null
    }
  }

  // Helper methods for data extraction and normalization

  private static extractString(field: string[] | undefined): string | undefined {
    return field?.[0]?.toString().trim() || undefined
  }

  private static extractNumber(field: string[] | undefined): number | undefined {
    const value = this.extractString(field)
    if (!value) return undefined
    
    // Clean the string (remove commas, currency symbols, etc.)
    const cleanValue = value.replace(/[€$,\s]/g, '')
    const num = parseFloat(cleanValue)
    
    return isNaN(num) ? undefined : num
  }

  private static extractBoolean(field: string[] | undefined): boolean | undefined {
    const value = this.extractString(field)
    if (!value) return undefined
    
    const lowerValue = value.toLowerCase().trim()
    return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes'
  }

  private static extractDate(field: string[] | undefined): string {
    const dateStr = this.extractString(field)
    if (!dateStr) return new Date().toISOString()
    
    try {
      // Try to parse the date - adjust format based on actual feed format
      const date = new Date(dateStr)
      return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
    } catch {
      return new Date().toISOString()
    }
  }

  private static extractFeatures(field: string[] | undefined): string[] {
    if (!field) return []
    
    const featuresStr = this.extractString(field)
    if (!featuresStr) return []
    
    // Split by common delimiters and clean up
    return featuresStr
      .split(/[,;|\n]/)
      .map(f => f.trim())
      .filter(f => f.length > 0)
      .slice(0, 20) // Limit to 20 features max
  }

  private static extractImages(imagesField: { Image?: string[] }[] | undefined, mainImage?: string): string[] {
    const images: string[] = []
    
    // Add main image first if it exists
    if (mainImage) {
      images.push(mainImage)
    }
    
    // Add additional images
    if (imagesField && Array.isArray(imagesField)) {
      for (const imageGroup of imagesField) {
        if (imageGroup.Image && Array.isArray(imageGroup.Image)) {
          for (const imageUrl of imageGroup.Image) {
            const cleanUrl = imageUrl.trim()
            if (cleanUrl && !images.includes(cleanUrl)) {
              images.push(cleanUrl)
            }
          }
        }
      }
    }
    
    return images.slice(0, 10) // Limit to 10 images max
  }

  private static normalizePropertyType(type: string | undefined): string | undefined {
    if (!type) return 'Unknown'
    const normalized = type.toLowerCase().trim()
    // Map Property Portal property types to standard types (from XML spec)
    const typeMapping: Record<string, string> = {
      'apartment': 'Apartment',
      'country-house': 'Country House',
      'penthouse': 'Penthouse',
      'plot': 'Plot',
      'townhouse': 'Townhouse',
      'villa': 'Villa',
      'office': 'Office',
      'business': 'Business',
      'cafe': 'Cafe',
      'bar': 'Bar',
      'restaurant': 'Restaurant',
      'retail': 'Retail',
      'shop': 'Shop',
      'hotel': 'Hotel',
      'leisure': 'Leisure',
      'industrial': 'Industrial',
      'warehouse': 'Warehouse',
      'commercial-land': 'Commercial Land',
      'development': 'Development',
      // legacy/extra
      'flat': 'Apartment',
      'house': 'House',
      'duplex': 'Duplex',
      'studio': 'Studio',
      'bungalow': 'Bungalow',
      'commercial': 'Commercial',
      'garage': 'Garage'
    }
    if (typeMapping[normalized]) {
      return typeMapping[normalized]
    } else {
      // Debug log for unknown types
      if (typeof console !== 'undefined') {
        console.warn('[PropertyPortalParser] Unknown property_type code:', type)
      }
      return 'Unknown'
    }
  }

  private static normalizeCondition(condition: string | undefined): PropertyData['condition'] {
    if (!condition) return undefined
    
    const normalized = condition.toLowerCase().trim()
    
    // Map Property Portal conditions to standard conditions
    const conditionMapping: Record<string, PropertyData['condition']> = {
      'excellent': 'excellent',
      'very good': 'excellent',
      'good': 'good',
      'fair': 'fair',
      'needs work': 'needs work',
      'needs renovation': 'needs work',
      'renovation project': 'renovation project',
      'to renovate': 'renovation project',
      'rebuild': 'rebuild',
      'new': 'excellent',
      'brand new': 'excellent'
    }

    for (const [key, value] of Object.entries(conditionMapping)) {
      if (normalized.includes(key)) {
        return value
      }
    }
    
    return 'good' // Default condition
  }

  private static normalizeArchitecturalStyle(style: string | undefined): PropertyData['architecturalStyle'] {
    if (!style) return undefined
    
    const normalized = style.toLowerCase().trim()
    
    // Map Property Portal styles to standard styles
    const styleMapping: Record<string, PropertyData['architecturalStyle']> = {
      'modern': 'modern',
      'contemporary': 'contemporary',
      'traditional': 'traditional',
      'rustic': 'rustic',
      'andalusian': 'andalusian',
      'mediterranean': 'mediterranean',
      'colonial': 'colonial',
      'minimalist': 'minimalist',
      'classic': 'classic'
    }

    for (const [key, value] of Object.entries(styleMapping)) {
      if (normalized.includes(key)) {
        return value
      }
    }
    
    return 'modern' // Default style
  }

  // Validate parsed property data
  public static validatePropertyData(property: PropertyData): boolean {
    // Check required fields
    if (!property.address || !property.city || !property.province) {
      return false
    }
    
    if (!property.propertyType || property.bedrooms < 0 || property.bathrooms < 0) {
      return false
    }
    
    // Check for at least one area measurement (build, plot, or terrace)
    const hasAnyArea = (property.buildArea && property.buildArea > 0) || 
                      (property.plotArea && property.plotArea > 0) || 
                      (property.terraceAreaM2 && property.terraceAreaM2 > 0)
    
    if (!hasAnyArea) {
      return false
    }
    
    if (!property.price || property.price <= 0) {
      return false
    }
    
    return true
  }

  // Extract features from PropertyList.es XML format and map to human-readable strings
  private static extractFeaturesFromPropertyListXML(featuresXml: { feature?: string[] }[] | undefined): string[] {
    if (!featuresXml || featuresXml.length === 0) {
      return []
    }
    const features: string[] = []
    for (const featureGroup of featuresXml) {
      if (featureGroup.feature) {
        for (const feature of featureGroup.feature) {
          if (feature && feature.trim().length > 0) {
            const code = feature.trim()
            features.push(FEATURE_CODE_MAP[code] || code)
          }
        }
      }
    }
    return features
  }

  // Extract images from PropertyList.es XML format
  private static extractImagesFromPropertyListXML(photosXml: { photo?: { $: { main?: string }, _: string }[] }[] | undefined): string[] {
    if (!photosXml || photosXml.length === 0) {
      return []
    }
    
    const images: string[] = []
    for (const photoGroup of photosXml) {
      if (photoGroup.photo) {
        for (const photo of photoGroup.photo) {
          // The image URL is in the CDATA content (photo._)
          if (photo._ && photo._.trim().length > 0) {
            const imageUrl = photo._.trim()
            // Clean up the URL if it contains CDATA markers
            const cleanUrl = imageUrl.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim()
            if (cleanUrl && cleanUrl.length > 0) {
              images.push(cleanUrl)
            }
          }
        }
      }
    }
    
    return images
  }

  // Expand province codes to full names using comprehensive mapping
  private static expandProvinceCode(provinceCode: string): string {
    return getProvinceNameFromCode(provinceCode)
  }

  // Legacy method for backwards compatibility
  private static extractFeaturesFromResalesXML(featuresXml: { characteristic?: string[] }[] | undefined): string[] {
    return this.extractFeaturesFromPropertyListXML(featuresXml as any)
  }

  // Legacy method for backwards compatibility  
  private static extractImagesFromResalesXML(imagesXml: any): string[] {
    return this.extractImagesFromPropertyListXML(imagesXml)
  }

  // Get parser statistics
  public static getParserInfo(): {
    name: string
    version: string
    supportedTypes: string[]
    supportedConditions: string[]
    supportedStyles: string[]
  } {
    return {
      name: 'Property Portal Parser',
      version: '1.0.0',
      supportedTypes: [
        'Apartment', 'Penthouse', 'Villa', 'House', 'Townhouse', 
        'Duplex', 'Studio', 'Bungalow', 'Commercial', 'Plot', 'Garage'
      ],
      supportedConditions: [
        'excellent', 'good', 'fair', 'needs work', 'renovation project', 'rebuild'
      ],
      supportedStyles: [
        'modern', 'contemporary', 'traditional', 'rustic', 'andalusian', 
        'mediterranean', 'colonial', 'minimalist', 'classic'
      ]
    }
  }
} 