// AI Property Data Enhancer - Analyzes XML property descriptions to extract additional data
import { PropertyData } from '@/types'
import { callOpenAI } from './api-services'

export interface EnhancedPropertyData extends PropertyData {
  // Enhanced location data
  urbanization?: string
  suburb?: string
  streetName?: string
  streetNumber?: string
  zone?: string
  
  // Enhanced property characteristics
  condition?: 'excellent' | 'good' | 'fair' | 'needs work' | 'renovation project' | 'rebuild'
  architecturalStyle?: 'modern' | 'rustic' | 'andalusian' | 'contemporary' | 'traditional' | 'mediterranean' | 'colonial' | 'minimalist' | 'classic'
  renovationNeeds?: string[]
  propertyFeatures?: string[]
  viewType?: string[]
  orientation?: string
  energyEfficiency?: string
  
  // Enhanced market data
  marketPosition?: 'premium' | 'high-end' | 'mid-range' | 'affordable'
  investmentPotential?: 'excellent' | 'good' | 'fair' | 'poor'
  rentalYield?: number
  
  // Analysis metadata
  aiAnalysisDate?: string
  aiConfidence?: number
  extractedKeywords?: string[]
}

export interface AIAnalysisResult {
  urbanization?: string
  suburb?: string
  streetName?: string
  streetNumber?: string
  zone?: string
  condition?: PropertyData['condition']
  architecturalStyle?: PropertyData['architecturalStyle']
  renovationNeeds: string[]
  propertyFeatures: string[]
  viewType: string[]
  orientation?: string
  energyEfficiency?: string
  marketPosition?: 'premium' | 'high-end' | 'mid-range' | 'affordable'
  investmentPotential?: 'excellent' | 'good' | 'fair' | 'poor'
  rentalYield?: number
  confidence: number
  extractedKeywords: string[]
}

export class AIPropertyEnhancer {
  
  /**
   * Check if a property has already been AI-enhanced
   */
  static isPropertyAlreadyEnhanced(property: PropertyData): boolean {
    return !!(property.aiAnalysisDate && property.aiConfidence && 
              (property.urbanization || property.streetName || property.condition || property.architecturalStyle))
  }
  
  /**
   * Check if a property needs AI enhancement (has description but not enhanced)
   */
  static needsEnhancement(property: PropertyData): boolean {
    return !!(property.description && 
              property.description.trim().length > 10 && 
              !this.isPropertyAlreadyEnhanced(property))
  }
  
  /**
   * Enhance property data using AI analysis of the description
   */
  static async enhancePropertyData(propertyData: PropertyData): Promise<EnhancedPropertyData> {
    try {
      // console.log(`🤖 AI enhancing property: ${propertyData.refNumber || propertyData.address}`)
      
      // Skip if no description available
      if (!propertyData.description || propertyData.description.trim().length < 10) {
        // console.log(`⚠️ No description available for AI enhancement: ${propertyData.refNumber || propertyData.address}`)
        return propertyData as EnhancedPropertyData
      }
      
      // Skip if already enhanced
      if (this.isPropertyAlreadyEnhanced(propertyData)) {
        // console.log(`✅ Property already AI-enhanced: ${propertyData.refNumber || propertyData.address}`)
        return propertyData as EnhancedPropertyData
      }
      
      // Analyze property description with AI
      const analysis = await this.analyzePropertyDescription(propertyData)
      
      // Merge AI analysis with original property data
      const enhancedData: EnhancedPropertyData = {
        ...propertyData,
        urbanization: analysis.urbanization || propertyData.urbanization,
        suburb: analysis.suburb,
        streetName: analysis.streetName,
        streetNumber: analysis.streetNumber,
        zone: analysis.zone,
        condition: analysis.condition || propertyData.condition,
        architecturalStyle: analysis.architecturalStyle || propertyData.architecturalStyle,
        renovationNeeds: analysis.renovationNeeds,
        propertyFeatures: analysis.propertyFeatures,
        viewType: analysis.viewType,
        orientation: analysis.orientation || propertyData.orientation,
        energyEfficiency: analysis.energyEfficiency || propertyData.energyRating,
        marketPosition: analysis.marketPosition,
        investmentPotential: analysis.investmentPotential,
        rentalYield: analysis.rentalYield,
        aiAnalysisDate: new Date().toISOString(),
        aiConfidence: analysis.confidence,
        extractedKeywords: analysis.extractedKeywords
      }
      
      // console.log(`✅ AI enhancement completed for: ${propertyData.refNumber || propertyData.address}`)
// console.log(`   - Urbanization: ${enhancedData.urbanization || 'Not found'}`)
// console.log(`   - Street: ${enhancedData.streetName || 'Not found'}`)
// console.log(`   - Condition: ${enhancedData.condition || 'Not found'}`)
// console.log(`   - Style: ${enhancedData.architecturalStyle || 'Not found'}`)
// console.log(`   - Confidence: ${analysis.confidence}%`)
      
      return enhancedData
      
    } catch (error) {
      console.error(`❌ AI enhancement failed for: ${propertyData.refNumber || propertyData.address}`, error)
      return propertyData as EnhancedPropertyData
    }
  }
  
  /**
   * Analyze property description using AI to extract detailed information
   */
  private static async analyzePropertyDescription(propertyData: PropertyData): Promise<AIAnalysisResult> {
    const prompt = `Analyze this Spanish property description to extract detailed location and property information:

PROPERTY DETAILS:
- Reference: ${propertyData.refNumber || 'N/A'}
- Type: ${propertyData.propertyType}
- Location: ${propertyData.city}, ${propertyData.province}
- Bedrooms: ${propertyData.bedrooms}
- Bathrooms: ${propertyData.bathrooms}
- Build Area: ${propertyData.buildArea || propertyData.totalAreaM2 || 'N/A'}m²
- Plot Area: ${propertyData.plotArea || 'N/A'}m²
- Price: €${propertyData.price?.toLocaleString() || 'N/A'}
- Features: ${propertyData.features?.join(', ') || 'None specified'}

DESCRIPTION: "${propertyData.description}"

TASK: Extract comprehensive property information from the description.

LOCATION EXTRACTION (Priority 1):
- urbanization: Extract urbanization name (e.g., "Urbanización Los Naranjos", "Urb. Nueva Andalucía")
- suburb: Extract suburb/neighbourhood name (e.g., "Puerto Banús", "Golden Mile")
- streetName: Extract street name (e.g., "Avenida del Mar", "Calle Mayor")
- streetNumber: Extract street number if mentioned
- zone: Extract zone/area name (e.g., "Zona de lujo", "Residential zone")

PROPERTY CHARACTERISTICS (Priority 2):
- condition: Determine property condition (excellent/good/fair/needs work/renovation project/rebuild)
- architecturalStyle: Determine architectural style (modern/rustic/andalusian/contemporary/traditional/mediterranean/colonial/minimalist/classic)
- renovationNeeds: List specific renovation needs mentioned
- propertyFeatures: Extract unique property features not in the basic features list
- viewType: Extract view types mentioned (sea view, mountain view, garden view, etc.)
- orientation: Extract orientation if mentioned (south-facing, north-facing, etc.)
- energyEfficiency: Extract energy efficiency information

MARKET ANALYSIS (Priority 3):
- marketPosition: Determine market position (premium/high-end/mid-range/affordable)
- investmentPotential: Assess investment potential (excellent/good/fair/poor)
- rentalYield: Calculate estimated rental yield if rental property

IMPORTANT GUIDELINES:
- Preserve all Spanish characters (á, é, í, ó, ú, ñ, ü) exactly as they appear
- Be very specific about what information is actually present in the description
- Don't make assumptions or add information not present in the text
- If information is not clearly stated, mark as null/undefined
- For confidence scoring: 90-100% = very clear information, 70-89% = reasonably clear, 50-69% = somewhat clear, <50% = unclear

Return JSON format:
{
  "urbanization": "exact urbanization name or null",
  "suburb": "exact suburb name or null",
  "streetName": "exact street name or null",
  "streetNumber": "street number or null",
  "zone": "zone name or null",
  "condition": "condition_value or null",
  "architecturalStyle": "style_value or null",
  "renovationNeeds": ["list", "of", "renovation", "needs"],
  "propertyFeatures": ["list", "of", "unique", "features"],
  "viewType": ["list", "of", "view", "types"],
  "orientation": "orientation or null",
  "energyEfficiency": "energy info or null",
  "marketPosition": "position_value or null",
  "investmentPotential": "potential_value or null",
  "rentalYield": number_or_null,
  "confidence": number_between_0_and_100,
  "extractedKeywords": ["key", "words", "found", "in", "description"]
}`

    try {
      // Use GPT-4 Turbo for enhanced property analysis
      const response = await callOpenAI(prompt)
      
      // Clean the response to ensure it's valid JSON
      let cleanedResponse = response.trim()
      
      // Remove markdown code blocks if present
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      
      // Parse JSON response
      const parsed = JSON.parse(cleanedResponse)
      
      // Validate and return the analysis result
      return {
        urbanization: parsed.urbanization || undefined,
        suburb: parsed.suburb || undefined,
        streetName: parsed.streetName || undefined,
        streetNumber: parsed.streetNumber || undefined,
        zone: parsed.zone || undefined,
        condition: parsed.condition || undefined,
        architecturalStyle: parsed.architecturalStyle || undefined,
        renovationNeeds: Array.isArray(parsed.renovationNeeds) ? parsed.renovationNeeds : [],
        propertyFeatures: Array.isArray(parsed.propertyFeatures) ? parsed.propertyFeatures : [],
        viewType: Array.isArray(parsed.viewType) ? parsed.viewType : [],
        orientation: parsed.orientation || undefined,
        energyEfficiency: parsed.energyEfficiency || undefined,
        marketPosition: parsed.marketPosition || undefined,
        investmentPotential: parsed.investmentPotential || undefined,
        rentalYield: typeof parsed.rentalYield === 'number' ? parsed.rentalYield : undefined,
        confidence: typeof parsed.confidence === 'number' ? Math.min(100, Math.max(0, parsed.confidence)) : 50,
        extractedKeywords: Array.isArray(parsed.extractedKeywords) ? parsed.extractedKeywords : []
      }
      
    } catch (error) {
      console.error('Error in AI property description analysis:', error)
      return {
        renovationNeeds: [],
        propertyFeatures: [],
        viewType: [],
        confidence: 0,
        extractedKeywords: []
      }
    }
  }
  
  /**
   * Batch enhance multiple properties
   */
  static async enhancePropertyBatch(properties: PropertyData[]): Promise<EnhancedPropertyData[]> {
    console.log(`🤖 Starting batch AI enhancement for ${properties.length} properties`)
    
    const enhancedProperties: EnhancedPropertyData[] = []
    let processed = 0
    
    // Process properties in batches to avoid rate limiting (GPT-4 Turbo optimized)
    const batchSize = 8
    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize)
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(properties.length / batchSize)}`)
      
      // Process batch concurrently
      const batchPromises = batch.map(async (property) => {
        try {
          const enhanced = await this.enhancePropertyData(property)
          processed++
          return enhanced
        } catch (error) {
          console.error(`❌ Failed to enhance property: ${property.refNumber || property.address}`, error)
          processed++
          return property as EnhancedPropertyData
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      enhancedProperties.push(...batchResults)
      
      // Add delay between batches to avoid rate limiting (GPT-4 Turbo)
      if (i + batchSize < properties.length) {
        await new Promise(resolve => setTimeout(resolve, 3000)) // 3 second delay for GPT-4 Turbo
      }
    }
    
    console.log(`✅ Batch AI enhancement completed: ${processed}/${properties.length} properties processed`)
    
    // Log summary statistics
    const stats = this.calculateEnhancementStats(enhancedProperties)
    console.log(`📊 Enhancement Statistics:`)
    console.log(`   - Properties with urbanization: ${stats.withUrbanization}`)
    console.log(`   - Properties with street names: ${stats.withStreetNames}`)
    console.log(`   - Properties with condition: ${stats.withCondition}`)
    console.log(`   - Properties with architectural style: ${stats.withArchitecturalStyle}`)
    console.log(`   - Average confidence: ${stats.averageConfidence.toFixed(1)}%`)
    
    return enhancedProperties
  }
  
  /**
   * Calculate enhancement statistics
   */
  private static calculateEnhancementStats(properties: EnhancedPropertyData[]) {
    const withUrbanization = properties.filter(p => p.urbanization).length
    const withStreetNames = properties.filter(p => p.streetName).length
    const withCondition = properties.filter(p => p.condition).length
    const withArchitecturalStyle = properties.filter(p => p.architecturalStyle).length
    const averageConfidence = properties.reduce((sum, p) => sum + (p.aiConfidence || 0), 0) / properties.length
    
    return {
      withUrbanization,
      withStreetNames,
      withCondition,
      withArchitecturalStyle,
      averageConfidence
    }
  }
} 