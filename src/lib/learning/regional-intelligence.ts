// Regional Intelligence System
// Learns local market patterns, seasonal trends, and regional characteristics

import { 
  RegionalKnowledge, 
  MarketCharacteristics, 
  PricingPattern,
  DevelopmentImpact,
  SeasonalPattern,
  DemographicInsight 
} from './learning-types'
import { PropertyData, CMAReport, Comparable } from '@/types'
import path from 'path'
import fs from 'fs'

// ========================================
// REGIONAL KNOWLEDGE DATABASE
// ========================================

export class RegionalKnowledgeDatabase {
  private dataDir: string
  private knowledgeFile: string
  private knowledge: Map<string, RegionalKnowledge> = new Map()
  private isLoaded: boolean = false

  constructor(dataDir: string = './data/learning') {
    this.dataDir = dataDir
    this.knowledgeFile = path.join(dataDir, 'regional-knowledge.json')
    this.ensureDataDirectory()
    this.loadDatabase()
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
      console.log(`Created regional knowledge data directory: ${this.dataDir}`)
    }
  }

  private loadDatabase(): void {
    try {
      if (fs.existsSync(this.knowledgeFile)) {
        const data = fs.readFileSync(this.knowledgeFile, 'utf8')
        const knowledgeArray: RegionalKnowledge[] = JSON.parse(data)
        this.knowledge.clear()
        knowledgeArray.forEach(rk => {
          this.knowledge.set(rk.id, rk)
        })
        console.log(`Loaded ${this.knowledge.size} regional knowledge records`)
      }
      this.isLoaded = true
    } catch (error) {
      console.error('Error loading regional knowledge database:', error)
      this.knowledge.clear()
      this.isLoaded = true
    }
  }

  private saveDatabase(): void {
    try {
      const knowledgeArray = Array.from(this.knowledge.values())
      fs.writeFileSync(this.knowledgeFile, JSON.stringify(knowledgeArray, null, 2), 'utf8')
    } catch (error) {
      console.error('Error saving regional knowledge database:', error)
    }
  }

  public updateRegionalKnowledge(knowledge: RegionalKnowledge): void {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    this.knowledge.set(knowledge.id, knowledge)
    this.saveDatabase()
    console.log(`Updated regional knowledge for: ${knowledge.regionName}`)
  }

  public getRegionalKnowledge(regionId: string): RegionalKnowledge | null {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    return this.knowledge.get(regionId) || null
  }

  public findRegionalKnowledge(
    regionName: string, 
    regionType: 'city' | 'province' | 'neighborhood' | 'postal_code'
  ): RegionalKnowledge | null {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    
    for (const knowledge of Array.from(this.knowledge.values())) {
      if (knowledge.regionName.toLowerCase() === regionName.toLowerCase() && 
          knowledge.regionType === regionType) {
        return knowledge
      }
    }
    return null
  }

  public getAllRegionalKnowledge(): RegionalKnowledge[] {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    return Array.from(this.knowledge.values())
  }

  public getKnowledgeStats(): {
    totalRegions: number
    regionsByType: { [type: string]: number }
    averageConfidence: number
    mostKnowledgeableRegions: string[]
    leastKnowledgeableRegions: string[]
  } {
    const allKnowledge = this.getAllRegionalKnowledge()
    
    if (allKnowledge.length === 0) {
      return {
        totalRegions: 0,
        regionsByType: {},
        averageConfidence: 0,
        mostKnowledgeableRegions: [],
        leastKnowledgeableRegions: []
      }
    }

    const regionsByType: { [type: string]: number } = {}
    allKnowledge.forEach(rk => {
      regionsByType[rk.regionType] = (regionsByType[rk.regionType] || 0) + 1
    })

    const averageConfidence = allKnowledge.reduce((sum, rk) => sum + rk.confidenceScore, 0) / allKnowledge.length

    // Sort by confidence and data points
    const sortedByKnowledge = allKnowledge.sort((a, b) => 
      (b.confidenceScore * b.dataPoints) - (a.confidenceScore * a.dataPoints)
    )

    return {
      totalRegions: allKnowledge.length,
      regionsByType,
      averageConfidence,
      mostKnowledgeableRegions: sortedByKnowledge.slice(0, 5).map(rk => rk.regionName),
      leastKnowledgeableRegions: sortedByKnowledge.slice(-5).map(rk => rk.regionName)
    }
  }
}

// ========================================
// REGIONAL INTELLIGENCE ENGINE
// ========================================

export class RegionalIntelligenceEngine {
  private database: RegionalKnowledgeDatabase

  constructor(dataDir?: string) {
    this.database = new RegionalKnowledgeDatabase(dataDir)
  }

  // Learn from a new analysis session
  public async learnFromAnalysis(
    sessionData: {
      propertyData: PropertyData
      report: CMAReport
      comparables: Comparable[]
      analysisQuality: number
    }
  ): Promise<void> {
    try {
      const { propertyData, report, comparables, analysisQuality } = sessionData

      // Update city-level knowledge
      await this.updateCityKnowledge(propertyData, report, comparables, analysisQuality)

      // Update province-level knowledge
      await this.updateProvinceKnowledge(propertyData, report, comparables, analysisQuality)

      // Update neighborhood knowledge if we can identify it
      if (propertyData.areaCode) {
        await this.updateNeighborhoodKnowledge(propertyData, report, comparables, analysisQuality)
      }

      console.log(`Learned from analysis in ${propertyData.city}, ${propertyData.province}`)
    } catch (error) {
      console.error('Error learning from analysis:', error)
    }
  }

  // Get regional insights for a location
  public getRegionalInsights(
    city: string, 
    province: string, 
    neighborhoodCode?: string
  ): RegionalKnowledge | null {
    // Try to get the most specific knowledge available
    let knowledge: RegionalKnowledge | null = null

    // First try neighborhood level
    if (neighborhoodCode) {
      knowledge = this.database.findRegionalKnowledge(neighborhoodCode, 'postal_code')
      if (knowledge && knowledge.confidenceScore > 60) {
        return knowledge
      }
    }

    // Then try city level
    knowledge = this.database.findRegionalKnowledge(city, 'city')
    if (knowledge && knowledge.confidenceScore > 40) {
      return knowledge
    }

    // Finally try province level
    knowledge = this.database.findRegionalKnowledge(province, 'province')
    return knowledge
  }

  // Predict property performance based on regional knowledge
  public predictPropertyPerformance(
    propertyData: PropertyData,
    seasonalContext?: 'spring' | 'summer' | 'autumn' | 'winter'
  ): {
    expectedPriceRange: { low: number; high: number }
    marketTrend: 'up' | 'down' | 'stable'
    timeOnMarket: number
    investmentGrade: 'A' | 'B' | 'C' | 'D' | 'F'
    riskFactors: string[]
    opportunities: string[]
    confidence: number
  } | null {
    const regionalKnowledge = this.getRegionalInsights(
      propertyData.city, 
      propertyData.province, 
      propertyData.areaCode
    )

    if (!regionalKnowledge || regionalKnowledge.confidenceScore < 30) {
      return null // Not enough regional knowledge
    }

    const marketChar = regionalKnowledge.marketCharacteristics
    const propertyArea = propertyData.totalAreaM2 || 100 // Default fallback

    // Calculate expected price range
    let basePricePerM2 = marketChar.averagePricePerM2
    
    // Apply property type adjustments
    if (marketChar.bestPerformingTypes.includes(propertyData.propertyType)) {
      basePricePerM2 *= 1.1 // 10% premium for popular types
    } else if (marketChar.worstPerformingTypes.includes(propertyData.propertyType)) {
      basePricePerM2 *= 0.9 // 10% discount for poor performing types
    }

    // Apply seasonal adjustments
    if (seasonalContext) {
      const seasonalPattern = regionalKnowledge.seasonalPatterns.find(sp => sp.season === seasonalContext)
      if (seasonalPattern) {
        basePricePerM2 *= (1 + seasonalPattern.priceAdjustment / 100)
      }
    }

    // Apply development impact adjustments
    let developmentAdjustment = 0
    regionalKnowledge.developmentImpacts.forEach(impact => {
      if (impact.distance <= 2) { // Within 2km
        developmentAdjustment += impact.impactOnPrice / 100
      }
    })
    basePricePerM2 *= (1 + developmentAdjustment)

    const expectedPrice = basePricePerM2 * propertyArea
    const volatilityRange = expectedPrice * (marketChar.priceVolatility / 100)

    // Determine market trend
    let marketTrend: 'up' | 'down' | 'stable' = 'stable'
    if (marketChar.priceAppreciation > 3) marketTrend = 'up'
    else if (marketChar.priceAppreciation < -2) marketTrend = 'down'

    // Calculate time on market
    let timeOnMarket = marketChar.averageTimeOnMarket
    if (seasonalContext) {
      const seasonalPattern = regionalKnowledge.seasonalPatterns.find(sp => sp.season === seasonalContext)
      if (seasonalPattern) {
        timeOnMarket = seasonalPattern.averageTimeOnMarket
      }
    }

    return {
      expectedPriceRange: {
        low: Math.round(expectedPrice - volatilityRange),
        high: Math.round(expectedPrice + volatilityRange)
      },
      marketTrend,
      timeOnMarket,
      investmentGrade: marketChar.investmentGrade,
      riskFactors: marketChar.riskFactors,
      opportunities: marketChar.opportunities,
      confidence: regionalKnowledge.confidenceScore
    }
  }

  // Detect market patterns and anomalies
  public detectMarketPatterns(): {
    emergingTrends: string[]
    marketAnomalies: string[]
    opportunityAreas: string[]
    riskAreas: string[]
  } {
    const allKnowledge = this.database.getAllRegionalKnowledge()
    const emergingTrends: string[] = []
    const marketAnomalies: string[] = []
    const opportunityAreas: string[] = []
    const riskAreas: string[] = []

    // Analyze trends across regions
    const highAppreciationRegions = allKnowledge.filter(rk => 
      rk.marketCharacteristics.priceAppreciation > 5
    )
    const lowAppreciationRegions = allKnowledge.filter(rk => 
      rk.marketCharacteristics.priceAppreciation < -3
    )

    if (highAppreciationRegions.length > 0) {
      emergingTrends.push(`High appreciation trend in ${highAppreciationRegions.length} regions`)
      opportunityAreas.push(...highAppreciationRegions.map(rk => rk.regionName))
    }

    if (lowAppreciationRegions.length > 0) {
      marketAnomalies.push(`Price decline detected in ${lowAppreciationRegions.length} regions`)
      riskAreas.push(...lowAppreciationRegions.map(rk => rk.regionName))
    }

    // Detect inventory imbalances
    const lowInventoryRegions = allKnowledge.filter(rk => 
      rk.marketCharacteristics.inventoryLevels === 'low' && 
      rk.marketCharacteristics.demandLevel === 'high'
    )
    
    if (lowInventoryRegions.length > 0) {
      emergingTrends.push(`Supply shortage in ${lowInventoryRegions.length} high-demand regions`)
      opportunityAreas.push(...lowInventoryRegions.map(rk => rk.regionName))
    }

    // Detect unusual time on market patterns
    const fastSellRegions = allKnowledge.filter(rk => 
      rk.marketCharacteristics.averageTimeOnMarket < 30
    )
    const slowSellRegions = allKnowledge.filter(rk => 
      rk.marketCharacteristics.averageTimeOnMarket > 120
    )

    if (fastSellRegions.length > 0) {
      emergingTrends.push(`Fast-selling markets in ${fastSellRegions.length} regions`)
    }

    if (slowSellRegions.length > 0) {
      marketAnomalies.push(`Slow-selling markets in ${slowSellRegions.length} regions`)
      riskAreas.push(...slowSellRegions.map(rk => rk.regionName))
    }

    return {
      emergingTrends,
      marketAnomalies,
      opportunityAreas: Array.from(new Set(opportunityAreas)), // Remove duplicates
      riskAreas: Array.from(new Set(riskAreas))
    }
  }

  // Generate regional market report
  public generateRegionalReport(regionName: string, regionType: string): any {
    const knowledge = this.database.findRegionalKnowledge(regionName, regionType as any)
    
    if (!knowledge) {
      return {
        region: regionName,
        type: regionType,
        status: 'no_data',
        message: 'Insufficient data for this region'
      }
    }

    const marketChar = knowledge.marketCharacteristics
    const patterns = this.analyzeRegionalPatterns(knowledge)
    const forecast = this.generateRegionalForecast(knowledge)

    return {
      region: regionName,
      type: regionType,
      confidence: knowledge.confidenceScore,
      dataPoints: knowledge.dataPoints,
      lastUpdated: knowledge.lastUpdated,
      
      marketOverview: {
        averagePricePerM2: marketChar.averagePricePerM2,
        priceAppreciation: marketChar.priceAppreciation,
        marketTrend: marketChar.priceAppreciation > 2 ? 'up' : marketChar.priceAppreciation < -2 ? 'down' : 'stable',
        timeOnMarket: marketChar.averageTimeOnMarket,
        inventoryLevel: marketChar.inventoryLevels,
        demandLevel: marketChar.demandLevel,
        investmentGrade: marketChar.investmentGrade
      },
      
      propertyTypes: {
        bestPerforming: marketChar.bestPerformingTypes,
        worstPerforming: marketChar.worstPerformingTypes
      },
      
      patterns: patterns,
      forecast: forecast,
      
      riskFactors: marketChar.riskFactors,
      opportunities: marketChar.opportunities,
      
      seasonalInsights: knowledge.seasonalPatterns.map(sp => ({
        season: sp.season,
        priceAdjustment: sp.priceAdjustment,
        marketActivity: sp.marketActivity,
        timeOnMarket: sp.averageTimeOnMarket
      })),
      
      developmentImpact: knowledge.developmentImpacts.map(di => ({
        type: di.developmentType,
        distance: di.distance,
        priceImpact: di.impactOnPrice,
        timeframe: di.impactTimeframe
      }))
    }
  }

  // Private helper methods
  private async updateCityKnowledge(
    propertyData: PropertyData,
    report: CMAReport,
    comparables: Comparable[],
    analysisQuality: number
  ): Promise<void> {
    const regionId = this.generateRegionId(propertyData.city, 'city')
    let knowledge = this.database.getRegionalKnowledge(regionId)

    if (!knowledge) {
      knowledge = this.createInitialKnowledge(regionId, propertyData.city, 'city')
    }

    // Update market characteristics
    this.updateMarketCharacteristics(knowledge, propertyData, report, comparables)
    
    // Update pricing patterns
    this.updatePricingPatterns(knowledge, propertyData, report, comparables)
    
    // Update seasonal patterns
    this.updateSeasonalPatterns(knowledge, propertyData, report)
    
    // Update development impacts
    this.updateDevelopmentImpacts(knowledge, report.futureDevelopment)

    // Update confidence and metadata
    knowledge.dataPoints++
    knowledge.confidenceScore = this.calculateConfidenceScore(knowledge)
    knowledge.lastUpdated = new Date().toISOString()

    this.database.updateRegionalKnowledge(knowledge)
  }

  private async updateProvinceKnowledge(
    propertyData: PropertyData,
    report: CMAReport,
    comparables: Comparable[],
    analysisQuality: number
  ): Promise<void> {
    const regionId = this.generateRegionId(propertyData.province, 'province')
    let knowledge = this.database.getRegionalKnowledge(regionId)

    if (!knowledge) {
      knowledge = this.createInitialKnowledge(regionId, propertyData.province, 'province')
    }

    // Update with aggregated data (province-level patterns)
    this.updateMarketCharacteristics(knowledge, propertyData, report, comparables)
    knowledge.dataPoints++
    knowledge.confidenceScore = this.calculateConfidenceScore(knowledge)
    knowledge.lastUpdated = new Date().toISOString()

    this.database.updateRegionalKnowledge(knowledge)
  }

  private async updateNeighborhoodKnowledge(
    propertyData: PropertyData,
    report: CMAReport,
    comparables: Comparable[],
    analysisQuality: number
  ): Promise<void> {
    const regionId = this.generateRegionId(propertyData.areaCode!, 'postal_code')
    let knowledge = this.database.getRegionalKnowledge(regionId)

    if (!knowledge) {
      knowledge = this.createInitialKnowledge(regionId, propertyData.areaCode!, 'postal_code')
    }

    // Update with detailed neighborhood-specific data
    this.updateMarketCharacteristics(knowledge, propertyData, report, comparables)
    this.updateDemographicInsights(knowledge, propertyData, report)
    
    knowledge.dataPoints++
    knowledge.confidenceScore = this.calculateConfidenceScore(knowledge)
    knowledge.lastUpdated = new Date().toISOString()

    this.database.updateRegionalKnowledge(knowledge)
  }

  private createInitialKnowledge(
    regionId: string, 
    regionName: string, 
    regionType: 'city' | 'province' | 'neighborhood' | 'postal_code'
  ): RegionalKnowledge {
    return {
      id: regionId,
      regionType,
      regionName,
      marketCharacteristics: {
        averagePricePerM2: 0,
        priceVolatility: 0,
        priceAppreciation: 0,
        averageTimeOnMarket: 0,
        inventoryLevels: 'moderate',
        demandLevel: 'moderate',
        bestPerformingTypes: [],
        worstPerformingTypes: [],
        averageRentalYield: 0,
        investmentGrade: 'C',
        riskFactors: [],
        opportunities: []
      },
      pricingPatterns: [],
      developmentImpacts: [],
      seasonalPatterns: [],
      demographicInsights: [],
      confidenceScore: 0,
      lastUpdated: new Date().toISOString(),
      dataPoints: 0
    }
  }

  private updateMarketCharacteristics(
    knowledge: RegionalKnowledge,
    propertyData: PropertyData,
    report: CMAReport,
    comparables: Comparable[]
  ): void {
    const marketChar = knowledge.marketCharacteristics
    const dataPoints = knowledge.dataPoints

    // Update average price per m²
    const propertyPricePerM2 = propertyData.price && propertyData.totalAreaM2 
      ? propertyData.price / propertyData.totalAreaM2 
      : 0

    if (propertyPricePerM2 > 0) {
      marketChar.averagePricePerM2 = dataPoints > 0 
        ? (marketChar.averagePricePerM2 * dataPoints + propertyPricePerM2) / (dataPoints + 1)
        : propertyPricePerM2
    }

    // Update time on market
    if (report.marketTrends.daysOnMarket > 0) {
      marketChar.averageTimeOnMarket = dataPoints > 0
        ? (marketChar.averageTimeOnMarket * dataPoints + report.marketTrends.daysOnMarket) / (dataPoints + 1)
        : report.marketTrends.daysOnMarket
    }

    // Update market trend indicators
    if (report.marketTrends.priceChange6Month !== undefined) {
      marketChar.priceAppreciation = dataPoints > 0
        ? (marketChar.priceAppreciation * dataPoints + report.marketTrends.priceChange6Month * 2) / (dataPoints + 1) // Annualized
        : report.marketTrends.priceChange6Month * 2
    }

    // Update property type performance
    this.updatePropertyTypePerformance(marketChar, propertyData.propertyType, propertyPricePerM2)

    // Update inventory and demand levels
    this.updateInventoryAndDemand(marketChar, report.marketTrends)

    // Update investment metrics
    // Note: averageRent not available in MarketTrends, skip rental yield calculation
    // if (report.marketTrends.averageRent && propertyData.price) {
    //   const rentalYield = (report.marketTrends.averageRent * 12 / propertyData.price) * 100
    //   marketChar.averageRentalYield = dataPoints > 0
    //     ? (marketChar.averageRentalYield * dataPoints + rentalYield) / (dataPoints + 1)
    //     : rentalYield
    // }

    // Update investment grade
    marketChar.investmentGrade = this.calculateInvestmentGrade(marketChar)
  }

  private updatePricingPatterns(
    knowledge: RegionalKnowledge,
    propertyData: PropertyData,
    report: CMAReport,
    comparables: Comparable[]
  ): void {
    // Analyze pricing patterns from comparables
    if (comparables.length >= 3) {
      const pattern = this.identifyPricingPattern(propertyData, comparables)
      if (pattern) {
        // Check if this pattern already exists
        const existingPattern = knowledge.pricingPatterns.find(p => p.pattern === pattern.pattern)
        if (existingPattern) {
          existingPattern.confidence = Math.min(100, existingPattern.confidence + 5)
          existingPattern.exampleCases.push(this.generatePropertyId(propertyData))
        } else {
          knowledge.pricingPatterns.push(pattern)
        }
      }
    }
  }

  private updateSeasonalPatterns(
    knowledge: RegionalKnowledge,
    propertyData: PropertyData,
    report: CMAReport
  ): void {
    const currentSeason = this.getCurrentSeason()
    const timeOnMarket = report.marketTrends.daysOnMarket

    let seasonalPattern = knowledge.seasonalPatterns.find(sp => sp.season === currentSeason)
    if (!seasonalPattern) {
      seasonalPattern = {
        season: currentSeason,
        priceAdjustment: 0,
        marketActivity: 'moderate',
        averageTimeOnMarket: timeOnMarket,
        yearsOfData: 1,
        confidence: 30
      }
      knowledge.seasonalPatterns.push(seasonalPattern)
    } else {
      // Update seasonal pattern with new data
      seasonalPattern.averageTimeOnMarket = 
        (seasonalPattern.averageTimeOnMarket + timeOnMarket) / 2
      seasonalPattern.confidence = Math.min(100, seasonalPattern.confidence + 2)
    }
  }

  private updateDevelopmentImpacts(
    knowledge: RegionalKnowledge,
    developments: any[]
  ): void {
    developments.forEach(dev => {
      let impact = knowledge.developmentImpacts.find(di => 
        di.developmentType === dev.type && Math.abs(di.distance - (dev.distance || 1)) < 0.5
      )

      if (!impact) {
        impact = {
          developmentType: dev.type,
          distance: dev.distance || 1,
          impactOnPrice: dev.impact === 'positive' ? 5 : dev.impact === 'negative' ? -5 : 0,
          impactTimeframe: '1-2 years',
          confidence: 40,
          historicalCases: []
        }
        knowledge.developmentImpacts.push(impact)
      } else {
        // Update confidence
        impact.confidence = Math.min(100, impact.confidence + 3)
      }
    })
  }

  private updateDemographicInsights(
    knowledge: RegionalKnowledge,
    propertyData: PropertyData,
    report: CMAReport
  ): void {
    // This would analyze buyer patterns and demographics
    // For now, we'll create basic insights based on property type and features
    
    const insight: DemographicInsight = {
      buyerProfile: {
        ageRange: this.inferAgeRange(propertyData),
        incomeLevel: this.inferIncomeLevel(propertyData),
        familyStatus: this.inferFamilyStatus(propertyData),
        nationality: ['Spanish', 'International']
      },
      preferences: {
        propertyTypes: [propertyData.propertyType],
        features: propertyData.features || [],
        priceRange: {
          min: propertyData.price ? propertyData.price * 0.8 : 0,
          max: propertyData.price ? propertyData.price * 1.2 : 0
        }
      },
      motivations: this.inferMotivations(propertyData),
      sensitivity: {
        priceChanges: 70, // Default sensitivity
        marketConditions: 60
      }
    }

    // Update or add demographic insight
    knowledge.demographicInsights = [insight] // Simplified for now
  }

  private calculateConfidenceScore(knowledge: RegionalKnowledge): number {
    let confidence = 0
    const dataPoints = knowledge.dataPoints

    // Base confidence from data points
    confidence += Math.min(50, dataPoints * 2)

    // Confidence from pricing patterns
    confidence += Math.min(20, knowledge.pricingPatterns.length * 4)

    // Confidence from seasonal data
    confidence += Math.min(15, knowledge.seasonalPatterns.length * 5)

    // Confidence from development data
    confidence += Math.min(15, knowledge.developmentImpacts.length * 3)

    return Math.min(100, confidence)
  }

  private updatePropertyTypePerformance(
    marketChar: MarketCharacteristics,
    propertyType: string,
    pricePerM2: number
  ): void {
    if (pricePerM2 > marketChar.averagePricePerM2 * 1.1) {
      // This property type is performing well
      if (!marketChar.bestPerformingTypes.includes(propertyType)) {
        marketChar.bestPerformingTypes.push(propertyType)
      }
      // Remove from worst performing if present
      marketChar.worstPerformingTypes = marketChar.worstPerformingTypes.filter(t => t !== propertyType)
    } else if (pricePerM2 < marketChar.averagePricePerM2 * 0.9) {
      // This property type is performing poorly
      if (!marketChar.worstPerformingTypes.includes(propertyType)) {
        marketChar.worstPerformingTypes.push(propertyType)
      }
      // Remove from best performing if present
      marketChar.bestPerformingTypes = marketChar.bestPerformingTypes.filter(t => t !== propertyType)
    }
  }

  private updateInventoryAndDemand(
    marketChar: MarketCharacteristics,
    marketTrends: any
  ): void {
    // Update based on time on market and inventory data
    if (marketTrends.daysOnMarket < 30) {
      marketChar.inventoryLevels = 'low'
      marketChar.demandLevel = 'high'
    } else if (marketTrends.daysOnMarket > 90) {
      marketChar.inventoryLevels = 'high'
      marketChar.demandLevel = 'low'
    } else {
      marketChar.inventoryLevels = 'moderate'
      marketChar.demandLevel = 'moderate'
    }
  }

  private calculateInvestmentGrade(marketChar: MarketCharacteristics): 'A' | 'B' | 'C' | 'D' | 'F' {
    let score = 0

    // Price appreciation
    if (marketChar.priceAppreciation > 5) score += 25
    else if (marketChar.priceAppreciation > 2) score += 15
    else if (marketChar.priceAppreciation > 0) score += 10

    // Rental yield
    if (marketChar.averageRentalYield > 6) score += 20
    else if (marketChar.averageRentalYield > 4) score += 15
    else if (marketChar.averageRentalYield > 2) score += 10

    // Time on market (liquidity)
    if (marketChar.averageTimeOnMarket < 45) score += 20
    else if (marketChar.averageTimeOnMarket < 75) score += 15
    else if (marketChar.averageTimeOnMarket < 120) score += 10

    // Demand level
    if (marketChar.demandLevel === 'high') score += 15
    else if (marketChar.demandLevel === 'moderate') score += 10

    // Inventory level (scarcity premium)
    if (marketChar.inventoryLevels === 'low') score += 10
    else if (marketChar.inventoryLevels === 'moderate') score += 5

    // Risk factors (penalty)
    score -= marketChar.riskFactors.length * 5

    // Convert to grade
    if (score >= 80) return 'A'
    if (score >= 65) return 'B'
    if (score >= 50) return 'C'
    if (score >= 35) return 'D'
    return 'F'
  }

  private identifyPricingPattern(
    propertyData: PropertyData,
    comparables: Comparable[]
  ): PricingPattern | null {
    const prices = comparables.map(c => c.price)
    const areas = comparables.map(c => c.m2) // Already in m²
    const pricesPerM2 = prices.map((price, idx) => price / areas[idx])

    const avgPricePerM2 = pricesPerM2.reduce((sum, price) => sum + price, 0) / pricesPerM2.length
    const propertyPricePerM2 = propertyData.price && propertyData.totalAreaM2 
      ? propertyData.price / propertyData.totalAreaM2 
      : 0

    if (propertyPricePerM2 === 0) return null

    const deviation = ((propertyPricePerM2 - avgPricePerM2) / avgPricePerM2) * 100

    if (Math.abs(deviation) > 10) {
      return {
        pattern: deviation > 0 ? 'Premium pricing in area' : 'Discount pricing in area',
        conditions: [
          `Property type: ${propertyData.propertyType}`,
          `Size range: ${propertyData.totalAreaM2}m²`,
          `Feature set: ${propertyData.features?.join(', ') || 'basic'}`
        ],
        impact: Math.round(deviation),
        confidence: 60,
        exampleCases: [this.generatePropertyId(propertyData)]
      }
    }

    return null
  }

  private analyzeRegionalPatterns(knowledge: RegionalKnowledge): any {
    return {
      pricingPatterns: knowledge.pricingPatterns.map(pp => ({
        pattern: pp.pattern,
        impact: pp.impact,
        confidence: pp.confidence
      })),
      seasonalTrends: knowledge.seasonalPatterns.map(sp => ({
        season: sp.season,
        adjustment: sp.priceAdjustment,
        activity: sp.marketActivity
      })),
      developmentEffects: knowledge.developmentImpacts.map(di => ({
        type: di.developmentType,
        impact: di.impactOnPrice,
        distance: di.distance
      }))
    }
  }

  private generateRegionalForecast(knowledge: RegionalKnowledge): any {
    const marketChar = knowledge.marketCharacteristics

    return {
      priceForeceast: {
        sixMonths: marketChar.priceAppreciation / 2,
        oneYear: marketChar.priceAppreciation,
        twoYears: marketChar.priceAppreciation * 1.8
      },
      marketActivity: {
        expectedTimeOnMarket: marketChar.averageTimeOnMarket,
        demandForecast: marketChar.demandLevel,
        inventoryForecast: marketChar.inventoryLevels
      },
      investmentOutlook: {
        grade: marketChar.investmentGrade,
        rentalYieldForecast: marketChar.averageRentalYield,
        riskLevel: this.calculateRiskLevel(marketChar)
      }
    }
  }

  // Helper methods
  private generateRegionId(name: string, type: string): string {
    return `${type}_${name.toLowerCase().replace(/\s+/g, '_')}`
  }

  private generatePropertyId(propertyData: PropertyData): string {
    const baseString = `${propertyData.address}-${propertyData.city}-${propertyData.province}`
    return Buffer.from(baseString).toString('base64').replace(/[/+=]/g, '').substring(0, 16)
  }

  private getCurrentSeason(): 'spring' | 'summer' | 'autumn' | 'winter' {
    const month = new Date().getMonth() + 1
    if (month >= 3 && month <= 5) return 'spring'
    if (month >= 6 && month <= 8) return 'summer'
    if (month >= 9 && month <= 11) return 'autumn'
    return 'winter'
  }

  private inferAgeRange(propertyData: PropertyData): string {
    if (propertyData.bedrooms >= 3) return '35-55'
    if (propertyData.bedrooms === 2) return '25-45'
    return '20-35'
  }

  private inferIncomeLevel(propertyData: PropertyData): string {
    if (!propertyData.price) return 'medium'
    if (propertyData.price > 500000) return 'high'
    if (propertyData.price > 200000) return 'medium'
    return 'low'
  }

  private inferFamilyStatus(propertyData: PropertyData): string {
    if (propertyData.bedrooms >= 3) return 'family'
    if (propertyData.bedrooms === 2) return 'couple'
    return 'single'
  }

  private inferMotivations(propertyData: PropertyData): string[] {
    const motivations = ['primary_residence']
    
    if (propertyData.price && propertyData.price < 300000) {
      motivations.push('investment')
    }
    
    if (propertyData.features?.includes('terrace') || propertyData.features?.includes('garden')) {
      motivations.push('lifestyle')
    }
    
    if (propertyData.condition === 'needs work') {
      motivations.push('renovation_project')
    }

    return motivations
  }

  private calculateRiskLevel(marketChar: MarketCharacteristics): 'low' | 'medium' | 'high' {
    let riskScore = 0

    if (marketChar.priceVolatility > 20) riskScore += 2
    else if (marketChar.priceVolatility > 10) riskScore += 1

    if (marketChar.averageTimeOnMarket > 120) riskScore += 2
    else if (marketChar.averageTimeOnMarket > 75) riskScore += 1

    if (marketChar.priceAppreciation < -5) riskScore += 3
    else if (marketChar.priceAppreciation < 0) riskScore += 1

    riskScore += marketChar.riskFactors.length

    if (riskScore >= 6) return 'high'
    if (riskScore >= 3) return 'medium'
    return 'low'
  }
}

// Create singleton instances
export const regionalKnowledgeDatabase = new RegionalKnowledgeDatabase()
export const regionalIntelligence = new RegionalIntelligenceEngine()

export default {
  RegionalKnowledgeDatabase,
  RegionalIntelligenceEngine,
  regionalKnowledgeDatabase,
  regionalIntelligence
} 