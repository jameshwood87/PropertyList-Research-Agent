import { NextRequest, NextResponse } from 'next/server'
import { extractPropertyData } from '@/lib/property-scraper'
import { searchMarketData } from '@/lib/tavily'
import { generateAnalysis } from '@/lib/openai'
import { AnalysisResult } from '@/types'
import { initializeProxyConfig } from '@/lib/proxy-config'

// Initialize proxy configuration on module load
initializeProxyConfig()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('API received body:', body)
    
    const { url, topic } = body
    console.log('Extracted URL:', url, 'Type:', typeof url)
    console.log('Extracted topic:', topic)
    
    if (!url || typeof url !== 'string' || url.trim() === '') {
      console.log('URL validation failed:', { url, type: typeof url })
      return NextResponse.json({
        error: 'Property URL is required and must be a valid string',
        steps: [{
          id: 'validate',
          title: 'Validate Input',
          status: 'error',
          description: 'Invalid or missing property URL'
        }]
      })
    }

    // Step 1: Extract property data
    console.log('🏠 Step 1: Extracting property data...')
    const propertyData = await extractPropertyData(url)
    
    // Step 2: Search for market data
    console.log('🔍 Step 2: Searching market data...')
    const marketQueries = [
      `${propertyData.location} property prices ${propertyData.type} market trends`,
      `${propertyData.location} real estate investment €/m² average price`,
      `${propertyData.location} property market news developments 2024`,
      `similar properties ${propertyData.location} ${propertyData.bedrooms} bedroom ${propertyData.type}`
    ]
    
    const marketData = await searchMarketData(marketQueries)
    
    // Step 3: Generate AI analysis
    console.log('🧠 Step 3: Generating AI analysis...')
    const analysis = await generateAnalysis(propertyData, marketData, topic)
    
    const result: AnalysisResult = {
      propertyData,
      marketData: {
        averagePricePerSqm: analysis.marketData?.averagePricePerSqm || 0,
        priceRange: analysis.marketData?.priceRange || { min: 0, max: 0 },
        salesVolume: analysis.marketData?.salesVolume || 0,
        daysOnMarket: analysis.marketData?.daysOnMarket || 0,
        priceGrowth: analysis.marketData?.priceGrowth || 0,
        marketTrend: analysis.marketData?.marketTrend || 'stable',
        comparableListings: analysis.marketData?.comparableListings || []
      },
      insights: analysis.insights,
      report: analysis.report,
      steps: [
        {
          id: 'extract',
          title: 'Extract Property Data',
          status: 'completed',
          description: 'Property data extracted successfully'
        },
        {
          id: 'market',
          title: 'Market Research',
          status: 'completed',
          description: 'Market data collected and analyzed'
        },
        {
          id: 'analysis',
          title: 'AI Analysis',
          status: 'completed',
          description: 'AI analysis completed'
        }
      ]
    }
    
    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('Analysis failed:', error)
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      code: error?.code,
      response: error?.response?.status
    })
    
    let errorMessage = 'Failed to analyze property'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return NextResponse.json({
      error: errorMessage,
      steps: [
        {
          id: 'extract',
          title: 'Extract Property Data',
          status: 'error',
          description: errorMessage,
          error: errorMessage
        }
      ]
    })
  }
} 