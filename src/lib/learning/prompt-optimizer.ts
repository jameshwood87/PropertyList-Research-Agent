// Adaptive Prompt Engineering System
// Continuously improves AI responses based on user feedback and performance metrics

import { 
  PromptPerformance, 
  ABTestResult, 
  PromptOptimization, 
  PromptMetrics,
  UserFeedback 
} from './learning-types'
import { PropertyData } from '@/types'
import path from 'path'
import fs from 'fs'

// ========================================
// PROMPT TEMPLATE LIBRARY
// ========================================

export const PROMPT_TEMPLATES = {
  location_analysis: {
    v1: {
      template: `Analyze this property description to extract specific location details:

Property: {address}, {city}, {province}
Description: "{description}"

Please extract and identify:
1. Specific streets, avenues, or roads mentioned
2. Neighbourhood names or area names
3. Urbanizations, complexes, or residential areas
4. Landmarks, monuments, or notable places
5. Nearby places of interest (schools, hospitals, shops)

IMPORTANT: Preserve all Spanish characters (á, é, í, ó, ú, ñ, ü) exactly as they appear.

Return the result in this exact JSON format:
{
  "specificStreets": ["street1", "street2"],
  "neighbourhoods": ["neighbourhood1", "neighbourhood2"],
  "urbanizations": ["urbanization1", "urbanization2"],
  "landmarks": ["landmark1", "landmark2"],
  "nearbyPlaces": ["place1", "place2"],
  "enhancedAddress": "{address}, {city}, {province}",
  "searchQueries": ["query1", "query2"]
}`,
      version: 1,
      created: '2024-01-01',
      performance: { averageQuality: 75, successRate: 85, userSatisfaction: 3.8 }
    }
  },

  market_summary: {
    v1: {
      template: `Generate a comprehensive property analysis summary based on this data:

PROPERTY: {address}, {city}
- Type: {propertyType}
- Size: {totalArea} m²{terraceArea}
- Bedrooms: {bedrooms}, Bathrooms: {bathrooms}
- Condition: {condition}
- Architectural Style: {architecturalStyle}
- Features: {features}

MARKET DATA: {marketData}
AMENITIES: {amenities}
COMPARABLES: {comparables}
DEVELOPMENTS: {developments}
INSIGHTS: {insights}

Provide analysis in this JSON format:
{
  "executiveSummary": "2-3 sentence overview",
  "investmentRecommendation": "Buy/Hold/Avoid with reasoning",
  "priceRange": "Suggested listing price range",
  "valueForeceast": "2-year value prediction",
  "prosAndCons": "Key pros and cons",
  "marketComparison": "How it compares to market"
}`,
      version: 1,
      created: '2024-01-01',
      performance: { averageQuality: 78, successRate: 82, userSatisfaction: 3.9 }
    }
  },

  valuation: {
    v1: {
      template: `Based on the comparable properties and market data provided, generate a detailed property valuation:

TARGET PROPERTY:
{propertyDetails}

COMPARABLE PROPERTIES:
{comparables}

MARKET DATA:
{marketData}

Consider:
- Recent sales in the area
- Property condition and features
- Market trends and seasonality
- Location premium/discount factors
- Development impact on values

Provide a JSON response with:
{
  "valuationRange": {"low": number, "high": number, "estimated": number},
  "confidence": number,
  "methodology": "explanation of valuation approach",
  "adjustments": [{"factor": "string", "adjustment": number, "reasoning": "string"}],
  "marketPosition": "how this property compares to local market"
}`,
      version: 1,
      created: '2024-01-01',
      performance: { averageQuality: 72, successRate: 79, userSatisfaction: 3.7 }
    }
  },

  investment_advice: {
    v1: {
      template: `Provide comprehensive investment analysis for this property:

PROPERTY ANALYSIS:
{propertyData}

MARKET CONTEXT:
{marketContext}

FINANCIAL METRICS:
{financialMetrics}

RISK FACTORS:
{riskFactors}

Generate investment advice covering:
1. Investment grade (A-F) with justification
2. Expected returns (rental yield, capital appreciation)
3. Risk assessment (market, location, property-specific risks)
4. Investment timeline recommendations
5. Exit strategy considerations

Return JSON format:
{
  "investmentGrade": "A|B|C|D|F",
  "expectedReturns": {"rentalYield": number, "capitalAppreciation": number},
  "riskLevel": "low|medium|high",
  "riskFactors": ["factor1", "factor2"],
  "timeframe": "short|medium|long",
  "recommendation": "detailed investment recommendation",
  "exitStrategy": "recommended exit strategy"
}`,
      version: 1,
      created: '2024-01-01',
      performance: { averageQuality: 80, successRate: 88, userSatisfaction: 4.1 }
    }
  },

  comparable_analysis: {
    v1: {
      template: `Analyze these comparable properties to determine market positioning:

TARGET PROPERTY:
{targetProperty}

COMPARABLE PROPERTIES:
{comparables}

For each comparable, analyze:
- Similarity to target property
- Price per m² comparison
- Feature differences and adjustments
- Time on market implications
- Location advantages/disadvantages

Provide analysis in JSON format:
{
  "bestComparables": ["reasons for selection"],
  "priceAnalysis": {"averagePricePerM2": number, "targetPositioning": "above|at|below market"},
  "adjustments": [{"comparable": "address", "adjustments": [{"factor": "string", "amount": number}]}],
  "marketInsights": "key insights from comparable analysis",
  "pricingRecommendation": "suggested pricing strategy"
}`,
      version: 1,
      created: '2024-01-01',
      performance: { averageQuality: 76, successRate: 83, userSatisfaction: 3.8 }
    }
  }
}

// ========================================
// PROMPT PERFORMANCE DATABASE
// ========================================

export class PromptPerformanceDatabase {
  private dataDir: string
  private performanceFile: string
  private optimizationsFile: string
  private abTestsFile: string
  private performance: Map<string, PromptPerformance> = new Map()
  private optimizations: Map<string, PromptOptimization> = new Map()
  private abTests: Map<string, ABTestResult> = new Map()
  private isLoaded: boolean = false

  constructor(dataDir: string = './data/learning') {
    this.dataDir = dataDir
    this.performanceFile = path.join(dataDir, 'prompt-performance.json')
    this.optimizationsFile = path.join(dataDir, 'prompt-optimizations.json')
    this.abTestsFile = path.join(dataDir, 'ab-tests.json')
    this.ensureDataDirectory()
    this.loadDatabase()
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
      console.log(`Created prompt performance data directory: ${this.dataDir}`)
    }
  }

  private loadDatabase(): void {
    try {
      // Load performance data
      if (fs.existsSync(this.performanceFile)) {
        const data = fs.readFileSync(this.performanceFile, 'utf8')
        const performanceArray: PromptPerformance[] = JSON.parse(data)
        this.performance.clear()
        performanceArray.forEach(perf => {
          this.performance.set(perf.id, perf)
        })
        console.log(`Loaded ${this.performance.size} prompt performance records`)
      }

      // Load optimizations
      if (fs.existsSync(this.optimizationsFile)) {
        const data = fs.readFileSync(this.optimizationsFile, 'utf8')
        const optimizationsArray: PromptOptimization[] = JSON.parse(data)
        this.optimizations.clear()
        optimizationsArray.forEach(opt => {
          this.optimizations.set(opt.id, opt)
        })
        console.log(`Loaded ${this.optimizations.size} prompt optimizations`)
      }

      // Load A/B tests
      if (fs.existsSync(this.abTestsFile)) {
        const data = fs.readFileSync(this.abTestsFile, 'utf8')
        const abTestsArray: ABTestResult[] = JSON.parse(data)
        this.abTests.clear()
        abTestsArray.forEach(test => {
          this.abTests.set(test.testId, test)
        })
        console.log(`Loaded ${this.abTests.size} A/B test results`)
      }

      this.isLoaded = true
    } catch (error) {
      console.error('Error loading prompt performance database:', error)
      this.performance.clear()
      this.optimizations.clear()
      this.abTests.clear()
      this.isLoaded = true
    }
  }

  private saveDatabase(): void {
    try {
      // Save performance data
      const performanceArray = Array.from(this.performance.values())
      fs.writeFileSync(this.performanceFile, JSON.stringify(performanceArray, null, 2), 'utf8')

      // Save optimizations
      const optimizationsArray = Array.from(this.optimizations.values())
      fs.writeFileSync(this.optimizationsFile, JSON.stringify(optimizationsArray, null, 2), 'utf8')

      // Save A/B tests
      const abTestsArray = Array.from(this.abTests.values())
      fs.writeFileSync(this.abTestsFile, JSON.stringify(abTestsArray, null, 2), 'utf8')
    } catch (error) {
      console.error('Error saving prompt performance database:', error)
    }
  }

  public updatePerformance(performance: PromptPerformance): void {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    this.performance.set(performance.id, performance)
    this.saveDatabase()
  }

  public addOptimization(optimization: PromptOptimization): void {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    this.optimizations.set(optimization.id, optimization)
    this.saveDatabase()
  }

  public addABTest(test: ABTestResult): void {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    this.abTests.set(test.testId, test)
    this.saveDatabase()
  }

  public getPerformanceByCategory(category: string): PromptPerformance[] {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    return Array.from(this.performance.values()).filter(perf => perf.promptCategory === category)
  }

  public getAllPerformance(): PromptPerformance[] {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    return Array.from(this.performance.values())
  }

  public getAllOptimizations(): PromptOptimization[] {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    return Array.from(this.optimizations.values())
  }

  public getAllABTests(): ABTestResult[] {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    return Array.from(this.abTests.values())
  }
}

// ========================================
// PROMPT OPTIMIZATION ENGINE
// ========================================

export class PromptOptimizationEngine {
  private database: PromptPerformanceDatabase

  constructor(dataDir?: string) {
    this.database = new PromptPerformanceDatabase(dataDir)
  }

  // Get the best performing prompt for a category
  public getBestPromptTemplate(category: string, context?: any): string {
    const categoryPerformance = this.database.getPerformanceByCategory(category)
    
    if (categoryPerformance.length === 0) {
      // Return default template if no performance data exists
      return this.getDefaultTemplate(category)
    }

    // Find the highest performing prompt
    const bestPrompt = categoryPerformance.reduce((best, current) => {
      const bestScore = this.calculateOverallScore(best)
      const currentScore = this.calculateOverallScore(current)
      return currentScore > bestScore ? current : best
    })

    return bestPrompt.promptTemplate
  }

  // Track prompt usage and performance
  public async trackPromptUsage(
    category: string,
    promptTemplate: string,
    userRating?: number,
    successMetrics?: any,
    userComments?: string
  ): Promise<void> {
    try {
      const promptId = this.generatePromptId(category, promptTemplate)
      let performance = this.database.getPerformanceByCategory(category)
        .find(p => p.id === promptId)

      if (!performance) {
        // Create new performance record
        performance = {
          id: promptId,
          promptTemplate,
          promptCategory: category as any,
          useCount: 0,
          averageQuality: 0,
          successRate: 0,
          averageResponseTime: 0,
          userRatings: [],
          userComments: [],
          tokenUsage: 0,
          costPerUse: 0,
          errorRate: 0,
          optimizationHistory: []
        }
      }

      // Update performance metrics
      performance.useCount++
      
      if (userRating) {
        performance.userRatings.push(userRating)
        performance.averageQuality = performance.userRatings.reduce((sum, rating) => sum + rating, 0) / performance.userRatings.length
      }

      if (userComments) {
        performance.userComments.push(userComments)
      }

      if (successMetrics) {
        if (successMetrics.responseTime) {
          performance.averageResponseTime = (performance.averageResponseTime * (performance.useCount - 1) + successMetrics.responseTime) / performance.useCount
        }
        if (successMetrics.success !== undefined) {
          const successCount = performance.useCount * (performance.successRate / 100)
          const newSuccessCount = successCount + (successMetrics.success ? 1 : 0)
          performance.successRate = (newSuccessCount / performance.useCount) * 100
        }
        if (successMetrics.tokenUsage) {
          performance.tokenUsage = (performance.tokenUsage * (performance.useCount - 1) + successMetrics.tokenUsage) / performance.useCount
        }
      }

      this.database.updatePerformance(performance)
      console.log(`Updated prompt performance for category: ${category}`)
    } catch (error) {
      console.error('Error tracking prompt usage:', error)
    }
  }

  // Optimize prompts based on performance data
  public async optimizePrompts(): Promise<PromptOptimization[]> {
    const optimizations: PromptOptimization[] = []
    const categories = ['location_analysis', 'market_summary', 'valuation', 'investment_advice', 'comparable_analysis']

    for (const category of categories) {
      try {
        const categoryOptimizations = await this.optimizeCategory(category)
        optimizations.push(...categoryOptimizations)
      } catch (error) {
        console.error(`Error optimizing category ${category}:`, error)
      }
    }

    console.log(`Generated ${optimizations.length} prompt optimizations`)
    return optimizations
  }

  // A/B test different prompt variations
  public async startABTest(
    category: string,
    promptA: string,
    promptB: string,
    testDuration: number = 7 // days
  ): Promise<string> {
    const testId = `ab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startDate = new Date()
    const endDate = new Date(startDate.getTime() + testDuration * 24 * 60 * 60 * 1000)

    const abTest: ABTestResult = {
      testId,
      promptA,
      promptB,
      testPeriod: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      results: {
        promptA: { uses: 0, averageRating: 0, successRate: 0 },
        promptB: { uses: 0, averageRating: 0, successRate: 0 }
      },
      winner: 'tie',
      confidenceLevel: 0,
      statisticalSignificance: false
    }

    this.database.addABTest(abTest)
    console.log(`Started A/B test ${testId} for category: ${category}`)
    
    return testId
  }

  // Analyze A/B test results
  public analyzeABTest(testId: string): ABTestResult | null {
    const test = this.database.getAllABTests().find(t => t.testId === testId)
    if (!test) return null

    // Calculate statistical significance
    const totalA = test.results.promptA.uses
    const totalB = test.results.promptB.uses
    const successA = totalA * (test.results.promptA.successRate / 100)
    const successB = totalB * (test.results.promptB.successRate / 100)

    if (totalA < 30 || totalB < 30) {
      test.statisticalSignificance = false
      test.confidenceLevel = 0
    } else {
      // Simple statistical significance test (chi-square)
      const pooledSuccess = (successA + successB) / (totalA + totalB)
      const expectedA = totalA * pooledSuccess
      const expectedB = totalB * pooledSuccess
      
      const chiSquare = Math.pow(successA - expectedA, 2) / expectedA + 
                       Math.pow(successB - expectedB, 2) / expectedB

      test.statisticalSignificance = chiSquare > 3.84 // p < 0.05
      test.confidenceLevel = test.statisticalSignificance ? 95 : 0
    }

    // Determine winner
    const scoreA = this.calculateTestScore(test.results.promptA)
    const scoreB = this.calculateTestScore(test.results.promptB)

    if (Math.abs(scoreA - scoreB) < 0.05) {
      test.winner = 'tie'
    } else if (scoreA > scoreB) {
      test.winner = 'A'
    } else {
      test.winner = 'B'
    }

    this.database.addABTest(test)
    return test
  }

  // Generate prompt variations for testing
  public generatePromptVariations(originalPrompt: string, category: string): string[] {
    const variations: string[] = []

    // Rule-based variations
    variations.push(this.addClarityImprovements(originalPrompt))
    variations.push(this.addSpecificityImprovements(originalPrompt))
    variations.push(this.addContextualImprovements(originalPrompt, category))
    variations.push(this.improveFormatting(originalPrompt))
    variations.push(this.adjustTone(originalPrompt))

    return variations.filter(v => v !== originalPrompt) // Remove unchanged versions
  }

  // Get optimization recommendations
  public getOptimizationRecommendations(): string[] {
    const recommendations: string[] = []
    const allPerformance = this.database.getAllPerformance()

    // Analyze performance patterns
    const lowPerformingPrompts = allPerformance.filter(p => p.averageQuality < 3.5)
    const highErrorRatePrompts = allPerformance.filter(p => p.errorRate > 10)
    const lowSuccessRatePrompts = allPerformance.filter(p => p.successRate < 80)

    if (lowPerformingPrompts.length > 0) {
      recommendations.push(`${lowPerformingPrompts.length} prompts have low user satisfaction. Consider optimization.`)
    }

    if (highErrorRatePrompts.length > 0) {
      recommendations.push(`${highErrorRatePrompts.length} prompts have high error rates. Review for clarity and format issues.`)
    }

    if (lowSuccessRatePrompts.length > 0) {
      recommendations.push(`${lowSuccessRatePrompts.length} prompts have low success rates. Analyze failure patterns.`)
    }

    // Category-specific recommendations
    const categoryPerformance = this.analyzeCategoryPerformance()
    Object.entries(categoryPerformance).forEach(([category, performance]) => {
      if (performance.averageQuality < 3.5) {
        recommendations.push(`${category} category needs improvement - average quality: ${performance.averageQuality.toFixed(1)}`)
      }
    })

    return recommendations
  }

  // Private helper methods
  private calculateOverallScore(performance: PromptPerformance): number {
    // Weighted score combining multiple metrics
    const qualityWeight = 0.4
    const successWeight = 0.3
    const efficiencyWeight = 0.2
    const userSatisfactionWeight = 0.1

    const qualityScore = (performance.averageQuality / 5) * 100
    const successScore = performance.successRate
    const efficiencyScore = Math.max(0, 100 - (performance.averageResponseTime / 1000)) // Penalty for slow responses
    const satisfactionScore = performance.userRatings.length > 0 
      ? (performance.userRatings.reduce((sum, rating) => sum + rating, 0) / performance.userRatings.length / 5) * 100
      : qualityScore

    return (qualityScore * qualityWeight) + 
           (successScore * successWeight) + 
           (efficiencyScore * efficiencyWeight) + 
           (satisfactionScore * userSatisfactionWeight)
  }

  private calculateTestScore(result: any): number {
    const ratingWeight = 0.6
    const successWeight = 0.4
    
    return (result.averageRating / 5) * ratingWeight + 
           (result.successRate / 100) * successWeight
  }

  private generatePromptId(category: string, template: string): string {
    const hash = Buffer.from(`${category}-${template.substring(0, 100)}`).toString('base64')
    return hash.replace(/[/+=]/g, '').substring(0, 16)
  }

  private getDefaultTemplate(category: string): string {
    const templates = PROMPT_TEMPLATES[category as keyof typeof PROMPT_TEMPLATES]
    if (templates && templates.v1) {
      return templates.v1.template
    }
    
    // Fallback generic template
    return `Analyze the provided data for {category} and return a structured JSON response with relevant insights.`
  }

  private async optimizeCategory(category: string): Promise<PromptOptimization[]> {
    const optimizations: PromptOptimization[] = []
    const performance = this.database.getPerformanceByCategory(category)

    for (const perf of performance) {
      if (perf.averageQuality < 3.5 || perf.successRate < 80) {
        // This prompt needs optimization
        const optimization = await this.createOptimization(perf)
        if (optimization) {
          optimizations.push(optimization)
          this.database.addOptimization(optimization)
        }
      }
    }

    return optimizations
  }

  private async createOptimization(performance: PromptPerformance): Promise<PromptOptimization | null> {
    try {
      const optimizationId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Analyze performance issues
      const issues = this.identifyPerformanceIssues(performance)
      const optimizationType = this.determineOptimizationType(issues)
      
      // Generate optimized prompt
      let optimizedPrompt = performance.promptTemplate
      
      switch (optimizationType) {
        case 'clarity':
          optimizedPrompt = this.addClarityImprovements(optimizedPrompt)
          break
        case 'specificity':
          optimizedPrompt = this.addSpecificityImprovements(optimizedPrompt)
          break
        case 'context':
          optimizedPrompt = this.addContextualImprovements(optimizedPrompt, performance.promptCategory)
          break
        case 'format':
          optimizedPrompt = this.improveFormatting(optimizedPrompt)
          break
        case 'tone':
          optimizedPrompt = this.adjustTone(optimizedPrompt)
          break
      }

      if (optimizedPrompt === performance.promptTemplate) {
        return null // No optimization possible
      }

      const optimization: PromptOptimization = {
        id: optimizationId,
        timestamp: new Date().toISOString(),
        originalPrompt: performance.promptTemplate,
        optimizedPrompt,
        optimizationType,
        optimizationReason: `Addressing ${issues.join(', ')} based on performance data`,
        beforeMetrics: {
          averageQuality: performance.averageQuality,
          successRate: performance.successRate,
          userSatisfaction: performance.userRatings.reduce((sum, r) => sum + r, 0) / performance.userRatings.length || 0,
          responseTime: performance.averageResponseTime,
          tokenEfficiency: performance.tokenUsage > 0 ? performance.averageQuality / performance.tokenUsage : 0
        },
        strategy: 'rule_based'
      }

      return optimization
    } catch (error) {
      console.error('Error creating optimization:', error)
      return null
    }
  }

  private identifyPerformanceIssues(performance: PromptPerformance): string[] {
    const issues: string[] = []

    if (performance.averageQuality < 3.0) issues.push('low_quality')
    if (performance.successRate < 70) issues.push('low_success_rate')
    if (performance.errorRate > 15) issues.push('high_error_rate')
    if (performance.averageResponseTime > 10000) issues.push('slow_response')
    if (performance.userComments.some(comment => comment.includes('unclear'))) issues.push('clarity_issues')
    if (performance.userComments.some(comment => comment.includes('generic'))) issues.push('specificity_issues')

    return issues
  }

  private determineOptimizationType(issues: string[]): 'clarity' | 'specificity' | 'context' | 'format' | 'tone' {
    if (issues.includes('clarity_issues')) return 'clarity'
    if (issues.includes('specificity_issues')) return 'specificity'
    if (issues.includes('high_error_rate')) return 'format'
    if (issues.includes('slow_response')) return 'specificity'
    return 'context'
  }

  private addClarityImprovements(prompt: string): string {
    // Add clearer instructions and structure
    let improved = prompt
    
    // Add explicit instruction formatting
    if (!improved.includes('Step by step:')) {
      improved = improved.replace(/Please|Provide/, 'Step by step, please')
    }
    
    // Add clear output format reminder
    if (improved.includes('JSON format') && !improved.includes('ONLY return valid JSON')) {
      improved += '\n\nIMPORTANT: Return ONLY valid JSON, no additional text.'
    }

    return improved
  }

  private addSpecificityImprovements(prompt: string): string {
    // Add more specific instructions and examples
    let improved = prompt
    
    // Add specific constraints
    if (improved.includes('analyze') && !improved.includes('specific')) {
      improved = improved.replace(/analyze/g, 'analyze specifically')
    }
    
    // Add quality criteria
    if (!improved.includes('accurate') && !improved.includes('precise')) {
      improved += '\n\nEnsure all responses are accurate, precise, and well-reasoned.'
    }

    return improved
  }

  private addContextualImprovements(prompt: string, category: string): string {
    // Add category-specific context and domain knowledge
    let improved = prompt
    
    const contextualAdditions: { [key: string]: string } = {
      location_analysis: '\n\nConsider Spanish addressing conventions and regional naming patterns.',
      market_summary: '\n\nFocus on current Spanish real estate market conditions and regional factors.',
      valuation: '\n\nApply Spanish property valuation standards and local market factors.',
      investment_advice: '\n\nConsider Spanish tax implications and investment regulations.',
      comparable_analysis: '\n\nAccount for Spanish property types and local market characteristics.'
    }

    if (contextualAdditions[category] && !improved.includes(contextualAdditions[category].trim())) {
      improved += contextualAdditions[category]
    }

    return improved
  }

  private improveFormatting(prompt: string): string {
    // Improve prompt structure and formatting
    let improved = prompt
    
    // Add clear sections
    if (!improved.includes('###') && !improved.includes('---')) {
      improved = improved.replace(/\n\n/g, '\n\n---\n\n')
    }
    
    // Improve JSON format specification
    if (improved.includes('JSON format') && !improved.includes('exact structure')) {
      improved = improved.replace('JSON format', 'exact JSON structure shown below')
    }

    return improved
  }

  private adjustTone(prompt: string): string {
    // Adjust tone to be more professional and direct
    let improved = prompt
    
    // Make instructions more direct
    improved = improved.replace(/please/gi, '')
    improved = improved.replace(/could you/gi, 'you must')
    improved = improved.replace(/would you/gi, 'you will')
    
    // Add professional context
    if (!improved.includes('professional')) {
      improved = 'As a professional real estate analyst, ' + improved.charAt(0).toLowerCase() + improved.slice(1)
    }

    return improved
  }

  private analyzeCategoryPerformance(): { [category: string]: any } {
    const categories = ['location_analysis', 'market_summary', 'valuation', 'investment_advice', 'comparable_analysis']
    const categoryPerformance: { [category: string]: any } = {}

    categories.forEach(category => {
      const performance = this.database.getPerformanceByCategory(category)
      if (performance.length > 0) {
        categoryPerformance[category] = {
          totalPrompts: performance.length,
          averageQuality: performance.reduce((sum, p) => sum + p.averageQuality, 0) / performance.length,
          averageSuccessRate: performance.reduce((sum, p) => sum + p.successRate, 0) / performance.length,
          totalUses: performance.reduce((sum, p) => sum + p.useCount, 0),
          needsOptimization: performance.filter(p => p.averageQuality < 3.5 || p.successRate < 80).length
        }
      }
    })

    return categoryPerformance
  }
}

// Create singleton instances
export const promptDatabase = new PromptPerformanceDatabase()
export const promptOptimizer = new PromptOptimizationEngine()

export default {
  PromptPerformanceDatabase,
  PromptOptimizationEngine,
  PROMPT_TEMPLATES,
  promptDatabase,
  promptOptimizer
} 