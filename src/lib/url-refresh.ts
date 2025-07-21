import { NextRequest } from 'next/server'

// Check if a signed URL is expired
export function isSignedUrlExpired(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const amzDate = urlObj.searchParams.get('X-Amz-Date')
    const amzExpires = urlObj.searchParams.get('X-Amz-Expires')
    
    if (!amzDate || !amzExpires) {
      return false // Not a signed URL, assume it's valid
    }
    
    // Parse the date (format: 20250718T151516Z)
    const dateStr = amzDate.replace('T', ' ').replace('Z', ' UTC')
    const signedDate = new Date(dateStr)
    const expiresInSeconds = parseInt(amzExpires)
    
    // Calculate expiration time
    const expirationTime = new Date(signedDate.getTime() + (expiresInSeconds * 1000))
    const now = new Date()
    
    // Add 1 hour buffer to refresh URLs before they actually expire
    const bufferTime = new Date(now.getTime() + (60 * 60 * 1000))
    
    return bufferTime > expirationTime
  } catch (error) {
    console.error('Error parsing signed URL:', error)
    return false
  }
}

// Extract the base S3 URL from a signed URL
export function extractBaseS3Url(signedUrl: string): string | null {
  try {
    const urlObj = new URL(signedUrl)
    
    // Check if it's a propertylist S3 URL
    if (!urlObj.hostname.includes('propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com')) {
      return null
    }
    
    // Extract the base URL without query parameters
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`
    return baseUrl
  } catch (error) {
    console.error('Error extracting base S3 URL:', error)
    return null
  }
}

// Generate a new signed URL by fetching from the XML feed
export async function refreshSignedUrl(baseUrl: string): Promise<string | null> {
  try {
    // The XML feed URL that contains fresh signed URLs
    const xmlFeedUrl = 'http://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/47/export/189963705804aee9/admin.xml'
    
    console.log(`🔄 Refreshing signed URL for: ${baseUrl}`)
    
    // Fetch the XML feed
    const response = await fetch(xmlFeedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch XML feed: ${response.status}`)
      return null
    }
    
    const xmlData = await response.text()
    
    // Search for the base URL in the XML feed
    const urlRegex = new RegExp(`<photo><!\\[CDATA\\[([^\\]]*${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\]]*)\\]\\]></photo>`, 'g')
    const matches = urlRegex.exec(xmlData)
    
    if (matches && matches[1]) {
      console.log(`✅ Found fresh signed URL for: ${baseUrl}`)
      return matches[1]
    }
    
    console.log(`❌ No fresh signed URL found for: ${baseUrl}`)
    return null
  } catch (error) {
    console.error(`❌ Error refreshing signed URL: ${error}`)
    return null
  }
}

// Refresh all expired URLs in a property's images array
export async function refreshPropertyImages(property: any): Promise<any> {
  if (!property.images || !Array.isArray(property.images)) {
    return property
  }
  
  const refreshedImages = []
  let refreshedCount = 0
  
  for (const imageUrl of property.images) {
    if (isSignedUrlExpired(imageUrl)) {
      const baseUrl = extractBaseS3Url(imageUrl)
      if (baseUrl) {
        const freshUrl = await refreshSignedUrl(baseUrl)
        if (freshUrl) {
          refreshedImages.push(freshUrl)
          refreshedCount++
          continue
        }
      }
    }
    refreshedImages.push(imageUrl)
  }
  
  if (refreshedCount > 0) {
    console.log(`🔄 Refreshed ${refreshedCount} URLs for property ${property.id}`)
  }
  
  return {
    ...property,
    images: refreshedImages
  }
}

// Batch refresh URLs for multiple properties
export async function batchRefreshUrls(properties: any[]): Promise<any[]> {
  console.log(`🔄 Starting batch URL refresh for ${properties.length} properties`)
  
  const refreshedProperties = []
  let totalRefreshed = 0
  
  for (const property of properties) {
    const refreshedProperty = await refreshPropertyImages(property)
    refreshedProperties.push(refreshedProperty)
    
    // Count how many URLs were refreshed
    const originalImages = property.images || []
    const refreshedImages = refreshedProperty.images || []
    const refreshedUrls = refreshedImages.filter((url: string, index: number) => 
      originalImages[index] !== url
    ).length
    
    totalRefreshed += refreshedUrls
  }
  
  console.log(`✅ Batch refresh complete: ${totalRefreshed} URLs refreshed`)
  return refreshedProperties
} 