// Historical Data Storage System
// Stores and retrieves real market data for long-term analysis

import { HistoricalPriceData } from '@/types'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface StoredMarketData {
  location: string // "{city}, {province}"
  propertyType: string
  lastUpdated: string
  dataSource: 'web_research' | 'xml_feed' | 'hybrid' | 'historical_accumulated'
  dataQuality: 'high' | 'medium' | 'low'
  historicalData: HistoricalPriceData[]
  currentMetrics: {
    averagePrice: number
    averagePricePerM2: number
    totalComparables: number
    marketTrend: 'up' | 'down' | 'stable'
  }
}

const DATA_DIR = path.join(process.cwd(), 'data', 'historical-market-data')
const STORAGE_FILE = path.join(DATA_DIR, 'market-data.json')

// Ensure data directory exists
async function ensureDataDirectory(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
  } catch (error) {
    console.warn('Failed to create historical data directory:', error)
  }
}

// Load all stored market data
async function loadStoredData(): Promise<StoredMarketData[]> {
  try {
    await ensureDataDirectory()
    const data = await fs.readFile(STORAGE_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    // File doesn't exist or is invalid - return empty array
    return []
  }
}

// Save all market data
async function saveStoredData(data: StoredMarketData[]): Promise<void> {
  try {
    await ensureDataDirectory()
    await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8')
    console.log(`💾 Saved ${data.length} market data records to storage`)
  } catch (error) {
    console.error('Failed to save historical market data:', error)
  }
}

// Store new market data
export async function storeMarketData(
  city: string,
  province: string,
  propertyType: string,
  marketData: {
    averagePrice: number
    averagePricePerM2: number
    totalComparables: number
    marketTrend: 'up' | 'down' | 'stable'
    historicalData?: HistoricalPriceData[]
    dataSource?: 'web_research' | 'xml_feed' | 'hybrid' | 'historical_accumulated'
    dataQuality?: 'high' | 'medium' | 'low'
  }
): Promise<void> {
  if (!marketData.historicalData || marketData.historicalData.length === 0) {
    console.log('📊 No historical data to store - skipping storage')
    return
  }

  try {
    const location = `${city}, ${province}`
    const storedData = await loadStoredData()
    
    // Find existing record for this location and property type
    const existingIndex = storedData.findIndex(
      record => record.location === location && record.propertyType === propertyType
    )
    
    const newRecord: StoredMarketData = {
      location,
      propertyType,
      lastUpdated: new Date().toISOString(),
      dataSource: marketData.dataSource || 'web_research',
      dataQuality: marketData.dataQuality || 'medium',
      historicalData: marketData.historicalData,
      currentMetrics: {
        averagePrice: marketData.averagePrice,
        averagePricePerM2: marketData.averagePricePerM2,
        totalComparables: marketData.totalComparables,
        marketTrend: marketData.marketTrend
      }
    }
    
    if (existingIndex >= 0) {
      // Update existing record - merge historical data
      const existing = storedData[existingIndex]
      const mergedHistoricalData = mergeHistoricalData(existing.historicalData, marketData.historicalData)
      
      storedData[existingIndex] = {
        ...newRecord,
        historicalData: mergedHistoricalData
      }
      
      console.log(`📈 Updated market data for ${location} (${propertyType}) - ${mergedHistoricalData.length} data points`)
    } else {
      // Add new record
      storedData.push(newRecord)
      console.log(`📊 Stored new market data for ${location} (${propertyType}) - ${marketData.historicalData.length} data points`)
    }
    
    await saveStoredData(storedData)
  } catch (error) {
    console.error('Failed to store market data:', error)
  }
}

// Retrieve stored market data
export async function retrieveMarketData(
  city: string,
  province: string,
  propertyType: string
): Promise<StoredMarketData | null> {
  try {
    const location = `${city}, ${province}`
    const storedData = await loadStoredData()
    
    const record = storedData.find(
      record => record.location === location && record.propertyType === propertyType
    )
    
    if (record) {
      console.log(`📈 Retrieved stored market data for ${location} (${propertyType}) - ${record.historicalData.length} data points`)
      return record
    }
    
    return null
  } catch (error) {
    console.error('Failed to retrieve market data:', error)
    return null
  }
}

// Merge historical data, avoiding duplicates
function mergeHistoricalData(
  existing: HistoricalPriceData[],
  newData: HistoricalPriceData[]
): HistoricalPriceData[] {
  const merged = [...existing]
  
  for (const newDataPoint of newData) {
    const existingIndex = merged.findIndex(point => point.year === newDataPoint.year)
    
    if (existingIndex >= 0) {
      // Update existing data point if new one has higher confidence
      const existingPoint = merged[existingIndex]
      if (getConfidenceScore(newDataPoint.confidence) > getConfidenceScore(existingPoint.confidence)) {
        merged[existingIndex] = newDataPoint
      }
    } else {
      // Add new data point
      merged.push(newDataPoint)
    }
  }
  
  // Sort by year
  return merged.sort((a, b) => parseInt(a.year) - parseInt(b.year))
}

// Get numeric confidence score for comparison
function getConfidenceScore(confidence: 'high' | 'medium' | 'low'): number {
  switch (confidence) {
    case 'high': return 3
    case 'medium': return 2
    case 'low': return 1
    default: return 1
  }
}

// Get all stored locations for analysis
export async function getAllStoredLocations(): Promise<Array<{location: string, propertyTypes: string[], lastUpdated: string}>> {
  try {
    const storedData = await loadStoredData()
    const locationMap = new Map<string, {propertyTypes: Set<string>, lastUpdated: string}>()
    
    for (const record of storedData) {
      if (locationMap.has(record.location)) {
        const existing = locationMap.get(record.location)!
        existing.propertyTypes.add(record.propertyType)
        if (record.lastUpdated > existing.lastUpdated) {
          existing.lastUpdated = record.lastUpdated
        }
      } else {
        locationMap.set(record.location, {
          propertyTypes: new Set([record.propertyType]),
          lastUpdated: record.lastUpdated
        })
      }
    }
    
    return Array.from(locationMap.entries()).map(([location, data]) => ({
      location,
      propertyTypes: Array.from(data.propertyTypes),
      lastUpdated: data.lastUpdated
    }))
  } catch (error) {
    console.error('Failed to get stored locations:', error)
    return []
  }
} 