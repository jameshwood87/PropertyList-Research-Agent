// Smart Comparable Selection System
// Learns from successful analyses to improve property matching and valuation accuracy

import { 
  ComparableIntelligence, 
  ComparableSelectionCriteria, 
  FeatureWeights,
  ComparablePattern,
  UserFeedback 
} from './learning-types'
import { PropertyData, Comparable } from '@/types'
import { PropertySearchCriteria } from '../feeds/property-database'
import path from 'path'
import fs from 'fs'

// ========================================
// COMPARABLE INTELLIGENCE DATABASE
// ========================================

export class ComparableIntelligenceDatabase {
  private dataDir: string
  private intelligenceFile: string
  private intelligence: Map<string, ComparableIntelligence> = new Map()
  private isLoaded: boolean = false

  constructor(dataDir: string = './data/learning') {
    this.dataDir = dataDir
    this.intelligenceFile = path.join(dataDir, 'comparable-intelligence.json')
    this.ensureDataDirectory()
    this.loadDatabase()
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
      console.log(`Created comparable intelligence data directory: ${this.dataDir}`)
    }
  }

  private loadDatabase(): void {
    try {
      if (fs.existsSync(this.intelligenceFile)) {
        const data = fs.readFileSync(this.intelligenceFile, 'utf8')
        const intelligenceArray: ComparableIntelligence[] = JSON.parse(data)
        this.intelligence.clear()
        intelligenceArray.forEach(ci => {
          this.intelligence.set(ci.id, ci)
        })
        console.log(`Loaded ${this.intelligence.size} comparable intelligence records`)
      }
      this.isLoaded = true
    } catch (error) {
      console.error('Error loading comparable intelligence database:', error)
      this.intelligence.clear()
      this.isLoaded = true
    }
  }

  private saveDatabase(): void {
    try {
      const intelligenceArray = Array.from(this.intelligence.values())
      fs.writeFileSync(this.intelligenceFile, JSON.stringify(intelligenceArray, null, 2), 'utf8')
    } catch (error) {
      console.error('Error saving comparable intelligence database:', error)
    }
  }

  public updateIntelligence(intelligence: ComparableIntelligence): void {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    this.intelligence.set(intelligence.id, intelligence)
    this.saveDatabase()
    console.log(`Updated comparable intelligence for: ${intelligence.regionId}-${intelligence.propertyType}`)
  }

  public getIntelligence(regionId: string, propertyType: string): ComparableIntelligence | null {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    
    const id = this.generateIntelligenceId(regionId, propertyType)
    return this.intelligence.get(id) || null
  }

  public getAllIntelligence(): ComparableIntelligence[] {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    return Array.from(this.intelligence.values())
  }

  public getIntelligenceStats(): {
    totalRegions: number
    totalPropertyTypes: number
    averageAccuracy: number
    bestPerformingCombinations: Array<{ region: string; type: string; accuracy: number }>
    worstPerformingCombinations: Array<{ region: string; type: string; accuracy: number }>
  } {
    const allIntelligence = this.getAllIntelligence()
    
    if (allIntelligence.length === 0) {
      return {
        totalRegions: 0,
        totalPropertyTypes: 0,
        averageAccuracy: 0,
        bestPerformingCombinations: [],
        worstPerformingCombinations: []
      }
    }

    const regions = new Set(allIntelligence.map(ci => ci.regionId))
    const propertyTypes = new Set(allIntelligence.map(ci => ci.propertyType))
    const averageAccuracy = allIntelligence.reduce((sum, ci) => sum + ci.selectionAccuracy, 0) / allIntelligence.length

    // Sort by accuracy
    const sortedByAccuracy = allIntelligence.sort((a, b) => b.selectionAccuracy - a.selectionAccuracy)

    return {
      totalRegions: regions.size,
      totalPropertyTypes: propertyTypes.size,
      averageAccuracy,
      bestPerformingCombinations: sortedByAccuracy.slice(0, 5).map(ci => ({
        region: ci.regionId,
        type: ci.propertyType,
        accuracy: ci.selectionAccuracy
      })),
      worstPerformingCombinations: sortedByAccuracy.slice(-5).map(ci => ({
        region: ci.regionId,
        type: ci.propertyType,
        accuracy: ci.selectionAccuracy
      }))
    }
  }

  private generateIntelligenceId(regionId: string, propertyType: string): string {
    return `${regionId}_${propertyType.toLowerCase().replace(/\s+/g, '_')}`
  }
}

// ========================================
// SMART COMPARABLE SELECTION ENGINE
// ========================================

export class SmartComparableEngine {
  private database: ComparableIntelligenceDatabase

  constructor(dataDir?: string) {
    this.database = new ComparableIntelligenceDatabase(dataDir)
  }

  // Get optimal selection criteria for a property
  public getOptimalCriteria(propertyData: PropertyData): ComparableSelectionCriteria {
    const regionId = this.generateRegionId(propertyData.city, propertyData.province)
    const intelligence = this.database.getIntelligence(regionId, propertyData.propertyType)

    if (intelligence && intelligence.learningConfidence > 50) {
      console.log(`Using learned criteria for ${propertyData.propertyType} in ${propertyData.city}`)
      return intelligence.optimalCriteria
    }

    // Return default criteria if no intelligence available
    console.log(`Using default criteria for ${propertyData.propertyType} in ${propertyData.city}`)
    return this.getDefaultCriteria(propertyData)
  }

  // Get feature weights for comparable selection
  public getFeatureWeights(propertyData: PropertyData): FeatureWeights {
    const regionId = this.generateRegionId(propertyData.city, propertyData.province)
    const intelligence = this.database.getIntelligence(regionId, propertyData.propertyType)

    if (intelligence && intelligence.learningConfidence > 50) {
      return intelligence.featureWeights
    }

    // Return default weights
    return this.getDefaultFeatureWeights(propertyData.propertyType)
  }

  // Learn from user feedback on comparable selections
  public async learnFromFeedback(
    propertyData: PropertyData,
    selectedComparables: Comparable[],
    userFeedback: UserFeedback
  ): Promise<void> {
    try {
      const regionId = this.generateRegionId(propertyData.city, propertyData.province)
      let intelligence = this.database.getIntelligence(regionId, propertyData.propertyType)

      if (!intelligence) {
        intelligence = this.createInitialIntelligence(regionId, propertyData.propertyType)
      }

      // Extract feedback about comparable selection
      const comparableRating = userFeedback.componentRatings.comparables
      
      // Update selection accuracy based on feedback
      this.updateSelectionAccuracy(intelligence, comparableRating.rating, comparableRating.accuracy)
      
      // Learn from successful/failed selections
      if (comparableRating.rating >= 4 && comparableRating.accuracy >= 4) {
        this.learnFromSuccessfulSelection(intelligence, propertyData, selectedComparables)
      } else if (comparableRating.rating <= 2 || comparableRating.accuracy <= 2) {
        this.learnFromFailedSelection(intelligence, propertyData, selectedComparables, comparableRating.comments)
      }

      // Update patterns
      this.updateSelectionPatterns(intelligence, propertyData, selectedComparables, comparableRating.rating)

      // Recalculate learning confidence
      intelligence.learningConfidence = this.calculateLearningConfidence(intelligence)
      intelligence.lastUpdated = new Date().toISOString()

      this.database.updateIntelligence(intelligence)
      console.log(`Updated comparable intelligence from feedback for ${propertyData.propertyType} in ${propertyData.city}`)
    } catch (error) {
      console.error('Error learning from feedback:', error)
    }
  }

  // Improve selection criteria based on validation results
  public async improveFromValidation(
    propertyData: PropertyData,
    selectedComparables: Comparable[],
    actualOutcome: {
      actualPrice?: number
      valuationAccuracy?: number
      marketPerformance?: string
    }
  ): Promise<void> {
    try {
      const regionId = this.generateRegionId(propertyData.city, propertyData.province)
      let intelligence = this.database.getIntelligence(regionId, propertyData.propertyType)

      if (!intelligence) {
        intelligence = this.createInitialIntelligence(regionId, propertyData.propertyType)
      }

      // Update valuation accuracy
      if (actualOutcome.valuationAccuracy !== undefined) {
        intelligence.valuationAccuracy = this.updateRunningAverage(
          intelligence.valuationAccuracy,
          actualOutcome.valuationAccuracy,
          10 // Weight recent data more heavily
        )
      }

      // Learn from market performance
      if (actualOutcome.actualPrice && propertyData.price) {
        const priceAccuracy = this.calculatePriceAccuracy(propertyData.price, actualOutcome.actualPrice)
        this.updateSelectionAccuracy(intelligence, priceAccuracy, priceAccuracy)
        
        // Analyze which comparables led to better predictions
        this.analyzeComparableEffectiveness(intelligence, selectedComparables, priceAccuracy)
      }

      intelligence.lastUpdated = new Date().toISOString()
      this.database.updateIntelligence(intelligence)
      
      console.log(`Improved comparable intelligence from validation for ${propertyData.propertyType} in ${propertyData.city}`)
    } catch (error) {
      console.error('Error improving from validation:', error)
    }
  }

  // Generate enhanced search criteria using learned intelligence
  public generateEnhancedCriteria(propertyData: PropertyData): PropertySearchCriteria {
    const optimalCriteria = this.getOptimalCriteria(propertyData)
    const featureWeights = this.getFeatureWeights(propertyData)

    // Build enhanced search criteria
    const criteria: PropertySearchCriteria = {
      propertyType: propertyData.propertyType,
      city: propertyData.city,
      province: propertyData.province,
      
      // Use learned optimal criteria
      maxDistance: optimalCriteria.maxDistance,
      
      // Flexible bedroom/bathroom matching based on weights
      bedrooms: this.getFlexibleBedroomCriteria(propertyData.bedrooms, featureWeights),
      bathrooms: this.getFlexibleBathroomCriteria(propertyData.bathrooms, featureWeights),
      
      // Area criteria based on learned patterns
      minAreaM2: propertyData.totalAreaM2 * optimalCriteria.areaRange.min,
      maxAreaM2: propertyData.totalAreaM2 * optimalCriteria.areaRange.max,
      
      // Feature matching based on importance weights
      features: this.getWeightedFeatures(propertyData.features || [], featureWeights),
      
      // Temporal criteria
      maxResults: 20
    }

    // Apply learned patterns
    this.applyLearnedPatterns(criteria, propertyData)

    return criteria
  }

  // Analyze selection patterns and generate insights
  public analyzeSelectionPatterns(): {
    regionalInsights: Array<{ region: string; insight: string; confidence: number }>
    propertyTypeInsights: Array<{ type: string; insight: string; confidence: number }>
    globalPatterns: Array<{ pattern: string; impact: string; confidence: number }>
    recommendations: string[]
  } {
    const allIntelligence = this.database.getAllIntelligence()
    
    return {
      regionalInsights: this.analyzeRegionalPatterns(allIntelligence),
      propertyTypeInsights: this.analyzePropertyTypePatterns(allIntelligence),
      globalPatterns: this.analyzeGlobalPatterns(allIntelligence),
      recommendations: this.generateSelectionRecommendations(allIntelligence)
    }
  }

  // Private helper methods
  private createInitialIntelligence(regionId: string, propertyType: string): ComparableIntelligence {
    return {
      id: this.database['generateIntelligenceId'](regionId, propertyType),
      regionId,
      propertyType,
      optimalCriteria: this.getDefaultCriteria({ propertyType } as PropertyData),
      featureWeights: this.getDefaultFeatureWeights(propertyType),
      successPatterns: [],
      selectionAccuracy: 70, // Start with moderate baseline
      valuationAccuracy: 70,
      lastUpdated: new Date().toISOString(),
      learningConfidence: 30 // Low initial confidence
    }
  }

  private getDefaultCriteria(propertyData: PropertyData): ComparableSelectionCriteria {
    return {
      maxDistance: 5, // 5km default
      optimalDistance: 2, // 2km preferred
      areaRange: { min: 0.8, max: 1.2 }, // ±20%
      requiredMatches: ['propertyType'],
      preferredMatches: ['bedrooms', 'condition'],
      maxAge: 365, // 1 year
      preferredAge: 180, // 6 months
      marketConditionWeight: 0.3
    }
  }

  private getDefaultFeatureWeights(propertyType: string): FeatureWeights {
    const baseWeights: FeatureWeights = {
      location: 0.3,
      size: 0.25,
      condition: 0.15,
      age: 0.1,
      features: 0.1,
      recentSales: 0.05,
      marketConditions: 0.05,
      propertyTypeSpecific: {},
      regionSpecific: {}
    }

    // Adjust weights based on property type
    switch (propertyType.toLowerCase()) {
      case 'apartment':
      case 'flat':
        baseWeights.location = 0.35 // Location more important for apartments
        baseWeights.size = 0.2
        break
      case 'villa':
      case 'house':
        baseWeights.size = 0.3 // Size more important for houses
        baseWeights.features = 0.15 // Features matter more
        break
      case 'penthouse':
        baseWeights.location = 0.4 // Premium location crucial
        baseWeights.features = 0.2 // Luxury features important
        break
    }

    return baseWeights
  }

  private updateSelectionAccuracy(
    intelligence: ComparableIntelligence, 
    rating: number, 
    accuracy: number
  ): void {
    const feedbackScore = (rating + accuracy) / 2 * 20 // Convert to 0-100 scale
    intelligence.selectionAccuracy = this.updateRunningAverage(
      intelligence.selectionAccuracy,
      feedbackScore,
      5 // Give recent feedback moderate weight
    )
  }

  private learnFromSuccessfulSelection(
    intelligence: ComparableIntelligence,
    propertyData: PropertyData,
    comparables: Comparable[]
  ): void {
    // Analyze what made this selection successful
    const distances = comparables.map(c => c.distance)
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length

    // Update optimal criteria based on successful pattern
    if (avgDistance < intelligence.optimalCriteria.optimalDistance) {
      intelligence.optimalCriteria.optimalDistance = 
        (intelligence.optimalCriteria.optimalDistance + avgDistance) / 2
    }

    // Analyze size patterns
    const sizeVariations = comparables.map(c => c.m2 / (propertyData.totalAreaM2 || 100))
    const sizeRange = {
      min: Math.min(...sizeVariations),
      max: Math.max(...sizeVariations)
    }

    // Update area range if this successful pattern is tighter
    if (sizeRange.max - sizeRange.min < intelligence.optimalCriteria.areaRange.max - intelligence.optimalCriteria.areaRange.min) {
      intelligence.optimalCriteria.areaRange = {
        min: (intelligence.optimalCriteria.areaRange.min + sizeRange.min) / 2,
        max: (intelligence.optimalCriteria.areaRange.max + sizeRange.max) / 2
      }
    }

    // Create or update success pattern
    const pattern: ComparablePattern = {
      patternName: `Successful selection for ${propertyData.propertyType}`,
      description: `Pattern that led to high user satisfaction`,
      conditions: [
        `Average distance: ${avgDistance.toFixed(1)}km`,
        `Size range: ${sizeRange.min.toFixed(2)}-${sizeRange.max.toFixed(2)}`,
        `Property type: ${propertyData.propertyType}`
      ],
      distanceAdjustment: avgDistance - intelligence.optimalCriteria.optimalDistance,
      timeAdjustment: 0,
      featureWeightAdjustments: this.calculateFeatureAdjustments(propertyData, comparables),
      useCount: 1,
      successRate: 100,
      userSatisfaction: 5
    }

    // Add or update pattern
    const existingPattern = intelligence.successPatterns.find(p => p.patternName === pattern.patternName)
    if (existingPattern) {
      existingPattern.useCount++
      existingPattern.successRate = (existingPattern.successRate + 100) / 2
      existingPattern.userSatisfaction = (existingPattern.userSatisfaction + 5) / 2
    } else {
      intelligence.successPatterns.push(pattern)
    }
  }

  private learnFromFailedSelection(
    intelligence: ComparableIntelligence,
    propertyData: PropertyData,
    comparables: Comparable[],
    comments?: string
  ): void {
    // Analyze what went wrong and adjust criteria
    if (comments) {
      if (comments.toLowerCase().includes('too far') || comments.toLowerCase().includes('distance')) {
        // Reduce maximum distance
        intelligence.optimalCriteria.maxDistance *= 0.9
        intelligence.optimalCriteria.optimalDistance *= 0.9
      }
      
      if (comments.toLowerCase().includes('different size') || comments.toLowerCase().includes('area')) {
        // Tighten area range
        intelligence.optimalCriteria.areaRange = {
          min: Math.max(0.7, intelligence.optimalCriteria.areaRange.min * 1.1),
          max: Math.min(1.3, intelligence.optimalCriteria.areaRange.max * 0.9)
        }
      }

      if (comments.toLowerCase().includes('features') || comments.toLowerCase().includes('amenities')) {
        // Increase feature matching importance
        intelligence.featureWeights.features = Math.min(0.25, intelligence.featureWeights.features * 1.2)
      }

      if (comments.toLowerCase().includes('old') || comments.toLowerCase().includes('outdated')) {
        // Prefer more recent sales
        intelligence.optimalCriteria.preferredAge = Math.max(30, intelligence.optimalCriteria.preferredAge * 0.8)
        intelligence.featureWeights.recentSales = Math.min(0.15, intelligence.featureWeights.recentSales * 1.3)
      }
    }
  }

  private updateSelectionPatterns(
    intelligence: ComparableIntelligence,
    propertyData: PropertyData,
    comparables: Comparable[],
    rating: number
  ): void {
    // Update existing patterns or create new ones based on this selection
    const selectionCharacteristics = this.analyzeSelectionCharacteristics(propertyData, comparables)
    
    // Find matching pattern or create new one
    const matchingPattern = intelligence.successPatterns.find(p => 
      this.patternsMatch(p, selectionCharacteristics)
    )

    if (matchingPattern) {
      // Update existing pattern
      matchingPattern.useCount++
      matchingPattern.successRate = (matchingPattern.successRate + rating * 20) / 2
      matchingPattern.userSatisfaction = (matchingPattern.userSatisfaction + rating) / 2
    } else if (rating >= 4) {
      // Create new successful pattern
      const newPattern: ComparablePattern = {
        patternName: `Pattern_${Date.now()}`,
        description: selectionCharacteristics.description,
        conditions: selectionCharacteristics.conditions,
        distanceAdjustment: selectionCharacteristics.avgDistance - intelligence.optimalCriteria.optimalDistance,
        timeAdjustment: 0,
        featureWeightAdjustments: {},
        useCount: 1,
        successRate: rating * 20,
        userSatisfaction: rating
      }
      intelligence.successPatterns.push(newPattern)
    }
  }

  private calculateLearningConfidence(intelligence: ComparableIntelligence): number {
    let confidence = 0

    // Base confidence from success patterns
    confidence += Math.min(40, intelligence.successPatterns.length * 8)

    // Confidence from selection accuracy
    if (intelligence.selectionAccuracy > 80) confidence += 30
    else if (intelligence.selectionAccuracy > 60) confidence += 20
    else if (intelligence.selectionAccuracy > 40) confidence += 10

    // Confidence from valuation accuracy
    if (intelligence.valuationAccuracy > 80) confidence += 20
    else if (intelligence.valuationAccuracy > 60) confidence += 15
    else if (intelligence.valuationAccuracy > 40) confidence += 10

    // Confidence from pattern success rates
    const avgPatternSuccess = intelligence.successPatterns.length > 0
      ? intelligence.successPatterns.reduce((sum, p) => sum + p.successRate, 0) / intelligence.successPatterns.length
      : 0
    confidence += avgPatternSuccess * 0.1

    return Math.min(100, confidence)
  }

  private generateRegionId(city: string, province: string): string {
    return `${city.toLowerCase().replace(/\s+/g, '_')}_${province.toLowerCase().replace(/\s+/g, '_')}`
  }

  private updateRunningAverage(currentValue: number, newValue: number, weight: number = 5): number {
    // Simple exponential moving average
    const alpha = 1 / weight
    return currentValue * (1 - alpha) + newValue * alpha
  }

  private calculatePriceAccuracy(predicted: number, actual: number): number {
    const error = Math.abs(predicted - actual) / actual
    return Math.max(0, 100 - (error * 100))
  }

  private analyzeComparableEffectiveness(
    intelligence: ComparableIntelligence,
    comparables: Comparable[],
    accuracy: number
  ): void {
    // Analyze which characteristics of comparables led to better accuracy
    if (accuracy > 80) {
      // These comparables were effective
      const distances = comparables.map(c => c.distance)
      const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length
      
      if (avgDistance < intelligence.optimalCriteria.optimalDistance) {
        // Closer comparables seem to work better
        intelligence.featureWeights.location = Math.min(0.5, intelligence.featureWeights.location * 1.1)
      }
    }
  }

  private getFlexibleBedroomCriteria(bedrooms: number, weights: FeatureWeights): number | undefined {
    // More flexible matching if size weight is high
    if (weights.size > 0.3) {
      return undefined // Don't restrict by bedrooms if size is more important
    }
    return bedrooms
  }

  private getFlexibleBathroomCriteria(bathrooms: number, weights: FeatureWeights): number | undefined {
    // More flexible matching if other factors are more important
    if (weights.location + weights.size > 0.5) {
      return undefined
    }
    return bathrooms
  }

  private getWeightedFeatures(features: string[], weights: FeatureWeights): string[] {
    if (weights.features < 0.15) {
      return [] // Don't filter by features if they're not important
    }
    return features.slice(0, 3) // Use top 3 features
  }

  private applyLearnedPatterns(criteria: PropertySearchCriteria, propertyData: PropertyData): void {
    const regionId = this.generateRegionId(propertyData.city, propertyData.province)
    const intelligence = this.database.getIntelligence(regionId, propertyData.propertyType)
    
    if (intelligence && intelligence.successPatterns.length > 0) {
      // Apply the most successful pattern
      const bestPattern = intelligence.successPatterns.reduce((best, current) => 
        current.successRate > best.successRate ? current : best
      )
      
      if (bestPattern.distanceAdjustment !== 0) {
        criteria.maxDistance = Math.max(1, (criteria.maxDistance || 5) + bestPattern.distanceAdjustment)
      }
    }
  }

  private calculateFeatureAdjustments(propertyData: PropertyData, comparables: Comparable[]): { [feature: string]: number } {
    // Analyze which features were well-matched in successful comparables
    const adjustments: { [feature: string]: number } = {}
    
    // This would analyze feature matching patterns
    // For now, return empty adjustments
    return adjustments
  }

  private analyzeSelectionCharacteristics(propertyData: PropertyData, comparables: Comparable[]): any {
    const distances = comparables.map(c => c.distance)
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length
    const maxDistance = Math.max(...distances)
    
    return {
      description: `Selection with avg distance ${avgDistance.toFixed(1)}km, max ${maxDistance.toFixed(1)}km`,
      conditions: [
        `Property type: ${propertyData.propertyType}`,
        `Comparable count: ${comparables.length}`,
        `Distance range: 0-${maxDistance.toFixed(1)}km`
      ],
      avgDistance,
      maxDistance
    }
  }

  private patternsMatch(pattern: ComparablePattern, characteristics: any): boolean {
    // Simple pattern matching - in reality this would be more sophisticated
    return pattern.conditions.some(condition => 
      characteristics.conditions.some((char: string) => char.includes(condition.split(':')[0]))
    )
  }

  private analyzeRegionalPatterns(intelligence: ComparableIntelligence[]): Array<{ region: string; insight: string; confidence: number }> {
    const regionalGroups = new Map<string, ComparableIntelligence[]>()
    
    intelligence.forEach(ci => {
      if (!regionalGroups.has(ci.regionId)) {
        regionalGroups.set(ci.regionId, [])
      }
      regionalGroups.get(ci.regionId)!.push(ci)
    })

    const insights: Array<{ region: string; insight: string; confidence: number }> = []
    
    regionalGroups.forEach((ciList, regionId) => {
      const avgAccuracy = ciList.reduce((sum, ci) => sum + ci.selectionAccuracy, 0) / ciList.length
      const avgConfidence = ciList.reduce((sum, ci) => sum + ci.learningConfidence, 0) / ciList.length
      
      if (avgAccuracy > 80) {
        insights.push({
          region: regionId,
          insight: `High comparable selection accuracy (${avgAccuracy.toFixed(1)}%) - good data availability`,
          confidence: avgConfidence
        })
      } else if (avgAccuracy < 60) {
        insights.push({
          region: regionId,
          insight: `Low comparable selection accuracy (${avgAccuracy.toFixed(1)}%) - may need data improvement`,
          confidence: avgConfidence
        })
      }
    })

    return insights
  }

  private analyzePropertyTypePatterns(intelligence: ComparableIntelligence[]): Array<{ type: string; insight: string; confidence: number }> {
    const typeGroups = new Map<string, ComparableIntelligence[]>()
    
    intelligence.forEach(ci => {
      if (!typeGroups.has(ci.propertyType)) {
        typeGroups.set(ci.propertyType, [])
      }
      typeGroups.get(ci.propertyType)!.push(ci)
    })

    const insights: Array<{ type: string; insight: string; confidence: number }> = []
    
    typeGroups.forEach((ciList, propertyType) => {
      const avgAccuracy = ciList.reduce((sum, ci) => sum + ci.selectionAccuracy, 0) / ciList.length
      const avgConfidence = ciList.reduce((sum, ci) => sum + ci.learningConfidence, 0) / ciList.length
      
      insights.push({
        type: propertyType,
        insight: `Average comparable accuracy: ${avgAccuracy.toFixed(1)}%`,
        confidence: avgConfidence
      })
    })

    return insights.sort((a, b) => b.confidence - a.confidence)
  }

  private analyzeGlobalPatterns(intelligence: ComparableIntelligence[]): Array<{ pattern: string; impact: string; confidence: number }> {
    const patterns: Array<{ pattern: string; impact: string; confidence: number }> = []
    
    // Analyze distance patterns
    const avgOptimalDistance = intelligence.reduce((sum, ci) => sum + ci.optimalCriteria.optimalDistance, 0) / intelligence.length
    patterns.push({
      pattern: `Average optimal distance: ${avgOptimalDistance.toFixed(1)}km`,
      impact: 'Comparables within this distance tend to be most effective',
      confidence: 70
    })

    // Analyze feature importance patterns
    const avgLocationWeight = intelligence.reduce((sum, ci) => sum + ci.featureWeights.location, 0) / intelligence.length
    if (avgLocationWeight > 0.35) {
      patterns.push({
        pattern: 'Location is consistently the most important factor',
        impact: 'Prioritize geographic proximity in comparable selection',
        confidence: 80
      })
    }

    return patterns
  }

  private generateSelectionRecommendations(intelligence: ComparableIntelligence[]): string[] {
    const recommendations: string[] = []
    
    const avgAccuracy = intelligence.reduce((sum, ci) => sum + ci.selectionAccuracy, 0) / intelligence.length
    if (avgAccuracy < 70) {
      recommendations.push('Overall comparable selection accuracy is below target. Review selection criteria.')
    }

    const lowConfidenceRegions = intelligence.filter(ci => ci.learningConfidence < 50)
    if (lowConfidenceRegions.length > 0) {
      recommendations.push(`${lowConfidenceRegions.length} regions have low learning confidence. Gather more feedback data.`)
    }

    const noPatterns = intelligence.filter(ci => ci.successPatterns.length === 0)
    if (noPatterns.length > 0) {
      recommendations.push(`${noPatterns.length} property type/region combinations lack success patterns. Increase feedback collection.`)
    }

    return recommendations
  }
}

// Create singleton instances
export const comparableIntelligenceDatabase = new ComparableIntelligenceDatabase()
export const smartComparableEngine = new SmartComparableEngine()

export default {
  ComparableIntelligenceDatabase,
  SmartComparableEngine,
  comparableIntelligenceDatabase,
  smartComparableEngine
} 