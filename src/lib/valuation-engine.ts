import { PropertyData, Comparable, Amenity, Development } from '../types'
import { MarketDataFromFeed } from './api-services'

export interface ComprehensiveValuation {
  marketValue: number
  confidence: number
  methodology: string
  breakdown: {
    baseValue: number
    locationAdjustment: number
    propertyAdjustments: number
    marketTrendAdjustment: number
    amenityAdjustment: number
    developmentAdjustment: number
  }
  factors: ValuationFactor[]
  comparableAnalysis: ComparableAnalysis
  marketPosition: MarketPosition
  valuationRange: {
    conservative: number
    marketValue: number
    optimistic: number
  }
  conditionAssessment: {
    condition: string
    impact: number
    reasoning: string
  }
  valuationRecommendation: {
    status: 'overpriced' | 'undervalued' | 'fairly_priced'
    percentage: number
    recommendation: string
    action: string
    urgency: 'high' | 'medium' | 'low'
  }
}

export interface ValuationFactor {
  factor: string
  adjustment: number
  percentage: number
  reasoning: string
}

interface ComparableAnalysis {
  usedComparables: number
  averagePrice: number
  medianPrice: number
  priceRange: { min: number; max: number }
  pricePerM2: number
  daysOnMarket: number
  conditionBreakdown: {
    excellent: number
    good: number
    fair: number
    needsWork: number
  }
  featureAnalysis: {
    premiumFeatures: string[]
    missingFeatures: string[]
    featureValue: number
  }
}

interface MarketPosition {
  percentile: number // 0-100, where 50 is average
  competitiveness: 'high' | 'medium' | 'low'
  marketTiming: 'favorable' | 'neutral' | 'unfavorable'
}

export class ValuationEngine {
  
  /**
   * Calculate comprehensive market value based on multiple factors
   */
  public async calculateMarketValue(
    propertyData: PropertyData,
    comparables: Comparable[],
    marketData: MarketDataFromFeed | null,
    amenities: Amenity[],
    developments: Development[]
  ): Promise<ComprehensiveValuation> {
    
    // Step 1: Analyze property condition and get AI assessment
    const conditionAssessment = await this.analyzePropertyCondition(propertyData)
    
    // Step 2: Calculate base value from comparable properties with condition weighting
    const baseValue = this.calculateBaseValue(propertyData, comparables, conditionAssessment)
    
    // Step 3: Apply property-specific adjustments
    const propertyAdjustments = this.calculatePropertyAdjustments(propertyData, comparables, conditionAssessment)
    
    // Step 4: Apply location adjustments
    const locationAdjustment = this.calculateLocationAdjustment(propertyData, amenities)
    
    // Step 5: Apply market trend adjustments
    const marketTrendAdjustment = this.calculateMarketTrendAdjustment(marketData, comparables)
    
    // Step 6: Apply amenity adjustments
    const amenityAdjustment = this.calculateAmenityAdjustment(amenities)
    
    // Step 7: Apply development impact
    const developmentAdjustment = this.calculateDevelopmentAdjustment(developments)
    
    // Step 8: Calculate final market value
    const totalAdjustment = propertyAdjustments + locationAdjustment + marketTrendAdjustment + amenityAdjustment + developmentAdjustment
    const marketValue = Math.round(baseValue * (1 + totalAdjustment))
    
    // Step 9: Calculate confidence and methodology
    const confidence = this.calculateConfidence(comparables, marketData, amenities, conditionAssessment)
    const methodology = this.generateMethodology(comparables, marketData, conditionAssessment)
    
    // Step 10: Generate valuation factors
    const factors = this.generateValuationFactors(
      baseValue,
      propertyAdjustments,
      locationAdjustment,
      marketTrendAdjustment,
      amenityAdjustment,
      developmentAdjustment,
      comparables,
      marketData
    )
    
    // Step 11: Analyze comparables
    const comparableAnalysis = this.analyzeComparables(comparables, propertyData)
    
    // Step 12: Determine market position
    const marketPosition = this.determineMarketPosition(propertyData, comparables, marketData)
    
    // Step 13: Calculate valuation range
    const valuationRange = this.calculateValuationRange(marketValue, confidence, comparableAnalysis)
    
    // Step 14: Generate valuation recommendation
    const valuationRecommendation = this.generateValuationRecommendation(
      propertyData.price || 0,
      marketValue,
      marketPosition,
      comparableAnalysis
    )
    
    return {
      marketValue,
      confidence,
      methodology,
      breakdown: {
        baseValue,
        locationAdjustment,
        propertyAdjustments,
        marketTrendAdjustment,
        amenityAdjustment,
        developmentAdjustment
      },
      factors,
      comparableAnalysis,
      marketPosition,
      valuationRange,
      conditionAssessment,
      valuationRecommendation
    }
  }
  
  /**
   * Analyze property condition using AI for more accurate assessment
   */
  private async analyzePropertyCondition(propertyData: PropertyData): Promise<{
    condition: string
    impact: number
    reasoning: string
  }> {
    try {
      // Use the existing analyzePropertyConditionAndStyle function
      const { analyzePropertyConditionAndStyle } = await import('./api-services')
      const conditionAndStyle = await analyzePropertyConditionAndStyle(propertyData)
      
      // Convert the condition to our enhanced assessment
      const condition = conditionAndStyle.condition || 'fair'
      const impact = this.getConditionImpact(condition, propertyData)
      const reasoning = this.getConditionReasoning(condition, propertyData)
      
      return {
        condition,
        impact,
        reasoning
      }
      
    } catch (error) {
      console.warn('AI condition analysis failed, using fallback:', error instanceof Error ? error.message : error)
      return this.getFallbackConditionAssessment(propertyData)
    }
  }
  
  private getConditionImpact(condition: string, propertyData: PropertyData): number {
    const conditionImpacts: Record<string, number> = {
      'excellent': 0.15,
      'good': 0.05,
      'fair': 0,
      'needs work': -0.10,
      'renovation project': -0.15,
      'rebuild': -0.20
    }
    
    let impact = conditionImpacts[condition] || 0
    
    // Adjust based on property type and features
    if (propertyData.features) {
      const premiumFeatures = ['Private Pool', 'Sea Views', 'Mountain Views', 'Garden', 'Security System']
      const premiumCount = propertyData.features.filter(f => premiumFeatures.includes(f)).length
      impact += premiumCount * 0.02 // 2% per premium feature
    }
    
    return Math.max(-0.20, Math.min(0.20, impact)) // Clamp between -20% and +20%
  }
  
  private getConditionReasoning(condition: string, propertyData: PropertyData): string {
    const currentYear = new Date().getFullYear()
    const yearBuilt = propertyData.yearBuilt
    const age = yearBuilt ? currentYear - yearBuilt : null
    
    switch (condition) {
      case 'excellent':
        return age ? `Excellent condition for a ${age}-year-old property with premium features` : 'Excellent condition with premium features and finishes'
      case 'good':
        return age ? `Good condition for a ${age}-year-old property, well-maintained` : 'Good condition with modern features'
      case 'fair':
        return age ? `Fair condition for a ${age}-year-old property, standard maintenance needed` : 'Fair condition, typical for the area'
      case 'needs work':
        return age ? `Needs work for a ${age}-year-old property, updates required` : 'Property needs updates and improvements'
      case 'renovation project':
        return 'Renovation project requiring significant work and investment'
      case 'rebuild':
        return 'Major renovation or rebuild required'
      default:
        return 'Condition assessment based on property characteristics'
    }
  }
  
  private getFallbackConditionAssessment(propertyData: PropertyData): {
    condition: string
    impact: number
    reasoning: string
  } {
    const currentYear = new Date().getFullYear()
    const yearBuilt = propertyData.yearBuilt
    const features = propertyData.features?.join(' ').toLowerCase() || ''
    const description = propertyData.description?.toLowerCase() || ''
    
    let condition = 'fair'
    let impact = 0
    let reasoning = 'Condition assessment based on property characteristics'
    
    // Determine condition based on age and features
    if (yearBuilt) {
      const age = currentYear - yearBuilt
      if (age < 5) {
        condition = 'excellent'
        impact = 0.10
        reasoning = 'Very recent construction (less than 5 years old)'
      } else if (age < 15) {
        condition = 'good'
        impact = 0.05
        reasoning = 'Relatively new construction (5-15 years old)'
      } else if (age < 30) {
        condition = 'fair'
        impact = 0
        reasoning = 'Standard age for properties in this area'
      } else {
        condition = 'needs work'
        impact = -0.10
        reasoning = 'Older property likely requiring updates'
      }
    }
    
    // Adjust based on features and description
    if (features.includes('renovation') || description.includes('renovation')) {
      condition = 'renovation project'
      impact = -0.15
      reasoning = 'Property requires renovation work'
    } else if (features.includes('luxury') || features.includes('new') || features.includes('pristine')) {
      condition = 'excellent'
      impact = 0.15
      reasoning = 'Luxury property with premium features'
    } else if (features.includes('well maintained') || features.includes('updated')) {
      condition = 'good'
      impact = 0.05
      reasoning = 'Well-maintained property with updates'
    }
    
    return { condition, impact, reasoning }
  }
  
  /**
   * Calculate base value from comparable properties with enhanced data quality validation
   */
  private calculateBaseValue(
    propertyData: PropertyData, 
    comparables: Comparable[], 
    conditionAssessment: { condition: string; impact: number }
  ): number {
    if (comparables.length === 0) {
      // Fallback to conservative estimate
      const buildArea = propertyData.buildArea || propertyData.totalAreaM2 || 100
      return buildArea * 2000 // Conservative fallback price per m²
    }
    
    // Use build area for price per m² calculations (not total area)
    const propertyBuildArea = propertyData.buildArea || propertyData.totalAreaM2 || 100
    
    // Enhanced data quality validation and weighting
    const weightedComparables = comparables.map(comp => {
      const compBuildArea = comp.buildArea || comp.m2
      if (compBuildArea <= 0) return null
      
      const pricePerM2 = comp.price / compBuildArea
      
      // Data quality validation - detect potential outliers
      let dataQualityScore = 1.0
      let qualityFlags: string[] = []
      
      // Check for suspiciously high price per m² (potential data errors)
      if (pricePerM2 > 20000) {
        dataQualityScore *= 0.3 // Heavily discount extremely high prices
        qualityFlags.push('extremely_high_price')
      } else if (pricePerM2 > 15000) {
        dataQualityScore *= 0.6 // Discount very high prices
        qualityFlags.push('very_high_price')
      } else if (pricePerM2 > 12000) {
        dataQualityScore *= 0.8 // Slight discount for high prices
        qualityFlags.push('high_price')
      }
      
      // Check for suspiciously low price per m²
      if (pricePerM2 < 1000) {
        dataQualityScore *= 0.5 // Discount extremely low prices
        qualityFlags.push('extremely_low_price')
      }
      
      // Check for duplicate or similar properties (potential data duplication)
      const similarProperties = comparables.filter(other => 
        other !== comp && 
        Math.abs(other.price - comp.price) < 1000 && 
        Math.abs((other.buildArea || other.m2) - compBuildArea) < 10
      )
      if (similarProperties.length > 0) {
        dataQualityScore *= 0.7 // Discount potential duplicates
        qualityFlags.push('potential_duplicate')
      }
      
      // Weight by condition similarity
      let conditionWeight = 1.0
      if (comp.features) {
        const compFeatures = comp.features.join(' ').toLowerCase()
        if (conditionAssessment.condition === 'excellent' && 
            (compFeatures.includes('luxury') || compFeatures.includes('new'))) {
          conditionWeight = 1.2
        } else if (conditionAssessment.condition === 'needs work' && 
                   (compFeatures.includes('renovation') || compFeatures.includes('needs work'))) {
          conditionWeight = 1.1
        }
      }
      
      // Calculate final weight combining data quality and condition
      const finalWeight = dataQualityScore * conditionWeight
      
      return {
        pricePerM2,
        weight: finalWeight,
        buildArea: compBuildArea,
        qualityFlags,
        dataQualityScore
      }
    }).filter(Boolean)
    
    if (weightedComparables.length === 0) {
      return propertyBuildArea * 2000 // Conservative fallback
    }
    
    // Log data quality issues for debugging
    const qualityIssues = weightedComparables.filter(comp => comp.qualityFlags.length > 0)
    if (qualityIssues.length > 0) {
      console.log(`⚠️ Data quality issues detected in ${qualityIssues.length}/${weightedComparables.length} comparables:`, 
        qualityIssues.map(comp => ({
          pricePerM2: comp.pricePerM2,
          flags: comp.qualityFlags,
          weight: comp.weight
        }))
      )
    }
    
    // Calculate weighted average price per m²
    const totalWeight = weightedComparables.reduce((sum, comp) => sum + comp.weight, 0)
    const weightedPricePerM2 = weightedComparables.reduce((sum, comp) => 
      sum + (comp.pricePerM2 * comp.weight), 0) / totalWeight
    
    // Additional validation: if weighted average is still suspiciously high, apply market-based correction
    let finalPricePerM2 = weightedPricePerM2
    
    // Market-based sanity check (for luxury areas like Puerto Banús, max reasonable price per m²)
    const maxReasonablePricePerM2 = this.getMaxReasonablePricePerM2(propertyData.city, propertyData.propertyType)
    if (finalPricePerM2 > maxReasonablePricePerM2) {
      console.log(`⚠️ Price per m² (€${finalPricePerM2.toLocaleString()}) exceeds reasonable maximum (€${maxReasonablePricePerM2.toLocaleString()}) for ${propertyData.propertyType} in ${propertyData.city}`)
      
      // Apply correction: use median of reasonable comparables or cap at maximum
      const reasonableComparables = weightedComparables.filter(comp => comp.pricePerM2 <= maxReasonablePricePerM2)
      if (reasonableComparables.length > 0) {
        const reasonablePrices = reasonableComparables.map(comp => comp.pricePerM2).sort((a, b) => a - b)
        const medianPrice = reasonablePrices[Math.floor(reasonablePrices.length / 2)]
        finalPricePerM2 = Math.min(medianPrice * 1.2, maxReasonablePricePerM2) // Use median with 20% premium cap
        console.log(`✅ Applied market correction: using median of reasonable comparables (€${medianPrice.toLocaleString()}) with premium cap`)
      } else {
        finalPricePerM2 = maxReasonablePricePerM2 * 0.8 // Conservative estimate
        console.log(`✅ Applied market correction: using conservative estimate (€${finalPricePerM2.toLocaleString()})`)
      }
    }
    
    return Math.round(finalPricePerM2 * propertyBuildArea)
  }
  
  /**
   * Get maximum reasonable price per m² for a given city and property type
   */
  private getMaxReasonablePricePerM2(city: string, propertyType: string): number {
    const cityLower = city.toLowerCase()
    const typeLower = propertyType.toLowerCase()
    
    // Define maximum reasonable prices per m² by city and property type
    const maxPrices: Record<string, Record<string, number>> = {
      // Premium Marbella Area (Highest Tier)
      'marbella': {
        'apartment': 12000, // €12,000/m² max for apartments in Marbella
        'villa': 15000,     // €15,000/m² max for villas in Marbella
        'penthouse': 18000, // €18,000/m² max for penthouses in Marbella
        'townhouse': 13000, // €13,000/m² max for townhouses in Marbella
        'default': 12000
      },
      'puerto banus': {
        'apartment': 12000, // €12,000/m² max for apartments in Puerto Banús
        'villa': 15000,     // €15,000/m² max for villas in Puerto Banús
        'penthouse': 18000, // €18,000/m² max for penthouses in Puerto Banús
        'townhouse': 13000, // €13,000/m² max for townhouses in Puerto Banús
        'default': 12000
      },
      'nueva andalucia': {
        'apartment': 10000, // €10,000/m² max for apartments in Nueva Andalucía
        'villa': 13000,     // €13,000/m² max for villas in Nueva Andalucía
        'penthouse': 15000, // €15,000/m² max for penthouses in Nueva Andalucía
        'townhouse': 11000, // €11,000/m² max for townhouses in Nueva Andalucía
        'default': 10000
      },
      'san pedro alcantara': {
        'apartment': 11000, // €11,000/m² max for apartments in San Pedro Alcántara
        'villa': 14000,     // €14,000/m² max for villas in San Pedro Alcántara
        'penthouse': 16000, // €16,000/m² max for penthouses in San Pedro Alcántara
        'townhouse': 12000, // €12,000/m² max for townhouses in San Pedro Alcántara
        'default': 11000
      },
      'benahavis': {
        'apartment': 10000, // €10,000/m² max for apartments in Benahavís
        'villa': 13000,     // €13,000/m² max for villas in Benahavís
        'penthouse': 15000, // €15,000/m² max for penthouses in Benahavís
        'townhouse': 11000, // €11,000/m² max for townhouses in Benahavís
        'default': 10000
      },
      
      // High-End Costa del Sol (Second Tier)
      'estepona': {
        'apartment': 9000,  // €9,000/m² max for apartments in Estepona
        'villa': 12000,     // €12,000/m² max for villas in Estepona
        'penthouse': 14000, // €14,000/m² max for penthouses in Estepona
        'townhouse': 10000, // €10,000/m² max for townhouses in Estepona
        'default': 9000
      },
      'fuengirola': {
        'apartment': 8000,  // €8,000/m² max for apartments in Fuengirola
        'villa': 11000,     // €11,000/m² max for villas in Fuengirola
        'penthouse': 13000, // €13,000/m² max for penthouses in Fuengirola
        'townhouse': 9000,  // €9,000/m² max for townhouses in Fuengirola
        'default': 8000
      },
      'benalmadena': {
        'apartment': 8000,  // €8,000/m² max for apartments in Benalmádena
        'villa': 11000,     // €11,000/m² max for villas in Benalmádena
        'penthouse': 13000, // €13,000/m² max for penthouses in Benalmádena
        'townhouse': 9000,  // €9,000/m² max for townhouses in Benalmádena
        'default': 8000
      },
      'torremolinos': {
        'apartment': 7000,  // €7,000/m² max for apartments in Torremolinos
        'villa': 10000,     // €10,000/m² max for villas in Torremolinos
        'penthouse': 12000, // €12,000/m² max for penthouses in Torremolinos
        'townhouse': 8000,  // €8,000/m² max for townhouses in Torremolinos
        'default': 7000
      },
      'mijas': {
        'apartment': 8000,  // €8,000/m² max for apartments in Mijas
        'villa': 11000,     // €11,000/m² max for villas in Mijas
        'penthouse': 13000, // €13,000/m² max for penthouses in Mijas
        'townhouse': 9000,  // €9,000/m² max for townhouses in Mijas
        'default': 8000
      },
      
      // Major Andalucía Cities (Third Tier)
      'malaga': {
        'apartment': 6000,  // €6,000/m² max for apartments in Málaga
        'villa': 9000,      // €9,000/m² max for villas in Málaga
        'penthouse': 11000, // €11,000/m² max for penthouses in Málaga
        'townhouse': 7000,  // €7,000/m² max for townhouses in Málaga
        'default': 6000
      },
      'sevilla': {
        'apartment': 5000,  // €5,000/m² max for apartments in Sevilla
        'villa': 8000,      // €8,000/m² max for villas in Sevilla
        'penthouse': 10000, // €10,000/m² max for penthouses in Sevilla
        'townhouse': 6000,  // €6,000/m² max for townhouses in Sevilla
        'default': 5000
      },
      'granada': {
        'apartment': 4000,  // €4,000/m² max for apartments in Granada
        'villa': 7000,      // €7,000/m² max for villas in Granada
        'penthouse': 9000,  // €9,000/m² max for penthouses in Granada
        'townhouse': 5000,  // €5,000/m² max for townhouses in Granada
        'default': 4000
      },
      'cadiz': {
        'apartment': 4000,  // €4,000/m² max for apartments in Cádiz
        'villa': 7000,      // €7,000/m² max for villas in Cádiz
        'penthouse': 9000,  // €9,000/m² max for penthouses in Cádiz
        'townhouse': 5000,  // €5,000/m² max for townhouses in Cádiz
        'default': 4000
      },
      'almeria': {
        'apartment': 3500,  // €3,500/m² max for apartments in Almería
        'villa': 6000,      // €6,000/m² max for villas in Almería
        'penthouse': 8000,  // €8,000/m² max for penthouses in Almería
        'townhouse': 4500,  // €4,500/m² max for townhouses in Almería
        'default': 3500
      },
      
      // Other Costa del Sol Areas (Fourth Tier)
      'nerja': {
        'apartment': 6000,  // €6,000/m² max for apartments in Nerja
        'villa': 9000,      // €9,000/m² max for villas in Nerja
        'penthouse': 11000, // €11,000/m² max for penthouses in Nerja
        'townhouse': 7000,  // €7,000/m² max for townhouses in Nerja
        'default': 6000
      },
      'velez malaga': {
        'apartment': 5000,  // €5,000/m² max for apartments in Vélez-Málaga
        'villa': 8000,      // €8,000/m² max for villas in Vélez-Málaga
        'penthouse': 10000, // €10,000/m² max for penthouses in Vélez-Málaga
        'townhouse': 6000,  // €6,000/m² max for townhouses in Vélez-Málaga
        'default': 5000
      },
      'ronda': {
        'apartment': 4000,  // €4,000/m² max for apartments in Ronda
        'villa': 7000,      // €7,000/m² max for villas in Ronda
        'penthouse': 9000,  // €9,000/m² max for penthouses in Ronda
        'townhouse': 5000,  // €5,000/m² max for townhouses in Ronda
        'default': 4000
      },
      'algeciras': {
        'apartment': 3500,  // €3,500/m² max for apartments in Algeciras
        'villa': 6000,      // €6,000/m² max for villas in Algeciras
        'penthouse': 8000,  // €8,000/m² max for penthouses in Algeciras
        'townhouse': 4500,  // €4,500/m² max for townhouses in Algeciras
        'default': 3500
      }
    }
    
    // Find matching city (case-insensitive)
    const cityKey = Object.keys(maxPrices).find(key => cityLower.includes(key)) || 'default'
    const cityPrices = maxPrices[cityKey] || maxPrices['marbella']
    
    // Find matching property type (case-insensitive)
    const typeKey = Object.keys(cityPrices).find(key => typeLower.includes(key)) || 'default'
    
    return cityPrices[typeKey] || cityPrices['default'] || 10000
  }
  
  /**
   * Calculate property-specific adjustments with enhanced condition analysis
   */
  private calculatePropertyAdjustments(
    propertyData: PropertyData, 
    comparables: Comparable[],
    conditionAssessment: { condition: string; impact: number }
  ): number {
    let adjustment = 0
    
    // Condition adjustment (most important)
    adjustment += conditionAssessment.impact
    
    // Bedroom adjustment
    const avgBedrooms = comparables.length > 0 
      ? comparables.reduce((sum, c) => sum + c.bedrooms, 0) / comparables.length 
      : 3
    const bedroomDiff = (propertyData.bedrooms || 0) - avgBedrooms
    adjustment += bedroomDiff * 0.05 // 5% per bedroom difference
    
    // Bathroom adjustment
    const avgBathrooms = comparables.length > 0 
      ? comparables.reduce((sum, c) => sum + c.bathrooms, 0) / comparables.length 
      : 2
    const bathroomDiff = (propertyData.bathrooms || 0) - avgBathrooms
    adjustment += bathroomDiff * 0.03 // 3% per bathroom difference
    
    // Property type adjustment
    const typeAdjustments: Record<string, number> = {
      'Villa': 0.15,      // 15% premium for villas
      'Apartment': -0.05,  // 5% discount for apartments
      'Townhouse': 0.05,   // 5% premium for townhouses
      'Penthouse': 0.20,   // 20% premium for penthouses
      'Duplex': 0.10       // 10% premium for duplexes
    }
    adjustment += typeAdjustments[propertyData.propertyType] || 0
    
    // Feature-based adjustments
    if (propertyData.features) {
      const premiumFeatures = ['Private Pool', 'Sea Views', 'Mountain Views', 'Garden', 'Security System']
      const standardFeatures = ['Air Conditioning', 'Fitted Kitchen', 'Parking', 'Terrace']
      
      const premiumCount = propertyData.features.filter(f => premiumFeatures.includes(f)).length
      const standardCount = propertyData.features.filter(f => standardFeatures.includes(f)).length
      
      adjustment += premiumCount * 0.03 // 3% per premium feature
      adjustment += standardCount * 0.01 // 1% per standard feature
    }
    
    return adjustment
  }
  
  /**
   * Calculate location-based adjustments with enhanced validation
   */
  private calculateLocationAdjustment(propertyData: PropertyData, amenities: Amenity[]): number {
    let adjustment = 0
    
    // Enhanced location validation - check if this is a premium area that already commands high prices
    const isPremiumArea = this.isPremiumLocation(propertyData.city, propertyData.address)
    
    // If it's already a premium area, reduce location adjustments to avoid double-counting
    const locationMultiplier = isPremiumArea ? 0.3 : 1.0
    
    // School proximity (high value for families)
    const schools = amenities.filter(a => a.type === 'school')
    if (schools.length >= 3) adjustment += 0.04 * locationMultiplier // Reduced from 8% to 4%
    else if (schools.length >= 1) adjustment += 0.02 * locationMultiplier // Reduced from 4% to 2%
    
    // Transport accessibility
    const transport = amenities.filter(a => a.type === 'transport')
    if (transport.length >= 2) adjustment += 0.03 * locationMultiplier // Reduced from 5% to 3%
    else if (transport.length >= 1) adjustment += 0.01 * locationMultiplier // Reduced from 2% to 1%
    
    // Shopping and services
    const shopping = amenities.filter(a => a.type === 'shopping')
    if (shopping.length >= 5) adjustment += 0.03 * locationMultiplier // Reduced from 6% to 3%
    else if (shopping.length >= 2) adjustment += 0.015 * locationMultiplier // Reduced from 3% to 1.5%
    
    // Healthcare facilities
    const healthcare = amenities.filter(a => a.type === 'healthcare')
    if (healthcare.length >= 2) adjustment += 0.015 * locationMultiplier // Reduced from 3% to 1.5%
    
    // Cap total location adjustment to prevent overvaluation
    const maxLocationAdjustment = isPremiumArea ? 0.05 : 0.10 // 5% max for premium areas, 10% for others
    adjustment = Math.min(adjustment, maxLocationAdjustment)
    
    return adjustment
  }
  
  /**
   * Check if the property is in a premium location that already commands high prices
   */
  private isPremiumLocation(city: string, address: string): boolean {
    const cityLower = city.toLowerCase()
    const addressLower = address.toLowerCase()
    
    // Premium areas that already command high prices
    const premiumAreas = [
      'puerto banus', 'puerto banús', 'puerto banús marina',
      'nueva andalucia', 'nueva andalucía', 'nueva andalucía golf',
      'golden mile', 'golden mile marbella',
      'playas del duque', 'playas del duque marbella',
      'sierra blanca', 'sierra blanca marbella',
      'marina banus', 'marina banús',
      'banus', 'banús'
    ]
    
    // Check if city or address contains premium area keywords
    return premiumAreas.some(area => 
      cityLower.includes(area) || addressLower.includes(area)
    )
  }
  
  /**
   * Calculate market trend adjustments
   */
  private calculateMarketTrendAdjustment(marketData: MarketDataFromFeed | null, comparables: Comparable[]): number {
    if (!marketData) return 0
    
    let adjustment = 0
    
    // Market trend adjustment
    switch (marketData.marketTrend) {
      case 'up':
        adjustment += 0.05 // 5% premium in rising market
        break
      case 'down':
        adjustment -= 0.05 // 5% discount in falling market
        break
      case 'stable':
        // No adjustment for stable market
        break
    }
    
    // Days on market adjustment (from comparables)
    const avgDaysOnMarket = comparables.length > 0 
      ? comparables.reduce((sum, c) => sum + c.daysOnMarket, 0) / comparables.length 
      : 0
    
    if (avgDaysOnMarket > 0) {
      if (avgDaysOnMarket < 30) {
        adjustment += 0.03 // 3% premium for fast-selling market
      } else if (avgDaysOnMarket > 90) {
        adjustment -= 0.03 // 3% discount for slow-selling market
      }
    }
    
    return adjustment
  }
  
  /**
   * Calculate amenity adjustments
   */
  private calculateAmenityAdjustment(amenities: Amenity[]): number {
    if (amenities.length === 0) return 0
    
    // Premium for comprehensive amenity access
    if (amenities.length >= 15) return 0.04 // 4% premium for excellent amenity access
    if (amenities.length >= 10) return 0.02 // 2% premium for good amenity access
    if (amenities.length >= 5) return 0.01 // 1% premium for some amenity access
    
    return 0
  }
  
  /**
   * Calculate development impact adjustments
   */
  private calculateDevelopmentAdjustment(developments: Development[]): number {
    if (developments.length === 0) return 0
    
    let adjustment = 0
    
    developments.forEach(development => {
      switch (development.impact) {
        case 'positive':
          adjustment += 0.03 // 3% premium per positive development
          break
        case 'negative':
          adjustment -= 0.02 // 2% discount per negative development
          break
        case 'neutral':
          // No adjustment for neutral developments
          break
      }
    })
    
    return adjustment
  }
  
  /**
   * Calculate confidence level in the valuation
   */
  private calculateConfidence(
    comparables: Comparable[], 
    marketData: MarketDataFromFeed | null, 
    amenities: Amenity[],
    conditionAssessment: { condition: string; impact: number }
  ): number {
    let confidence = 50 // Base confidence
    
    // Comparable data quality
    if (comparables.length >= 10) confidence += 25
    else if (comparables.length >= 5) confidence += 20
    else if (comparables.length >= 2) confidence += 15
    else if (comparables.length >= 1) confidence += 10
    
    // Market data quality
    if (marketData) {
      if (marketData.dataQuality === 'high') confidence += 15
      else if (marketData.dataQuality === 'medium') confidence += 10
      else confidence += 5
    }
    
    // Amenity data quality
    if (amenities.length >= 10) confidence += 10
    else if (amenities.length >= 5) confidence += 5
    
    // Condition assessment quality
    if (conditionAssessment.condition !== 'fair') confidence += 5
    
    return Math.min(95, confidence) // Cap at 95%
  }
  
  /**
   * Generate methodology description
   */
  private generateMethodology(
    comparables: Comparable[], 
    marketData: MarketDataFromFeed | null,
    conditionAssessment: { condition: string; reasoning: string }
  ): string {
    const parts: string[] = []
    
    if (comparables.length > 0) {
      parts.push(`Valuation based on ${comparables.length} comparable properties`)
    }
    
    if (marketData) {
      parts.push(`market data analysis (${marketData.dataQuality} quality)`)
    }
    
    parts.push(`condition assessment: ${conditionAssessment.condition} (${conditionAssessment.reasoning})`)
    
    if (parts.length === 0) {
      return 'Limited data available for valuation'
    }
    
    return parts.join(' and ') + '. Includes property-specific adjustments for features, location factors, and market trends.'
  }
  
  /**
   * Generate detailed valuation factors
   */
  private generateValuationFactors(
    baseValue: number,
    propertyAdjustments: number,
    locationAdjustment: number,
    marketTrendAdjustment: number,
    amenityAdjustment: number,
    developmentAdjustment: number,
    comparables: Comparable[],
    marketData: MarketDataFromFeed | null
  ): ValuationFactor[] {
    const factors: ValuationFactor[] = []
    
    // Get total properties analysed from market data or fallback to comparables length
    const totalPropertiesAnalysed = marketData?.totalComparables || comparables.length
    
    // Always include Comparable Properties as the base factor
    factors.push({
      factor: 'Comparable Properties',
      adjustment: baseValue,
      percentage: 100,
      reasoning: `Base valuation derived from analysis of ${totalPropertiesAnalysed} properties in the area (${comparables.length} detailed comparables selected)`
    })
    
    if (propertyAdjustments !== 0) {
      factors.push({
        factor: 'Property Features & Condition',
        adjustment: Math.round(baseValue * propertyAdjustments),
        percentage: Math.round(propertyAdjustments * 100),
        reasoning: 'Adjustment for bedrooms, bathrooms, property type, condition, and premium features compared to comparables'
      })
    }
    
    if (locationAdjustment !== 0) {
      factors.push({
        factor: 'Location Quality',
        adjustment: Math.round(baseValue * locationAdjustment),
        percentage: Math.round(locationAdjustment * 100),
        reasoning: 'Adjustment for proximity to schools, transport, shopping, and healthcare facilities'
      })
    }
    
    if (marketTrendAdjustment !== 0) {
      factors.push({
        factor: 'Market Trends',
        adjustment: Math.round(baseValue * marketTrendAdjustment),
        percentage: Math.round(marketTrendAdjustment * 100),
        reasoning: 'Adjustment for current market conditions and days on market trends'
      })
    }
    
    if (amenityAdjustment !== 0) {
      factors.push({
        factor: 'Amenity Access',
        adjustment: Math.round(baseValue * amenityAdjustment),
        percentage: Math.round(amenityAdjustment * 100),
        reasoning: 'Premium for comprehensive amenity access in the area'
      })
    }
    
    if (developmentAdjustment !== 0) {
      factors.push({
        factor: 'Future Developments',
        adjustment: Math.round(baseValue * developmentAdjustment),
        percentage: Math.round(developmentAdjustment * 100),
        reasoning: 'Adjustment for planned developments in the area'
      })
    }
    
    return factors
  }
  
  /**
   * Analyze comparable properties with condition breakdown
   */
  private analyzeComparables(comparables: Comparable[], propertyData: PropertyData): ComparableAnalysis {
    if (comparables.length === 0) {
      return {
        usedComparables: 0,
        averagePrice: 0,
        medianPrice: 0,
        priceRange: { min: 0, max: 0 },
        pricePerM2: 0,
        daysOnMarket: 0,
        conditionBreakdown: { excellent: 0, good: 0, fair: 0, needsWork: 0 },
        featureAnalysis: { premiumFeatures: [], missingFeatures: [], featureValue: 0 }
      }
    }
    
    const prices = comparables.map(c => c.price).sort((a, b) => a - b)
    const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length
    const medianPrice = prices[Math.floor(prices.length / 2)]
    
    // Calculate price per m² using build area
    const pricesPerM2 = comparables.map(comp => {
              const area = comp.buildArea || comp.m2
      return area > 0 ? comp.price / area : 0
    }).filter(price => price > 0)
    
    const avgPricePerM2 = pricesPerM2.length > 0 
      ? pricesPerM2.reduce((sum, price) => sum + price, 0) / pricesPerM2.length 
      : 0
    
    const avgDaysOnMarket = comparables.reduce((sum, c) => sum + c.daysOnMarket, 0) / comparables.length
    
    // Analyze condition breakdown
    const conditionBreakdown = { excellent: 0, good: 0, fair: 0, needsWork: 0 }
    comparables.forEach(comp => {
      if (comp.features) {
        const features = comp.features.join(' ').toLowerCase()
        if (features.includes('luxury') || features.includes('new')) {
          conditionBreakdown.excellent++
        } else if (features.includes('well maintained') || features.includes('updated')) {
          conditionBreakdown.good++
        } else if (features.includes('renovation') || features.includes('needs work')) {
          conditionBreakdown.needsWork++
        } else {
          conditionBreakdown.fair++
        }
      } else {
        conditionBreakdown.fair++
      }
    })
    
    // Analyze features
    const targetFeatures = propertyData.features || []
    const allComparableFeatures = comparables.flatMap(c => c.features || [])
    const premiumFeatures = ['Private Pool', 'Sea Views', 'Mountain Views', 'Garden', 'Security System']
    
    const missingFeatures = premiumFeatures.filter(f => 
      !targetFeatures.includes(f) && allComparableFeatures.includes(f)
    )
    
    const featureValue = missingFeatures.length * 0.03 // 3% per missing premium feature
    
    return {
      usedComparables: comparables.length,
      averagePrice: Math.round(averagePrice),
      medianPrice: Math.round(medianPrice),
      priceRange: { min: prices[0], max: prices[prices.length - 1] },
      pricePerM2: Math.round(avgPricePerM2),
      daysOnMarket: Math.round(avgDaysOnMarket),
      conditionBreakdown,
      featureAnalysis: {
        premiumFeatures: targetFeatures.filter(f => premiumFeatures.includes(f)),
        missingFeatures,
        featureValue
      }
    }
  }
  
  /**
   * Determine market position and competitiveness
   */
  private determineMarketPosition(
    propertyData: PropertyData, 
    comparables: Comparable[], 
    marketData: MarketDataFromFeed | null
  ): MarketPosition {
    if (comparables.length === 0) {
      return {
        percentile: 50,
        competitiveness: 'medium',
        marketTiming: 'neutral'
      }
    }
    
    // Calculate where this property would rank among comparables
    const propertyPrice = propertyData.price || 0
    const comparablePrices = comparables.map(c => c.price).sort((a, b) => a - b)
    
    let percentile = 50
    if (propertyPrice > 0) {
      const rank = comparablePrices.findIndex(price => price >= propertyPrice)
      percentile = rank >= 0 ? (rank / comparablePrices.length) * 100 : 100
    }
    
    // Determine competitiveness
    let competitiveness: 'high' | 'medium' | 'low' = 'medium'
    if (percentile <= 25) competitiveness = 'high'
    else if (percentile >= 75) competitiveness = 'low'
    
    // Determine market timing
    let marketTiming: 'favorable' | 'neutral' | 'unfavorable' = 'neutral'
    if (marketData && comparables.length > 0) {
      const avgDaysOnMarket = comparables.reduce((sum, c) => sum + c.daysOnMarket, 0) / comparables.length
      if (marketData.marketTrend === 'up' && avgDaysOnMarket < 45) {
        marketTiming = 'favorable'
      } else if (marketData.marketTrend === 'down' && avgDaysOnMarket > 90) {
        marketTiming = 'unfavorable'
      }
    }
    
    return {
      percentile: Math.round(percentile),
      competitiveness,
      marketTiming
    }
  }
  
  /**
   * Calculate valuation range based on confidence and market data
   */
  private calculateValuationRange(
    marketValue: number, 
    confidence: number, 
    comparableAnalysis: ComparableAnalysis
  ): { conservative: number; marketValue: number; optimistic: number } {
    // Calculate range based on confidence level and market volatility
    const confidenceFactor = (100 - confidence) / 100 // Higher confidence = smaller range
    const baseRange = 0.15 // 15% base range
    
    const rangeMultiplier = baseRange * confidenceFactor
    
    const conservative = Math.round(marketValue * (1 - rangeMultiplier))
    const optimistic = Math.round(marketValue * (1 + rangeMultiplier))
    
    return {
      conservative,
      marketValue,
      optimistic
    }
  }
  
  /**
   * Generate valuation recommendation with actionable insights
   */
  private generateValuationRecommendation(
    askingPrice: number,
    marketValue: number,
    marketPosition: MarketPosition,
    comparableAnalysis: ComparableAnalysis
  ): {
    status: 'overpriced' | 'undervalued' | 'fairly_priced'
    percentage: number
    recommendation: string
    action: string
    urgency: 'high' | 'medium' | 'low'
  } {
    if (askingPrice === 0) {
      return {
        status: 'fairly_priced',
        percentage: 0,
        recommendation: 'Property valuation completed. Consider this as a reference for pricing decisions.',
        action: 'Use this valuation as a guide for setting competitive pricing.',
        urgency: 'medium'
      }
    }
    
    const percentageDiff = ((askingPrice - marketValue) / marketValue) * 100
    const absPercentage = Math.abs(percentageDiff)
    
    // Determine status
    let status: 'overpriced' | 'undervalued' | 'fairly_priced'
    if (percentageDiff > 10) {
      status = 'overpriced'
    } else if (percentageDiff < -10) {
      status = 'undervalued'
    } else {
      status = 'fairly_priced'
    }
    
    // Determine urgency based on market position and percentage difference
    let urgency: 'high' | 'medium' | 'low' = 'medium'
    if (absPercentage > 20) urgency = 'high'
    else if (absPercentage < 5) urgency = 'low'
    
    // Generate recommendation based on status and market conditions
    let recommendation = ''
    let action = ''
    
    switch (status) {
      case 'overpriced':
        if (marketPosition.marketTiming === 'favorable') {
          recommendation = `Property is ${absPercentage.toFixed(1)}% above market value, but market conditions are favorable.`
          action = 'Consider reducing price by 5-10% to attract more buyers while maintaining good returns.'
        } else if (marketPosition.marketTiming === 'unfavorable') {
          recommendation = `Property is ${absPercentage.toFixed(1)}% overpriced in a challenging market.`
          action = 'Significant price reduction recommended (10-15%) to remain competitive.'
        } else {
          recommendation = `Property is ${absPercentage.toFixed(1)}% above market value.`
          action = 'Consider price adjustment to align with market expectations.'
        }
        break
        
      case 'undervalued':
        if (marketPosition.marketTiming === 'favorable') {
          recommendation = `Excellent opportunity! Property is ${absPercentage.toFixed(1)}% below market value in a rising market.`
          action = 'Buy now! This represents exceptional value with strong upside potential.'
        } else {
          recommendation = `Property appears ${absPercentage.toFixed(1)}% undervalued compared to market analysis.`
          action = 'Strong buying opportunity with potential for value appreciation.'
        }
        break
        
      case 'fairly_priced':
        if (marketPosition.marketTiming === 'favorable') {
          recommendation = 'Property is fairly priced in a favorable market environment.'
          action = 'Good timing for purchase with potential for moderate appreciation.'
        } else if (marketPosition.marketTiming === 'unfavorable') {
          recommendation = 'Property is fairly priced but market conditions are challenging.'
          action = 'Consider waiting for better market conditions or negotiate for additional discounts.'
        } else {
          recommendation = 'Property is fairly priced relative to market value.'
          action = 'Standard market conditions - proceed with normal due diligence.'
        }
        break
    }
    
    return {
      status,
      percentage: Math.round(percentageDiff),
      recommendation,
      action,
      urgency
    }
  }
} 