import { NextRequest, NextResponse } from 'next/server'
import { isSignedUrlExpired, extractBaseS3Url, refreshSignedUrl } from '@/lib/url-refresh'

// Simple SVG placeholder generator
function generatePlaceholderSVG(width: number = 400, height: number = 300, text: string = 'Property Image'): string {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f8fafc"/>
      <rect x="0" y="0" width="100%" height="100%" fill="url(#pattern)" opacity="0.1"/>
      <defs>
        <pattern id="pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="1" fill="#94a3b8"/>
        </pattern>
      </defs>
      <g fill="#64748b" text-anchor="middle" dominant-baseline="middle">
        <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="16" font-weight="500">
          ${text}
        </text>
        <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="12" opacity="0.7">
          Image temporarily unavailable
        </text>
        <text x="50%" y="75%" font-family="Arial, sans-serif" font-size="10" opacity="0.5">
          ${width} × ${height}
        </text>
      </g>
      <circle cx="50%" cy="30%" r="12" fill="#e2e8f0" opacity="0.6"/>
      <path d="M 50% 25% L 45% 35% L 55% 35% Z" fill="#94a3b8" opacity="0.4"/>
    </svg>
  `
}



export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const imageUrl = searchParams.get('url')

  if (!imageUrl) {
    return new NextResponse('Missing image URL', { status: 400 })
  }

  console.log(`🖼️ Proxying image: ${imageUrl}`)

  try {
    // Check if URL is expired and try to refresh it
    let finalImageUrl = imageUrl
    if (isSignedUrlExpired(imageUrl)) {
      console.log(`🔄 URL expired, attempting refresh: ${imageUrl.substring(0, 100)}...`)
      const baseUrl = extractBaseS3Url(imageUrl)
      if (baseUrl) {
        const freshUrl = await refreshSignedUrl(baseUrl)
        if (freshUrl) {
          finalImageUrl = freshUrl
          console.log(`✅ URL refreshed successfully`)
        }
      }
    }

    const response = await fetch(finalImageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    if (!response.ok) {
      console.log(`❌ Failed to fetch image: ${response.status} ${response.statusText}`)
      return new NextResponse(`Image fetch failed: ${response.status} ${response.statusText}`, { 
        status: response.status 
      })
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    console.log(`❌ Error fetching image: ${error}`)
    return new NextResponse(`Error fetching image: ${error}`, { status: 500 })
  }
} 