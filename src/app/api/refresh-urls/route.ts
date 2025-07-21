import { NextRequest, NextResponse } from 'next/server'
import { batchRefreshUrls, refreshPropertyImages } from '@/lib/url-refresh'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, propertyId, batchSize = 100 } = body

    console.log(`🔄 URL refresh request: ${action}`)

    switch (action) {
      case 'refresh_property':
        if (!propertyId) {
          return NextResponse.json({ error: 'Property ID required' }, { status: 400 })
        }
        
        // Load the properties database
        const propertiesPath = path.join(process.cwd(), 'data', 'properties.json')
        const properties = JSON.parse(fs.readFileSync(propertiesPath, 'utf8'))
        
        // Find the specific property
        const property = properties.find((p: any) => p.id === propertyId)
        if (!property) {
          return NextResponse.json({ error: 'Property not found' }, { status: 404 })
        }
        
        // Refresh the property's URLs
        const refreshedProperty = await refreshPropertyImages(property)
        
        // Update the property in the database
        const propertyIndex = properties.findIndex((p: any) => p.id === propertyId)
        properties[propertyIndex] = refreshedProperty
        
        // Save back to database
        fs.writeFileSync(propertiesPath, JSON.stringify(properties, null, 2))
        
        return NextResponse.json({
          success: true,
          propertyId,
          refreshed: true
        })

      case 'refresh_batch':
        // Load the properties database
        const allPropertiesPath = path.join(process.cwd(), 'data', 'properties.json')
        const allProperties = JSON.parse(fs.readFileSync(allPropertiesPath, 'utf8'))
        
        // Process in batches to avoid memory issues
        const totalProperties = allProperties.length
        const batches = Math.ceil(totalProperties / batchSize)
        let totalRefreshed = 0
        
        console.log(`🔄 Processing ${totalProperties} properties in ${batches} batches`)
        
        for (let i = 0; i < batches; i++) {
          const start = i * batchSize
          const end = Math.min(start + batchSize, totalProperties)
          const batch = allProperties.slice(start, end)
          
          console.log(`🔄 Processing batch ${i + 1}/${batches} (properties ${start + 1}-${end})`)
          
          const refreshedBatch = await batchRefreshUrls(batch)
          
          // Update the batch in the main array
          for (let j = 0; j < refreshedBatch.length; j++) {
            allProperties[start + j] = refreshedBatch[j]
          }
          
          // Count refreshed URLs in this batch
          const batchRefreshed = refreshedBatch.reduce((count: number, property: any, index: number) => {
            const originalImages = batch[index].images || []
            const refreshedImages = property.images || []
            return count + refreshedImages.filter((url: string, idx: number) => 
              originalImages[idx] !== url
            ).length
          }, 0)
          
          totalRefreshed += batchRefreshed
          
          // Save progress after each batch
          fs.writeFileSync(allPropertiesPath, JSON.stringify(allProperties, null, 2))
          
          console.log(`✅ Batch ${i + 1} complete: ${batchRefreshed} URLs refreshed`)
        }
        
        return NextResponse.json({
          success: true,
          totalProperties,
          totalRefreshed,
          batches
        })

      case 'refresh_comparables':
        // This will refresh URLs for comparable properties in a session
        const { sessionId } = body
        if (!sessionId) {
          return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
        }
        
        // Load session data
        const sessionsPath = path.join(process.cwd(), 'server', 'sessions.json')
        const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'))
        
        const session = sessions.find((s: any) => s.id === sessionId)
        if (!session) {
          return NextResponse.json({ error: 'Session not found' }, { status: 404 })
        }
        
        // Refresh URLs for comparable properties
        if (session.comparableProperties && Array.isArray(session.comparableProperties)) {
          const refreshedComparables = await batchRefreshUrls(session.comparableProperties)
          session.comparableProperties = refreshedComparables
          
          // Save updated session
          fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2))
          
          return NextResponse.json({
            success: true,
            sessionId,
            comparableCount: refreshedComparables.length
          })
        }
        
        return NextResponse.json({
          success: true,
          sessionId,
          message: 'No comparable properties to refresh'
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('❌ Error in URL refresh:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    
    if (!url) {
      return NextResponse.json({ error: 'URL parameter required' }, { status: 400 })
    }
    
    // Check if URL is expired
    const { isSignedUrlExpired, extractBaseS3Url, refreshSignedUrl } = await import('@/lib/url-refresh')
    
    if (isSignedUrlExpired(url)) {
      const baseUrl = extractBaseS3Url(url)
      if (baseUrl) {
        const freshUrl = await refreshSignedUrl(baseUrl)
        if (freshUrl) {
          return NextResponse.json({
            expired: true,
            originalUrl: url,
            freshUrl: freshUrl
          })
        }
      }
      
      return NextResponse.json({
        expired: true,
        originalUrl: url,
        error: 'Could not refresh URL'
      })
    }
    
    return NextResponse.json({
      expired: false,
      url: url
    })
  } catch (error) {
    console.error('❌ Error checking URL:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 