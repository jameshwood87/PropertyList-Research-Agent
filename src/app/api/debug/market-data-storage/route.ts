import { NextRequest, NextResponse } from 'next/server'
import { getAllStoredLocations, retrieveMarketData } from '@/lib/historical-data-storage'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get('location')
    const propertyType = searchParams.get('propertyType')
    
    // If specific location and property type requested, return detailed data
    if (location && propertyType) {
      const [city, province] = location.split(', ')
      const data = await retrieveMarketData(city, province, propertyType)
      
      if (data) {
        return NextResponse.json({
          success: true,
          data: {
            location: data.location,
            propertyType: data.propertyType,
            dataSource: data.dataSource,
            dataQuality: data.dataQuality,
            lastUpdated: data.lastUpdated,
            historicalDataPoints: data.historicalData.length,
            yearRange: data.historicalData.length > 0 ? {
              from: Math.min(...data.historicalData.map(d => parseInt(d.year))),
              to: Math.max(...data.historicalData.map(d => parseInt(d.year)))
            } : null,
            currentMetrics: data.currentMetrics,
            historicalData: data.historicalData
          }
        })
      } else {
        return NextResponse.json({
          success: false,
          error: 'No data found for specified location and property type'
        }, { status: 404 })
      }
    }
    
    // Otherwise return overview of all stored data
    const locations = await getAllStoredLocations()
    
    const statistics = {
      totalLocations: locations.length,
      totalPropertyTypes: new Set(locations.flatMap(l => l.propertyTypes)).size,
      locations: locations.map(location => ({
        location: location.location,
        propertyTypes: location.propertyTypes,
        lastUpdated: location.lastUpdated
      })),
      lastUpdateOverall: locations.length > 0 ? 
        Math.max(...locations.map(l => new Date(l.lastUpdated).getTime())) : null
    }
    
    return NextResponse.json({
      success: true,
      message: 'Historical market data storage overview',
      statistics
    })
    
  } catch (error) {
    console.error('Error accessing market data storage:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to access market data storage',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const confirm = searchParams.get('confirm')
    
    if (confirm !== 'true') {
      return NextResponse.json({
        success: false,
        error: 'Add ?confirm=true to confirm deletion of all stored market data'
      }, { status: 400 })
    }
    
    // Clear all stored data by writing empty array
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const DATA_DIR = path.join(process.cwd(), 'data', 'historical-market-data')
    const STORAGE_FILE = path.join(DATA_DIR, 'market-data.json')
    
    await fs.writeFile(STORAGE_FILE, JSON.stringify([], null, 2), 'utf-8')
    
    return NextResponse.json({
      success: true,
      message: 'All stored market data has been cleared'
    })
    
  } catch (error) {
    console.error('Error clearing market data storage:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to clear market data storage',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 