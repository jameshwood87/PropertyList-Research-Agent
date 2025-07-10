import axios from 'axios'
import * as cheerio from 'cheerio'
import { PropertyData } from '@/types'
import { antiScrapingManager } from './anti-scraping'

export async function extractPropertyData(url: string): Promise<PropertyData> {
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
    
    // Use anti-scraping manager with retry logic
    let response
    let lastError
    const maxRetries = 3
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt + 1}/${maxRetries} using anti-scraping manager`)
        
        response = await antiScrapingManager.makeRequest(trimmedUrl, {
          timeout: 30000,
          maxRedirects: 10,
          validateStatus: (status) => status < 500
        })
        
        console.log(`Success! Status: ${response.status}`)
        
        // Check for specific error responses
        if (response.status === 403) {
          console.log('403 Forbidden - session will be rotated, retrying...')
          // Session is automatically rotated by anti-scraping manager
          continue
        } else if (response.status === 404) {
          throw new Error('Property not found: The listing may have been removed or the URL is incorrect')
        } else if (response.status === 429) {
          console.log('429 Too Many Requests - waiting and retrying...')
          await new Promise(resolve => setTimeout(resolve, 5000))
          continue
        } else if (response.status >= 400) {
          console.log(`HTTP ${response.status} - retrying with different session...`)
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
        }
        
        // Wait before retry
        if (attempt < maxRetries - 1) {
          const waitTime = Math.pow(2, attempt) * 2000 // Exponential backoff
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
      if (response.status === 403) {
        throw new Error('Access denied: The property website is blocking our request. This specific property URL cannot be accessed at the moment.')
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
    
    let extractedData: PropertyData
    
    if (hostname.includes('idealista.com')) {
      console.log('Extracting from Idealista')
      extractedData = extractFromIdealista($ as any)
    } else if (hostname.includes('fotocasa.es')) {
      console.log('Extracting from Fotocasa')
      extractedData = extractFromFotocasa($ as any)
    } else if (hostname.includes('kyero.com')) {
      console.log('Extracting from Kyero')
      extractedData = extractFromKyero($ as any)
    } else {
      console.log('Using generic extraction for:', hostname)
      extractedData = extractGeneric($ as any)
    }
    
    console.log('Extracted data:', extractedData)
    
    // Validate that we got some meaningful data
    if (!extractedData.location || extractedData.location === 'Unknown Location') {
      console.warn('No location found, trying alternative extraction...')
      // Try alternative extraction methods
      extractedData = tryAlternativeExtraction($, extractedData)
    }
    
    return extractedData
    
  } catch (error: any) {
    console.error('Error extracting property data:', error)
    
    // Provide more specific error messages
    if (error?.code === 'ENOTFOUND') {
      throw new Error('Network error: Cannot reach the property website. Please check the URL and try again.')
    } else if (error?.code === 'ECONNREFUSED') {
      throw new Error('Connection refused: The property website is not responding. Please try again later.')
    } else if (error?.code === 'ETIMEDOUT') {
      throw new Error('Request timeout: The property website is taking too long to respond. Please try again.')
    } else if (error?.response?.status === 404) {
      throw new Error('Property not found: The URL appears to be invalid or the property listing has been removed.')
    } else if (error?.response?.status === 403) {
      throw new Error('Access denied: The property website is blocking our request. Please try a different URL.')
    } else if (error?.response?.status >= 500) {
      throw new Error('Server error: The property website is experiencing technical difficulties. Please try again later.')
    } else if (error?.message?.includes('Invalid URL')) {
      throw error // Re-throw URL validation errors as-is
    } else {
      throw new Error(`Failed to extract property data: ${error?.message || error}`)
    }
  }
}

function extractFromIdealista($: cheerio.CheerioAPI): PropertyData {
  // Extract key information from Idealista
  const priceText = $('.info-data-price').text().trim()
  const price = parsePrice(priceText)
  
  const locationText = $('.main-info__title-minor').text().trim()
  const location = locationText || 'Unknown Location'
  
  const details = $('.info-features').text()
  const bedrooms = extractNumber(details, /(\d+)\s*hab/) || 0
  const bathrooms = extractNumber(details, /(\d+)\s*ba/) || 0
  const sqm = extractNumber(details, /(\d+)\s*m²/) || 0
  
  const typeText = $('.info-data-type').text().trim()
  const type = typeText || 'property'
  
  const description = $('.comment').text().trim()
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
    isNewConstruction: description.toLowerCase().includes('obra nueva') || description.toLowerCase().includes('new construction')
  }
}

function extractFromFotocasa($: cheerio.CheerioAPI): PropertyData {
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
    isNewConstruction: description.toLowerCase().includes('obra nueva') || description.toLowerCase().includes('new construction')
  }
}

function extractFromKyero($: cheerio.CheerioAPI): PropertyData {
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
    isNewConstruction: description.toLowerCase().includes('new construction') || description.toLowerCase().includes('obra nueva')
  }
}

function extractGeneric($: cheerio.CheerioAPI): PropertyData {
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
    isNewConstruction: false
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

function tryAlternativeExtraction($: any, fallbackData: PropertyData): PropertyData {
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