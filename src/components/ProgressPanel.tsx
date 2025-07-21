import { PropertyData } from '@/types'
import { fixSpanishCharacters, normalizeProvinceName } from '@/lib/utils'

// Extract urbanization/neighborhood name from full address - PRIORITIZE XML FEED DATA
function extractLocationName(address: string, city: string, urbanization?: string, suburb?: string): string {
  // FIRST PRIORITY: Use XML feed urbanization data
  if (urbanization && urbanization.trim()) {
    return urbanization.trim()
  }
  
  // SECOND PRIORITY: Use XML feed suburb data
  if (suburb && suburb.trim()) {
    return suburb.trim()
  }
  
  // THIRD PRIORITY: Look for urbanization keywords in the address
  let cleanAddress = address.trim()
  const urbanizationKeywords = [
    'urbanización', 'urbanizacion', 'urb.', 'urb',
    'residencial', 'conjunto', 'complejo'
  ]
  
  const addressLower = cleanAddress.toLowerCase()
  
  for (const keyword of urbanizationKeywords) {
    const keywordIndex = addressLower.indexOf(keyword)
    if (keywordIndex !== -1) {
      // Extract from keyword to the next comma or end
      const fromKeyword = cleanAddress.substring(keywordIndex)
      const nextComma = fromKeyword.indexOf(',')
      const extracted = nextComma !== -1 
        ? fromKeyword.substring(0, nextComma).trim()
        : fromKeyword.trim()
      
      if (extracted !== city && extracted.length > keyword.length) {
        return extracted
      }
    }
  }
  
  // FOURTH PRIORITY: Look for neighborhood/area keywords
  const neighborhoodKeywords = [
    'barrio', 'neighborhood', 'zona', 'sector'
  ]
  
  for (const keyword of neighborhoodKeywords) {
    const keywordIndex = addressLower.indexOf(keyword)
    if (keywordIndex !== -1) {
      // Extract from keyword to the next comma or end
      const fromKeyword = cleanAddress.substring(keywordIndex)
      const nextComma = fromKeyword.indexOf(',')
      const extracted = nextComma !== -1 
        ? fromKeyword.substring(0, nextComma).trim()
        : fromKeyword.trim()
      
      if (extracted !== city && extracted.length > keyword.length) {
        return extracted
      }
    }
  }
  
  // FIFTH PRIORITY: Split by comma to get the first part (street name)
  const parts = cleanAddress.split(',')
  if (parts.length > 1) {
    const firstPart = parts[0].trim()
    
    // If the first part is not just the city name, use it
    if (firstPart !== city && firstPart.length > 0) {
      return firstPart
    }
  }
  
  // Final fallback: use city name
  return city
}

interface ProgressPanelProps {
  currentStep: number
  isProcessing: boolean
  propertyData: PropertyData
}

const steps = [
  {
    id: 'property-description',
    title: 'Property Description Analysis',
    description: 'Extracting location details from property description',
    emoji: '🧠'
  },
  {
    id: 'property-condition',
    title: 'Property Condition & Style',
    description: 'AI analysis of property condition and architectural style',
    emoji: '🏠'
  },
  {
    id: 'geolocation-amenities',
    title: 'Geolocation & Amenities',
    description: 'Using Google Maps API to get coordinates and nearby schools, shopping, transport',
    emoji: '🗺️'
  },
  {
    id: 'market-trends',
    title: 'Market & Historical Trends',
    description: 'Property feed database + Tavily web research for pricing trends and market insights',
    emoji: '📈'
  },
  {
    id: 'comparable-listings',
    title: 'Comparable Listings',
            description: 'Using property feed database to find 5-10 similar properties',
    emoji: '🏘️'
  },
  {
    id: 'future-developments',
    title: 'Future Developments',
    description: 'Tavily API search for urban planning and infrastructure projects',
    emoji: '🏗️'
  },
  {
    id: 'neighborhood-insights',
    title: 'Neighborhood Insights',
    description: 'Tavily search for investment trends, safety, and market sentiment',
    emoji: '🌍'
  },
  {
    id: 'ai-summary',
    title: 'AI Summary Generation',
    description: 'OpenAI analysis for executive summary, recommendations, and forecasts',
    emoji: '🤖'
  }
]

export default function ProgressPanel({ currentStep, isProcessing, propertyData }: ProgressPanelProps) {
  return (
    <div className="space-y-6">
      {/* Property Summary */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Property Analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1">
            <h3 className="font-medium text-gray-900">{extractLocationName(fixSpanishCharacters(propertyData.address), fixSpanishCharacters(propertyData.city), fixSpanishCharacters(propertyData.urbanization || ''), fixSpanishCharacters(propertyData.suburb || ''))}</h3>
              {propertyData.refNumber && (
                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                  Ref: {propertyData.refNumber}
                </span>
              )}
            </div>
                            <p className="text-gray-600">{fixSpanishCharacters(propertyData.city)}, {normalizeProvinceName(fixSpanishCharacters(propertyData.province))} {propertyData.areaCode}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Type:</span>
              <span className="ml-2 font-medium text-gray-900">
                {propertyData.propertyType}
                {propertyData.architecturalStyle && ` (${propertyData.architecturalStyle})`}
                {propertyData.condition && (
                  <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                    propertyData.condition === 'excellent' ? 'condition-excellent' :
                    propertyData.condition === 'good' ? 'condition-good' :
                    propertyData.condition === 'fair' ? 'condition-fair' :
                    propertyData.condition === 'needs work' ? 'condition-needs-work' :
                    'condition-renovation'
                  }`}>
                    {propertyData.condition}
                  </span>
                )}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Size:</span>
              <span className="ml-2 font-medium text-gray-900">{(propertyData.totalAreaM2 || propertyData.squareFootage || 0).toLocaleString()} m²</span>
            </div>
            {propertyData.terraceAreaM2 && propertyData.terraceAreaM2 > 0 && (
              <div>
                <span className="text-gray-500">Terrace:</span>
                <span className="ml-2 font-medium text-green-600">{propertyData.terraceAreaM2.toLocaleString()} m²</span>
              </div>
            )}
            {propertyData.bedrooms > 0 && (
              <div>
                <span className="text-gray-500">Bedrooms:</span>
                <span className="ml-2 font-medium text-gray-900">{propertyData.bedrooms}</span>
              </div>
            )}
            {propertyData.bathrooms > 0 && (
              <div>
                <span className="text-gray-500">Bathrooms:</span>
                <span className="ml-2 font-medium text-gray-900">{propertyData.bathrooms}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">CMA Generation Progress</h2>
        
        <div className="space-y-4">
          {steps.map((step, index) => {
            const isCompleted = currentStep > index
            const isCurrent = currentStep === index && isProcessing
            const isUpcoming = currentStep < index
            
            return (
              <div
                key={step.id}
                className={`flex items-start space-x-4 p-4 rounded-lg transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-primary/10 border-l-4 border-primary' 
                    : isCurrent 
                      ? 'bg-[#00ae9a]/10 border-l-4 border-[#00ae9a]' 
                      : 'bg-gray-50/50'
                }`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  isCompleted 
                    ? 'bg-primary text-white' 
                    : isCurrent 
                      ? 'bg-[#00ae9a] text-white animate-pulse' 
                      : 'bg-gray-300'
                }`}>
                  {isCompleted ? (
                    <span className="text-lg">✅</span>
                  ) : isCurrent ? (
                    <span className="text-lg animate-pulse">{step.emoji}</span>
                  ) : (
                    <span className="text-lg">{step.emoji}</span>
                  )}
                </div>
                
                <div className="flex-1">
                  <h3 className={`font-medium ${
                    isCompleted 
                      ? 'text-primary' 
                      : isCurrent 
                        ? 'text-[#00ae9a]' 
                        : 'text-gray-900'
                  }`}>
                    {step.title}
                  </h3>
                  <p className={`text-sm ${
                    isCompleted 
                      ? 'text-primary/70' 
                      : isCurrent 
                        ? 'text-[#00ae9a]/70' 
                        : 'text-gray-600'
                  }`}>
                    {step.description}
                  </p>
                </div>
                
                {isCurrent && (
                  <div className="flex-shrink-0">
                    <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00ae9a', borderTopColor: 'transparent' }}></div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        
        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{Math.round((currentStep / steps.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-primary to-primary-light h-2 rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            ></div>
          </div>
        </div>
        
        {!isProcessing && currentStep === steps.length && (
                      <div className="mt-6 p-4 bg-[#00ae9a]/10 border border-[#00ae9a]/30 rounded-lg">
            <div className="flex items-center space-x-2">
                                <div className="w-5 h-5 bg-[#00ae9a] rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-green-800 font-medium">CMA Report Generated Successfully!</span>
            </div>
            <p className="text-green-700 text-sm mt-2">
              Your comprehensive market analysis is ready for download.
            </p>
          </div>
        )}
      </div>
    </div>
  )
} 