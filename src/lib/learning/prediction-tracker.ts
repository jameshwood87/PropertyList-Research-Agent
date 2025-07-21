// Market Prediction Tracking & Validation System
// Tracks forecasts vs reality and learns from prediction accuracy

import { 
  MarketPrediction, 
  PredictionValidation, 
  ModelPerformance,
  LearningAnalytics 
} from './learning-types'
import { PropertyData, CMAReport, ValuationEstimate, MarketTrends } from '@/types'
import path from 'path'
import fs from 'fs'

// ========================================
// PREDICTION DATABASE MANAGEMENT
// ========================================

export class PredictionDatabase {
  private dataDir: string
  private predictionsFile: string
  private validationsFile: string
  private predictions: Map<string, MarketPrediction> = new Map()
  private validations: Map<string, PredictionValidation> = new Map()
  private isLoaded: boolean = false

  constructor(dataDir: string = './data/learning') {
    this.dataDir = dataDir
    this.predictionsFile = path.join(dataDir, 'market-predictions.json')
    this.validationsFile = path.join(dataDir, 'prediction-validations.json')
    this.ensureDataDirectory()
    this.loadDatabase()
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
      console.log(`Created prediction data directory: ${this.dataDir}`)
    }
  }

  private loadDatabase(): void {
    try {
      // Load predictions
      if (fs.existsSync(this.predictionsFile)) {
        const data = fs.readFileSync(this.predictionsFile, 'utf8')
        const predictionsArray: MarketPrediction[] = JSON.parse(data)
        this.predictions.clear()
        predictionsArray.forEach(pred => {
          this.predictions.set(pred.id, pred)
        })
        console.log(`Loaded ${this.predictions.size} predictions from database`)
      }

      // Load validations
      if (fs.existsSync(this.validationsFile)) {
        const data = fs.readFileSync(this.validationsFile, 'utf8')
        const validationsArray: PredictionValidation[] = JSON.parse(data)
        this.validations.clear()
        validationsArray.forEach(val => {
          this.validations.set(val.id, val)
        })
        console.log(`Loaded ${this.validations.size} validations from database`)
      }

      this.isLoaded = true
    } catch (error) {
      console.error('Error loading prediction database:', error)
      this.predictions.clear()
      this.validations.clear()
      this.isLoaded = true
    }
  }

  private saveDatabase(): void {
    try {
      // Save predictions
      const predictionsArray = Array.from(this.predictions.values())
      fs.writeFileSync(this.predictionsFile, JSON.stringify(predictionsArray, null, 2), 'utf8')

      // Save validations
      const validationsArray = Array.from(this.validations.values())
      fs.writeFileSync(this.validationsFile, JSON.stringify(validationsArray, null, 2), 'utf8')
    } catch (error) {
      console.error('Error saving prediction database:', error)
    }
  }

  public addPrediction(prediction: MarketPrediction): void {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    this.predictions.set(prediction.id, prediction)
    this.saveDatabase()
    console.log(`Saved prediction for property: ${prediction.propertyId}`)
  }

  public addValidation(validation: PredictionValidation): void {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    this.validations.set(validation.id, validation)
    this.saveDatabase()
    console.log(`Saved validation for prediction: ${validation.predictionId}`)
  }

  public getPrediction(predictionId: string): MarketPrediction | null {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    return this.predictions.get(predictionId) || null
  }

  public getPredictionsByProperty(propertyId: string): MarketPrediction[] {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    return Array.from(this.predictions.values()).filter(pred => pred.propertyId === propertyId)
  }

  public getPredictionsForValidation(): MarketPrediction[] {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    const now = new Date()
    const validationCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days old

    return Array.from(this.predictions.values()).filter(pred => {
      // Only validate predictions that are old enough
      const predictionDate = new Date(pred.timestamp)
      return predictionDate < validationCutoff && !this.hasValidation(pred.id)
    })
  }

  public hasValidation(predictionId: string): boolean {
    return Array.from(this.validations.values()).some(val => val.predictionId === predictionId)
  }

  public getAllPredictions(): MarketPrediction[] {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    return Array.from(this.predictions.values())
  }

  public getAllValidations(): PredictionValidation[] {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    return Array.from(this.validations.values())
  }

  public getPerformanceStats(): {
    totalPredictions: number
    validatedPredictions: number
    averageAccuracy: number
    priceAccuracy: number
    trendAccuracy: number
    modelCalibration: number
  } {
    const allPredictions = this.getAllPredictions()
    const allValidations = this.getAllValidations()

    if (allValidations.length === 0) {
      return {
        totalPredictions: allPredictions.length,
        validatedPredictions: 0,
        averageAccuracy: 0,
        priceAccuracy: 0,
        trendAccuracy: 0,
        modelCalibration: 0
      }
    }

    const averageAccuracy = allValidations.reduce((sum, val) => sum + val.overallAccuracy, 0) / allValidations.length
    const priceAccuracy = allValidations.reduce((sum, val) => sum + val.priceAccuracy, 0) / allValidations.length
    const trendAccuracy = allValidations.reduce((sum, val) => sum + val.trendAccuracy, 0) / allValidations.length

    // Model calibration: how well confidence scores match actual accuracy
    const calibrationErrors = allValidations.map(val => {
      const prediction = this.getPrediction(val.predictionId)
      if (prediction) {
        return Math.abs(prediction.modelConfidence - val.overallAccuracy)
      }
      return 0
    })
    const modelCalibration = 100 - (calibrationErrors.reduce((sum, err) => sum + err, 0) / calibrationErrors.length)

    return {
      totalPredictions: allPredictions.length,
      validatedPredictions: allValidations.length,
      averageAccuracy,
      priceAccuracy,
      trendAccuracy,
      modelCalibration: Math.max(0, modelCalibration)
    }
  }
}

// ========================================
// PREDICTION TRACKING SERVICE
// ========================================

export class PredictionTrackingService {
  private database: PredictionDatabase

  constructor(dataDir?: string) {
    this.database = new PredictionDatabase(dataDir)
  }

  // Store a new prediction from analysis
  public async storePrediction(
    sessionId: string,
    propertyData: PropertyData,
    report: CMAReport
  ): Promise<string> {
    try {
      const predictionId = `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const propertyId = this.generatePropertyId(propertyData)

      const prediction: MarketPrediction = {
        id: predictionId,
        sessionId,
        propertyId,
        timestamp: new Date().toISOString(),
        
        // Extract predictions from the report
        predictedPriceRange: {
          low: report.valuationEstimate.low,
          high: report.valuationEstimate.high,
          estimated: report.valuationEstimate.estimated,
          confidence: report.valuationEstimate.confidence
        },
        
        predictedMarketTrend: report.marketTrends.marketTrend,
        predictedPriceChange: report.marketTrends.priceChange6Month || 0,
        predictionTimeframe: '6_months',
        
        investmentGrade: this.calculateInvestmentGrade(report),
        
        // Confidence factors
        dataQuality: this.calculateDataQuality(report),
        modelConfidence: report.valuationEstimate.confidence,
        
        // Methodology tracking
        analysisMethod: this.extractAnalysisMethods(report),
        dataSourcesUsed: this.extractDataSources(report)
      }

      this.database.addPrediction(prediction)
      console.log(`Stored prediction for property: ${propertyId}`)
      
      return predictionId
    } catch (error) {
      console.error('Error storing prediction:', error)
      throw error
    }
  }

  // Validate predictions against actual outcomes
  public async validatePredictions(): Promise<{ validated: number; accuracy: number }> {
    try {
      const predictionsToValidate = this.database.getPredictionsForValidation()
      console.log(`Found ${predictionsToValidate.length} predictions ready for validation`)

      let validatedCount = 0
      let totalAccuracy = 0

      for (const prediction of predictionsToValidate) {
        try {
          const actualData = await this.fetchActualMarketData(prediction.propertyId)
          
          if (actualData) {
            const validation = await this.createValidation(prediction, actualData)
            this.database.addValidation(validation)
            validatedCount++
            totalAccuracy += validation.overallAccuracy
            
            console.log(`Validated prediction ${prediction.id} with ${validation.overallAccuracy}% accuracy`)
          }
        } catch (error) {
          console.warn(`Failed to validate prediction ${prediction.id}:`, error)
        }
      }

      const averageAccuracy = validatedCount > 0 ? totalAccuracy / validatedCount : 0
      
      console.log(`Validation completed: ${validatedCount} predictions validated with ${averageAccuracy.toFixed(1)}% average accuracy`)
      
      return { validated: validatedCount, accuracy: averageAccuracy }
    } catch (error) {
      console.error('Error validating predictions:', error)
      return { validated: 0, accuracy: 0 }
    }
  }

  // Get prediction performance analytics
  public getPerformanceAnalytics(): any {
    const stats = this.database.getPerformanceStats()
    const allValidations = this.database.getAllValidations()

    // Analyze prediction patterns
    const performanceByMethod = this.analyzePerformanceByMethod(allValidations)
    const performanceByDataQuality = this.analyzePerformanceByDataQuality(allValidations)
    const biasAnalysis = this.analyzePredictionBias(allValidations)
    const improvementTrend = this.calculateImprovementTrend(allValidations)

    return {
      overallStats: stats,
      performanceByMethod,
      performanceByDataQuality,
      biasAnalysis,
      improvementTrend,
      recommendations: this.generatePerformanceRecommendations(stats, biasAnalysis)
    }
  }

  // Update model weights based on validation results
  public async updateModelWeights(validationResults: PredictionValidation[]): Promise<void> {
    try {
      console.log(`Updating model weights based on ${validationResults.length} validation results`)

      // Analyze success and failure patterns
      const successPatterns = this.analyzeSuccessPatterns(validationResults)
      const failurePatterns = this.analyzeFailurePatterns(validationResults)

      // Update weighting strategies
      await this.updateAnalysisWeights(successPatterns, failurePatterns)

      console.log('Model weights updated successfully')
    } catch (error) {
      console.error('Error updating model weights:', error)
    }
  }

  // Private helper methods
  private generatePropertyId(propertyData: PropertyData): string {
    const baseString = `${propertyData.address}-${propertyData.city}-${propertyData.province}`
    return Buffer.from(baseString).toString('base64').replace(/[/+=]/g, '').substring(0, 16)
  }

  private calculateInvestmentGrade(report: CMAReport): 'A' | 'B' | 'C' | 'D' | 'F' {
    let score = 0

    // Valuation confidence
    if (report.valuationEstimate.confidence > 80) score += 20
    else if (report.valuationEstimate.confidence > 60) score += 15
    else if (report.valuationEstimate.confidence > 40) score += 10

    // Market trends
    if (report.marketTrends.marketTrend === 'up') score += 15
    else if (report.marketTrends.marketTrend === 'stable') score += 10

    // Data availability
    if (report.comparableProperties.length > 5) score += 15
    else if (report.comparableProperties.length > 2) score += 10

    if (report.nearbyAmenities.length > 10) score += 10
    else if (report.nearbyAmenities.length > 5) score += 5

    // Future development
    const positiveDevelopments = report.futureDevelopment.filter(d => d.impact === 'positive').length
    if (positiveDevelopments > 2) score += 10
    else if (positiveDevelopments > 0) score += 5

    // Convert score to grade
    if (score >= 80) return 'A'
    if (score >= 65) return 'B'
    if (score >= 50) return 'C'
    if (score >= 35) return 'D'
    return 'F'
  }

  private calculateDataQuality(report: CMAReport): number {
    let quality = 0
    let maxQuality = 0

    // Comparable properties quality
    maxQuality += 30
    if (report.comparableProperties.length > 5) quality += 30
    else if (report.comparableProperties.length > 2) quality += 20
    else if (report.comparableProperties.length > 0) quality += 10

    // Market data quality
    maxQuality += 25
    if (report.marketTrends.averagePrice > 0) quality += 25

    // Amenities data quality
    maxQuality += 20
    if (report.nearbyAmenities.length > 10) quality += 20
    else if (report.nearbyAmenities.length > 5) quality += 15
    else if (report.nearbyAmenities.length > 0) quality += 10

    // Location data quality
    maxQuality += 15
    if (report.coordinates) quality += 15

    // Future development data
    maxQuality += 10
    if (report.futureDevelopment.length > 0) quality += 10

    return Math.round((quality / maxQuality) * 100)
  }

  private extractAnalysisMethods(report: CMAReport): string[] {
    const methods: string[] = []
    
    if (report.comparableProperties.length > 0) methods.push('comparable_analysis')
    if (report.marketTrends.averagePrice > 0) methods.push('market_data_analysis')
    if (report.futureDevelopment.length > 0) methods.push('development_impact_analysis')
    if (report.walkabilityData) methods.push('mobility_analysis')
    if (report.nearbyAmenities.length > 0) methods.push('amenity_analysis')

    return methods
  }

  private extractDataSources(report: CMAReport): string[] {
    const sources: string[] = []
    
    if (report.comparableProperties.length > 0) sources.push('property_feed')
    if (report.marketTrends.averagePrice > 0) sources.push('property_feed')
    if (report.nearbyAmenities.length > 0) sources.push('google_maps')
    if (report.futureDevelopment.length > 0) sources.push('tavily_search')

    return sources
  }

  private async fetchActualMarketData(propertyId: string): Promise<any> {
    // This would integrate with external services to get actual market outcomes
    // For now, we'll simulate this
    try {
      // In a real implementation, this would:
      // 1. Check property listing sites for actual sale price
      // 2. Query market data APIs for actual trends
      // 3. Use property registry data if available
      
      console.log(`Fetching actual market data for property: ${propertyId}`)
      
      // Simulated data for development
      // In production, this would be replaced with real API calls
      return null // Return null for now to indicate no data available
      
    } catch (error) {
      console.warn(`Could not fetch actual data for property ${propertyId}:`, error)
      return null
    }
  }

  private async createValidation(prediction: MarketPrediction, actualData: any): Promise<PredictionValidation> {
    const validationId = `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Calculate accuracy metrics
    const priceAccuracy = this.calculatePriceAccuracy(prediction, actualData)
    const trendAccuracy = this.calculateTrendAccuracy(prediction, actualData)
    const overallAccuracy = (priceAccuracy + trendAccuracy) / 2

    // Analyze success and failure factors
    const successFactors = this.identifySuccessFactors(prediction, actualData, overallAccuracy)
    const failureFactors = this.identifyFailureFactors(prediction, actualData, overallAccuracy)

    const validation: PredictionValidation = {
      id: validationId,
      predictionId: prediction.id,
      validationDate: new Date().toISOString(),
      
      actualOutcome: {
        actualPrice: actualData.price,
        actualMarketTrend: actualData.trend,
        actualPriceChange: actualData.priceChange,
        actualTimeOnMarket: actualData.timeOnMarket
      },
      
      priceAccuracy,
      trendAccuracy,
      overallAccuracy,
      
      successFactors,
      failureFactors,
      
      modelPerformance: {
        accuracyScore: overallAccuracy,
        precisionScore: this.calculatePrecision(prediction, actualData),
        recallScore: this.calculateRecall(prediction, actualData),
        confidenceCalibration: this.calculateConfidenceCalibration(prediction, actualData),
        biasDetection: this.detectBias(prediction, actualData)
      }
    }

    return validation
  }

  private calculatePriceAccuracy(prediction: MarketPrediction, actualData: any): number {
    const predicted = prediction.predictedPriceRange.estimated
    const actual = actualData.price
    
    if (!actual || actual <= 0) return 0
    
    const error = Math.abs(predicted - actual) / actual
    return Math.max(0, 100 - (error * 100))
  }

  private calculateTrendAccuracy(prediction: MarketPrediction, actualData: any): number {
    const predictedTrend = prediction.predictedMarketTrend
    const actualTrend = actualData.trend
    
    if (predictedTrend === actualTrend) return 100
    if ((predictedTrend === 'stable' && actualTrend !== 'stable') || 
        (predictedTrend !== 'stable' && actualTrend === 'stable')) return 50
    return 0 // Opposite trends
  }

  private calculatePrecision(prediction: MarketPrediction, actualData: any): number {
    // Implement precision calculation based on prediction confidence vs accuracy
    const confidence = prediction.modelConfidence
    const actual = actualData.price
    const predicted = prediction.predictedPriceRange.estimated
    
    if (!actual) return 0
    
    const accuracy = this.calculatePriceAccuracy(prediction, actualData)
    return Math.min(100, accuracy * (confidence / 100))
  }

  private calculateRecall(prediction: MarketPrediction, actualData: any): number {
    // Implement recall calculation
    // For now, return a simple metric based on data quality
    return prediction.dataQuality
  }

  private calculateConfidenceCalibration(prediction: MarketPrediction, actualData: any): number {
    const confidence = prediction.modelConfidence
    const accuracy = this.calculatePriceAccuracy(prediction, actualData)
    
    // Good calibration means confidence matches accuracy
    const calibrationError = Math.abs(confidence - accuracy)
    return Math.max(0, 100 - calibrationError)
  }

  private detectBias(prediction: MarketPrediction, actualData: any): any {
    const predicted = prediction.predictedPriceRange.estimated
    const actual = actualData.price
    
    const bias: any = {}
    
    if (actual && predicted) {
      const priceBias = ((predicted - actual) / actual) * 100
      if (Math.abs(priceBias) > 5) {
        bias.priceRangeBias = priceBias
      }
    }

    return bias
  }

  private identifySuccessFactors(prediction: MarketPrediction, actualData: any, accuracy: number): string[] {
    const factors: string[] = []
    
    if (accuracy > 80) {
      if (prediction.dataQuality > 80) factors.push('high_data_quality')
      if (prediction.modelConfidence > 80) factors.push('high_model_confidence')
      if (prediction.analysisMethod.length > 3) factors.push('comprehensive_analysis')
    }

    return factors
  }

  private identifyFailureFactors(prediction: MarketPrediction, actualData: any, accuracy: number): string[] {
    const factors: string[] = []
    
    if (accuracy < 50) {
      if (prediction.dataQuality < 50) factors.push('low_data_quality')
      if (prediction.modelConfidence < 50) factors.push('low_model_confidence')
      if (prediction.analysisMethod.length < 2) factors.push('limited_analysis_methods')
    }

    return factors
  }

  private analyzePerformanceByMethod(validations: PredictionValidation[]): any {
    // Group validations by analysis methods and calculate performance
    const methodPerformance: any = {}
    
    validations.forEach(validation => {
      const prediction = this.database.getPrediction(validation.predictionId)
      if (prediction) {
        prediction.analysisMethod.forEach(method => {
          if (!methodPerformance[method]) {
            methodPerformance[method] = { accuracies: [], count: 0 }
          }
          methodPerformance[method].accuracies.push(validation.overallAccuracy)
          methodPerformance[method].count++
        })
      }
    })

    // Calculate average performance for each method
    Object.keys(methodPerformance).forEach(method => {
      const accuracies = methodPerformance[method].accuracies
      methodPerformance[method].averageAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length
    })

    return methodPerformance
  }

  private analyzePerformanceByDataQuality(validations: PredictionValidation[]): any {
    const qualityBuckets = {
      'high': { accuracies: [] as number[], threshold: 80, averageAccuracy: 0 },
      'medium': { accuracies: [] as number[], threshold: 60, averageAccuracy: 0 },
      'low': { accuracies: [] as number[], threshold: 0, averageAccuracy: 0 }
    }

    validations.forEach(validation => {
      const prediction = this.database.getPrediction(validation.predictionId)
      if (prediction) {
        const quality = prediction.dataQuality
        if (quality >= 80) qualityBuckets.high.accuracies.push(validation.overallAccuracy)
        else if (quality >= 60) qualityBuckets.medium.accuracies.push(validation.overallAccuracy)
        else qualityBuckets.low.accuracies.push(validation.overallAccuracy)
      }
    })

    // Calculate averages
    Object.keys(qualityBuckets).forEach(bucket => {
      const accuracies = qualityBuckets[bucket as keyof typeof qualityBuckets].accuracies
      qualityBuckets[bucket as keyof typeof qualityBuckets].averageAccuracy = 
        accuracies.length > 0 ? accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length : 0
    })

    return qualityBuckets
  }

  private analyzePredictionBias(validations: PredictionValidation[]): any {
    const biases = {
      priceOverestimation: 0,
      priceUnderestimation: 0,
      trendBias: {},
      confidenceOverconfidence: 0
    }

    validations.forEach(validation => {
      const prediction = this.database.getPrediction(validation.predictionId)
      if (prediction && validation.actualOutcome.actualPrice) {
        const predicted = prediction.predictedPriceRange.estimated
        const actual = validation.actualOutcome.actualPrice
        
        if (predicted > actual) biases.priceOverestimation++
        else if (predicted < actual) biases.priceUnderestimation++

        // Confidence calibration
        if (prediction.modelConfidence > validation.overallAccuracy) {
          biases.confidenceOverconfidence++
        }
      }
    })

    return biases
  }

  private calculateImprovementTrend(validations: PredictionValidation[]): any {
    // Sort by date and calculate moving average accuracy
    const sortedValidations = validations.sort((a, b) => 
      new Date(a.validationDate).getTime() - new Date(b.validationDate).getTime()
    )

    const windowSize = 10
    const movingAverages = []

    for (let i = windowSize - 1; i < sortedValidations.length; i++) {
      const window = sortedValidations.slice(i - windowSize + 1, i + 1)
      const average = window.reduce((sum, val) => sum + val.overallAccuracy, 0) / window.length
      movingAverages.push({
        date: window[window.length - 1].validationDate,
        accuracy: average
      })
    }

    return {
      movingAverages,
      trend: this.calculateTrend(movingAverages),
      improvementRate: this.calculateImprovementRate(movingAverages)
    }
  }

  private calculateTrend(data: any[]): 'improving' | 'stable' | 'declining' {
    if (data.length < 2) return 'stable'
    
    const recent = data.slice(-3)
    const previous = data.slice(-6, -3)
    
    if (recent.length === 0 || previous.length === 0) return 'stable'
    
    const recentAvg = recent.reduce((sum, d) => sum + d.accuracy, 0) / recent.length
    const previousAvg = previous.reduce((sum, d) => sum + d.accuracy, 0) / previous.length
    
    const diff = recentAvg - previousAvg
    if (diff > 2) return 'improving'
    if (diff < -2) return 'declining'
    return 'stable'
  }

  private calculateImprovementRate(data: any[]): number {
    if (data.length < 2) return 0
    
    const first = data[0].accuracy
    const last = data[data.length - 1].accuracy
    const periods = data.length
    
    return ((last - first) / first) * 100 / periods // Improvement rate per period
  }

  private generatePerformanceRecommendations(stats: any, biasAnalysis: any): string[] {
    const recommendations: string[] = []

    if (stats.averageAccuracy < 70) {
      recommendations.push('Overall prediction accuracy is below target. Focus on improving data quality and analysis methods.')
    }

    if (stats.modelCalibration < 70) {
      recommendations.push('Model confidence calibration needs improvement. Adjust confidence calculation algorithms.')
    }

    if (biasAnalysis.priceOverestimation > biasAnalysis.priceUnderestimation * 1.5) {
      recommendations.push('Detected price overestimation bias. Review valuation methodology.')
    }

    if (biasAnalysis.confidenceOverconfidence > stats.validatedPredictions * 0.6) {
      recommendations.push('Model is overconfident. Reduce confidence scores or improve accuracy.')
    }

    return recommendations
  }

  private analyzeSuccessPatterns(validations: PredictionValidation[]): any {
    const successfulValidations = validations.filter(val => val.overallAccuracy > 80)
    
    // Analyze what makes predictions successful
    const patterns = {
      commonMethods: {},
      commonDataSources: {},
      dataQualityThresholds: [],
      confidenceRanges: []
    }

    successfulValidations.forEach(validation => {
      const prediction = this.database.getPrediction(validation.predictionId)
      if (prediction) {
        patterns.dataQualityThresholds.push(prediction.dataQuality)
        patterns.confidenceRanges.push(prediction.modelConfidence)
        
        prediction.analysisMethod.forEach(method => {
          patterns.commonMethods[method] = (patterns.commonMethods[method] || 0) + 1
        })
        
        prediction.dataSourcesUsed.forEach(source => {
          patterns.commonDataSources[source] = (patterns.commonDataSources[source] || 0) + 1
        })
      }
    })

    return patterns
  }

  private analyzeFailurePatterns(validations: PredictionValidation[]): any {
    const failedValidations = validations.filter(val => val.overallAccuracy < 50)
    
    // Analyze what causes prediction failures
    const patterns = {
      commonFailureMethods: {},
      lowDataQuality: [],
      overconfidenceIssues: [],
      commonFailureFactors: {}
    }

    failedValidations.forEach(validation => {
      const prediction = this.database.getPrediction(validation.predictionId)
      if (prediction) {
        if (prediction.dataQuality < 50) {
          patterns.lowDataQuality.push(prediction.id)
        }
        
        if (prediction.modelConfidence > validation.overallAccuracy + 20) {
          patterns.overconfidenceIssues.push(prediction.id)
        }

        validation.failureFactors.forEach(factor => {
          patterns.commonFailureFactors[factor] = (patterns.commonFailureFactors[factor] || 0) + 1
        })
      }
    })

    return patterns
  }

  private async updateAnalysisWeights(successPatterns: any, failurePatterns: any): Promise<void> {
    // This would update the analysis system weights based on learned patterns
    console.log('Updating analysis weights based on success/failure patterns')
    console.log('Success patterns:', successPatterns)
    console.log('Failure patterns:', failurePatterns)
    
    // In a full implementation, this would:
    // 1. Update comparable selection weights
    // 2. Adjust confidence calculation parameters
    // 3. Modify analysis method priorities
    // 4. Update data quality thresholds
  }
}

// Create singleton instances
export const predictionDatabase = new PredictionDatabase()
export const predictionTracker = new PredictionTrackingService()

export default {
  PredictionDatabase,
  PredictionTrackingService,
  predictionDatabase,
  predictionTracker
} 