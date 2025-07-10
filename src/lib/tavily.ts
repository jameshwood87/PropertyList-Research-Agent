import axios from 'axios'
import { TavilyResponse, TavilySearchResult } from '@/types'

const TAVILY_API_KEY = process.env.TAVILY_API_KEY

export async function searchMarketData(queries: string[]): Promise<TavilySearchResult[]> {
  if (!TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY is not configured')
  }

  const allResults: TavilySearchResult[] = []

  for (const query of queries) {
    try {
      const response = await axios.post('https://api.tavily.com/search', {
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        include_answer: true,
        include_raw_content: false,
        max_results: 10,
        include_domains: [
          'idealista.com',
          'fotocasa.es',
          'kyero.com',
          'thinkspain.com',
          'surinenglish.com',
          'malagahoy.es',
          'abc.es',
          'elmundo.es',
          'lavanguardia.com',
          'elpais.com'
        ]
      })

      const data: TavilyResponse = response.data
      
      // Filter and rank results
      const relevantResults = data.results
        .filter(result => result.score > 0.5)
        .map(result => ({
          ...result,
          query: query // Add the query that generated this result
        }))

      allResults.push(...relevantResults)
    } catch (error) {
      console.error(`Error searching for: ${query}`, error)
    }
  }

  // Remove duplicates and sort by score
  const uniqueResults = deduplicateResults(allResults)
  return uniqueResults.sort((a, b) => b.score - a.score).slice(0, 20)
}

export async function searchPropertyComparisons(location: string, propertyType: string, bedrooms: number, sqm: number): Promise<TavilySearchResult[]> {
  if (!TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY is not configured')
  }

  const queries = [
    `"${location}" ${propertyType} ${bedrooms} bedroom ${sqm}m² for sale price`,
    `similar properties ${location} ${propertyType} price comparison`,
    `${location} ${propertyType} market prices €/m² 2024`,
    `${location} real estate listings ${bedrooms} bedroom ${propertyType}`
  ]

  const results: TavilySearchResult[] = []

  for (const query of queries) {
    try {
      const response = await axios.post('https://api.tavily.com/search', {
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        include_answer: false,
        include_raw_content: false,
        max_results: 5,
        include_domains: [
          'idealista.com',
          'fotocasa.es',
          'kyero.com',
          'pisos.com',
          'yaencontre.com'
        ]
      })

      const data: TavilyResponse = response.data
      results.push(...data.results.filter(result => result.score > 0.4))
    } catch (error) {
      console.error(`Error searching property comparisons: ${query}`, error)
    }
  }

  return deduplicateResults(results).slice(0, 10)
}

export async function searchLocalNews(location: string): Promise<TavilySearchResult[]> {
  if (!TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY is not configured')
  }

  const queries = [
    `${location} real estate market news 2024`,
    `${location} property development infrastructure projects`,
    `${location} tourism investment property market`,
    `${location} zoning changes urban planning 2024`
  ]

  const results: TavilySearchResult[] = []

  for (const query of queries) {
    try {
      const response = await axios.post('https://api.tavily.com/search', {
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        include_answer: true,
        include_raw_content: false,
        max_results: 8,
        include_domains: [
          'thinkspain.com',
          'surinenglish.com',
          'malagahoy.es',
          'abc.es',
          'elmundo.es',
          'lavanguardia.com',
          'elpais.com',
          'euroweeklynews.com'
        ]
      })

      const data: TavilyResponse = response.data
      results.push(...data.results.filter(result => result.score > 0.5))
    } catch (error) {
      console.error(`Error searching local news: ${query}`, error)
    }
  }

  return deduplicateResults(results).slice(0, 15)
}

export async function searchMarketTrends(location: string): Promise<TavilySearchResult[]> {
  if (!TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY is not configured')
  }

  const queries = [
    `${location} property price trends 2024 growth rates`,
    `${location} real estate market statistics average prices`,
    `${location} property investment returns rental yields`,
    `${location} housing market demand supply analysis`
  ]

  const results: TavilySearchResult[] = []

  for (const query of queries) {
    try {
      const response = await axios.post('https://api.tavily.com/search', {
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        include_answer: true,
        include_raw_content: false,
        max_results: 6,
        include_domains: [
          'idealista.com',
          'fotocasa.es',
          'kyero.com',
          'thinkspain.com',
          'surinenglish.com',
          'tinsa.es',
          'st-tasaciones.es'
        ]
      })

      const data: TavilyResponse = response.data
      results.push(...data.results.filter(result => result.score > 0.6))
    } catch (error) {
      console.error(`Error searching market trends: ${query}`, error)
    }
  }

  return deduplicateResults(results).slice(0, 12)
}

function deduplicateResults(results: TavilySearchResult[]): TavilySearchResult[] {
  const seen = new Set<string>()
  const unique: TavilySearchResult[] = []

  for (const result of results) {
    // Create a key based on URL and title for deduplication
    const key = `${result.url}-${result.title}`.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(result)
    }
  }

  return unique
}

export function extractPriceData(results: TavilySearchResult[]): {
  prices: number[]
  averagePrice: number
  pricePerSqm: number[]
  averagePricePerSqm: number
} {
  const prices: number[] = []
  const pricePerSqm: number[] = []

  results.forEach(result => {
    const content = `${result.title} ${result.content}`.toLowerCase()
    
    // Extract prices in euros
    const priceMatches = content.match(/€\s*(\d+(?:[.,]\d+)*)/g)
    if (priceMatches) {
      priceMatches.forEach(match => {
        const price = parseInt(match.replace(/[€.,\s]/g, ''))
        if (price > 10000 && price < 10000000) { // Reasonable property price range
          prices.push(price)
        }
      })
    }

    // Extract price per sqm
    const pricePerSqmMatches = content.match(/€\s*(\d+(?:[.,]\d+)*)\s*\/?\s*m²/g)
    if (pricePerSqmMatches) {
      pricePerSqmMatches.forEach(match => {
        const price = parseInt(match.replace(/[€.,\s\/m²]/g, ''))
        if (price > 100 && price < 50000) { // Reasonable price per sqm range
          pricePerSqm.push(price)
        }
      })
    }
  })

  const averagePrice = prices.length > 0 ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0
  const averagePricePerSqm = pricePerSqm.length > 0 ? pricePerSqm.reduce((sum, price) => sum + price, 0) / pricePerSqm.length : 0

  return {
    prices,
    averagePrice,
    pricePerSqm,
    averagePricePerSqm
  }
}

export function extractMarketTrends(results: TavilySearchResult[]): {
  trend: 'up' | 'down' | 'stable'
  growthRate: number
  insights: string[]
} {
  const content = results.map(r => `${r.title} ${r.content}`).join(' ').toLowerCase()
  
  let trend: 'up' | 'down' | 'stable' = 'stable'
  let growthRate = 0
  const insights: string[] = []

  // Analyze trend indicators
  const upWords = ['increase', 'rise', 'growth', 'up', 'higher', 'surge', 'boom', 'appreciation']
  const downWords = ['decrease', 'fall', 'decline', 'down', 'lower', 'drop', 'crash', 'depreciation']
  
  const upCount = upWords.filter(word => content.includes(word)).length
  const downCount = downWords.filter(word => content.includes(word)).length
  
  if (upCount > downCount + 2) {
    trend = 'up'
  } else if (downCount > upCount + 2) {
    trend = 'down'
  }

  // Extract growth rate
  const growthMatches = content.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:growth|increase|rise|appreciation)/g)
  if (growthMatches) {
    const rates = growthMatches.map(match => parseFloat(match.replace(/[^\d.]/g, '')))
    growthRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length
  }

  // Extract key insights
  results.forEach(result => {
    const sentences = result.content.split(/[.!?]/)
    sentences.forEach(sentence => {
      const lower = sentence.toLowerCase()
      if (lower.includes('property') || lower.includes('real estate')) {
        if (lower.includes('investment') || lower.includes('market') || lower.includes('price')) {
          insights.push(sentence.trim())
        }
      }
    })
  })

  return {
    trend,
    growthRate,
    insights: insights.slice(0, 5) // Top 5 insights
  }
} 