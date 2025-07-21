// Property Database Service with JSON File-Based Storage + In-Memory Search
import { PropertyData, Comparable } from '@/types'
import path from 'path'
import fs from 'fs'
import { gzip, gunzip } from 'zlib'
import { promisify } from 'util'

// Promisify zlib functions for async/await usage
const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

export interface PriceHistoryEntry {
  price: number
  date: string
  source: string
  change?: number // Price change from previous entry (absolute)
  changePercent?: number // Price change from previous entry (percentage)
}

export interface CompressedPriceEntry {
  price: number // Average price for the period
  date: string // Period start date
  source: string
  highPrice: number // Highest price in the period
  lowPrice: number // Lowest price in the period
  changes: number // Number of price changes in the period
}

export interface SmartPriceHistory {
  // Recent detailed data (last 6 months - all changes)
  recent: PriceHistoryEntry[]
  
  // Compressed historical data
  monthly: CompressedPriceEntry[] // 2 years of monthly averages
  quarterly: CompressedPriceEntry[] // 5 years of quarterly averages  
  yearly: CompressedPriceEntry[] // 10+ years of yearly averages
  
  // Major price changes (>10% changes - kept indefinitely)
  majorChanges: PriceHistoryEntry[]
  
  // Metadata
  firstListedDate: string
  lastUpdated: string
  totalChanges: number
}

export interface DatabaseProperty {
  id: string
  feed_source: string
  ref_number?: string
  address: string
  city: string
  province: string
  area_code?: string
  // Enhanced location fields
  neighbourhood?: string // Barrio, zona, district
  urbanisation?: string // Urbanización, development, complex
  zone?: string // Specific zone within city
  property_type: string
  bedrooms: number
  bathrooms: number
  total_area_m2: number
  build_area?: number
  plot_area?: number
  terrace_area_m2?: number
  condition?: string
  architectural_style?: string
  features: string[] // Array of features
  description?: string
  price: number
  year_built?: number
  date_listed: string
  last_updated: string
  image?: string
  images?: string[] // Array of image URLs
  lat?: number
  lng?: number
  // Transaction type (sale vs rental)
  is_sale: boolean
  is_short_term?: boolean
  is_long_term?: boolean
  // Enhanced price history tracking
  price_history: SmartPriceHistory
  // Search optimization fields
  search_text: string // Concatenated searchable text
  price_per_m2: number
  location_hash: string // For faster location-based queries
  // Enhanced indexing fields
  size_category?: string // Small, Medium, Large, Luxury
  age_category?: string // New, 1-5 years, 5-10 years, 10+ years
  view_type?: string // Sea, Mountain, Golf, City, etc.
  development_name?: string // Name of development/community
  
  // CamelCase field mappings for compatibility
  propertyType?: string
  buildArea?: number
  plotArea?: number
  terraceAreaM2?: number
  architecturalStyle?: string
  isSale?: boolean
  isShortTerm?: boolean
  isLongTerm?: boolean
  refNumber?: string
  dateListed?: string
  lastUpdated?: string
  pricePerM2?: number
  locationHash?: string
  searchText?: string
  sizeCategory?: string
  ageCategory?: string
  viewType?: string
  developmentName?: string
  feedSource?: string
  areaCode?: string
  yearBuilt?: number
}

export interface PropertySearchCriteria {
  propertyType: string
  city: string
  province?: string
  // Enhanced location criteria
  neighbourhood?: string
  urbanisation?: string
  zone?: string
  street?: string // Street name for precise location matching
  suburb?: string // Suburb/neighbourhood for location hierarchy
  address?: string // Full address for location component extraction
  bedrooms?: number
  bathrooms?: number
  minPrice?: number
  maxPrice?: number
  minAreaM2?: number
  maxAreaM2?: number
  maxDistance?: number // in km from coordinates
  lat?: number
  lng?: number
  condition?: string[]
  features?: string[]
  // Enhanced search criteria
  architecturalStyle?: string[]
  sizeCategory?: string[]
  ageCategory?: string[]
  viewType?: string[]
  developmentName?: string
  // Property age and timing criteria
  minYearBuilt?: number // Minimum year built
  maxYearBuilt?: number // Maximum year built
  minListingDate?: string // Minimum listing date (ISO string)
  maxListingDate?: string // Maximum listing date (ISO string)
  maxResults?: number
  // Transaction type filter
  isSale?: boolean // true for sale properties, false for rental properties
  isShortTerm?: boolean // true for short-term rental properties
  isLongTerm?: boolean // true for long-term rental properties
  // Property exclusion
  excludeId?: string // Property ID to exclude from search results (prevents self-comparison)
}

export interface DatabaseIndex {
  byCity: Record<string, string[]> // city -> property IDs
  byType: Record<string, string[]> // property type -> property IDs
  byLocation: Record<string, string[]> // location hash -> property IDs
  byPriceRange: Record<string, string[]> // price ranges -> property IDs
  // Enhanced location indexes
  byNeighbourhood: Record<string, string[]> // neighbourhood -> property IDs
  byUrbanisation: Record<string, string[]> // urbanisation -> property IDs
  byZone: Record<string, string[]> // zone -> property IDs
  // Enhanced property indexes
  byCondition: Record<string, string[]> // condition -> property IDs
  byArchitecturalStyle: Record<string, string[]> // architectural style -> property IDs
  bySizeCategory: Record<string, string[]> // size category -> property IDs
  byAgeCategory: Record<string, string[]> // age category -> property IDs
  byViewType: Record<string, string[]> // view type -> property IDs
  byDevelopmentName: Record<string, string[]> // development name -> property IDs
  // Feature indexes
  byFeature: Record<string, string[]> // feature -> property IDs
  // Transaction type indexes
  bySale: Record<string, string[]> // sale properties by city
  byRental: Record<string, string[]> // rental properties by city
  byShortTerm: Record<string, string[]> // short-term rentals by city
  byLongTerm: Record<string, string[]> // long-term rentals by city
  lastUpdated: string
}

// Smart Price History Helper Functions
class PriceHistoryManager {
  
  // Initialize empty smart price history
  static createEmptyHistory(): SmartPriceHistory {
    return {
      recent: [],
      monthly: [],
      quarterly: [],
      yearly: [],
      majorChanges: [],
      firstListedDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      totalChanges: 0
    }
  }
  
  // Add new price entry to smart history
  static addPriceEntry(
    history: SmartPriceHistory, 
    price: number, 
    date: string, 
    source: string
  ): SmartPriceHistory {
    const newEntry: PriceHistoryEntry = {
      price,
      date,
      source
    }
    
    // Calculate change from last price if available
    const lastPrice = this.getLastPrice(history)
    if (lastPrice && lastPrice > 0) {
      newEntry.change = price - lastPrice
      newEntry.changePercent = ((price - lastPrice) / lastPrice) * 100
      
      // Check if this is a major change (>10%)
      if (Math.abs(newEntry.changePercent) >= 10) {
        history.majorChanges.push(newEntry)
      }
    }
    
    // Add to recent history
    history.recent.push(newEntry)
    history.totalChanges++
    history.lastUpdated = date
    
    // Compress old data if needed
    this.compressHistoryIfNeeded(history)
    
    return history
  }
  
  // Get the most recent price from history
  private static getLastPrice(history: SmartPriceHistory): number | null {
    if (history.recent.length > 0) {
      return history.recent[history.recent.length - 1].price
    }
    if (history.monthly.length > 0) {
      return history.monthly[history.monthly.length - 1].price
    }
    if (history.quarterly.length > 0) {
      return history.quarterly[history.quarterly.length - 1].price
    }
    if (history.yearly.length > 0) {
      return history.yearly[history.yearly.length - 1].price
    }
    return null
  }
  
  // Compress history when recent data gets too old
  private static compressHistoryIfNeeded(history: SmartPriceHistory): void {
    const now = new Date()
    const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000)
    const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000)
    const fiveYearsAgo = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000)
    
    // Move old recent data to monthly compression
    const oldRecentData = history.recent.filter(entry => new Date(entry.date) < sixMonthsAgo)
    history.recent = history.recent.filter(entry => new Date(entry.date) >= sixMonthsAgo)
    
    if (oldRecentData.length > 0) {
      const monthlyCompressed = this.compressToMonthly(oldRecentData)
      history.monthly.push(...monthlyCompressed)
    }
    
    // Move old monthly data to quarterly compression
    const oldMonthlyData = history.monthly.filter(entry => new Date(entry.date) < twoYearsAgo)
    history.monthly = history.monthly.filter(entry => new Date(entry.date) >= twoYearsAgo)
    
    if (oldMonthlyData.length > 0) {
      const quarterlyCompressed = this.compressToQuarterly(oldMonthlyData)
      history.quarterly.push(...quarterlyCompressed)
    }
    
    // Move old quarterly data to yearly compression
    const oldQuarterlyData = history.quarterly.filter(entry => new Date(entry.date) < fiveYearsAgo)
    history.quarterly = history.quarterly.filter(entry => new Date(entry.date) >= fiveYearsAgo)
    
    if (oldQuarterlyData.length > 0) {
      const yearlyCompressed = this.compressToYearly(oldQuarterlyData)
      history.yearly.push(...yearlyCompressed)
    }
  }
  
  // Compress price entries to monthly averages
  private static compressToMonthly(entries: PriceHistoryEntry[]): CompressedPriceEntry[] {
    return this.compressByPeriod(entries, 'month')
  }
  
  // Compress price entries to quarterly averages
  private static compressToQuarterly(entries: (PriceHistoryEntry | CompressedPriceEntry)[]): CompressedPriceEntry[] {
    return this.compressByPeriod(entries, 'quarter')
  }
  
  // Compress price entries to yearly averages
  private static compressToYearly(entries: (PriceHistoryEntry | CompressedPriceEntry)[]): CompressedPriceEntry[] {
    return this.compressByPeriod(entries, 'year')
  }
  
  // Generic compression by time period
  private static compressByPeriod(
    entries: (PriceHistoryEntry | CompressedPriceEntry)[], 
    period: 'month' | 'quarter' | 'year'
  ): CompressedPriceEntry[] {
    const grouped = new Map<string, (PriceHistoryEntry | CompressedPriceEntry)[]>()
    
    entries.forEach(entry => {
      const date = new Date(entry.date)
      let key: string
      
      if (period === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      } else if (period === 'quarter') {
        const quarter = Math.floor(date.getMonth() / 3) + 1
        key = `${date.getFullYear()}-Q${quarter}`
      } else {
        key = `${date.getFullYear()}`
      }
      
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(entry)
    })
    
    const compressed: CompressedPriceEntry[] = []
    
    grouped.forEach((periodEntries, periodKey) => {
      const prices = periodEntries.map(e => e.price)
      const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length
      const highPrice = Math.max(...prices)
      const lowPrice = Math.min(...prices)
      
      // Use the first entry's date as the period start
      const firstEntry = periodEntries[0]
      
      compressed.push({
        price: Math.round(avgPrice),
        date: firstEntry.date,
        source: firstEntry.source,
        highPrice: Math.round(highPrice),
        lowPrice: Math.round(lowPrice),
        changes: periodEntries.length
      })
    })
    
    return compressed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }
  
  // Get all price history as a flat array (for backward compatibility)
  static getAllPriceHistory(history: SmartPriceHistory): PriceHistoryEntry[] {
    const allEntries: PriceHistoryEntry[] = []
    
    // Add yearly data (converted back to PriceHistoryEntry format)
    history.yearly.forEach(entry => {
      allEntries.push({
        price: entry.price,
        date: entry.date,
        source: entry.source
      })
    })
    
    // Add quarterly data
    history.quarterly.forEach(entry => {
      allEntries.push({
        price: entry.price,
        date: entry.date,
        source: entry.source
      })
    })
    
    // Add monthly data
    history.monthly.forEach(entry => {
      allEntries.push({
        price: entry.price,
        date: entry.date,
        source: entry.source
      })
    })
    
    // Add recent data
    allEntries.push(...history.recent)
    
    // Sort by date
    return allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }
  
  // Get recent price history (for display)
  static getRecentPriceHistory(history: SmartPriceHistory, limit: number = 10): PriceHistoryEntry[] {
    const allRecent = [...history.recent]
    
    // Add some monthly data if we don't have enough recent data
    if (allRecent.length < limit && history.monthly.length > 0) {
      const monthlyAsEntries = history.monthly.slice(-Math.min(5, limit - allRecent.length)).map(entry => ({
        price: entry.price,
        date: entry.date,
        source: entry.source
      }))
      allRecent.unshift(...monthlyAsEntries)
    }
    
    return allRecent.slice(-limit)
  }
  
  // Migrate old price history format to new format
  static migrateOldHistory(oldHistory: PriceHistoryEntry[]): SmartPriceHistory {
    const newHistory = this.createEmptyHistory()
    
    if (oldHistory.length > 0) {
      newHistory.firstListedDate = oldHistory[0].date
      newHistory.totalChanges = oldHistory.length
    }
    
    // Add all old entries through the normal process (will be compressed as needed)
    oldHistory.forEach(entry => {
      this.addPriceEntry(newHistory, entry.price, entry.date, entry.source)
    })
    
    return newHistory
  }
}

export class PropertyDatabase {
  private dataDir: string
  private propertiesFile: string
  private indexFile: string
  private properties: Map<string, DatabaseProperty> = new Map()
  private index: DatabaseIndex
  private isLoaded: boolean = false
  private compressionEnabled: boolean = true // Enable compression by default

  constructor(dataDir: string = './data', enableCompression: boolean = true) {
    this.dataDir = dataDir
    this.propertiesFile = path.join(dataDir, 'properties.json')
    this.indexFile = path.join(dataDir, 'index.json')
    this.compressionEnabled = enableCompression
    this.ensureDataDirectory()
    this.initializeIndex()
    this.loadDatabase()
  }

  private ensureDataDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
    }
  }

  private initializeIndex(): void {
    this.index = {
      byCity: {},
      byType: {},
      byLocation: {},
      byPriceRange: {},
      // Enhanced location indexes
      byNeighbourhood: {},
      byUrbanisation: {},
      byZone: {},
      // Enhanced property indexes
      byCondition: {},
      byArchitecturalStyle: {},
      bySizeCategory: {},
      byAgeCategory: {},
      byViewType: {},
      byDevelopmentName: {},
      // Feature indexes
      byFeature: {},
      // Transaction type indexes
      bySale: {},
      byRental: {},
      byShortTerm: {},
      byLongTerm: {},
      lastUpdated: new Date().toISOString()
    }
  }

  private loadDatabase(): void {
    try {
      // Load properties with compression support
      const propertiesPath = this.getCompressedFilePath(this.propertiesFile)
      if (fs.existsSync(propertiesPath)) {
        const data = fs.readFileSync(propertiesPath)
        this.decompressData(data).then(propertiesArray => {
          this.properties.clear()
          
          let migratedCount = 0
          propertiesArray.forEach(prop => {
            // Fix field mapping from snake_case to camelCase
            const mappedProp = {
              ...prop,
              // Map property type field
              propertyType: prop.property_type || prop.propertyType,
              // Map area fields
              buildArea: prop.build_area || prop.buildArea,
              plotArea: prop.plot_area || prop.plotArea,
              terraceAreaM2: prop.terrace_area_m2 || prop.terraceAreaM2,
              // Map transaction type fields
              isSale: prop.is_sale !== undefined ? prop.is_sale : prop.isSale,
              isShortTerm: prop.is_short_term !== undefined ? prop.is_short_term : prop.isShortTerm,
              isLongTerm: prop.is_long_term !== undefined ? prop.is_long_term : prop.isLongTerm,
              // Map reference number field - ensure this works correctly
              refNumber: prop.ref_number || prop.refNumber || undefined,
              // Map architectural style field
              architecturalStyle: prop.architectural_style || prop.architecturalStyle,
              // Map date fields
              dateListed: prop.date_listed || prop.dateListed,
              lastUpdated: prop.last_updated || prop.lastUpdated,
              // Map price per m2 field
              pricePerM2: prop.price_per_m2 || prop.pricePerM2,
              // Map location hash field
              locationHash: prop.location_hash || prop.locationHash,
              // Map search text field
              searchText: prop.search_text || prop.searchText,
              // Map size category field
              sizeCategory: prop.size_category || prop.sizeCategory,
              // Map age category field
              ageCategory: prop.age_category || prop.ageCategory,
              // Map view type field
              viewType: prop.view_type || prop.viewType,
              // Map development name field
              developmentName: prop.development_name || prop.developmentName,
              // Map feed source field
              feedSource: prop.feed_source || prop.feedSource,
              // Map area code field
              areaCode: prop.area_code || prop.areaCode,
              // Map year built field
              yearBuilt: prop.year_built || prop.yearBuilt
            }
            
            // Debug: Log reference number mapping for first few properties
            if (this.properties.size < 5) {
              console.log(`🔍 Property ${this.properties.size + 1} ref mapping:`, {
                original: prop.ref_number,
                mapped: mappedProp.refNumber,
                address: mappedProp.address
              })
            }
            
            // Check if price_history needs migration from old format
            if (mappedProp.price_history && Array.isArray(mappedProp.price_history)) {
              // Old format detected - migrate to new SmartPriceHistory format
              const oldHistory = mappedProp.price_history as PriceHistoryEntry[]
              mappedProp.price_history = PriceHistoryManager.migrateOldHistory(oldHistory)
              migratedCount++
            } else if (!mappedProp.price_history) {
              // No price history - initialize empty
              mappedProp.price_history = PriceHistoryManager.createEmptyHistory()
            }
            
            this.properties.set(mappedProp.id, mappedProp as DatabaseProperty)
          })
          
          console.log(`Loaded ${this.properties.size} properties from database`)
          if (migratedCount > 0) {
            console.log(`Migrated ${migratedCount} properties to new price history format`)
            // Save the migrated data
            this.saveDatabase()
          }
        }).catch(error => {
          console.error('Error decompressing properties:', error)
          this.properties.clear()
        })
      }

      // Load index with compression support
      const indexPath = this.getCompressedFilePath(this.indexFile)
      if (fs.existsSync(indexPath)) {
        const indexData = fs.readFileSync(indexPath)
        this.decompressData(indexData).then(index => {
          this.index = index
        }).catch(error => {
          console.error('Error decompressing index:', error)
          this.rebuildIndex()
        })
      } else {
        this.rebuildIndex()
      }

      this.isLoaded = true
    } catch (error) {
      console.error('Error loading database:', error)
      this.properties.clear()
      this.initializeIndex()
      this.isLoaded = true
    }
  }

  private saveDatabase(): void {
    try {
      // Save properties with compression
      const propertiesArray = Array.from(this.properties.values())
      this.compressData(propertiesArray).then(compressedData => {
        const propertiesPath = this.getCompressedFilePath(this.propertiesFile)
        fs.writeFileSync(propertiesPath, compressedData)
      }).catch(error => {
        console.error('Error compressing properties:', error)
        // Fallback to uncompressed
        fs.writeFileSync(this.propertiesFile, JSON.stringify(propertiesArray, null, 2), 'utf8')
      })

      // Save index with compression
      this.index.lastUpdated = new Date().toISOString()
      this.compressData(this.index).then(compressedData => {
        const indexPath = this.getCompressedFilePath(this.indexFile)
        fs.writeFileSync(indexPath, compressedData)
      }).catch(error => {
        console.error('Error compressing index:', error)
        // Fallback to uncompressed
        fs.writeFileSync(this.indexFile, JSON.stringify(this.index, null, 2), 'utf8')
      })
    } catch (error) {
      console.error('Error saving database:', error)
    }
  }

  private rebuildIndex(): void {
    this.initializeIndex()

    for (const property of Array.from(this.properties.values())) {
      this.addToIndex(property)
    }

    console.log('Database index rebuilt')
  }

  private addToIndex(property: DatabaseProperty): void {
    const { 
      id, city, property_type, location_hash, price, 
      neighbourhood, urbanisation, zone, condition, architectural_style,
      size_category, age_category, view_type, development_name, features
    } = property

    // City index
    if (!this.index.byCity[city]) {
      this.index.byCity[city] = []
    }
    if (!this.index.byCity[city].includes(id)) {
      this.index.byCity[city].push(id)
    }

    // Property type index
    if (!this.index.byType[property_type]) {
      this.index.byType[property_type] = []
    }
    if (!this.index.byType[property_type].includes(id)) {
      this.index.byType[property_type].push(id)
    }

    // Location index
    if (!this.index.byLocation[location_hash]) {
      this.index.byLocation[location_hash] = []
    }
    if (!this.index.byLocation[location_hash].includes(id)) {
      this.index.byLocation[location_hash].push(id)
    }

    // Price range index (in 100k increments)
    const priceRange = `${Math.floor(price / 100000) * 100000}-${Math.floor(price / 100000) * 100000 + 99999}`
    if (!this.index.byPriceRange[priceRange]) {
      this.index.byPriceRange[priceRange] = []
    }
    if (!this.index.byPriceRange[priceRange].includes(id)) {
      this.index.byPriceRange[priceRange].push(id)
    }

    // Enhanced location indexes
    if (neighbourhood) {
      if (!this.index.byNeighbourhood[neighbourhood]) {
        this.index.byNeighbourhood[neighbourhood] = []
      }
      if (!this.index.byNeighbourhood[neighbourhood].includes(id)) {
        this.index.byNeighbourhood[neighbourhood].push(id)
      }
    }

    if (urbanisation) {
      if (!this.index.byUrbanisation[urbanisation]) {
        this.index.byUrbanisation[urbanisation] = []
      }
      if (!this.index.byUrbanisation[urbanisation].includes(id)) {
        this.index.byUrbanisation[urbanisation].push(id)
      }
    }

    if (zone) {
      if (!this.index.byZone[zone]) {
        this.index.byZone[zone] = []
      }
      if (!this.index.byZone[zone].includes(id)) {
        this.index.byZone[zone].push(id)
      }
    }

    // Enhanced property indexes
    if (condition) {
      if (!this.index.byCondition[condition]) {
        this.index.byCondition[condition] = []
      }
      if (!this.index.byCondition[condition].includes(id)) {
        this.index.byCondition[condition].push(id)
      }
    }

    if (architectural_style) {
      if (!this.index.byArchitecturalStyle[architectural_style]) {
        this.index.byArchitecturalStyle[architectural_style] = []
      }
      if (!this.index.byArchitecturalStyle[architectural_style].includes(id)) {
        this.index.byArchitecturalStyle[architectural_style].push(id)
      }
    }

    if (size_category) {
      if (!this.index.bySizeCategory[size_category]) {
        this.index.bySizeCategory[size_category] = []
      }
      if (!this.index.bySizeCategory[size_category].includes(id)) {
        this.index.bySizeCategory[size_category].push(id)
      }
    }

    if (age_category) {
      if (!this.index.byAgeCategory[age_category]) {
        this.index.byAgeCategory[age_category] = []
      }
      if (!this.index.byAgeCategory[age_category].includes(id)) {
        this.index.byAgeCategory[age_category].push(id)
      }
    }

    if (view_type) {
      if (!this.index.byViewType[view_type]) {
        this.index.byViewType[view_type] = []
      }
      if (!this.index.byViewType[view_type].includes(id)) {
        this.index.byViewType[view_type].push(id)
      }
    }

    if (development_name) {
      if (!this.index.byDevelopmentName[development_name]) {
        this.index.byDevelopmentName[development_name] = []
      }
      if (!this.index.byDevelopmentName[development_name].includes(id)) {
        this.index.byDevelopmentName[development_name].push(id)
      }
    }

    // Feature indexes
    if (features && features.length > 0) {
      features.forEach(feature => {
        if (!this.index.byFeature[feature]) {
          this.index.byFeature[feature] = []
        }
        if (!this.index.byFeature[feature].includes(id)) {
          this.index.byFeature[feature].push(id)
        }
      })
    }
  }

  private removeFromIndex(propertyId: string, property: DatabaseProperty): void {
    const { 
      city, property_type, location_hash, price, 
      neighbourhood, urbanisation, zone, condition, architectural_style,
      size_category, age_category, view_type, development_name, features
    } = property

    // Remove from city index
    if (this.index.byCity[city]) {
      this.index.byCity[city] = this.index.byCity[city].filter(id => id !== propertyId)
      if (this.index.byCity[city].length === 0) {
        delete this.index.byCity[city]
      }
    }

    // Remove from type index
    if (this.index.byType[property_type]) {
      this.index.byType[property_type] = this.index.byType[property_type].filter(id => id !== propertyId)
      if (this.index.byType[property_type].length === 0) {
        delete this.index.byType[property_type]
      }
    }

    // Remove from location index
    if (this.index.byLocation[location_hash]) {
      this.index.byLocation[location_hash] = this.index.byLocation[location_hash].filter(id => id !== propertyId)
      if (this.index.byLocation[location_hash].length === 0) {
        delete this.index.byLocation[location_hash]
      }
    }

    // Remove from price range index
    const priceRange = `${Math.floor(price / 100000) * 100000}-${Math.floor(price / 100000) * 100000 + 99999}`
    if (this.index.byPriceRange[priceRange]) {
      this.index.byPriceRange[priceRange] = this.index.byPriceRange[priceRange].filter(id => id !== propertyId)
      if (this.index.byPriceRange[priceRange].length === 0) {
        delete this.index.byPriceRange[priceRange]
      }
    }

    // Remove from enhanced location indexes
    if (neighbourhood && this.index.byNeighbourhood[neighbourhood]) {
      this.index.byNeighbourhood[neighbourhood] = this.index.byNeighbourhood[neighbourhood].filter(id => id !== propertyId)
      if (this.index.byNeighbourhood[neighbourhood].length === 0) {
        delete this.index.byNeighbourhood[neighbourhood]
      }
    }

    if (urbanisation && this.index.byUrbanisation[urbanisation]) {
      this.index.byUrbanisation[urbanisation] = this.index.byUrbanisation[urbanisation].filter(id => id !== propertyId)
      if (this.index.byUrbanisation[urbanisation].length === 0) {
        delete this.index.byUrbanisation[urbanisation]
      }
    }

    if (zone && this.index.byZone[zone]) {
      this.index.byZone[zone] = this.index.byZone[zone].filter(id => id !== propertyId)
      if (this.index.byZone[zone].length === 0) {
        delete this.index.byZone[zone]
      }
    }

    // Remove from enhanced property indexes
    if (condition && this.index.byCondition[condition]) {
      this.index.byCondition[condition] = this.index.byCondition[condition].filter(id => id !== propertyId)
      if (this.index.byCondition[condition].length === 0) {
        delete this.index.byCondition[condition]
      }
    }

    if (architectural_style && this.index.byArchitecturalStyle[architectural_style]) {
      this.index.byArchitecturalStyle[architectural_style] = this.index.byArchitecturalStyle[architectural_style].filter(id => id !== propertyId)
      if (this.index.byArchitecturalStyle[architectural_style].length === 0) {
        delete this.index.byArchitecturalStyle[architectural_style]
      }
    }

    if (size_category && this.index.bySizeCategory[size_category]) {
      this.index.bySizeCategory[size_category] = this.index.bySizeCategory[size_category].filter(id => id !== propertyId)
      if (this.index.bySizeCategory[size_category].length === 0) {
        delete this.index.bySizeCategory[size_category]
      }
    }

    if (age_category && this.index.byAgeCategory[age_category]) {
      this.index.byAgeCategory[age_category] = this.index.byAgeCategory[age_category].filter(id => id !== propertyId)
      if (this.index.byAgeCategory[age_category].length === 0) {
        delete this.index.byAgeCategory[age_category]
      }
    }

    if (view_type && this.index.byViewType[view_type]) {
      this.index.byViewType[view_type] = this.index.byViewType[view_type].filter(id => id !== propertyId)
      if (this.index.byViewType[view_type].length === 0) {
        delete this.index.byViewType[view_type]
      }
    }

    if (development_name && this.index.byDevelopmentName[development_name]) {
      this.index.byDevelopmentName[development_name] = this.index.byDevelopmentName[development_name].filter(id => id !== propertyId)
      if (this.index.byDevelopmentName[development_name].length === 0) {
        delete this.index.byDevelopmentName[development_name]
      }
    }

    // Remove from feature indexes
    if (features && features.length > 0) {
      features.forEach(feature => {
        if (this.index.byFeature[feature]) {
          this.index.byFeature[feature] = this.index.byFeature[feature].filter(id => id !== propertyId)
          if (this.index.byFeature[feature].length === 0) {
            delete this.index.byFeature[feature]
          }
        }
      })
    }
  }

  // Enhanced search strategy builder with location priority
  private buildSearchStrategy(criteria: PropertySearchCriteria): Array<{
    name: string
    criteria: PropertySearchCriteria
    priority: number
  }> {
    const strategies = []

    // Strategy 1: Same urbanisation (highest priority - within 1km)
    if (criteria.urbanisation) {
      strategies.push({
        name: 'Same Urbanisation - Exact Match',
        criteria: { 
          ...criteria, 
          maxDistance: 1,
          urbanisation: criteria.urbanisation
        },
        priority: 1
      })
    }

    // Strategy 2: Same neighbourhood (high priority - within 2km)
    if (criteria.neighbourhood) {
      strategies.push({
        name: 'Same Neighbourhood - Exact Match',
        criteria: { 
          ...criteria, 
          maxDistance: 2,
          neighbourhood: criteria.neighbourhood
        },
        priority: 2
      })
    }

    // Strategy 3: Same urbanisation with relaxed criteria (within 2km)
    if (criteria.urbanisation) {
      strategies.push({
        name: 'Same Urbanisation - Relaxed',
        criteria: { 
          ...criteria, 
          maxDistance: 2,
          urbanisation: criteria.urbanisation,
          // Relax bedroom/bathroom constraints for same urbanisation
          bedrooms: undefined,
          bathrooms: undefined
        },
        priority: 3
      })
    }

    // Strategy 4: Same neighbourhood with relaxed criteria (within 3km)
    if (criteria.neighbourhood) {
      strategies.push({
        name: 'Same Neighbourhood - Relaxed',
        criteria: { 
          ...criteria, 
          maxDistance: 3,
          neighbourhood: criteria.neighbourhood,
          // Relax bedroom/bathroom constraints for same neighbourhood
          bedrooms: undefined,
          bathrooms: undefined
        },
        priority: 4
      })
    }

    // Strategy 5: Same city within 5km radius
    strategies.push({
      name: 'Same City - 5km Radius',
      criteria: { 
        ...criteria, 
        maxDistance: 5,
        // Remove location-specific filters for broader search
        urbanisation: undefined,
        neighbourhood: undefined
      },
      priority: 5
    })

    // Strategy 6: Same city with very relaxed criteria (within 5km)
    strategies.push({
      name: 'Same City - Very Relaxed',
      criteria: { 
        ...criteria, 
        maxDistance: 5,
        // Very relaxed criteria as fallback
        urbanisation: undefined,
        neighbourhood: undefined,
        bedrooms: undefined,
        bathrooms: undefined,
        minAreaM2: undefined,
        maxAreaM2: undefined
      },
      priority: 6
    })

    return strategies.sort((a, b) => a.priority - b.priority)
  }

  // Execute a specific search strategy
  private executeSearchStrategy(strategy: {
    name: string
    criteria: PropertySearchCriteria
    priority: number
  }): string[] {
    const { criteria } = strategy
    let candidateIds: string[] = []

    // Start with city and type intersection
    // Handle city name variations (with/without accents, case sensitivity)
    const normalizeCity = (city: string) => {
      return city.toLowerCase().replace(/[áéíóúñ]/g, (match) => {
        const map: { [key: string]: string } = {
          'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n'
        };
        return map[match] || match;
      });
    };
    
    const searchCity = normalizeCity(criteria.city);
    let cityIds: string[] = [];
    
    // Try exact match first
    if (this.index.byCity[criteria.city]) {
      cityIds = this.index.byCity[criteria.city];
    } else {
      // Try normalized match
      for (const [city, ids] of Object.entries(this.index.byCity)) {
        if (normalizeCity(city) === searchCity) {
          cityIds = ids;
          break;
        }
      }
    }
    
    console.log(`🔍 City search: "${criteria.city}" -> "${searchCity}" -> found ${cityIds.length} properties`);
    
    // Case-insensitive property type matching - FIXED: Use propertyType field
    const propertyTypeLower = criteria.propertyType?.toLowerCase() || '';
    let typeIds: string[] = []
    
    // Try exact match first, then case-insensitive match
    if (criteria.propertyType && this.index.byType[criteria.propertyType]) {
      typeIds = this.index.byType[criteria.propertyType]
    } else if (criteria.propertyType) {
      // Find case-insensitive match
      for (const [type, ids] of Object.entries(this.index.byType)) {
        if (type.toLowerCase() === propertyTypeLower) {
          typeIds = ids
          break
        }
      }
    }
    
    console.log(`🔍 Property type search: "${criteria.propertyType}" -> found ${typeIds.length} properties`);
    
    // If we have both city and type filters, intersect them
    if (cityIds.length > 0 && typeIds.length > 0) {
      candidateIds = cityIds.filter(id => typeIds.includes(id))
    } else if (cityIds.length > 0) {
      candidateIds = cityIds
    } else if (typeIds.length > 0) {
      candidateIds = typeIds
    }
    
    console.log(`🔍 After city/type intersection: ${candidateIds.length} candidates`)

    // Apply enhanced location filters
    if (criteria.urbanisation) {
      const urbanisationIds = this.index.byUrbanisation[criteria.urbanisation] || []
      candidateIds = candidateIds.filter(id => urbanisationIds.includes(id))
    }

    if (criteria.neighbourhood) {
      const neighbourhoodIds = this.index.byNeighbourhood[criteria.neighbourhood] || []
      candidateIds = candidateIds.filter(id => neighbourhoodIds.includes(id))
    }

    if (criteria.zone) {
      const zoneIds = this.index.byZone[criteria.zone] || []
      candidateIds = candidateIds.filter(id => zoneIds.includes(id))
    }

    return candidateIds
  }

  // Insert or update property with price history tracking
  public async upsertProperty(property: PropertyData, feedSource: string): Promise<void> {
    if (!this.isLoaded) {
      this.loadDatabase()
    }

    const dbProperty = this.convertToDbProperty(property, feedSource)
    const existingProperty = this.properties.get(dbProperty.id)

    if (existingProperty) {
      // Remove from index before updating
      this.removeFromIndex(dbProperty.id, existingProperty)
      
      // Preserve existing price history
      dbProperty.price_history = existingProperty.price_history
      
      // Add new price history entry if price changed
      const currentPrice = property.price || 0
      const previousPrice = existingProperty.price
      
      if (currentPrice !== previousPrice && currentPrice > 0) {
        dbProperty.price_history = PriceHistoryManager.addPriceEntry(
          dbProperty.price_history,
          currentPrice,
          new Date().toISOString(),
          feedSource
        )
      }
    } else {
      // New property - initialize with current price if available
      dbProperty.price_history = PriceHistoryManager.createEmptyHistory()
      if (property.price && property.price > 0) {
        dbProperty.price_history = PriceHistoryManager.addPriceEntry(
          dbProperty.price_history,
          property.price,
          dbProperty.date_listed,
          feedSource
        )
      }
    }

    // Add/update property
    this.properties.set(dbProperty.id, dbProperty)
    this.addToIndex(dbProperty)

    // Save periodically (every 10 properties to avoid constant I/O)
    if (this.properties.size % 10 === 0) {
      this.saveDatabase()
    }
  }

  // Find comparable properties with advanced filtering
  public findComparableProperties(criteria: PropertySearchCriteria): { comparables: Comparable[], totalFound: number } {
    if (!this.isLoaded) {
      this.loadDatabase()
    }

    console.log(`🔍 Database search started with criteria:`, {
      propertyType: criteria.propertyType,
      city: criteria.city,
      province: criteria.province,
      bedrooms: criteria.bedrooms,
      bathrooms: criteria.bathrooms,
      minAreaM2: criteria.minAreaM2,
      maxAreaM2: criteria.maxAreaM2,
      maxDistance: criteria.maxDistance,
      isSale: criteria.isSale
    })

    let allCandidateIds: string[] = []
    const candidateIdsByStrategy: { [strategyName: string]: string[] } = {}

    // Enhanced search strategy: Collect candidates from all strategies
    const searchStrategy = this.buildSearchStrategy(criteria)
    console.log(`🔍 Search strategy has ${searchStrategy.length} steps`)
    
    for (const strategy of searchStrategy) {
      console.log(`🔍 Executing strategy: ${strategy.name}`)
      const strategyCandidates = this.executeSearchStrategy(strategy)
      candidateIdsByStrategy[strategy.name] = strategyCandidates
      console.log(`🔍 Strategy ${strategy.name} found ${strategyCandidates.length} candidates`)
      
      // Add to all candidates (avoiding duplicates)
      for (const id of strategyCandidates) {
        if (!allCandidateIds.includes(id)) {
          allCandidateIds.push(id)
        }
      }
    }

    // Prioritise candidates by location strategy
    let candidateIds: string[] = []
    
    // First, add candidates from location-based strategies (highest priority)
    if (candidateIdsByStrategy['Same Urbanisation - Exact Match']) {
      candidateIds.push(...candidateIdsByStrategy['Same Urbanisation - Exact Match'])
    }
    if (candidateIdsByStrategy['Same Neighbourhood - Exact Match']) {
      candidateIds.push(...candidateIdsByStrategy['Same Neighbourhood - Exact Match'])
    }
    if (candidateIdsByStrategy['Same Urbanisation - Relaxed']) {
      candidateIds.push(...candidateIdsByStrategy['Same Urbanisation - Relaxed'])
    }
    if (candidateIdsByStrategy['Same Neighbourhood - Relaxed']) {
      candidateIds.push(...candidateIdsByStrategy['Same Neighbourhood - Relaxed'])
    }
    
    // Then add remaining candidates from broader strategies
    if (candidateIdsByStrategy['Same City - 5km Radius']) {
      candidateIds.push(...candidateIdsByStrategy['Same City - 5km Radius'])
    }
    if (candidateIdsByStrategy['Same City - Very Relaxed']) {
      candidateIds.push(...candidateIdsByStrategy['Same City - Very Relaxed'])
    }
    
    // Remove duplicates while preserving order
    candidateIds = Array.from(new Set(candidateIds))
    
    console.log(`🔍 Total unique candidates found: ${candidateIds.length}`)
    console.log(`🔍 Location-based candidates: ${candidateIds.filter(id => {
      const property = this.properties.get(id)
      return property && (
        (criteria.urbanisation && property.urbanisation === criteria.urbanisation) ||
        (criteria.neighbourhood && property.neighbourhood === criteria.neighbourhood)
      )
    }).length}`)

    if (candidateIds.length === 0) {
      console.log(`❌ No candidate IDs found in search strategy`)
      return { comparables: [], totalFound: 0 }
    }

    console.log(`🔍 Starting to filter ${candidateIds.length} candidate properties`)

    // Filter candidates by criteria
    const candidates: (DatabaseProperty & { distance: number; score: number })[] = []
    let filteredByProvince = 0
    let filteredByTransactionType = 0
    let filteredByBedrooms = 0
    let filteredByBathrooms = 0
    let filteredByPrice = 0
    let filteredByArea = 0
    let filteredByDistance = 0
    let filteredByCondition = 0
    let filteredByFeatures = 0
    let filteredByArchitecturalStyle = 0
    let filteredBySizeCategory = 0
    let filteredByAgeCategory = 0
    let filteredByViewType = 0
    let filteredByDevelopmentName = 0
    let filteredByYearBuilt = 0
    let filteredByListingDate = 0
    let filteredByExcludeId = 0

    for (const id of candidateIds) {
      const property = this.properties.get(id)
      if (!property) continue

      // Exclude current property from comparable search (prevents self-comparison)
      if (criteria.excludeId && property.id === criteria.excludeId) {
        filteredByExcludeId++
        continue
      }

      // Apply filters with province code mapping
      if (criteria.province) {
        const propertyProvince = property.province
        const criteriaProvince = criteria.province
        
        // Map province codes to full names
        const provinceMap: { [key: string]: string } = {
          'MA': 'Málaga',
          'CA': 'Cádiz',
          'GR': 'Granada',
          'A': 'Alicante',
          'T': 'Tarragona',
          'PM': 'Palma',
          'GI': 'Girona',
          'CO': 'Córdoba',
          'AL': 'Almería',
          'M': 'Madrid',
          'SE': 'Sevilla',
          'B': 'Barcelona',
          'J': 'Jaén',
          'CS': 'Castellón'
        }
        
        const mappedPropertyProvince = provinceMap[propertyProvince] || propertyProvince
        const mappedCriteriaProvince = provinceMap[criteriaProvince] || criteriaProvince
        
        if (mappedPropertyProvince !== mappedCriteriaProvince) {
          filteredByProvince++
          continue
        }
      }

      // Transaction type filter (sale vs rental)
      if (criteria.isSale !== undefined && property.is_sale !== criteria.isSale) {
        filteredByTransactionType++
        continue
      }

      // Flexible bedroom/bathroom matching (±1, more lenient for same urbanisation)
      if (criteria.bedrooms) {
        const isSameUrbanisation = criteria.urbanisation && property.urbanisation === criteria.urbanisation
        const bedroomRange = isSameUrbanisation 
          ? [Math.max(1, criteria.bedrooms - 2), criteria.bedrooms + 2] // ±2 for same urbanisation
          : [Math.max(1, criteria.bedrooms - 1), criteria.bedrooms + 1] // ±1 for others
        
        if (property.bedrooms < bedroomRange[0] || property.bedrooms > bedroomRange[1]) {
          filteredByBedrooms++
          continue
        }
      }

      if (criteria.bathrooms) {
        const isSameUrbanisation = criteria.urbanisation && property.urbanisation === criteria.urbanisation
        const bathroomRange = isSameUrbanisation
          ? [Math.max(1, criteria.bathrooms - 1), criteria.bathrooms + 1] // ±1 for same urbanisation
          : [Math.max(1, criteria.bathrooms - 0.5), criteria.bathrooms + 0.5] // ±0.5 for others
        
        if (property.bathrooms < bathroomRange[0] || property.bathrooms > bathroomRange[1]) {
          filteredByBathrooms++
          continue
        }
      }

      // Price range
      if (criteria.minPrice && property.price < criteria.minPrice) {
        filteredByPrice++
        continue
      }
      if (criteria.maxPrice && property.price > criteria.maxPrice) {
        filteredByPrice++
        continue
      }

      // Dynamic area filtering with intelligent tolerance based on property type and size
      const getDynamicAreaTolerance = (propertyType: string, buildArea: number, isSameUrbanisation: boolean): number => {
        // For villas with very small build areas (< 100m²), use very relaxed tolerance
        if (propertyType?.toLowerCase() === 'villa' && buildArea < 100) {
          return 1.0 // 100% tolerance for small villas
        }
        // For villas with small build areas (100-150m²), use relaxed tolerance
        if (propertyType?.toLowerCase() === 'villa' && buildArea < 150) {
          return 0.75 // 75% tolerance for medium villas
        }
        // For same urbanisation, use more lenient tolerance
        if (isSameUrbanisation) {
          return 0.5 // 50% tolerance for same urbanisation
        }
        // For apartments and other properties, use standard tolerance
        return 0.3 // 30% tolerance for standard properties
      }
      
      const isSameUrbanisation = criteria.urbanisation && property.urbanisation === criteria.urbanisation
              const areaTolerance = getDynamicAreaTolerance(property.propertyType, property.buildArea || 0, isSameUrbanisation)
      
      // Get the appropriate area for comparison (use buildArea, plotArea, or terraceAreaM2) - FIXED: Use camelCase fields
      const getPropertyArea = (prop: DatabaseProperty): number => {
        // For villas, use buildArea as primary but consider plotArea for analysis
        if (prop.propertyType?.toLowerCase() === 'villa') {
          // For villas, prefer buildArea but fallback to plotArea if buildArea is very small
          if (prop.buildArea && prop.buildArea > 0) {
            // If build area is very small relative to plot area, consider using plot area
            if (prop.plotArea && prop.plotArea > 0 && prop.buildArea < prop.plotArea * 0.3) {
              return prop.plotArea // Use plot area for very small builds on large plots
            }
            return prop.buildArea
          }
          // For villas without build area, use plot area
          if (prop.plotArea && prop.plotArea > 0) {
            return prop.plotArea
          }
        } else {
          // For non-villas, prefer buildArea first
          if (prop.buildArea && prop.buildArea > 0) {
            return prop.buildArea
          }
          // Fallback to plotArea if buildArea not available
          if (prop.plotArea && prop.plotArea > 0) {
            return prop.plotArea
          }
        }
        // Last fallback to terrace area
        return prop.terraceAreaM2 || 0
      }
      
      const propertyArea = getPropertyArea(property)
      
      if (criteria.minAreaM2) {
        const minArea = criteria.minAreaM2 * areaTolerance
        if (propertyArea < minArea) {
          filteredByArea++
          continue
        }
      }
      if (criteria.maxAreaM2) {
        const maxArea = criteria.maxAreaM2 * (2 - areaTolerance) // Inverse for max area
        if (propertyArea > maxArea) {
          filteredByArea++
          continue
        }
      }

      // Calculate distance if coordinates provided
      let distance = 0
      if (criteria.lat && criteria.lng && property.lat && property.lng) {
        distance = this.calculateDistance(criteria.lat, criteria.lng, property.lat, property.lng)
        if (criteria.maxDistance && distance > criteria.maxDistance) {
          filteredByDistance++
          continue
        }
      }

      // Condition filter
      if (criteria.condition && criteria.condition.length > 0) {
        if (!property.condition || !criteria.condition.includes(property.condition)) {
          filteredByCondition++
          continue
        }
      }

      // Year built filter
      if (criteria.minYearBuilt && property.year_built && property.year_built < criteria.minYearBuilt) {
        filteredByYearBuilt++
        continue
      }
      if (criteria.maxYearBuilt && property.year_built && property.year_built > criteria.maxYearBuilt) {
        filteredByYearBuilt++
        continue
      }

      // Listing date filter
      if (criteria.minListingDate && property.date_listed < criteria.minListingDate) {
        filteredByListingDate++
        continue
      }
      if (criteria.maxListingDate && property.date_listed > criteria.maxListingDate) {
        filteredByListingDate++
        continue
      }

      // Feature matching
      if (criteria.features && criteria.features.length > 0) {
        const hasAnyFeature = criteria.features.some(feature => 
          property.features.some(pf => pf.toLowerCase().includes(feature.toLowerCase()))
        )
        if (!hasAnyFeature) {
          filteredByFeatures++
          continue
        }
      }

      // Enhanced property filters
      if (criteria.architecturalStyle && criteria.architecturalStyle.length > 0) {
        if (!property.architectural_style || !criteria.architecturalStyle.includes(property.architectural_style)) {
          filteredByArchitecturalStyle++
          continue
        }
      }

      if (criteria.sizeCategory && criteria.sizeCategory.length > 0) {
        if (!property.size_category || !criteria.sizeCategory.includes(property.size_category)) {
          filteredBySizeCategory++
          continue
        }
      }

      if (criteria.ageCategory && criteria.ageCategory.length > 0) {
        if (!property.age_category || !criteria.ageCategory.includes(property.age_category)) {
          filteredByAgeCategory++
          continue
        }
      }

      if (criteria.viewType && criteria.viewType.length > 0) {
        if (!property.view_type || !criteria.viewType.includes(property.view_type)) {
          filteredByViewType++
          continue
        }
      }

      if (criteria.developmentName && property.development_name) {
        if (property.development_name !== criteria.developmentName) {
          filteredByDevelopmentName++
          continue
        }
      }

      // Calculate relevance score with location priority
      const score = this.calculateRelevanceScoreWithLocationPriority(property, criteria)

      candidates.push({ ...property, distance, score })
    }

    console.log(`🔍 Filtering results:`)
    console.log(`  - Total candidates processed: ${candidateIds.length}`)
    console.log(`  - Filtered by exclude ID (self): ${filteredByExcludeId}`)
    console.log(`  - Filtered by province: ${filteredByProvince}`)
    console.log(`  - Filtered by transaction type: ${filteredByTransactionType}`)
    console.log(`  - Filtered by bedrooms: ${filteredByBedrooms}`)
    console.log(`  - Filtered by bathrooms: ${filteredByBathrooms}`)
    console.log(`  - Filtered by price: ${filteredByPrice}`)
    console.log(`  - Filtered by area: ${filteredByArea}`)
    console.log(`  - Filtered by distance: ${filteredByDistance}`)
    console.log(`  - Filtered by condition: ${filteredByCondition}`)
    console.log(`  - Filtered by year built: ${filteredByYearBuilt}`)
    console.log(`  - Filtered by listing date: ${filteredByListingDate}`)
    console.log(`  - Filtered by features: ${filteredByFeatures}`)
    console.log(`  - Final candidates after filtering: ${candidates.length}`)



    // Sort by score (higher is better), then by distance
    candidates.sort((a, b) => {
      if (Math.abs(a.score - b.score) > 0.1) {
        return b.score - a.score // Higher score first
      }
      return a.distance - b.distance // Closer distance for similar scores
    })

    // Ensure location-based properties are always prioritised in top 12
    const maxResults = criteria.maxResults || 12
    const finalCandidates = this.ensureLocationPriority(candidates, criteria, maxResults)

    // Convert to Comparable format
    const comparables = finalCandidates.map(candidate => this.convertToComparable(candidate))
    return { comparables, totalFound: candidates.length }
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371 // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1)
    const dLng = this.toRadians(lng2 - lng1)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  // Ensure location-based properties are always prioritised in top results
  private ensureLocationPriority(
    candidates: (DatabaseProperty & { distance: number; score: number })[], 
    criteria: PropertySearchCriteria, 
    maxResults: number
  ): (DatabaseProperty & { distance: number; score: number })[] {
    if (!criteria.urbanisation && !criteria.neighbourhood) {
      return candidates.slice(0, maxResults)
    }

    // Separate location-based and other properties
    const locationBased = candidates.filter(c => 
      (criteria.urbanisation && c.urbanisation === criteria.urbanisation) ||
      (criteria.neighbourhood && c.neighbourhood === criteria.neighbourhood)
    )
    const otherProperties = candidates.filter(c => 
      !(criteria.urbanisation && c.urbanisation === criteria.urbanisation) &&
      !(criteria.neighbourhood && c.neighbourhood === criteria.neighbourhood)
    )

    console.log(`🏆 Location priority: ${locationBased.length} location-based, ${otherProperties.length} other properties`)

    // If we have enough location-based properties, prioritise them
    if (locationBased.length >= maxResults) {
      // Take all location-based properties up to maxResults
      const selectedLocation = locationBased.slice(0, maxResults)
      console.log(`🏆 Selected ${selectedLocation.length} location-based properties (all slots filled)`)
      return selectedLocation
    }

    // If we have some location-based properties but not enough, fill remaining slots with others
    if (locationBased.length > 0) {
      const remainingSlots = maxResults - locationBased.length
      const selectedOthers = otherProperties.slice(0, remainingSlots)
      const finalSelection = [...locationBased, ...selectedOthers]
      console.log(`🏆 Selected ${locationBased.length} location-based + ${selectedOthers.length} other properties`)
      return finalSelection
    }

    // If no location-based properties, use normal selection
    console.log(`🏆 No location-based properties found, using normal selection`)
    return candidates.slice(0, maxResults)
  }

  // Ensure diversity within same urbanisation by prioritizing different property types/sizes
  private ensureUrbanisationDiversity(
    candidates: (DatabaseProperty & { distance: number; score: number })[], 
    criteria: PropertySearchCriteria, 
    maxResults: number
  ): (DatabaseProperty & { distance: number; score: number })[] {
    if (!criteria.urbanisation) {
      return candidates.slice(0, maxResults)
    }

    const sameUrbanisation = candidates.filter(c => c.urbanisation === criteria.urbanisation)
    const otherProperties = candidates.filter(c => c.urbanisation !== criteria.urbanisation)

    // If we have enough same urbanisation properties, prioritize diversity within them
    if (sameUrbanisation.length >= Math.min(8, maxResults)) {
      const diverseUrbanisation = this.selectDiverseProperties(sameUrbanisation, Math.min(8, maxResults))
      const remainingSlots = maxResults - diverseUrbanisation.length
      const otherSelected = otherProperties.slice(0, remainingSlots)
      

      
      return [...diverseUrbanisation, ...otherSelected]
    }

    // If we don't have many same urbanisation properties, use normal selection
    return candidates.slice(0, maxResults)
  }

  // Select diverse properties from the same urbanisation
  private selectDiverseProperties(
    properties: (DatabaseProperty & { distance: number; score: number })[], 
    maxCount: number
  ): (DatabaseProperty & { distance: number; score: number })[] {
    if (properties.length <= maxCount) {
      return properties
    }

    const selected: (DatabaseProperty & { distance: number; score: number })[] = []
    const usedTypes = new Set<string>()
    const usedSizes = new Set<string>()
    const usedPriceRanges = new Set<string>()

    // First pass: select one of each property type
    for (const property of properties) {
      if (selected.length >= maxCount) break
      
      if (!usedTypes.has(property.property_type)) {
        selected.push(property)
        usedTypes.add(property.property_type)
      }
    }

    // Second pass: select different size categories
    for (const property of properties) {
      if (selected.length >= maxCount) break
      
      if (!selected.find(p => p.id === property.id) && 
          property.size_category && 
          !usedSizes.has(property.size_category)) {
        selected.push(property)
        usedSizes.add(property.size_category)
      }
    }

    // Third pass: select different price ranges
    for (const property of properties) {
      if (selected.length >= maxCount) break
      
      if (!selected.find(p => p.id === property.id)) {
        const priceRange = this.getPriceRange(property.price)
        if (!usedPriceRanges.has(priceRange)) {
          selected.push(property)
          usedPriceRanges.add(priceRange)
        }
      }
    }

    // Fill remaining slots with highest scoring properties
    const remaining = properties.filter(p => !selected.find(sp => sp.id === p.id))
    const additional = remaining.slice(0, maxCount - selected.length)
    
    return [...selected, ...additional]
  }

  // Get price range category for diversity selection
  private getPriceRange(price: number): string {
    if (price < 200000) return 'low'
    if (price < 500000) return 'medium'
    if (price < 1000000) return 'high'
    return 'luxury'
  }

  private calculateRelevanceScoreWithLocationPriority(property: DatabaseProperty, criteria: PropertySearchCriteria): number {
    let score = 1.0

    // LOCATION PRIORITY (highest weight)
    // Same urbanisation (highest priority)
    if (criteria.urbanisation && property.urbanisation && 
        property.urbanisation.toLowerCase() === criteria.urbanisation.toLowerCase()) {
      score += 5.0
      console.log(`🏆 Location boost: Same urbanisation (${property.urbanisation})`)
    }
    
    // Same neighbourhood
    if (criteria.neighbourhood && property.neighbourhood && 
        property.neighbourhood.toLowerCase() === criteria.neighbourhood.toLowerCase()) {
      score += 3.0
      console.log(`🏆 Location boost: Same neighbourhood (${property.neighbourhood})`)
    }

    // Property type matching - FIXED: Use propertyType field instead of property_type
    if (criteria.propertyType && property.propertyType?.toLowerCase() === criteria.propertyType.toLowerCase()) {
      score += 2.0
    }

    // Bedroom matching
    if (criteria.bedrooms && property.bedrooms === criteria.bedrooms) {
      score += 1.5
    } else if (criteria.bedrooms && Math.abs(property.bedrooms - criteria.bedrooms) === 1) {
      score += 0.5
    }

    // Bathroom matching
    if (criteria.bathrooms && property.bathrooms === criteria.bathrooms) {
      score += 1.0
    } else if (criteria.bathrooms && Math.abs(property.bathrooms - criteria.bathrooms) <= 0.5) {
      score += 0.3
    }

    // Price similarity
    if (criteria.minPrice && criteria.maxPrice && property.price) {
      const midPrice = (criteria.minPrice + criteria.maxPrice) / 2
      const priceDiff = Math.abs(property.price - midPrice) / midPrice
      if (priceDiff <= 0.1) score += 1.0
      else if (priceDiff <= 0.2) score += 0.5
      else if (priceDiff <= 0.3) score += 0.2
    }

    // Area similarity - FIXED: Use camelCase fields
    const propertyArea = property.buildArea || property.plotArea || property.terraceAreaM2 || 0
    if (criteria.minAreaM2 && criteria.maxAreaM2 && propertyArea > 0) {
      const midArea = (criteria.minAreaM2 + criteria.maxAreaM2) / 2
      const areaDiff = Math.abs(propertyArea - midArea) / midArea
      if (areaDiff <= 0.1) score += 1.0
      else if (areaDiff <= 0.2) score += 0.5
      else if (areaDiff <= 0.3) score += 0.2
    }

    // Distance bonus (closer is better)
    if (property.lat && property.lng && criteria.lat && criteria.lng) {
      const distance = this.calculateDistance(criteria.lat, criteria.lng, property.lat, property.lng)
      if (distance <= 1) score += 2.0
      else if (distance <= 2) score += 1.5
      else if (distance <= 3) score += 1.0
      else if (distance <= 5) score += 0.5
    }

    return score
  }

  private calculateRelevanceScore(property: DatabaseProperty, criteria: PropertySearchCriteria): number {
    let score = 1.0

    // Bedroom match bonus (exact match gets highest score)
    if (criteria.bedrooms) {
      if (property.bedrooms === criteria.bedrooms) score += 0.4
      else if (Math.abs(property.bedrooms - criteria.bedrooms) === 1) score += 0.2
      else if (Math.abs(property.bedrooms - criteria.bedrooms) === 2) score += 0.1
    }

    // Bathroom match bonus (exact match gets highest score)
    if (criteria.bathrooms) {
      if (property.bathrooms === criteria.bathrooms) score += 0.3
      else if (Math.abs(property.bathrooms - criteria.bathrooms) <= 0.5) score += 0.15
      else if (Math.abs(property.bathrooms - criteria.bathrooms) <= 1) score += 0.05
    }

    // Area similarity bonus (closer size gets higher score)
    if (criteria.minAreaM2 && criteria.maxAreaM2) {
      const targetArea = (criteria.minAreaM2 + criteria.maxAreaM2) / 2
      const areaDiff = Math.abs(property.total_area_m2 - targetArea) / targetArea
      if (areaDiff <= 0.1) score += 0.3 // Within 10% gets highest score
      else if (areaDiff <= 0.2) score += 0.2 // Within 20% gets good score
      else if (areaDiff <= 0.3) score += 0.1 // Within 30% gets some score
    }

    // Feature match bonus (more features matched = higher score)
    if (criteria.features && criteria.features.length > 0) {
      const matchedFeatures = criteria.features.filter(feature =>
        property.features.some(pf => pf.toLowerCase().includes(feature.toLowerCase()))
      )
      const featureMatchRatio = matchedFeatures.length / criteria.features.length
      if (featureMatchRatio >= 0.8) score += 0.4 // 80%+ features matched
      else if (featureMatchRatio >= 0.6) score += 0.3 // 60%+ features matched
      else if (featureMatchRatio >= 0.4) score += 0.2 // 40%+ features matched
      else if (featureMatchRatio >= 0.2) score += 0.1 // 20%+ features matched
    }

    // Condition bonus (exact condition match)
    if (criteria.condition && property.condition && criteria.condition.includes(property.condition)) {
      score += 0.2
    }

    // Distance bonus (closer properties get higher scores)
    if (criteria.lat && criteria.lng && property.lat && property.lng) {
      const distance = this.calculateDistance(criteria.lat, criteria.lng, property.lat, property.lng)
      if (distance <= 1) score += 0.3 // Within 1km
      else if (distance <= 2) score += 0.2 // Within 2km
      else if (distance <= 3) score += 0.1 // Within 3km
    }

    // Price per m² similarity bonus
    if (criteria.minAreaM2 && criteria.maxAreaM2) {
      const targetArea = (criteria.minAreaM2 + criteria.maxAreaM2) / 2
      const targetPricePerM2 = (criteria.minPrice || 0) / targetArea
      const propertyPricePerM2 = property.price / property.total_area_m2
      
      if (targetPricePerM2 > 0) {
        const pricePerM2Diff = Math.abs(propertyPricePerM2 - targetPricePerM2) / targetPricePerM2
        if (pricePerM2Diff <= 0.1) score += 0.2 // Within 10% price per m²
        else if (pricePerM2Diff <= 0.2) score += 0.1 // Within 20% price per m²
      }
    }

    // Recency bonus (more recent listings get slight preference)
    const daysOnMarket = this.calculateDaysOnMarket(property.date_listed)
    if (daysOnMarket <= 30) score += 0.1 // Listed within 30 days
    else if (daysOnMarket <= 90) score += 0.05 // Listed within 90 days

    // Enhanced location bonuses (prioritizing urbanisation diversity)
    if (criteria.urbanisation && property.urbanisation === criteria.urbanisation) {
      score += 1.0 // Same urbanisation gets highest bonus (doubled from 0.5)
      
      // Additional bonus for showing price diversity within urbanisation
      // This encourages showing different property types/sizes in same urbanisation
      if (property.property_type !== criteria.propertyType) {
        score += 0.3 // Bonus for different property type in same urbanisation
      }
      
      // Bonus for different size categories in same urbanisation
      if (criteria.sizeCategory && property.size_category && 
          !criteria.sizeCategory.includes(property.size_category)) {
        score += 0.2 // Bonus for different size category in same urbanisation
      }
      
      // Bonus for different price ranges in same urbanisation (shows market spectrum)
      if (criteria.minPrice && criteria.maxPrice) {
        const targetPrice = (criteria.minPrice + criteria.maxPrice) / 2
        const priceDiff = Math.abs(property.price - targetPrice) / targetPrice
        if (priceDiff > 0.3) { // If price is significantly different (>30%)
          score += 0.2 // Bonus for showing price diversity in same urbanisation
        }
      }
    }

    if (criteria.neighbourhood && property.neighbourhood === criteria.neighbourhood) {
      score += 0.4 // Same neighbourhood gets good bonus (increased from 0.3)
    }

    if (criteria.zone && property.zone === criteria.zone) {
      score += 0.25 // Same zone gets bonus (increased from 0.2)
    }

    // Enhanced property bonuses
    if (criteria.architecturalStyle && property.architectural_style && 
        criteria.architecturalStyle.includes(property.architectural_style)) {
      score += 0.2 // Architectural style match
    }

    if (criteria.sizeCategory && property.size_category && 
        criteria.sizeCategory.includes(property.size_category)) {
      score += 0.15 // Size category match
    }

    if (criteria.ageCategory && property.age_category && 
        criteria.ageCategory.includes(property.age_category)) {
      score += 0.15 // Age category match
    }

    if (criteria.viewType && property.view_type && 
        criteria.viewType.includes(property.view_type)) {
      score += 0.1 // View type match
    }

    if (criteria.developmentName && property.development_name === criteria.developmentName) {
      score += 0.3 // Same development gets good bonus
    }

    return score
  }

  // Get property count by feed source
  public getPropertyCount(feedSource?: string): number {
    if (!this.isLoaded) {
      this.loadDatabase()
    }

    if (!feedSource) {
      return this.properties.size
    }

    let count = 0
    for (const property of Array.from(this.properties.values())) {
      if (property.feed_source === feedSource) {
        count++
      }
    }
    return count
  }

  // Clean old properties from a feed source
  public cleanOldProperties(feedSource: string, cutoffDate: string): number {
    if (!this.isLoaded) {
      this.loadDatabase()
    }

    const cutoff = new Date(cutoffDate)
    let removedCount = 0

    for (const [id, property] of Array.from(this.properties.entries())) {
      if (property.feed_source === feedSource && new Date(property.last_updated) < cutoff) {
        this.removeFromIndex(id, property)
        this.properties.delete(id)
        removedCount++
      }
    }

    if (removedCount > 0) {
      this.saveDatabase()
      console.log(`Removed ${removedCount} old properties from ${feedSource}`)
    }

    return removedCount
  }

  // Force save database
  public saveNow(): void {
    this.saveDatabase()
  }

  // Get price history for a specific property
  public getPriceHistory(propertyId: string): PriceHistoryEntry[] {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    
    const property = this.properties.get(propertyId)
    if (!property?.price_history) {
      return []
    }
    
    return PriceHistoryManager.getAllPriceHistory(property.price_history)
  }

  // Get price trend for a property (enhanced with smart history analysis)
  public getPriceTrend(propertyId: string): { 
    trend: number; 
    direction: 'up' | 'down' | 'stable';
    shortTerm: number; // Last 3 months trend
    longTerm: number; // Full history trend
    volatility: number; // Price volatility score
  } | null {
    if (!this.isLoaded) {
      this.loadDatabase()
    }
    
    const property = this.properties.get(propertyId)
    if (!property?.price_history) {
      return null
    }
    
    const smartHistory = property.price_history
    const allHistory = PriceHistoryManager.getAllPriceHistory(smartHistory)
    
    if (allHistory.length < 2) {
      return null
    }
    
    // Calculate long-term trend (full history)
    const firstPrice = allHistory[0].price
    const lastPrice = allHistory[allHistory.length - 1].price
    const longTermTrend = ((lastPrice - firstPrice) / firstPrice) * 100
    
    // Calculate short-term trend (recent data only)
    const recentHistory = smartHistory.recent
    let shortTermTrend = 0
    if (recentHistory.length >= 2) {
      const recentFirst = recentHistory[0].price
      const recentLast = recentHistory[recentHistory.length - 1].price
      shortTermTrend = ((recentLast - recentFirst) / recentFirst) * 100
    } else {
      shortTermTrend = longTermTrend // Fall back to long-term if no recent data
    }
    
    // Calculate volatility (standard deviation of price changes)
    const prices = allHistory.map(h => h.price)
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length
    const volatility = Math.sqrt(variance) / avgPrice * 100 // As percentage of average price
    
    // Determine overall direction based on combined trends
    let direction: 'up' | 'down' | 'stable' = 'stable'
    const combinedTrend = (shortTermTrend * 0.7) + (longTermTrend * 0.3) // Weight recent trends more heavily
    
    if (Math.abs(combinedTrend) > 1) { // Only consider significant changes (>1%)
      direction = combinedTrend > 0 ? 'up' : 'down'
    }
    
    return { 
      trend: Math.round(combinedTrend * 100) / 100,
      direction,
      shortTerm: Math.round(shortTermTrend * 100) / 100,
      longTerm: Math.round(longTermTrend * 100) / 100,
      volatility: Math.round(volatility * 100) / 100
    }
  }

  // Get database stats
  public getStats(): {
    totalProperties: number
    byFeedSource: Record<string, number>
    byCities: Record<string, number>
    byPropertyType: Record<string, number>
    lastUpdated: string
  } {
    if (!this.isLoaded) {
      this.loadDatabase()
    }

    const stats = {
      totalProperties: this.properties.size,
      byFeedSource: {} as Record<string, number>,
      byCities: {} as Record<string, number>,
      byPropertyType: {} as Record<string, number>,
      lastUpdated: this.index.lastUpdated
    }

    for (const property of Array.from(this.properties.values())) {
      // Count by feed source
      stats.byFeedSource[property.feed_source] = (stats.byFeedSource[property.feed_source] || 0) + 1
      
      // Count by city
      stats.byCities[property.city] = (stats.byCities[property.city] || 0) + 1
      
      // Count by property type
      stats.byPropertyType[property.property_type] = (stats.byPropertyType[property.property_type] || 0) + 1
    }

    return stats
  }

  // Helper methods
  private convertToDbProperty(property: PropertyData, feedSource: string): DatabaseProperty {
    const id = this.generatePropertyId(property, feedSource)
    const locationHash = this.generateLocationHash(property.city, property.province)
    const searchText = this.buildSearchText(property)
    // Calculate price per m² based on the most relevant area
    const getRelevantArea = (prop: PropertyData): number => {
      // For villas, use build area as primary but consider plot area for analysis
      if (prop.propertyType?.toLowerCase() === 'villa') {
        // For villas, prefer build area but fallback to plot area if build area is very small
        if (prop.buildArea && prop.buildArea > 0) {
          // If build area is very small relative to plot area, consider using plot area
          if (prop.plotArea && prop.plotArea > 0 && prop.buildArea < prop.plotArea * 0.3) {
            return prop.plotArea // Use plot area for very small builds on large plots
          }
          return prop.buildArea
        }
        // For villas without build area, use plot area
        if (prop.plotArea && prop.plotArea > 0) {
          return prop.plotArea
        }
      } else {
        // For non-villas, prefer build area first
        if (prop.buildArea && prop.buildArea > 0) {
          return prop.buildArea
        }
        // Fallback to plot area if build area not available
        if (prop.plotArea && prop.plotArea > 0) {
          return prop.plotArea
        }
      }
      // Last fallback to terrace area
      return prop.terraceAreaM2 || 0
    }
    
    const relevantArea = getRelevantArea(property)
    const pricePerM2 = property.price && relevantArea > 0 
      ? property.price / relevantArea 
      : 0

    // Use enhanced transaction type detection
    const transactionType = this.detectDetailedTransactionType(property)

    // Enhanced field population
    const enhancedFields = this.populateEnhancedFields(property)

    return {
      id,
      feed_source: feedSource,
      ref_number: property.refNumber,
      address: property.address,
      city: property.city,
      province: property.province,
      area_code: property.areaCode,
      // Enhanced location fields
      neighbourhood: enhancedFields.neighbourhood,
      urbanisation: enhancedFields.urbanisation,
      zone: enhancedFields.zone,
      property_type: property.propertyType,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      total_area_m2: 0, // Not used - we only use build_area, plot_area, terrace_area_m2
      build_area: property.buildArea,
      plot_area: property.plotArea,
      terrace_area_m2: property.terraceAreaM2,
      condition: property.condition,
      architectural_style: property.architecturalStyle,
      features: property.features || [],
      description: property.description,
      price: property.price || 0,
      year_built: property.yearBuilt,
      date_listed: property.dateListed || new Date().toISOString(),
      last_updated: new Date().toISOString(),
      image: property.image,
      images: property.images || [],
      lat: undefined, // Will be geocoded separately
      lng: undefined,
      // Transaction type with enhanced detection
      is_sale: transactionType.isSale,
      is_short_term: transactionType.isShortTerm,
      is_long_term: transactionType.isLongTerm,
      price_history: PriceHistoryManager.createEmptyHistory(), // Will be populated during upsert
      search_text: searchText,
      price_per_m2: pricePerM2,
      location_hash: locationHash,
      // Enhanced indexing fields
      size_category: enhancedFields.sizeCategory,
      age_category: enhancedFields.ageCategory,
      view_type: enhancedFields.viewType,
      development_name: enhancedFields.developmentName
    }
  }

  // Populate enhanced fields from property data
  private populateEnhancedFields(property: PropertyData): {
    neighbourhood?: string
    urbanisation?: string
    zone?: string
    sizeCategory?: string
    ageCategory?: string
    viewType?: string
    developmentName?: string
  } {
    const result: any = {}

    // Extract location fields from address or description
    const addressText = `${property.address} ${property.description || ''}`.toLowerCase()
    
    // Extract neighbourhood/zone from address patterns
    const neighbourhoodPatterns = [
      /(barrio|zona|district)\s+([a-záéíóúñü]+)/i,
      /([a-záéíóúñü]+)\s+(barrio|zona|district)/i
    ]
    
    for (const pattern of neighbourhoodPatterns) {
      const match = addressText.match(pattern)
      if (match) {
        result.neighbourhood = match[2] || match[1]
        break
      }
    }

    // Extract urbanisation/development from address patterns
    const urbanisationPatterns = [
      /(urbanización|urbanizacion|development|complex)\s+([a-záéíóúñü]+)/i,
      /([a-záéíóúñü]+)\s+(urbanización|urbanizacion|development|complex)/i
    ]
    
    for (const pattern of urbanisationPatterns) {
      const match = addressText.match(pattern)
      if (match) {
        result.urbanisation = match[2] || match[1]
        break
      }
    }

    // Determine size category based on the most relevant area
    const getRelevantArea = (prop: PropertyData): number => {
      // For villas, use build area as primary but consider plot area for analysis
      if (prop.propertyType?.toLowerCase() === 'villa') {
        // For villas, prefer build area but fallback to plot area if build area is very small
        if (prop.buildArea && prop.buildArea > 0) {
          // If build area is very small relative to plot area, consider using plot area
          if (prop.plotArea && prop.plotArea > 0 && prop.buildArea < prop.plotArea * 0.3) {
            return prop.plotArea // Use plot area for very small builds on large plots
          }
          return prop.buildArea
        }
        // For villas without build area, use plot area
        if (prop.plotArea && prop.plotArea > 0) {
          return prop.plotArea
        }
      } else {
        // For non-villas, prefer build area first
        if (prop.buildArea && prop.buildArea > 0) {
          return prop.buildArea
        }
        // Fallback to plot area if build area not available
        if (prop.plotArea && prop.plotArea > 0) {
          return prop.plotArea
        }
      }
      // Last fallback to terrace area
      return prop.terraceAreaM2 || 0
    }
    
    const relevantArea = getRelevantArea(property)
    if (relevantArea > 0) {
      if (relevantArea < 100) result.sizeCategory = 'Small'
      else if (relevantArea < 200) result.sizeCategory = 'Medium'
      else if (relevantArea < 300) result.sizeCategory = 'Large'
      else result.sizeCategory = 'Luxury'
    }

    // Determine age category based on year built
    if (property.yearBuilt) {
      const currentYear = new Date().getFullYear()
      const age = currentYear - property.yearBuilt
      
      if (age <= 1) result.ageCategory = 'New'
      else if (age <= 5) result.ageCategory = '1-5 years'
      else if (age <= 10) result.ageCategory = '5-10 years'
      else result.ageCategory = '10+ years'
    }

    // Extract view type from features or description
    const viewFeatures = ['sea', 'mountain', 'golf', 'city', 'garden', 'pool']
    for (const view of viewFeatures) {
      if (addressText.includes(view) || 
          (property.features && property.features.some(f => f.toLowerCase().includes(view)))) {
        result.viewType = view.charAt(0).toUpperCase() + view.slice(1)
        break
      }
    }

    // Extract development name from address patterns
    const developmentPatterns = [
      /(residencial|residential|residència|residencia)\s+([a-záéíóúñü]+)/i,
      /([a-záéíóúñü]+)\s+(residencial|residential|residència|residencia)/i
    ]
    
    for (const pattern of developmentPatterns) {
      const match = addressText.match(pattern)
      if (match) {
        result.developmentName = match[2] || match[1]
        break
      }
    }

    return result
  }

  private convertToComparable(dbProperty: DatabaseProperty & { distance: number }): Comparable {
    // Get price trend data
    const priceTrend = this.getPriceTrend(dbProperty.id)
    
    // Use original images - URL refresh will be handled by the proxy endpoint
    const images = dbProperty.images || []
    
    // Convert feature codes to human-readable strings
    const mappedFeatures = dbProperty.features.map(featureCode => {
      // Import the feature code mapping from PropertyPortalParser
      const FEATURE_CODE_MAP: Record<string, string> = {
        'alarm-system': 'Alarm System',
        'all-electric-home': 'All Electric Home',
        'air_conditioning': 'Air Conditioning',
        'bank-repossession': 'Bank Repossession',
        'bar': 'Beachside',
        'barbeque-area': 'BBQ Area',
        'basement': 'Basement',
        'beach-front': 'Beachfront',
        'central-heating': 'Central Heating',
        'close-to-beach': 'Close to Beach',
        'close-to-golf': 'Close to Golf',
        'close-to-marina': 'Close to Marina',
        'close-to-restaurants': 'Close to Restaurants',
        'close-to-schools': 'Close to Schools',
        'close-to-shops': 'Close to Shops',
        'close-to-ski-resort': 'Close to Ski Resort',
        'close-to-town-centre': 'Close to Town Centre',
        'cold-hot-ac-units': 'Hot & Cold AC',
        'commercial-district': 'Commercial District',
        'countryside': 'Countryside',
        'covered-terrace': 'Covered Terrace',
        'disabled-access': 'Disabled Access',
        'distressed-property': 'Distressed Property',
        'double-glazing': 'Double Glazing',
        'drinkable-water': 'Drinkable Water',
        'ducted-central-ac': 'Central AC',
        'east': 'East-facing',
        'electric-blinds': 'Electric Blinds',
        'ensuite-bathroom': 'Ensuite Bathroom',
        'entry-phone-system': 'Entry Phone System',
        'excellent-condition': 'Excellent Condition',
        'fair-condition': 'Fair Condition',
        'fibre-internet': 'Fibre Internet',
        'fireplace': 'Fireplace',
        'fitted-wardrobes': 'Fitted Wardrobes',
        'fully-equipped-kitchen': 'Fully Equipped Kitchen',
        'fully-furnished': 'Fully Furnished',
        'games-room': 'Games Room',
        'garage': 'Garage',
        'garden-communal': 'Communal Garden',
        'garden-landscaped': 'Landscaped Garden',
        'garden-private': 'Private Garden',
        'gas': 'Gas',
        'gated-complex': 'Gated Complex',
        'golf-front': 'Golf-front',
        'good-condition': 'Good Condition',
        'guest-apartment': 'Guest Apartment',
        'guest-house': 'Guest House',
        'gym': 'Gym',
        'heated-bathroom-floors': 'Heated Bathroom Floors',
        'historic-property': 'Historic Property',
        'home-automation': 'Home Automation',
        'investment-opportunity': 'Investment Opportunity',
        'jacuzzi': 'Jacuzzi',
        'kitchen-not-equipped': 'Kitchen Not Equipped',
        'lift': 'Lift',
        'luxury-property': 'Luxury Property',
        'marble-flooring': 'Marble Flooring',
        'modern': 'Modern',
        'mountain': 'Mountain Views',
        'near-public-transport': 'Near Public Transport',
        'new-development': 'New Development',
        'newly-built': 'Newly Built',
        'north': 'North-facing',
        'north-east': 'North-east-facing',
        'north-west': 'North-west-facing',
        'off-plan-project': 'Off-plan Project',
        'on-site-restaurant': 'On-site Restaurant',
        'open-plan-kitchen-lounge': 'Open-plan Kitchen/Lounge',
        'paddle-court': 'Paddle Court',
        'parking-communal': 'Communal Parking',
        'parking-covered': 'Covered Parking',
        'parking-multiple': 'Multiple Parking Spaces',
        'parking-private-space': 'Private Parking Space',
        'parking-underground': 'Underground Parking',
        'partially-equipped-kitchen': 'Partially Equipped Kitchen',
        'partially-furnished': 'Partially Furnished',
        'pool-childrens': "Children's Pool",
        'pool-communal': 'Communal Pool',
        'pool-heated': 'Heated Pool',
        'pool-indoor': 'Indoor Pool',
        'pool-private': 'Private Pool',
        'pool-room-for': 'Pool Room',
        'port-marina': 'Port/Marina',
        'pre-installed-ac': 'Pre-installed A/C',
        'private-terrace': 'Private Terrace',
        'private-well': 'Private Water Well',
        'recently-refurbished': 'Recently Refurbished',
        'recently-renovated': 'Recently Renovated',
        'reception-24-hour': '24-hour Reception',
        'requires-renovation': 'Requires Renovation',
        'satellite-tv': 'Satellite TV',
        'sauna': 'Sauna',
        'security-24-hour': '24-hour Security',
        'smart-home': 'Smart Home',
        'solar-power': 'Solar Power',
        'solar-water-heating': 'Solar Water Heating',
        'solarium': 'Solarium',
        'south': 'South-facing',
        'south-east': 'South-east-facing',
        'south-west': 'South-west-facing',
        'stables': 'Stables',
        'staff-accommodation': 'Staff Accommodation',
        'storage-room': 'Storage Room',
        'style-andalucian': 'Andalusian Style',
        'style-rustic': 'Rustic Style',
        'suburban-area': 'Suburban Area',
        'surrounded-by-nature': 'Surrounded by Nature',
        'tennis-court': 'Tennis Court',
        'town-centre': 'Town Centre',
        'underfloor-heating': 'Underfloor Heating',
        'unfurnished': 'Unfurnished',
        'urban-living': 'Urban Living',
        'utility-room': 'Utility Room',
        'views-beach': 'Beach Views',
        'views-city': 'City Views',
        'views-countryside': 'Countryside Views',
        'views-forest': 'Forest Views',
        'views-garden': 'Garden Views',
        'views-golf': 'Golf Views',
        'views-lake': 'Lake Views',
        'views-marina': 'Marina Views',
        'views-mountain': 'Mountain Views',
        'views-panoramic': 'Panoramic Views',
        'views-pool': 'Pool Views',
        'views-sea': 'Sea Views',
        'views-ski-resort': 'Ski Resort Views',
        'village': 'Village',
        'walking-amenities': 'Walking Distance to Amenities',
        'walking-beach': 'Walking Distance to Beach',
        'west': 'West-facing',
        'wifi': 'WiFi',
        'with-planning-permission': 'With Planning Permission',
        'wooden-flooring': 'Wooden Flooring'
      }
      
      return FEATURE_CODE_MAP[featureCode] || featureCode
    })
    
    // Get the appropriate area for display
    const getDisplayArea = (prop: DatabaseProperty): number => {
      // For villas, use build_area as primary but consider plot_area for analysis
      if (prop.property_type?.toLowerCase() === 'villa') {
        // For villas, prefer build_area but fallback to plot_area if build_area is very small
        if (prop.build_area && prop.build_area > 0) {
          // If build area is very small relative to plot area, consider using plot area
          if (prop.plot_area && prop.plot_area > 0 && prop.build_area < prop.plot_area * 0.3) {
            return prop.plot_area // Use plot area for very small builds on large plots
          }
          return prop.build_area
        }
        // For villas without build area, use plot area
        if (prop.plot_area && prop.plot_area > 0) {
          return prop.plot_area
        }
      } else {
        // For non-villas, prefer build_area first
        if (prop.build_area && prop.build_area > 0) {
          return prop.build_area
        }
        // Fallback to plot_area if build_area not available
        if (prop.plot_area && prop.plot_area > 0) {
          return prop.plot_area
        }
      }
      // Last fallback to terrace area
      return prop.terrace_area_m2 || 0
    }
    
    const displayArea = getDisplayArea(dbProperty)
    
    // Determine which area type is being used for display
    const getAreaType = (prop: DatabaseProperty): 'build' | 'plot' | 'terrace' => {
      if (prop.property_type?.toLowerCase() === 'villa') {
        if (prop.build_area && prop.build_area > 0) {
          if (prop.plot_area && prop.plot_area > 0 && prop.build_area < prop.plot_area * 0.3) {
            return 'plot'
          }
          return 'build'
        }
        if (prop.plot_area && prop.plot_area > 0) {
          return 'plot'
        }
      } else {
        if (prop.build_area && prop.build_area > 0) {
          return 'build'
        }
        if (prop.plot_area && prop.plot_area > 0) {
          return 'plot'
        }
      }
      return 'terrace'
    }
    
    const areaType = getAreaType(dbProperty)
    
    // Extract condition from features or use direct condition field
    let condition: Comparable['condition'] | undefined
    if (dbProperty.condition) {
      condition = dbProperty.condition as Comparable['condition']
    } else if (dbProperty.features) {
      const features = dbProperty.features.join(' ').toLowerCase()
      if (features.includes('excellent-condition') || features.includes('luxury') || features.includes('new-build')) {
        condition = 'excellent'
      } else if (features.includes('good-condition') || features.includes('well-maintained')) {
        condition = 'good'
      } else if (features.includes('fair-condition') || features.includes('needs-renovation')) {
        condition = 'fair'
      } else if (features.includes('needs-work') || features.includes('renovation-project')) {
        condition = 'needs work'
      } else if (features.includes('rebuild') || features.includes('distressed-property')) {
        condition = 'rebuild'
      }
    }
    
    return {
      address: dbProperty.address,
      price: dbProperty.price,
      m2: Math.round(displayArea), // Use m² directly
      bedrooms: dbProperty.bedrooms,
      bathrooms: dbProperty.bathrooms,
      saleDate: dbProperty.date_listed,
      distance: dbProperty.distance || 0,
      pricePerM2: Math.round(dbProperty.price / displayArea), // Use €/m² directly
      propertyType: dbProperty.property_type,
      daysOnMarket: this.calculateDaysOnMarket(dbProperty.date_listed),
      adjustedPrice: dbProperty.price, // Could add market adjustments here
      condition: condition, // Include property condition
      // Property age and timing
      yearBuilt: dbProperty.year_built || dbProperty.yearBuilt,
      listingDate: dbProperty.date_listed,
      lastUpdated: dbProperty.last_updated || dbProperty.lastUpdated,
      // Property images
      images: images && images.length > 0
        ? images
        : dbProperty.image
          ? [dbProperty.image]
          : [],
      // Area details (matching XML feed field names)
      build_area: dbProperty.build_area,
      plot_area: dbProperty.plot_area,
      terrace_area_m2: dbProperty.terrace_area_m2,
      areaType: areaType,
      displayArea: displayArea,
      features: mappedFeatures, // Use mapped features instead of raw codes
      // Include price history for comparables (last 10 entries for performance)
      priceHistory: PriceHistoryManager.getRecentPriceHistory(dbProperty.price_history, 10),
      priceTrend: priceTrend || undefined,
      // Reference number for display
      refNumber: dbProperty.ref_number || dbProperty.refNumber
    }
  }

  private generatePropertyId(property: PropertyData, feedSource: string): string {
    // Create a unique identifier that includes feed source and a hash of key property data
    // This prevents duplicates even if reference numbers are the same across feeds
    const keyData = {
      feedSource,
      refNumber: property.refNumber || '',
      address: property.address,
      city: property.city,
      province: property.province,
      propertyType: property.propertyType,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      buildArea: property.buildArea || 0,
      price: property.price || 0,
      dateListed: property.dateListed || ''
    }
    
    // Create a hash of the key data to ensure uniqueness
    const dataString = JSON.stringify(keyData)
    const hash = Buffer.from(dataString).toString('base64').replace(/[/+=]/g, '').substring(0, 12)
    
    // Include feed source and reference number for readability, but add hash for uniqueness
    if (property.refNumber) {
      return `${feedSource}-${property.refNumber}-${hash}`
    } else {
      return `${feedSource}-${hash}`
    }
  }

  private generateLocationHash(city: string, province: string): string {
    return `${city.toLowerCase().replace(/\s+/g, '-')}-${province.toLowerCase().replace(/\s+/g, '-')}`
  }

  private buildSearchText(property: PropertyData): string {
    const parts = [
      property.address,
      property.city,
      property.province,
      property.propertyType,
      property.condition,
      property.architecturalStyle,
      ...(property.features || []),
      property.description
    ].filter(Boolean)

    return parts.join(' ').toLowerCase()
  }

  private calculateDaysOnMarket(dateListedStr: string): number {
    const dateListed = new Date(dateListedStr)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - dateListed.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  private detectTransactionType(property: PropertyData): boolean {
    // If explicitly set, use that value
    if (property.isSale !== undefined) {
      return property.isSale
    }
    
    // Check for rental indicators - if any rental flags are set, it's a rental
    if (property.isShortTerm || property.isLongTerm) {
      return false // Rental property
    }
    
    // Check for rental price indicators
    if (property.monthlyPrice || property.weeklyPriceFrom || property.weeklyPriceTo) {
      return false // Rental property
    }
    
    // Check description for rental keywords
    if (property.description) {
      const rentalKeywords = ['rent', 'rental', 'alquiler', 'alquila', 'se alquila', 'monthly', 'weekly', 'temporary', 'holiday', 'vacation']
      const hasRentalKeywords = rentalKeywords.some(keyword => 
        property.description!.toLowerCase().includes(keyword.toLowerCase())
      )
      if (hasRentalKeywords) {
        return false // Rental property
      }
    }
    
    // Check for sale keywords
    if (property.description) {
      const saleKeywords = ['sale', 'sell', 'venta', 'vende', 'se vende', 'buy', 'purchase', 'compra']
      const hasSaleKeywords = saleKeywords.some(keyword => 
        property.description!.toLowerCase().includes(keyword.toLowerCase())
      )
      if (hasSaleKeywords) {
        return true // Sale property
      }
    }
    
    // Default to sale if no clear indicators (most properties in MLS feeds are sales)
    return true
  }

  // Enhanced transaction type detection that considers both sale and rental possibilities
  private detectDetailedTransactionType(property: PropertyData): {
    isSale: boolean
    isShortTerm: boolean
    isLongTerm: boolean
    primaryType: 'sale' | 'short-term-rental' | 'long-term-rental'
  } {
    let isSale = true
    let isShortTerm = false
    let isLongTerm = false
    let primaryType: 'sale' | 'short-term-rental' | 'long-term-rental' = 'sale'

    // Check explicit flags first
    if (property.isShortTerm) isShortTerm = true
    if (property.isLongTerm) isLongTerm = true

    // Check price indicators
    if (property.monthlyPrice) isLongTerm = true
    if (property.weeklyPriceFrom || property.weeklyPriceTo) isShortTerm = true

    // If any rental indicators are present, it's not a pure sale
    if (isShortTerm || isLongTerm) {
      isSale = false
    }

    // Determine primary type based on indicators
    if (isShortTerm && !isLongTerm) {
      primaryType = 'short-term-rental'
    } else if (isLongTerm && !isShortTerm) {
      primaryType = 'long-term-rental'
    } else if (isShortTerm && isLongTerm) {
      // If both are set, prioritize based on price indicators
      if (property.weeklyPriceFrom || property.weeklyPriceTo) {
        primaryType = 'short-term-rental'
      } else if (property.monthlyPrice) {
        primaryType = 'long-term-rental'
      } else {
        primaryType = 'long-term-rental' // Default
      }
    } else {
      // Check description for keywords
      if (property.description) {
        const shortTermKeywords = ['weekly', 'holiday', 'vacation', 'temporary', 'short-term', 'semanal']
        const longTermKeywords = ['monthly', 'long-term', 'alquiler', 'rental', 'mensual']
        
        const hasShortTermKeywords = shortTermKeywords.some(keyword => 
          property.description!.toLowerCase().includes(keyword.toLowerCase())
        )
        const hasLongTermKeywords = longTermKeywords.some(keyword => 
          property.description!.toLowerCase().includes(keyword.toLowerCase())
        )

        if (hasShortTermKeywords && !hasLongTermKeywords) {
          primaryType = 'short-term-rental'
          isShortTerm = true
          isSale = false
        } else if (hasLongTermKeywords && !hasShortTermKeywords) {
          primaryType = 'long-term-rental'
          isLongTerm = true
          isSale = false
        }
      }
    }

    return { isSale, isShortTerm, isLongTerm, primaryType }
  }

  // Recategorize all properties in the database based on transaction type indicators
  public recategorizeTransactionTypes(): void {
    if (!this.isLoaded) {
      this.loadDatabase()
    }

    console.log('🔄 Recategorizing transaction types for all properties...')
    let recategorized = 0

    this.properties.forEach((property, propertyId) => {
      const originalIsSale = property.is_sale
      
      // Determine transaction type based on property data
      let isSale = true // Default to sale
      
      // Check for rental indicators
      if (property.is_short_term || property.is_long_term) {
        isSale = false
      }
      
      // Check description for rental keywords
      if (property.description) {
        const rentalKeywords = ['rent', 'rental', 'alquiler', 'alquila', 'se alquila', 'monthly', 'weekly', 'temporary']
        const hasRentalKeywords = rentalKeywords.some(keyword => 
          property.description!.toLowerCase().includes(keyword.toLowerCase())
        )
        if (hasRentalKeywords) {
          isSale = false
        }
      }
      
      // Check for sale keywords
      if (property.description) {
        const saleKeywords = ['sale', 'sell', 'venta', 'vende', 'se vende', 'buy', 'purchase', 'compra']
        const hasSaleKeywords = saleKeywords.some(keyword => 
          property.description!.toLowerCase().includes(keyword.toLowerCase())
        )
        if (hasSaleKeywords) {
          isSale = true
        }
      }
      
      // Update if changed
      if (property.is_sale !== isSale) {
        property.is_sale = isSale
        recategorized++
      }
    })
    
    if (recategorized > 0) {
      console.log(`✅ Recategorized ${recategorized} properties`)
      this.saveDatabase()
    } else {
      console.log('ℹ️ No properties needed recategorization')
    }
  }

  // Compression helper methods
  private async compressData(data: any): Promise<Buffer> {
    if (!this.compressionEnabled) {
      return Buffer.from(JSON.stringify(data, null, 2), 'utf8')
    }
    
    try {
      const jsonString = JSON.stringify(data, null, 2)
      const compressed = await gzipAsync(jsonString, { level: 6 }) // Balanced compression
      console.log(`📦 Compressed data: ${jsonString.length} → ${compressed.length} bytes (${Math.round((1 - compressed.length / jsonString.length) * 100)}% reduction)`)
      return compressed
    } catch (error) {
      console.warn('⚠️ Compression failed, falling back to uncompressed:', error)
      return Buffer.from(JSON.stringify(data, null, 2), 'utf8')
    }
  }

  private async decompressData(buffer: Buffer): Promise<any> {
    try {
      // Try to decompress first
      const decompressed = await gunzipAsync(buffer)
      const jsonString = decompressed.toString('utf8')
      return JSON.parse(jsonString)
    } catch (error) {
      // If decompression fails, try parsing as regular JSON
      try {
        const jsonString = buffer.toString('utf8')
        return JSON.parse(jsonString)
      } catch (parseError) {
        throw new Error(`Failed to parse data: ${parseError}`)
      }
    }
  }

  private getCompressedFilePath(originalPath: string): string {
    return this.compressionEnabled ? `${originalPath}.gz` : originalPath
  }

  // Optimized comparable property search with improved algorithms
  public findComparablePropertiesOptimized(criteria: PropertySearchCriteria): Comparable[] {
    if (!this.isLoaded) {
      this.loadDatabase()
    }

    const startTime = Date.now()
    console.log(`🔍 Optimized search for: ${criteria.city} ${criteria.propertyType}`)

    // Use optimized index intersection for faster results
    const candidateIds = this.getOptimizedCandidates(criteria)
    
    if (candidateIds.length === 0) {
      console.log('❌ No candidates found')
      return []
    }

    // Convert to properties with distance calculation
    const candidates = this.convertCandidatesToProperties(candidateIds, criteria)
    
    // Apply advanced filtering and scoring
    const filteredCandidates = this.applyAdvancedFiltering(candidates, criteria)
    
    // Sort by relevance score and ensure diversity
    const sortedCandidates = this.sortByRelevanceAndDiversity(filteredCandidates, criteria)
    
    // Convert to Comparable format
    const comparables = sortedCandidates.slice(0, criteria.maxResults || 10).map(candidate => 
      this.convertToComparable(candidate)
    )

    const duration = Date.now() - startTime
    console.log(`✅ Found ${comparables.length} comparables in ${duration}ms`)
    
    return comparables
  }

  // Optimized candidate selection using index intersection
  private getOptimizedCandidates(criteria: PropertySearchCriteria): string[] {
    const cityKey = criteria.city.toLowerCase()
    const typeKey = criteria.propertyType.toLowerCase()
    
    // Get primary candidates from city and type intersection
    const cityIds = this.index.byCity[cityKey] || []
    const typeIds = this.index.byType[typeKey] || []
    
    // Use Set for faster intersection
    const citySet = new Set(cityIds)
    const typeSet = new Set(typeIds)
    
    // Find intersection efficiently
    const intersection = cityIds.filter(id => typeSet.has(id))
    
    // Apply transaction type filter if specified
    if (criteria.isSale !== undefined) {
      const transactionIds = this.getTransactionTypeIds(cityKey, criteria)
      const transactionSet = new Set(transactionIds)
      return intersection.filter(id => transactionSet.has(id))
    }
    
    return intersection
  }

  // Get transaction type specific IDs
  private getTransactionTypeIds(cityKey: string, criteria: PropertySearchCriteria): string[] {
    if (criteria.isSale === true) {
      return this.index.bySale?.[cityKey] || []
    } else if (criteria.isSale === false) {
      if (criteria.isShortTerm) {
        return this.index.byShortTerm?.[cityKey] || []
      } else if (criteria.isLongTerm) {
        return this.index.byLongTerm?.[cityKey] || []
      } else {
        return this.index.byRental?.[cityKey] || []
      }
    }
    return []
  }

  // Convert candidates to properties with distance calculation
  private convertCandidatesToProperties(candidateIds: string[], criteria: PropertySearchCriteria): (DatabaseProperty & { distance: number; score: number })[] {
    const candidates: (DatabaseProperty & { distance: number; score: number })[] = []
    
    for (const id of candidateIds) {
      const property = this.properties.get(id)
      if (!property) continue
      
      // Calculate distance if coordinates are available
      let distance = 0
      if (criteria.lat && criteria.lng && property.lat && property.lng) {
        distance = this.calculateDistance(criteria.lat, criteria.lng, property.lat, property.lng)
      }
      
      // Calculate initial relevance score
      const score = this.calculateRelevanceScore(property, criteria)
      
      candidates.push({ ...property, distance, score })
    }
    
    return candidates
  }

  // Apply advanced filtering with optimized algorithms
  private applyAdvancedFiltering(candidates: (DatabaseProperty & { distance: number; score: number })[], criteria: PropertySearchCriteria): (DatabaseProperty & { distance: number; score: number })[] {
    return candidates.filter(candidate => {
      // Price range filter
      if (criteria.minPrice && candidate.price < criteria.minPrice) return false
      if (criteria.maxPrice && candidate.price > criteria.maxPrice) return false
      
      // Area filter
      if (criteria.minAreaM2 || criteria.maxAreaM2) {
        const area = this.getRelevantArea(candidate)
        if (criteria.minAreaM2 && area < criteria.minAreaM2) return false
        if (criteria.maxAreaM2 && area > criteria.maxAreaM2) return false
      }
      
      // Distance filter
      if (criteria.maxDistance && candidate.distance > criteria.maxDistance) return false
      
      // Bedrooms filter
      if (criteria.bedrooms && candidate.bedrooms !== criteria.bedrooms) return false
      
      // Bathrooms filter
      if (criteria.bathrooms && candidate.bathrooms !== criteria.bathrooms) return false
      
      return true
    })
  }

  // Sort by relevance and ensure diversity
  private sortByRelevanceAndDiversity(candidates: (DatabaseProperty & { distance: number; score: number })[], criteria: PropertySearchCriteria): (DatabaseProperty & { distance: number; score: number })[] {
    // Sort by combined score (relevance + distance penalty)
    const sorted = candidates.sort((a, b) => {
      const scoreA = a.score - (a.distance * 0.1) // Distance penalty
      const scoreB = b.score - (b.distance * 0.1)
      return scoreB - scoreA
    })
    
    // Ensure urbanization diversity
    return this.ensureUrbanisationDiversity(sorted, criteria, criteria.maxResults || 10)
  }

  // Get relevant area for a property (build, plot, or terrace)
  private getRelevantArea(property: DatabaseProperty): number {
    // Prefer build area, then plot area, then terrace area
    if (property.build_area && property.build_area > 0) {
      return property.build_area
    } else if (property.plot_area && property.plot_area > 0) {
      return property.plot_area
    } else if (property.terrace_area_m2 && property.terrace_area_m2 > 0) {
      return property.terrace_area_m2
    } else {
      return property.total_area_m2 || 0
    }
  }
} 