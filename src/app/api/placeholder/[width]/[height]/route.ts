import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ width: string; height: string }> }
) {
  const { width, height } = await params
  const widthNum = parseInt(width) || 400
  const heightNum = parseInt(height) || 300
  
  // Ensure reasonable dimensions
  const safeWidth = Math.min(Math.max(widthNum, 50), 2000)
  const safeHeight = Math.min(Math.max(heightNum, 50), 2000)

  // Create SVG placeholder
  const svg = `
    <svg width="${safeWidth}" height="${safeHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <rect width="100%" height="100%" fill="url(#grid)" opacity="0.1"/>
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#d1d5db" stroke-width="1"/>
        </pattern>
      </defs>
      <g fill="#9ca3af" text-anchor="middle" dominant-baseline="middle">
        <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="16" font-weight="500">
          Property Image
        </text>
        <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="12" opacity="0.7">
          ${safeWidth} × ${safeHeight}
        </text>
      </g>
      <circle cx="50%" cy="35%" r="8" fill="#d1d5db" opacity="0.5"/>
    </svg>
  `.trim()

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      'Access-Control-Allow-Origin': '*',
    },
  })
} 