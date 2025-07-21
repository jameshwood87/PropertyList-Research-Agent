export interface PropertyData {
  id?: string // Unique property identifier for exclusion from comparable searches
  refNumber?: string // Unique reference number from property feed
  address: string
  city: string
  province: string
  areaCode?: string // Area code instead of zipCode
  propertyType: string
  bedrooms: number
  bathrooms: number
  totalAreaM2?: number // Not used - XML feed only provides buildArea, plotArea, terraceAreaM2
  buildArea?: number // Build area in m²
  plotArea?: number // Plot area in m²
  terraceAreaM2?: number // Terrace/balcony area in m²
  build?: number // Build area in m² (XML feed field name)
  terrace?: number // Terrace area in m² (XML feed field name)
  plot?: number // Plot area in m² (XML feed field name)
  size?: number // Size in square meters (for backward compatibility)
  squareFootage?: number // Legacy field for backward compatibility
  lotSize?: string
  yearBuilt?: number
  condition?: 'excellent' | 'good' | 'fair' | 'needs work' | 'renovation project' | 'rebuild'
  architecturalStyle?: 'modern' | 'rustic' | 'andalusian' | 'contemporary' | 'traditional' | 'mediterranean' | 'colonial' | 'minimalist' | 'classic'
  features: string[]
  description?: string
  price?: number
  dateListed?: string
  image?: string // Single primary image URL (for backward compatibility)
  images?: string[] // Array of image URLs for gallery
  
  // Rental-specific fields
  isSale?: boolean
  isShortTerm?: boolean
  isLongTerm?: boolean
  // Database field names (for compatibility with XML feed data)
  is_sale?: boolean
  is_short_term?: boolean
  is_long_term?: boolean
  monthlyPrice?: number // Long term rental price per month in Euros
  weeklyPriceFrom?: number // Low season price per week in Euros
  weeklyPriceTo?: number // High season price per week in Euros
  rentalDeposit?: number // Long term rental deposit in Euros
  rentalCommission?: number // Long term rental commission in Euros
  propertyTax?: number // Property tax (IBI) per year in Euros
  garbageTax?: number // Garbage tax (Basura) per year in Euros
  communityFees?: number // Community fees per month in Euros
  availableFrom?: string // Date the long term rental is available from (YYYY-MM-DD)
  sleeps?: number // Number of people the holiday rental is suited for
  furnished?: boolean // Is the property offered for rent furnished?
  
  // Additional XML fields
  parkingSpaces?: number // Number of parking spaces
  floorNumber?: number // Floor number (0 = ground floor)
  latitude?: number // Latitude coordinate
  longitude?: number // Longitude coordinate
  energyRating?: string // Energy rating (A, B, C, D, E, F, G)
  orientation?: string // Property orientation
  freehold?: boolean // Is the property available as freehold?
  leasehold?: boolean // Is the property available as leasehold?
  urbanization?: string // Urbanization name
  lastUpdatedAt?: string // Last updated timestamp
  direct?: boolean // Is this a direct listing?
  
  // AI enhancement fields
  aiAnalysisDate?: string // Date when AI analysis was performed
  aiConfidence?: number // Confidence score of AI analysis (0-100)
  streetName?: string // Street name extracted by AI
  suburb?: string // Suburb/neighborhood extracted by AI
  zone?: string // Zone/area extracted by AI
  renovationNeeds?: string[] // Renovation needs identified by AI
  propertyFeatures?: string[] // Additional features extracted by AI
  viewType?: string[] // View types identified by AI
  energyEfficiency?: string // Energy efficiency info extracted by AI
  marketPosition?: 'premium' | 'high-end' | 'mid-range' | 'affordable' // Market position assessed by AI
  investmentPotential?: 'excellent' | 'good' | 'fair' | 'poor' // Investment potential assessed by AI
  rentalYield?: number // Estimated rental yield calculated by AI
  extractedKeywords?: string[] // Keywords extracted from description by AI
}

export interface ApiStatus {
  name: string
  status: 'online' | 'offline' | 'checking'
  lastChecked: Date
}

export interface ProgressStep {
  id: string
  title: string
  description: string
  completed: boolean
  current: boolean
  emoji: string
}

export interface CMAReport {
  propertyData: PropertyData
  summary: PropertySummary
  marketTrends: MarketTrends
  comparableProperties: Comparable[]
  comparablePropertiesTotal?: number // Total number of comparable properties found before limiting to top 12
  nearbyAmenities: Amenity[]
  futureDevelopment: Development[]
  walkabilityData?: WalkabilityData
  valuationEstimate: ValuationEstimate
  coordinates?: {
    lat: number
    lng: number
  }
  reportDate: string
}

export interface PropertySummary {
  overview: string
  keyFeatures: string[]
  marketPosition: string
  investmentPotential: string
  amenitiesSummary: string
  locationOverview: string
  amenitiesAnalysis: string
  lifestyleAssessment: string
  propertyCondition?: string
  architecturalAnalysis?: string
  marketTiming?: string
  walkabilityInsights?: string
  developmentImpact?: string
  comparableInsights?: string
  investmentTiming?: string
  riskAssessment?: string
}

export interface MarketTrends {
  averagePrice: number
  medianPrice: number
  averagePricePerM2: number // Price per square meter (€/m²)
  daysOnMarket: number
  marketTrend: 'up' | 'down' | 'stable'
  inventory: number
  priceChange6Month: number
  priceChange12Month: number
  seasonalTrends: string
  // Real historical price data
  historicalData?: HistoricalPriceData[]
  dataSource: 'web_research' | 'xml_feed' | 'hybrid' | 'official_spanish' | 'historical_accumulated'
  dataQuality: 'high' | 'medium' | 'low'
  officialSources?: string[] // List of official Spanish sources used
  lastUpdated: string
}

export interface HistoricalPriceData {
  year: string
  price: number // Average price per m² for that year
  source: string // Source of the data
  confidence: 'high' | 'medium' | 'low' // Confidence level in this data point
  dataPoints?: number // Number of actual sales data points for this year
}

export interface Comparable {
  address: string
  price: number
  m2: number // Primary area value (build, plot, or terrace area)
  bedrooms: number
  bathrooms: number
  saleDate: string
  distance: number
  pricePerM2: number
  propertyType: string
  daysOnMarket: number
  adjustedPrice: number
  // Property condition (critical for accurate comparison)
  condition?: 'excellent' | 'good' | 'fair' | 'needs work' | 'renovation project' | 'rebuild'
  // Property age and timing (critical for market analysis)
  yearBuilt?: number // Year the property was built
  listingDate?: string // When the property was listed for sale/rent
  lastUpdated?: string // When the listing was last updated
  // Property images
  images?: string[] // Array of image URLs for the comparable property
  // Area details (camelCase for frontend compatibility)
  buildArea?: number // Build area in m²
  plotArea?: number // Plot area in m²
  terraceArea?: number // Terrace/balcony area in m²
  areaType?: 'build' | 'plot' | 'terrace' // Which area type is being used for comparison
  displayArea?: number // The actual area value being used for display/comparison
  features?: string[] // Property features
  // Reference number for display
  refNumber?: string // Reference number from the property feed
  // Enhanced price history and analysis data
  priceHistory?: Array<{
    price: number
    date: string
    source: string
    change?: number // Price change from previous entry
    changePercent?: number // Price change percentage
  }>
  priceTrend?: {
    trend: number // Combined trend percentage
    direction: 'up' | 'down' | 'stable'
    shortTerm: number // Last 3-6 months trend
    longTerm: number // Full history trend
    volatility: number // Price volatility score
  }
  // Market position indicators
  marketPosition?: {
    percentileInArea: number // Where this property ranks in the area (0-100)
    daysOnMarketVsAverage: number // How property's DOM compares to area average
    priceVsAreaAverage: number // How property price compares to area average
  }
  // Location relevance scoring for comparable search
  locationScore?: number // Score indicating location relevance (higher = more relevant)
}

export interface Amenity {
  name: string
  type: 'school' | 'shopping' | 'transport' | 'healthcare' | 'recreation' | 'dining' | 'entertainment' | 'zoo' | 'waterpark' | 'cinema' | 'casino' | 'museum' | 'golf' | 'beach'
  distance: number
  rating?: number
  description: string
  coordinates?: {
    lat: number
    lng: number
  }
}

export interface Development {
  project: string
  type: 'residential' | 'commercial' | 'infrastructure' | 'mixed'
  status: 'planned' | 'approved' | 'under_construction' | 'completed'
  completionDate: string
  impact: 'positive' | 'negative' | 'neutral'
  description: string
  reputationRating: 'excellent' | 'good' | 'fair' | 'poor' // Source reputation rating
  sourceType: 'official' | 'news' | 'commercial' | 'other' // Type of source
}

export interface ValuationEstimate {
  low: number
  high: number
  estimated: number
  confidence: number
  methodology: string
  adjustments: ValuationAdjustment[]
}

export interface ValuationAdjustment {
  factor: string
  adjustment: number
  reasoning: string
}

export interface MobilityData {
  walkingScore: number
  walkingDescription: string
  drivingScore: number
  drivingDescription: string
  transitScore: number
  transitDescription: string
  accessibilityScore: number
  averageWalkTime: number
  averageDriveTime: number
  reachableDestinations: number
  walkableDestinations: number
  transitAccessibleDestinations: number
  dataSource: string
  coordinates: {
    lat: number
    lng: number
  }
}

// Legacy interface for backward compatibility
export interface WalkabilityData extends MobilityData {
  walkScore?: number
  walkDescription?: string
  bikeScore?: number
  bikeDescription?: string
}

// Legacy interfaces for backward compatibility
export interface MarketAnalysis {
  averagePrice: number
  medianPrice: number
  averagePricePerM2: number // Price per square meter (€/m²)
  daysOnMarket: number
  marketTrend: 'up' | 'down' | 'stable'
  inventory: number
}

export interface ValuationRange {
  low: number
  high: number
  estimated: number
  confidence: number
} 