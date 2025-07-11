import axios from 'axios'
import * as cheerio from 'cheerio'
import { PropertyData as BasePropertyData } from '@/types'
import { antiScrapingManager } from './anti-scraping'

const RETRY_DELAYS = [2000, 5000, 10000] // Progressive delays between retries
const MAX_RETRIES = 3
const BLOCK_WAIT_TIME = 15000 // Time to wait when blocked

// Define location details interface
interface LocationDetails {
  street: string
  urbanization: string
  area: string
  city: string
  province: string
}

// Extend the base PropertyData interface
interface ExtendedPropertyData extends BasePropertyData {
  locationDetails: LocationDetails
  plotSize?: number
  terraceSize?: number
  reference?: string
}

export async function extractPropertyData(url: string): Promise<BasePropertyData> {
  try {
    console.log('extractPropertyData called with URL:', url, 'Type:', typeof url)
    
    // Validate URL first
    if (!url || typeof url !== 'string') {
      const errorMsg = `Invalid URL: URL is required and must be a string. Received: ${typeof url}`
      console.error(errorMsg)
      throw new Error(errorMsg)
    }

    let trimmedUrl = url.trim()
    if (!trimmedUrl) {
      const errorMsg = 'Invalid URL: URL cannot be empty'
      console.error(errorMsg)
      throw new Error(errorMsg)
    }

    // Auto-fix missing protocol
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      console.log('Missing protocol, adding https://')
      trimmedUrl = 'https://' + trimmedUrl
    }

    // Check if URL is properly formatted
    let parsedUrl
    try {
      parsedUrl = new URL(trimmedUrl)
      console.log('Successfully parsed URL:', parsedUrl.href)
    } catch (urlError: any) {
      const errorMsg = `Invalid URL format: The URL "${trimmedUrl}" is not valid. Please check the URL and try again. Error: ${urlError?.message || urlError}`
      console.error(errorMsg)
      throw new Error(errorMsg)
    }

    console.log('Attempting to fetch property page using anti-scraping manager...')
    
    // Use anti-scraping manager with enhanced retry logic
    let response
    let lastError
    let blockCount = 0
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        console.log(`Attempt ${attempt + 1}/${MAX_RETRIES} using anti-scraping manager`)
        
        // Add random delay between attempts
        if (attempt > 0) {
          const baseDelay = RETRY_DELAYS[attempt - 1]
          const jitter = Math.floor(Math.random() * 2000) // Add up to 2s of random jitter
          const delay = baseDelay + jitter
          console.log(`Waiting ${delay}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        
        response = await antiScrapingManager.makeRequest(trimmedUrl, {
          timeout: 30000,
          maxRedirects: 5,
          validateStatus: (status) => status < 500,
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
          }
        })
        
        console.log(`Success! Status: ${response.status}`)
        
        // Check for specific error responses
        if (response.status === 403 || response.status === 429) {
          console.log(`${response.status} - Access denied/rate limited, rotating session and waiting...`)
          blockCount++
          
          // If we've been blocked multiple times, wait longer
          const waitTime = BLOCK_WAIT_TIME * Math.pow(2, blockCount - 1)
          console.log(`Block #${blockCount} - Waiting ${waitTime}ms before retry...`)
          
          antiScrapingManager.clearSessions() // Force new session
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        } else if (response.status === 404) {
          throw new Error('Property not found: The listing may have been removed or the URL is incorrect')
        } else if (response.status >= 400) {
          console.log(`HTTP ${response.status} - retrying with different session...`)
          continue
        }
        
        // Check for empty or invalid responses
        if (!response.data || typeof response.data !== 'string' || response.data.length < 100) {
          console.log('Empty or invalid response received, retrying...')
          continue
        }
        
        // Check for common block indicators in the response
        const blockIndicators = [
          'access denied',
          'too many requests',
          'blocked',
          'captcha',
          'security check',
          'please verify you are a human'
        ]
        
        const lowerData = response.data.toLowerCase()
        const isBlocked = blockIndicators.some(indicator => lowerData.includes(indicator))
        
        if (isBlocked) {
          console.log('Block detected in response content, rotating session and retrying...')
          blockCount++
          antiScrapingManager.clearSessions()
          await new Promise(resolve => setTimeout(resolve, BLOCK_WAIT_TIME))
          continue
        }
        
        break // Success!
        
      } catch (error: any) {
        lastError = error
        console.log(`Attempt ${attempt + 1} failed:`, error.message)
        
        // Clear sessions on certain errors to force rotation
        if (error.response?.status === 403 || error.response?.status === 429) {
          console.log('Clearing sessions due to blocking')
          antiScrapingManager.clearSessions()
          blockCount++
        }
        
        // Wait before retry with exponential backoff
        if (attempt < MAX_RETRIES - 1) {
          const waitTime = Math.pow(2, attempt) * 2000 + Math.random() * 1000
          console.log(`Waiting ${waitTime}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
    }
    
    if (!response) {
      throw lastError || new Error('Failed to fetch property page after all retries')
    }
    
    // Only proceed if we got a successful response (2xx status code)
    if (response.status < 200 || response.status >= 300) {
      if (response.status === 403 || response.status === 429) {
        throw new Error('Access denied: The property website is blocking our request. Please try again in a few minutes.')
      } else if (response.status === 404) {
        throw new Error('Property not found: The listing may have been removed or the URL is incorrect.')
      } else {
        throw new Error(`HTTP ${response.status}: Unable to access the property page. Please try a different URL.`)
      }
    }
    
    console.log('Successfully fetched page. Status:', response.status, 'Content-Type:', response.headers['content-type'])
    
    if (!response.data || response.data.length === 0) {
      throw new Error('Empty response from property page')
    }
    
    const $ = cheerio.load(response.data)
    console.log('Page loaded successfully, title:', $('title').text())
    
    // Determine the property portal and extract data accordingly
    const hostname = parsedUrl.hostname.toLowerCase()
    console.log('Hostname:', hostname)
    
    let extractedData: ExtendedPropertyData
    
    if (hostname.includes('idealista.com')) {
      console.log('Extracting from Idealista')
      extractedData = extractFromIdealista($ as unknown as cheerio.CheerioAPI)
    } else if (hostname.includes('fotocasa.es')) {
      console.log('Extracting from Fotocasa')
      extractedData = extractFromFotocasa($ as unknown as cheerio.CheerioAPI)
    } else if (hostname.includes('kyero.com')) {
      console.log('Extracting from Kyero')
      extractedData = extractFromKyero($ as unknown as cheerio.CheerioAPI)
    } else if (hostname.includes('estate-agency.co')) {
      console.log('Extracting from Estate Agency')
      extractedData = extractFromEstateAgency($ as unknown as cheerio.CheerioAPI)
    } else {
      console.log('Using generic extraction for:', hostname)
      extractedData = extractGeneric($ as unknown as cheerio.CheerioAPI)
    }
    
    console.log('Extracted data:', extractedData)
    
    // Validate that we got some meaningful data
    if (!extractedData.location || extractedData.location === 'Unknown Location') {
      console.warn('No location found, trying alternative extraction...')
      // Try alternative extraction methods
      extractedData = tryAlternativeExtraction($, extractedData)
    }
    
    // Final validation of extracted data
    if (!extractedData.price || !extractedData.location || !extractedData.description) {
      throw new Error('Failed to extract essential property data. The website structure may have changed.')
    }
    
    // Return only the base PropertyData fields
    return {
      location: extractedData.location,
      price: extractedData.price,
      pricePerSqm: extractedData.pricePerSqm,
      bedrooms: extractedData.bedrooms,
      bathrooms: extractedData.bathrooms,
      type: extractedData.type,
      sqm: extractedData.sqm,
      saleOrRent: extractedData.saleOrRent,
      description: extractedData.description,
      features: extractedData.features,
      views: extractedData.views,
      isNewConstruction: extractedData.isNewConstruction
    }
    
  } catch (error: any) {
    console.error('Error extracting property data:', error)
    
    // Enhanced error messages
    if (error?.code === 'ENOTFOUND') {
      throw new Error('Network error: Cannot reach the property website. Please check your internet connection and try again.')
    } else if (error?.code === 'ECONNREFUSED') {
      throw new Error('Connection refused: The property website is not responding. Please wait a few minutes and try again.')
    } else if (error?.code === 'ETIMEDOUT') {
      throw new Error('Request timeout: The property website is taking too long to respond. Please try again later.')
    } else if (error?.response?.status === 404) {
      throw new Error('Property not found: The URL appears to be invalid or the property listing has been removed.')
    } else if (error?.response?.status === 403 || error?.response?.status === 429) {
      throw new Error('Access denied: The property website is blocking our request. This specific property URL cannot be accessed at the moment.\n\nPlease check that the URL is valid and points to a supported property listing.')
    } else if (error?.response?.status >= 500) {
      throw new Error('Server error: The property website is experiencing technical difficulties. Please try again in a few minutes.')
    } else if (error?.message?.includes('Invalid URL')) {
      throw error // Re-throw URL validation errors as-is
    } else if (error?.message?.includes('Failed to extract essential property data')) {
      throw new Error('Unable to extract property information. The website structure may have changed or the content is not accessible.')
    } else {
      throw new Error(`Failed to extract property data: ${error?.message || error}`)
    }
  }
}

function extractFromIdealista($: cheerio.CheerioAPI): ExtendedPropertyData {
  // Enhanced price extraction with multiple selectors and formats
  let price = 0
  const priceSelectors = [
    '.info-data-price',
    '.price-container .price',
    '[data-testid="price"]',
    '.price-features__price'
  ]
  
  for (const selector of priceSelectors) {
    const priceElement = $(selector)
    if (priceElement.length) {
      const priceText = priceElement.text().trim()
      // Remove currency symbols and normalize format
      const normalizedPrice = priceText
        .replace(/[€$£]/g, '')
        .replace(/\./g, '')
        .replace(/,/g, '.')
        .replace(/\s/g, '')
        .match(/\d+\.?\d*/)?.[0]
      
      if (normalizedPrice) {
        price = parseFloat(normalizedPrice)
        break
      }
    }
  }

  // Enhanced location extraction with multiple data points
  let locationDetails: LocationDetails = {
    street: '',
    urbanization: '',
    area: '',
    city: '',
    province: ''
  }

  // Try multiple selectors for street address
  const streetSelectors = [
    '.main-info__title-minor',
    '.property-location',
    '[data-testid="address"]',
    '.address'
  ]

  for (const selector of streetSelectors) {
    const streetElement = $(selector)
    if (streetElement.length) {
      locationDetails.street = streetElement.text().trim()
      break
    }
  }

  // Extract location hierarchy from breadcrumbs
  const breadcrumbs = $('.breadcrumb li, .navigation-breadcrumb li')
  const locationParts: string[] = []
  
  breadcrumbs.each((_, el) => {
    const text = $(el).text().trim()
    if (text && !text.includes('>')) {
      locationParts.push(text)
    }
  })

  // Assign location parts in reverse order (most specific to least)
  if (locationParts.length >= 1) locationDetails.province = locationParts[0]
  if (locationParts.length >= 2) locationDetails.city = locationParts[1]
  if (locationParts.length >= 3) locationDetails.area = locationParts[2]

  // Try to extract urbanization from street address or description
  const urbanizationPattern = /\((.*?)\)|en\s+(.*?)\s+(?:,|$)/i
  const streetMatch = locationDetails.street.match(urbanizationPattern)
  if (streetMatch) {
    locationDetails.urbanization = streetMatch[1] || streetMatch[2]
    // Clean up street address
    locationDetails.street = locationDetails.street
      .replace(urbanizationPattern, '')
      .replace(/\s+,/g, ',')
      .trim()
  }

  // Build full location string
  const location = [
    locationDetails.street,
    locationDetails.urbanization,
    locationDetails.area,
    locationDetails.city,
    locationDetails.province
  ]
    .filter(Boolean)
    .join(', ')

  // Extract other property details
  const details = $('.info-features').text()
  const bedrooms = extractNumber(details, /(\d+)\s*(?:hab|dormitor)/i) || 0
  const bathrooms = extractNumber(details, /(\d+)\s*(?:ba[ñn]|aseo)/i) || 0
  const sqm = extractNumber(details, /(\d+)\s*m²/) || 0
  
  // Enhanced property type detection
  let type = 'property'
  const titleText = $('.main-info__title').text().toLowerCase()
  const typePatterns = {
    'piso': /piso|apartamento|ático/i,
    'house': /casa|chalet|villa/i,
    'duplex': /dúplex|duplex/i,
    'studio': /estudio|loft/i,
    'penthouse': /ático|penthouse/i,
    'commercial': /local|oficina|comercial/i
  }

  for (const [propertyType, pattern] of Object.entries(typePatterns)) {
    if (pattern.test(titleText)) {
      type = propertyType
      break
    }
  }

  // Enhanced description extraction with multiple selectors
  let description = ''
  const descriptionSelectors = [
    '.comment',
    '.description',
    '[data-testid="description"]',
    '.property-description'
  ]

  for (const selector of descriptionSelectors) {
    const descElement = $(selector)
    if (descElement.length) {
      description = descElement.text().trim()
      break
    }
  }

  // Extract features with improved detection
  const features = extractFeatures($)
  
  // Detect views from description and features
  const views = extractViews(description)
  
  // Enhanced new construction detection
  const isNewConstruction = $('.icon-new-development').length > 0 || 
    description.toLowerCase().includes('obra nueva') ||
    description.toLowerCase().includes('new development')

  // Calculate price per sqm only if both values are valid
  const pricePerSqm = (price > 0 && sqm > 0) ? Math.round(price / sqm) : undefined

  return {
    location: location || 'Unknown Location',
    price,
    pricePerSqm,
    bedrooms,
    bathrooms,
    type,
    sqm,
    saleOrRent: 'sale',
    description,
    features,
    views,
    isNewConstruction,
    locationDetails,
    plotSize: extractNumber(details, /parcela[:\s]+(\d+)/i) || 0,
    terraceSize: extractNumber(details, /terraza[:\s]+(\d+)/i) || 0,
    reference: $('.property-reference').text().trim() || ''
  }
}

function extractFromFotocasa($: cheerio.CheerioAPI): ExtendedPropertyData {
  // Extract key information from Fotocasa
  const priceText = $('.fc-SecondaryPrice').text().trim() || $('.fc-Price').text().trim()
  const price = parsePrice(priceText)
  
  const locationText = $('.fc-LocationDetail').text().trim()
  const location = locationText || 'Unknown Location'
  
  const bedrooms = extractNumber($('.fc-Characteristic').text(), /(\d+)\s*dorm/) || 0
  const bathrooms = extractNumber($('.fc-Characteristic').text(), /(\d+)\s*ba/) || 0
  const sqm = extractNumber($('.fc-Characteristic').text(), /(\d+)\s*m²/) || 0
  
  const type = $('.fc-PropertyType').text().trim() || 'property'
  const description = $('.fc-Description').text().trim()
  const saleOrRent = priceText.includes('/mes') ? 'rent' : 'sale'
  
  return {
    location,
    price,
    pricePerSqm: sqm > 0 ? Math.round(price / sqm) : undefined,
    bedrooms,
    bathrooms,
    type,
    sqm,
    saleOrRent,
    description,
    features: extractFeatures($),
    views: extractViews(description),
    isNewConstruction: description.toLowerCase().includes('obra nueva') || description.toLowerCase().includes('new construction'),
    locationDetails: {
      street: '',
      urbanization: extractUrbanization(location),
      area: location.split(',')[1]?.trim() || '',
      city: location.split(',')[2]?.trim() || '',
      province: location.split(',')[3]?.trim() || ''
    },
    plotSize: 0,
    terraceSize: 0,
    reference: ''
  }
}

function extractFromKyero($: cheerio.CheerioAPI): ExtendedPropertyData {
  // Extract key information from Kyero
  const priceText = $('.property-price').text().trim()
  const price = parsePrice(priceText)
  
  const locationText = $('.property-location').text().trim()
  const location = locationText || 'Unknown Location'
  
  const details = $('.property-details').text()
  const bedrooms = extractNumber(details, /(\d+)\s*bed/) || 0
  const bathrooms = extractNumber(details, /(\d+)\s*bath/) || 0
  const sqm = extractNumber(details, /(\d+)\s*m²/) || 0
  
  const type = $('.property-type').text().trim() || 'property'
  const description = $('.property-description').text().trim()
  const saleOrRent = priceText.includes('/month') ? 'rent' : 'sale'
  
  return {
    location,
    price,
    pricePerSqm: sqm > 0 ? Math.round(price / sqm) : undefined,
    bedrooms,
    bathrooms,
    type,
    sqm,
    saleOrRent,
    description,
    features: extractFeatures($),
    views: extractViews(description),
    isNewConstruction: description.toLowerCase().includes('new construction') || description.toLowerCase().includes('obra nueva'),
    locationDetails: {
      street: '',
      urbanization: extractUrbanization(location),
      area: location.split(',')[1]?.trim() || '',
      city: location.split(',')[2]?.trim() || '',
      province: location.split(',')[3]?.trim() || ''
    },
    plotSize: 0,
    terraceSize: 0,
    reference: ''
  }
}

function extractFromEstateAgency($: cheerio.CheerioAPI): ExtendedPropertyData {
  // Extract title and location
  const title = $('.title').first().text().trim()
  const location = title.split(' in ')[1] || 'Unknown Location'

  // Extract price
  const priceText = $('.price .line').first().text().trim()
  const price = parsePrice(priceText) || 0

  // Extract property details
  const buildDetails = $('.bulid-details .item')
  let sqm = 0
  let plotSize = 0
  let terraceSize = 0

  buildDetails.each((_, el) => {
    const value = $(el).find('.value').text().trim()
    const name = $(el).find('.name').text().trim().toLowerCase()
    const numericValue = parseInt(value)

    if (name === 'build') sqm = numericValue
    if (name === 'plot') plotSize = numericValue
    if (name === 'terrace') terraceSize = numericValue
  })

  // Extract description
  const description = $('.description').text().trim()

  // Extract features
  const features = $('.features .item').map((_, el) => $(el).text().trim()).get()

  // Extract reference number
  const reference = $('.reference').text().trim()

  // Determine property type from title
  const type = title.split(' - ')[1]?.split(' in ')[0]?.toLowerCase() || 'property'

  // Extract bedrooms and bathrooms from title
  const bedroomsMatch = title.match(/(\d+)\s*Bed/)
  const bedrooms = bedroomsMatch ? parseInt(bedroomsMatch[1]) : 0

  // Count bathrooms from description (en-suite mentions)
  const bathroomsMatch = description.match(/(\d+)\s*(?:bedroom|bed)\s+en-suite/i)
  const bathrooms = bathroomsMatch ? parseInt(bathroomsMatch[1]) : 0

  // Determine if it's new construction
  const isNewConstruction = description.toLowerCase().includes('brand new') ||
                           description.toLowerCase().includes('new to the market') ||
                           description.toLowerCase().includes('just been totally reformed')

  // Extract views from description
  const views = extractViews(description)

  // Extract location details
  const locationParts = location.split(',').map(part => part.trim())
  const locationDetails = {
    street: '',
    urbanization: extractUrbanization(description),
    area: locationParts[0] || '',
    city: locationParts[1] || '',
    province: locationParts[2] || ''
  }

  // Always sale for this website (they don't do rentals)
  const saleOrRent = 'sale'

  return {
    location,
    price,
    pricePerSqm: sqm > 0 ? Math.round(price / sqm) : undefined,
    bedrooms,
    bathrooms,
    type,
    sqm,
    saleOrRent,
    description,
    features,
    views,
    isNewConstruction,
    locationDetails,
    plotSize,
    terraceSize,
    reference
  }
}

function extractGeneric($: cheerio.CheerioAPI): ExtendedPropertyData {
  // Generic extraction for unknown sites
  const text = $('body').text().toLowerCase()
  
  // Try to find price patterns
  const priceMatch = text.match(/€\s*(\d+(?:[.,]\d+)*)/g)
  const price = priceMatch ? parsePrice(priceMatch[0]) : 0
  
  // Try to find location
  const locationMatch = text.match(/(madrid|barcelona|sevilla|málaga|valencia|marbella|benahavís|estepona|torremolinos|fuengirola|benalmádena)/i)
  const location = locationMatch ? locationMatch[0] : 'Unknown Location'
  
  // Try to find property details
  const bedrooms = extractNumber(text, /(\d+)\s*(?:bed|dorm|hab)/i) || 0
  const bathrooms = extractNumber(text, /(\d+)\s*(?:bath|ba)/i) || 0
  const sqm = extractNumber(text, /(\d+)\s*m²/i) || 0
  
  return {
    location,
    price,
    pricePerSqm: sqm > 0 ? Math.round(price / sqm) : undefined,
    bedrooms,
    bathrooms,
    type: 'property',
    sqm,
    saleOrRent: 'sale',
    description: $('title').text() || 'Property listing',
    features: [],
    views: [],
    isNewConstruction: false,
    locationDetails: {
      street: '',
      urbanization: extractUrbanization(location),
      area: location.split(',')[1]?.trim() || '',
      city: location.split(',')[2]?.trim() || '',
      province: location.split(',')[3]?.trim() || ''
    },
    plotSize: 0,
    terraceSize: 0,
    reference: ''
  }
}

function parsePrice(priceText: string): number {
  // Remove currency symbols and extract numeric value
  const cleanText = priceText.replace(/[€$£,\s]/g, '')
  const match = cleanText.match(/(\d+(?:\.\d+)?)/)
  return match ? parseInt(match[1]) : 0
}

function extractNumber(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern)
  return match ? parseInt(match[1]) : null
}

function extractFeatures($: cheerio.CheerioAPI): string[] {
  const features: string[] = []
  
  // Common feature selectors
  const featureSelectors = [
    '.property-features li',
    '.features li',
    '.characteristics li',
    '.amenities li'
  ]
  
  featureSelectors.forEach(selector => {
    $(selector).each((_, element) => {
      const feature = $(element).text().trim()
      if (feature) features.push(feature)
    })
  })
  
  return features
}

function extractViews(description: string): string[] {
  const views: string[] = []
  const viewKeywords = ['sea', 'mountain', 'golf', 'pool', 'garden', 'city', 'countryside', 'beach']
  
  viewKeywords.forEach(keyword => {
    if (description.toLowerCase().includes(keyword)) {
      views.push(keyword)
    }
  })
  
  return views
}

function tryAlternativeExtraction($: any, fallbackData: ExtendedPropertyData): ExtendedPropertyData {
  console.log('Trying alternative extraction methods...')
  
  // Try to extract location from various selectors
  const locationSelectors = [
    'h1', 'h2', '.title', '.location', '.address', '.city', '.area',
    '[class*="location"]', '[class*="address"]', '[class*="city"]',
    '[id*="location"]', '[id*="address"]', '[id*="city"]'
  ]
  
  let location = fallbackData.location
  for (const selector of locationSelectors) {
    const text = $(selector).first().text().trim()
    if (text && text.length > 2 && text.length < 100) {
      // Basic validation for location text
      if (text.match(/[a-zA-Z]/) && !text.match(/^\d+$/)) {
        location = text
        console.log('Found location via selector:', selector, '→', text)
        break
      }
    }
  }
  
  // Try to extract price from various selectors
  const priceSelectors = [
    '[class*="price"]', '[id*="price"]', '.amount', '.cost',
    'span:contains("€")', 'div:contains("€")', 'p:contains("€")'
  ]
  
  let price = fallbackData.price
  for (const selector of priceSelectors) {
    const text = $(selector).first().text().trim()
    if (text && text.includes('€')) {
      const extractedPrice = parsePrice(text)
      if (extractedPrice > 0) {
        price = extractedPrice
        console.log('Found price via selector:', selector, '→', extractedPrice)
        break
      }
    }
  }
  
  // Try to extract basic property info from meta tags
  const description = $('meta[name="description"]').attr('content') || 
                     $('meta[property="og:description"]').attr('content') || 
                     fallbackData.description
  
  return {
    ...fallbackData,
    location,
    price,
    description
  }
}

// Helper function to extract urbanization name
function extractUrbanization(address: string): string {
  if (!address) return ''
  
  // Common patterns for urbanization names
  const patterns = [
    /\b(?:Urbanización|Urb\.|Urbanizacion)\s+([^,]+)/i,
    /\(([^)]+)\)/,
    /\"([^"]+)\"/,
    /\b(?:Residencial|Complejo|Conjunto)\s+([^,]+)/i
  ]
  
  for (const pattern of patterns) {
    const match = address.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  
  // Try splitting by commas and look for likely urbanization names
  const parts = address.split(',').map(p => p.trim())
  if (parts.length > 1) {
    // Look for parts that might be urbanization names (e.g., "Los Flamingos", "La Quinta")
    const urbanizationPart = parts.find(p => 
      /^(?:Los|Las|El|La)\s+\w+/i.test(p) || // Common Spanish urbanization prefixes
      /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(p) // Proper case names
    )
    if (urbanizationPart) {
      return urbanizationPart
    }
  }
  
  return ''
}