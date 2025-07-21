// Feed Configuration System for Property XML Feeds
export interface FeedProvider {
  name: string
  url: string
  type: 'xml' | 'json' | 'api'
  updateInterval: number // in seconds
  updateTime?: string // HH:MM format for scheduled updates
  credentials?: {
    username?: string
    password?: string
    apiKey?: string
  }
  parser: string // parser class name
  enabled: boolean
  dataSource: 'official' | 'commercial' | 'hybrid' // New field for data source classification
  description?: string // Description of the data source
}

export interface FeedConfiguration {
  activeFeed: string
  providers: Record<string, FeedProvider>
  database: {
    path: string
    maxSize: string
    backupInterval: number
  }
  search: {
    maxResults: number
    searchRadius: number // km
    similarityThreshold: number
  }
  // Official Spanish data sources configuration
  officialSources: {
    enabled: boolean
    priority: 'high' | 'medium' | 'low'
    updateInterval: number
  }
}

// Default configuration with Property Portal as primary and official Spanish sources
export const defaultFeedConfig: FeedConfiguration = {
  activeFeed: 'property-portal',
  providers: {
    'property-portal': {
      name: 'PropertyList XML Feed',
      url: process.env.PROPERTY_PORTAL_XML_URL || 'http://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/47/export/189963705804aee9/admin.xml',
      type: 'xml',
      updateInterval: 86400, // 24 hours
      updateTime: '03:32', // 3:32 AM
      credentials: {
        // No credentials needed for PropertyList XML feed
      },
      parser: 'PropertyPortalParser',
      enabled: true,
      dataSource: 'commercial',
      description: 'PropertyList XML feed with comprehensive property data including descriptions'
    },
    'idealista': {
      name: 'Idealista',
      url: process.env.IDEALISTA_XML_URL || '',
      type: 'xml',
      updateInterval: 86400,
      updateTime: '01:00',
      parser: 'IdealistaParser',
      enabled: false,
      dataSource: 'commercial',
      description: 'Major Spanish property portal with extensive listings'
    },
    'fotocasa': {
      name: 'Fotocasa',
      url: process.env.FOTOCASA_XML_URL || '',
      type: 'xml',
      updateInterval: 86400,
      updateTime: '01:30',
      parser: 'FotocasaParser',
      enabled: false,
      dataSource: 'commercial',
      description: 'Spanish property portal with market data'
    },
    // Official Spanish data sources
    'ine': {
      name: 'INE - Instituto Nacional de Estadística',
      url: 'https://www.ine.es/dyngs/DataLab/manual.html?cid=45',
      type: 'api',
      updateInterval: 604800, // Weekly updates
      updateTime: '02:00',
      parser: 'INEParser',
      enabled: true,
      dataSource: 'official',
      description: 'Official Spanish statistics including housing market data, population, and economic indicators'
    },
    'catastro': {
      name: 'Catastro - Dirección General del Catastro',
      url: 'https://www.sedecatastro.gob.es/',
      type: 'api',
      updateInterval: 86400, // Daily updates
      updateTime: '04:00',
      parser: 'CatastroParser',
      enabled: true,
      dataSource: 'official',
      description: 'Official Spanish property registry with cadastral data, property values, and ownership information'
    },
    'juntadeandalucia': {
      name: 'Junta de Andalucía - Datos Abiertos',
      url: 'https://www.juntadeandalucia.es/datosabierto',
      type: 'api',
      updateInterval: 604800, // Weekly updates
      updateTime: '03:00',
      parser: 'JuntaAndaluciaParser',
      enabled: true,
      dataSource: 'official',
      description: 'Andalusian government open data including regional property statistics and planning data'
    },
    'crimestats': {
      name: 'Estadísticas de Criminalidad - Ministerio del Interior',
      url: 'https://estadisticasdecriminalidad.ses.mir.es/publico/portalestadistico/',
      type: 'api',
      updateInterval: 2592000, // Monthly updates
      updateTime: '05:00',
      parser: 'CrimeStatsParser',
      enabled: true,
      dataSource: 'official',
      description: 'Official Spanish crime statistics and safety data by region and municipality'
    },
    'sedecatastro': {
      name: 'Sede Catastro - Consulta de Datos',
      url: 'https://www.sedecatastro.gob.es/',
      type: 'api',
      updateInterval: 86400, // Daily updates
      updateTime: '06:00',
      parser: 'SedeCatastroParser',
      enabled: true,
      dataSource: 'official',
      description: 'Catastro web portal for property data consultation and cadastral information'
    }
  },
  database: {
    path: './data/properties.db',
    maxSize: '500MB',
    backupInterval: 604800 // 7 days
  },
  search: {
    maxResults: 20,
    searchRadius: 5, // 5km radius for comparables
    similarityThreshold: 0.7
  },
  officialSources: {
    enabled: true,
    priority: 'high',
    updateInterval: 86400 // Daily updates for official sources
  }
}

// Get current feed configuration
export function getCurrentFeedConfig(): FeedConfiguration {
  // In production, this would load from a config file or database
  return defaultFeedConfig
}

// Get active feed provider
export function getActiveFeedProvider(): FeedProvider {
  const config = getCurrentFeedConfig()
  return config.providers[config.activeFeed]
}

// Get all official Spanish data sources
export function getOfficialSpanishSources(): FeedProvider[] {
  const config = getCurrentFeedConfig()
  return Object.values(config.providers).filter(provider => 
    provider.dataSource === 'official' && provider.enabled
  )
}

// Get all enabled data sources
export function getEnabledDataSources(): FeedProvider[] {
  const config = getCurrentFeedConfig()
  return Object.values(config.providers).filter(provider => provider.enabled)
}

// Switch active feed provider
export function switchFeedProvider(providerName: string): boolean {
  const config = getCurrentFeedConfig()
  if (config.providers[providerName] && config.providers[providerName].enabled) {
    config.activeFeed = providerName
    console.log(`Switched to feed provider: ${providerName}`)
    return true
  }
  console.error(`Invalid or disabled feed provider: ${providerName}`)
  return false
}

// Validate feed URL accessibility
export async function validateFeedProvider(providerName: string): Promise<boolean> {
  const config = getCurrentFeedConfig()
  const provider = config.providers[providerName]
  
  if (!provider) {
    console.error(`Feed provider not found: ${providerName}`)
    return false
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(provider.url, {
      method: 'HEAD',
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    return response.ok
  } catch (error) {
    console.error(`Feed validation failed for ${providerName}:`, error)
    return false
  }
}

// Get data source priority for analysis
export function getDataSourcePriority(providerName: string): number {
  const config = getCurrentFeedConfig()
  const provider = config.providers[providerName]
  
  if (!provider) return 0
  
  // Official sources get highest priority
  if (provider.dataSource === 'official') return 3
  // Commercial sources get medium priority
  if (provider.dataSource === 'commercial') return 2
  // Hybrid sources get lower priority
  return 1
} 