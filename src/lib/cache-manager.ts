// Cache Manager for PropertyList Research Agent
// Reduces API costs by caching frequently requested data

import * as fs from 'fs/promises'
import * as path from 'path'

// Cache interfaces
export interface LocationCache {
  address: string
  coordinates: { lat: number; lng: number }
  timestamp: number
  ttl: number // 30 days for coordinates
}

export interface AmenityCache {
  locationKey: string // "lat,lng" rounded to 0.001 precision
  amenities: any[]
  timestamp: number
  ttl: number // 7 days for amenities
}

export interface MarketDataCache {
  city: string
  propertyType: string
  marketData: any
  timestamp: number
  ttl: number // 24 hours for market data
}

export interface TavilyCache {
  query: string
  results: any[]
  timestamp: number
  ttl: number // 12 hours for search results
}

export interface MobilityCache {
  locationKey: string
  mobilityData: any
  timestamp: number
  ttl: number // 7 days for mobility data
}

export class CacheManager {
  private cacheDir: string
  private memoryCache: Map<string, any> = new Map()
  private memoryCacheTTL: Map<string, number> = new Map()
  private readonly MEMORY_CACHE_TTL = 5 * 60 * 1000 // 5 minutes for memory cache

  constructor(cacheDir: string = './data/cache') {
    this.cacheDir = cacheDir
    this.ensureCacheDirectory()
  }

  private async ensureCacheDirectory() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true })
    } catch (error) {
      console.warn('⚠️ Could not create cache directory:', error)
    }
  }

  private getCacheFilePath(cacheType: string, key: string): string {
    const sanitizedKey = key.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100)
    return path.join(this.cacheDir, `${cacheType}_${sanitizedKey}.json`)
  }

  private getMemoryCacheKey(cacheType: string, key: string): string {
    return `${cacheType}:${key}`
  }

  private isExpired(timestamp: number, ttl: number): boolean {
    return Date.now() - timestamp > ttl
  }

  // Generic cache get method
  async get<T>(cacheType: string, key: string): Promise<T | null> {
    const memoryKey = this.getMemoryCacheKey(cacheType, key)
    
    // Check memory cache first
    const memoryData = this.memoryCache.get(memoryKey)
    const memoryTimestamp = this.memoryCacheTTL.get(memoryKey)
    
    if (memoryData && memoryTimestamp && !this.isExpired(memoryTimestamp, this.MEMORY_CACHE_TTL)) {
      console.log(`📦 Memory cache hit for ${cacheType}: ${key}`)
      return memoryData
    }

    // Check file cache
    try {
      const filePath = this.getCacheFilePath(cacheType, key)
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const cachedData = JSON.parse(fileContent)
      
      if (this.isExpired(cachedData.timestamp, cachedData.ttl)) {
        console.log(`🗑️ Cache expired for ${cacheType}: ${key}`)
        await this.delete(cacheType, key)
        return null
      }
      
      // Store in memory cache for faster access
      this.memoryCache.set(memoryKey, cachedData.data)
      this.memoryCacheTTL.set(memoryKey, Date.now())
      
      console.log(`📦 File cache hit for ${cacheType}: ${key}`)
      return cachedData.data
    } catch (error) {
      // Cache miss or file doesn't exist
      return null
    }
  }

  // Generic cache set method
  async set(cacheType: string, key: string, data: any, ttl: number): Promise<void> {
    const memoryKey = this.getMemoryCacheKey(cacheType, key)
    const cacheData = {
      data,
      timestamp: Date.now(),
      ttl
    }
    
    // Store in memory cache
    this.memoryCache.set(memoryKey, data)
    this.memoryCacheTTL.set(memoryKey, Date.now())
    
    // Store in file cache
    try {
      const filePath = this.getCacheFilePath(cacheType, key)
      await fs.writeFile(filePath, JSON.stringify(cacheData, null, 2), 'utf-8')
      console.log(`💾 Cached ${cacheType}: ${key}`)
    } catch (error) {
      console.warn(`⚠️ Failed to write cache file for ${cacheType}: ${key}`, error)
    }
  }

  // Generic cache delete method
  async delete(cacheType: string, key: string): Promise<void> {
    const memoryKey = this.getMemoryCacheKey(cacheType, key)
    
    // Remove from memory cache
    this.memoryCache.delete(memoryKey)
    this.memoryCacheTTL.delete(memoryKey)
    
    // Remove file cache
    try {
      const filePath = this.getCacheFilePath(cacheType, key)
      await fs.unlink(filePath)
    } catch (error) {
      // File doesn't exist, which is fine
    }
  }

  // Specific cache methods for different data types
  async getCoordinates(address: string): Promise<{ lat: number; lng: number } | null> {
    return this.get<{ lat: number; lng: number }>('coordinates', address)
  }

  async setCoordinates(address: string, coordinates: { lat: number; lng: number }): Promise<void> {
    await this.set('coordinates', address, coordinates, 30 * 24 * 60 * 60 * 1000) // 30 days
  }

  async getAmenities(lat: number, lng: number): Promise<any[] | null> {
    const locationKey = `${lat.toFixed(3)},${lng.toFixed(3)}`
    return this.get<any[]>('amenities', locationKey)
  }

  async setAmenities(lat: number, lng: number, amenities: any[]): Promise<void> {
    const locationKey = `${lat.toFixed(3)},${lng.toFixed(3)}`
    await this.set('amenities', locationKey, amenities, 7 * 24 * 60 * 60 * 1000) // 7 days
  }

  async getMarketData(city: string, propertyType: string): Promise<any | null> {
    const key = `${city}_${propertyType}`
    return this.get<any>('marketdata', key)
  }

  async setMarketData(city: string, propertyType: string, marketData: any): Promise<void> {
    const key = `${city}_${propertyType}`
    await this.set('marketdata', key, marketData, 24 * 60 * 60 * 1000) // 24 hours
  }

  async getTavilyResults(query: string): Promise<any[] | null> {
    return this.get<any[]>('tavily', query)
  }

  async setTavilyResults(query: string, results: any[]): Promise<void> {
    // Intelligent TTL based on query type
    let ttl = 7 * 24 * 60 * 60 * 1000 // Default: 7 days for most queries
    
    // Shorter TTL for time-sensitive queries
    if (query.includes('2024') || query.includes('2025') || query.includes('recent')) {
      ttl = 24 * 60 * 60 * 1000 // 24 hours for year-specific queries
    }
    
    // Very short TTL for development/construction queries
    if (query.includes('construction') || query.includes('development') || query.includes('project')) {
      ttl = 12 * 60 * 60 * 1000 // 12 hours for development queries
    }
    
    // Long TTL for historical/statistical data
    if (query.includes('INE') || query.includes('Catastro') || query.includes('statistics') || 
        query.includes('historical') || query.includes('market data')) {
      ttl = 30 * 24 * 60 * 60 * 1000 // 30 days for official statistics
    }
    
    await this.set('tavily', query, results, ttl)
  }

  async getMobilityData(lat: number, lng: number): Promise<any | null> {
    const locationKey = `${lat.toFixed(3)},${lng.toFixed(3)}`
    return this.get<any>('mobility', locationKey)
  }

  async setMobilityData(lat: number, lng: number, mobilityData: any): Promise<void> {
    const locationKey = `${lat.toFixed(3)},${lng.toFixed(3)}`
    await this.set('mobility', locationKey, mobilityData, 7 * 24 * 60 * 60 * 1000) // 7 days
  }

  // Cache statistics
  async getCacheStats(): Promise<{
    memoryCacheSize: number
    fileCacheCount: number
    cacheTypes: Record<string, number>
  }> {
    try {
      const files = await fs.readdir(this.cacheDir)
      const cacheTypes: Record<string, number> = {}
      
      files.forEach(file => {
        const parts = file.split('_')
        if (parts.length > 0) {
          const cacheType = parts[0]
          cacheTypes[cacheType] = (cacheTypes[cacheType] || 0) + 1
        }
      })
      
      return {
        memoryCacheSize: this.memoryCache.size,
        fileCacheCount: files.length,
        cacheTypes
      }
    } catch (error) {
      return {
        memoryCacheSize: this.memoryCache.size,
        fileCacheCount: 0,
        cacheTypes: {}
      }
    }
  }

  // Clean up expired cache entries
  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir)
      let cleanedCount = 0
      
      for (const file of files) {
        try {
          const filePath = path.join(this.cacheDir, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const cachedData = JSON.parse(content)
          
          if (this.isExpired(cachedData.timestamp, cachedData.ttl)) {
            await fs.unlink(filePath)
            cleanedCount++
          }
        } catch (error) {
          // Skip files that can't be read or parsed
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`)
      }
    } catch (error) {
      console.warn('⚠️ Cache cleanup failed:', error)
    }
  }
}

// Global cache manager instance
export const cacheManager = new CacheManager() 