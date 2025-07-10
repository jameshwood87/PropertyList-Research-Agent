export interface PropertyData {
  location: string
  address?: string
  price: number
  pricePerSqm?: number
  bedrooms: number
  bathrooms: number
  type: string
  views?: string[]
  quality?: string
  sqm: number
  yearBuilt?: number
  isNewConstruction?: boolean
  saleOrRent: 'sale' | 'rent'
  features?: string[]
  description?: string
}

export interface MarketData {
  averagePricePerSqm: number
  priceRange: {
    min: number
    max: number
  }
  salesVolume: number
  daysOnMarket: number
  priceGrowth: number
  marketTrend: 'up' | 'down' | 'stable'
  comparableListings: PropertyData[]
}

export interface AnalysisStep {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'error'
  description: string
  result?: any
  error?: string
}

export interface AnalysisResult {
  propertyData?: PropertyData
  marketData?: MarketData
  insights?: {
    valuation: {
      estimatedValue: number
      priceAssessment: 'overpriced' | 'fairly_priced' | 'underpriced'
      confidence: number
    }
    investment: {
      potential: 'high' | 'medium' | 'low'
      risks: (string | {
        risk: string
        impact: 'high' | 'medium' | 'low'
        likelihood: 'high' | 'medium' | 'low'
        mitigation: string
      })[]
      opportunities: (string | {
        opportunity: string
        potential: 'high' | 'medium' | 'low'
        timeframe: 'short_term' | 'medium_term' | 'long_term'
        strategy: string
      })[]
    }
    recommendations: {
      buyerAdvice: string | {
        recommendation: string
        reasoning: string
        conditions: string[]
        negotiationPoints: string[]
        maxPrice: number
        inspectionFocus: string[]
        timeline: string
      }
      sellerAdvice: string | {
        pricingStrategy: string
        marketingStrategy: string
        timing: string
        improvements: string[]
        targetBuyer: string
        expectedTimeToSell: number
      }
      investorAdvice: string | {
        strategy: string
        financing: string
        exitStrategy: string
        holdPeriod: number
        renovationNeeds: string[]
        targetTenant: string
        breakEvenAnalysis: string
      }
    }
  }
  report?: {
    summary: string
    fullReport: string
    pdfUrl?: string
  }
  steps?: AnalysisStep[]
  error?: string
}

export interface TavilySearchResult {
  title: string
  url: string
  content: string
  score: number
  published_date?: string
}

export interface TavilyResponse {
  results: TavilySearchResult[]
  query: string
  response_time: number
} 