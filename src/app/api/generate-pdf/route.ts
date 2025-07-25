import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs'
import { CMAReport } from '@/types'
import { validateApiToken } from '@/lib/auth'



// Generate a fallback map placeholder for PDFs
function generateMapPlaceholder(coordinates: any, address: string): string {
  const lat = coordinates?.lat || 36.7213
  const lng = coordinates?.lng || -4.4217
  
  // Create a professional map-like placeholder using CSS
  return `
    <div style="
      width: 100%; 
      height: 120px; 
      background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 50%, #d1e7ff 100%);
      border-radius: 6px; 
      border: 1px solid #e5e7eb;
      position: relative;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <!-- Map grid pattern -->
      <div style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: 
          linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
        background-size: 20px 20px;
        opacity: 0.3;
      "></div>
      
      <!-- Location marker -->
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        z-index: 2;
      ">
        <div style="
          width: 16px;
          height: 16px;
          background: #dc2626;
          border-radius: 50%;
          margin: 0 auto 8px;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          position: relative;
        ">
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 6px;
            height: 6px;
            background: white;
            border-radius: 50%;
          "></div>
        </div>
        <div style="
          font-size: 11px; 
          font-weight: 600; 
          margin-bottom: 3px;
          color: #1f2937;
          text-shadow: 0 1px 2px rgba(255,255,255,0.8);
        ">📍 Property Location</div>
        <div style="
          font-size: 9px; 
          color: #6b7280;
          font-family: 'Courier New', monospace;
          background: rgba(255,255,255,0.8);
          padding: 2px 6px;
          border-radius: 3px;
          display: inline-block;
        ">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
      </div>
      
      <!-- Location label -->
      <div style="
        position: absolute;
        top: 6px;
        left: 6px;
        background: rgba(0,0,0,0.75);
        color: white;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 9px;
        font-weight: 500;
        z-index: 3;
      ">
        📍 Location Map
      </div>
      
      <!-- Compass indicator -->
      <div style="
        position: absolute;
        top: 6px;
        right: 6px;
        background: rgba(255,255,255,0.9);
        color: #374151;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 8px;
        font-weight: 500;
        z-index: 3;
      ">
        N
      </div>
    </div>
  `
}

// Enhanced map generation with fallback
async function generateMapForPDF(report: any): Promise<string> {
  // Always use the free placeholder map since location is already linked in the main text
  return generateMapPlaceholder(report.coordinates, report.propertyData?.address || 'Unknown location')
}

export async function POST(request: NextRequest) {
  // Validate API token
  const authResult = validateApiToken(request)
  if (!authResult.isValid) {
    return NextResponse.json(
      { error: 'Unauthorized', details: authResult.error },
      { status: 401 }
    )
  }

    let browser: any = null
  
  try {
    const { report, reportType, format }: { report: CMAReport; reportType?: string; format?: string } = await request.json()
    
    if (!report) {
      return NextResponse.json(
        { error: 'CMA report data is required' },
        { status: 400 }
      )
    }

    // Validate required report properties
    if (!report.propertyData || !report.propertyData.address) {
      return NextResponse.json(
        { error: 'Invalid report data: missing property information' },
        { status: 400 }
      )
    }

    // Launch Puppeteer with Windows-friendly configuration and enhanced stability
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-javascript', // Disable JS since we're generating static HTML
        '--memory-pressure-off',
        '--max_old_space_size=4096'
      ],
      timeout: 90000, // Increased timeout for better reliability
      ignoreDefaultArgs: ['--disable-extensions']
    })
    
    const page = await browser.newPage()
    
    // Set page format and timeout
    await page.setViewport({ width: 1200, height: 1600 })
    await page.setDefaultTimeout(30000)
    
    // Read logo file with error handling
    let logoBase64 = ''
    try {
      const logoPath = path.join(process.cwd(), 'private', 'logo.png')
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath)
        logoBase64 = logoBuffer.toString('base64')
      }
    } catch (logoError) {
      console.warn('Logo file not found, continuing without logo:', logoError)
    }
    
    // Generate HTML content for PDF with error handling
    let htmlContent: string
    try {
      htmlContent = generatePDFHTML(report, logoBase64, reportType, format)
      
      // Validate HTML content
      if (!htmlContent || htmlContent.length < 100) {
        throw new Error('Generated HTML content is too short or empty')
      }
      
      // Check for common HTML generation issues
      if (htmlContent.includes('undefined') || htmlContent.includes('null')) {
        console.warn('HTML content contains undefined/null values, but continuing...')
      }
      
    } catch (htmlError) {
      console.error('Error generating HTML content:', htmlError)
      return NextResponse.json(
        { error: 'Failed to generate PDF content' },
        { status: 500 }
      )
    }
    
    // Set HTML content with timeout - use domcontentloaded for faster loading
    await page.setContent(htmlContent, { 
      waitUntil: 'domcontentloaded',
      timeout: 45000
    })
    
    // Wait for images to load with better error handling
    try {
      // Wait for all images to load or timeout
      await page.evaluate(() => {
        return Promise.all(
          Array.from(document.images)
            .filter(img => !img.complete)
            .map(img => new Promise((resolve, reject) => {
              img.onload = resolve
              img.onerror = resolve // Don't reject on image errors, just continue
              // Timeout after 5 seconds per image
              setTimeout(resolve, 5000)
            }))
        )
      })
    } catch (imageError) {
      console.warn('Some images failed to load, continuing with PDF generation:', imageError)
    }
    
    // Additional wait for any remaining content
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Generate PDF with timeout
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12px',
        right: '12px',
        bottom: '12px',
        left: '12px'
      },
      timeout: 60000,
      preferCSSPageSize: false
    })
    
    // Validate PDF was generated
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Generated PDF is empty')
    }
    
    // Return PDF as response
    const reportTypeLabel = reportType || 'Buyer'
    const refNumber = report.propertyData?.refNumber || 'NoRef'
    const location = report.propertyData?.suburb || report.propertyData?.city || 'Unknown'
    const date = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    }).replace(/\//g, '-')
    
    const fileName = `${refNumber} CMA ${reportTypeLabel} Report - ${location} - ${date}.pdf`
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })
    
  } catch (error) {
    console.error('Error generating PDF:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Provide more specific error messages
    let errorMessage = 'Failed to generate PDF'
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = 'PDF generation timed out. Please try again.'
      } else if (error.message.includes('browser')) {
        errorMessage = 'Browser error during PDF generation. Please try again.'
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error during PDF generation. Please try again.'
      } else if (error.message.includes('launch')) {
        errorMessage = 'Browser launch failed. Please try again.'
      } else if (error.message.includes('Invalid date')) {
        errorMessage = 'Data formatting error. Please try again.'
      } else {
        errorMessage = `PDF generation failed: ${error.message}`
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  } finally {
    // Ensure browser is always closed
    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.error('Error closing browser:', closeError)
      }
    }
  }
}

function formatPrice(price: number): string {
  if (!price || isNaN(price) || price < 0) {
    return 'N/A'
  }
  
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  } catch (error) {
    console.error('Error formatting price:', error)
    return 'N/A'
  }
}

function formatDate(dateString: string): string {
  if (!dateString) {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }
  
  // Handle common non-date values
  const lowerDateString = dateString.toLowerCase().trim()
  if (lowerDateString === 'tbd' || lowerDateString === 'tba' || lowerDateString === 'to be determined' || 
      lowerDateString === 'to be announced' || lowerDateString === 'unknown' || lowerDateString === 'pending') {
    return 'TBD'
  }
  
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date')
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch (error) {
    console.error('Error formatting date:', error)
    // Return the original string if it's not a valid date but not a recognized placeholder
    return dateString
  }
}



function formatComparableAddress(address: string): string {
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
  
  // Replace province codes with full names - more careful approach
  let formattedAddress = address
  
  // First, handle all multi-letter codes (MA, PM, GI, CO, AL, SE, CS)
  const multiLetterCodes = Object.keys(provinceMap).filter(code => code.length > 1);
  for (const code of multiLetterCodes) {
    const name = provinceMap[code];
    // Replace only standalone codes after comma and space
    const regex = new RegExp(`(, ${code}\\b|, ${code}$)`, 'g');
    formattedAddress = formattedAddress.replace(regex, `, ${name}`);
  }
  
  // Then handle single-letter codes (M, A, T, B, J) - but be very careful
  const singleLetterCodes = Object.keys(provinceMap).filter(code => code.length === 1);
  for (const code of singleLetterCodes) {
    const name = provinceMap[code];
    // For single letters, only replace if they are at the end of the string or followed by a space
    // This prevents replacing "M" in "Málaga"
    const regex = new RegExp(`(, ${code}(?=\\s|$)|, ${code}$)`, 'g');
    formattedAddress = formattedAddress.replace(regex, `, ${name}`);
  }
  
  return formattedAddress
}

function formatLocation(propertyData: any): string {
  const locationParts = []
  
  // Add city
  if (propertyData.city) {
    locationParts.push(propertyData.city)
  }
  
  // Add province with proper formatting
  if (propertyData.province) {
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
    
    const fullProvinceName = provinceMap[propertyData.province] || propertyData.province
    locationParts.push(fullProvinceName)
  }
  
  // Add area code if available
  if (propertyData.areaCode) {
    locationParts.push(propertyData.areaCode)
  }
  
  return locationParts.join(', ')
}

function generateDynamicNextSteps(report: CMAReport): Array<{icon: string, title: string, description: string}> {
  const steps = []
  
  // Always include property viewing
  steps.push({
    icon: '👁️',
    title: 'Property Viewing',
    description: 'Schedule a viewing to assess condition, layout, and verify all property details firsthand'
  })
  
  // Legal due diligence - always important
  steps.push({
    icon: '⚖️',
    title: 'Legal Due Diligence',
    description: 'Consult with a local property solicitor for legal checks and documentation review'
  })
  
  // Professional survey - especially important for older properties or those needing work
  if (report.propertyData.condition === 'needs work' || report.propertyData.condition === 'renovation project' || report.propertyData.condition === 'rebuild') {
    steps.push({
      icon: '🔧',
      title: 'Detailed Survey Required',
      description: `This ${report.propertyData.condition} property requires a comprehensive structural survey to assess renovation costs and feasibility`
    })
  } else {
    steps.push({
      icon: '📋',
      title: 'Professional Survey',
      description: 'Obtain a professional property survey and independent valuation assessment'
    })
  }
  
  // Financing - especially important for high-value properties
  if (report.propertyData.price && report.propertyData.price > 500000) {
    steps.push({
      icon: '💰',
      title: 'High-Value Financing',
      description: 'Research specialised mortgage options for properties over €500k and obtain pre-approval'
    })
  } else {
    steps.push({
      icon: '💰',
      title: 'Financing Options',
      description: 'Research mortgage options and obtain pre-approval for financing'
    })
  }
  
  // Cost analysis - include specific costs based on property type
  const costDetails = []
  if (report.propertyData.propertyType.toLowerCase().includes('apartment')) {
    costDetails.push('community fees')
  }
  if (report.propertyData.propertyType.toLowerCase().includes('villa') || report.propertyData.propertyType.toLowerCase().includes('house')) {
    costDetails.push('maintenance costs')
  }
  costDetails.push('taxes', 'insurance')
  
  steps.push({
    icon: '📊',
    title: 'Cost Analysis',
    description: `Review all additional costs including ${costDetails.join(', ')} and ongoing expenses`
  })
  
  // Rental potential - if good rental area or property type
  if (report.walkabilityData && (report.walkabilityData.walkingScore > 60 || report.walkabilityData.transitScore > 60)) {
    steps.push({
      icon: '🏠',
      title: 'Rental Investment',
      description: `High walkability (${report.walkabilityData.walkingScore}/100) makes this ideal for rental investment - calculate expected yields`
    })
  } else if (report.propertyData.propertyType.toLowerCase().includes('apartment')) {
    steps.push({
      icon: '🏠',
      title: 'Rental Potential',
      description: 'Consider rental potential and calculate expected yield returns for this apartment'
    })
  }
  
  // Market timing - based on market trends
  if (report.marketTrends && report.marketTrends.marketTrend === 'up') {
    steps.push({
      icon: '📈',
      title: 'Act Quickly',
      description: 'Market shows upward momentum - consider acting quickly to secure this property before prices increase further'
    })
  } else if (report.marketTrends && report.marketTrends.marketTrend === 'down') {
    steps.push({
      icon: '⏰',
      title: 'Strategic Timing',
      description: 'Market shows downward trend - use this to negotiate better terms while prices are favourable'
    })
  }
  
  // Development impact - if there are future developments
  if (report.futureDevelopment && report.futureDevelopment.length > 0) {
    const positiveDevelopments = report.futureDevelopment.filter(d => d.impact === 'positive').length
    const negativeDevelopments = report.futureDevelopment.filter(d => d.impact === 'negative').length
    
    if (positiveDevelopments > negativeDevelopments) {
      steps.push({
        icon: '🏗️',
        title: 'Development Opportunity',
        description: `${positiveDevelopments} positive developments planned - this could enhance property value and rental potential`
      })
    } else if (negativeDevelopments > 0) {
      steps.push({
        icon: '⚠️',
        title: 'Development Risk',
        description: `${negativeDevelopments} developments may impact property value - investigate potential effects`
      })
    }
  }
  
  // Negotiation strategy - based on valuation vs asking price
  if (report.valuationEstimate && report.propertyData.price) {
    const valuationMid = (report.valuationEstimate.low + report.valuationEstimate.high) / 2
    const priceDifference = ((valuationMid - report.propertyData.price) / report.propertyData.price) * 100
    
    if (priceDifference > 10) {
      steps.push({
        icon: '🤝',
        title: 'Strong Negotiation Position',
        description: `Valuation suggests property is overpriced by ~${Math.abs(priceDifference).toFixed(1)}% - negotiate for better terms`
      })
    } else if (priceDifference < -10) {
      steps.push({
        icon: '💎',
        title: 'Competitive Pricing',
        description: `Property appears well-priced - consider acting quickly as it may attract multiple offers`
      })
    } else {
      steps.push({
        icon: '🤝',
        title: 'Fair Market Value',
        description: 'Property is priced close to market value - negotiate based on condition and specific features'
      })
    }
  } else {
    steps.push({
      icon: '🤝',
      title: 'Negotiation Strategy',
      description: 'Negotiate based on market analysis, property condition, and survey results'
    })
  }
  
  return steps
}

function generateBuyerPDFHTML(report: CMAReport, logoBase64: string, format?: string): string {
  // Use mobile format if specified
  if (format === 'mobile') {
    return generateMobileBuyerPDFHTML(report, logoBase64)
  }
  
  return generatePrintableBuyerPDFHTML(report, logoBase64)
}

function generatePrintableBuyerPDFHTML(report: CMAReport, logoBase64: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Buyer Investment Report - ${report.propertyData.address}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.3;
      color: #1f2937;
      background: white;
      font-size: 10px;
    }
    
    .container {
      max-width: 100%;
      margin: 0 auto;
      padding: 8px;
    }
    
    .header {
      background: linear-gradient(135deg, #00ae9a 0%, #009688 100%);
      color: white;
      padding: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      border-radius: 6px;
    }
    
    .header-left h1 {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .header-left p {
      font-size: 10px;
      opacity: 0.9;
    }
    
    .logo {
      width: 40px;
      height: 40px;
      border-radius: 6px;
      background: transparent;
      padding: 0;
    }
    
    .executive-summary {
      background: white;
      color: #1f2937;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-top: 8px;
    }
    
    .summary-stat {
      text-align: center;
      background: #f9fafb;
      border-radius: 4px;
      padding: 6px;
      border: 1px solid #e5e7eb;
    }
    
    .summary-stat-value {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 2px;
      color: #00ae9a;
    }
    
    .summary-stat-label {
      font-size: 8px;
      color: #6b7280;
    }
    
    .section-card {
      background: white;
      border-radius: 6px;
      padding: 8px;
      margin-bottom: 8px;
      border: 1px solid #e5e7eb;
      page-break-inside: avoid;
    }
    
    .section-header {
      display: flex;
      align-items: center;
      margin-bottom: 6px;
    }
    
    .section-icon {
      width: 20px;
      height: 20px;
      background: #00ae9a;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 6px;
      color: white;
      font-size: 10px;
    }
    
    .section-title {
      font-size: 12px;
      font-weight: bold;
      color: #1f2937;
    }
    
    .property-highlights {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .highlight-card {
      background: #f9fafb;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    
    .highlight-label {
      color: #6b7280;
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 500;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    
    .highlight-value {
      color: #1f2937;
      font-size: 16px;
      font-weight: 600;
    }
    
    .investment-analysis {
      background: linear-gradient(135deg, #00ae9a 0%, #43e8d8 100%);
      color: #1f2937;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    }
    
    .investment-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 8px;
    }
    
    .investment-stat {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      padding: 8px;
      text-align: center;
    }
    
    .investment-stat-value {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 2px;
    }
    
    .investment-stat-label {
      font-size: 12px;
      opacity: 0.9;
    }
    
    .comparables-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 0;
      page-break-inside: avoid;
      align-content: start;
    }
    
    /* Ensure comparable properties section fits on one page */
    .comparable-properties-page {
      page-break-before: always;
      page-break-inside: avoid;
      break-inside: avoid;
      break-before: page;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    .comparable-card {
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      font-size: 10px;
      margin-bottom: 0;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s ease;
    }
    
    .comparable-card:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }
    
    .comparable-image {
      width: 100%;
      height: 120px;
      overflow: hidden;
      position: relative;
    }
    
    .comparable-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 12px 12px 0 0;
    }
    
    /* Image collage layout for comparable properties */
    .image-collage {
      display: grid;
      grid-template-columns: 2fr 1fr;
      grid-template-rows: 1fr 1fr;
      width: 100%;
      height: 100%;
      gap: 2px;
      overflow: hidden;
    }
    
    .main-image {
      grid-row: 1 / 3;
      width: 100%;
      height: 100%;
      overflow: hidden;
      position: relative;
    }
    
    .main-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      border-radius: 12px 0 0 0;
      display: block;
    }
    
    .thumbnail-images {
      width: 100%;
      height: 100%;
      display: contents;
    }
    
    .thumbnail-images img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
    }
    
    .thumbnail-images img:first-child {
      grid-row: 1 / 2;
      border-radius: 0 12px 0 0;
    }
    
    .thumbnail-images img:last-child {
      grid-row: 2 / 3;
      border-radius: 0 0 12px 0;
    }
    
    .placeholder {
      flex: 1;
      background: #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
      font-size: 8px;
    }
    
    /* Additional safeguards for image handling */
    .image-collage img {
      max-width: 100%;
      max-height: 100%;
      min-width: 0;
      min-height: 0;
    }
    
    .main-image img,
    .thumbnail-images img {
      vertical-align: top;
    }
    

    
    .comparable-content {
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .comparable-header {
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 3px;
      font-size: 11px;
      line-height: 1.2;
    }
    
    .comparable-type {
      color: #6b7280;
      font-size: 9px;
      margin-bottom: 4px;
    }
    
    .comparable-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px;
      font-size: 9px;
    }
    
    .comparable-detail {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .comparable-detail .label {
      color: #6b7280;
    }
    
    .comparable-detail .value {
      font-weight: 600;
      color: #1f2937;
    }
    
    .price-highlight {
      color: #00ae9a;
      font-size: 11px;
    }
    
    .next-steps {
      background: #f8fafc;
      color: #1f2937;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      border: 1px solid #e5e7eb;
      box-shadow: 0 1px 3px -1px rgba(0, 0, 0, 0.1);
    }
    
    .steps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 8px;
      margin-top: 12px;
    }
    
    .step-card {
      background: white;
      border-radius: 6px;
      padding: 10px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      border: 1px solid #e5e7eb;
      transition: all 0.3s ease;
    }
    
    .step-card:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: translateY(-2px);
    }
    
    .step-icon {
      font-size: 18px;
      min-width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #00ae9a;
      border-radius: 6px;
      flex-shrink: 0;
      color: white;
    }
    
    .step-content {
      flex: 1;
    }
    
    .step-title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 4px;
      color: #1f2937;
    }
    
    .step-description {
      font-size: 11px;
      line-height: 1.3;
      color: #6b7280;
      margin: 0;
    }
    
    .footer {
      text-align: center;
      padding: 12px;
      color: #6b7280;
      font-size: 12px;
      border-top: 1px solid #e5e7eb;
      margin-top: 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    @media print {
      body {
        background: white !important;
      }
      
      .section-card, .executive-summary, .investment-analysis, .next-steps {
        box-shadow: none !important;
        border: 1px solid #e5e7eb !important;
      }
    }
    
    .image-gallery-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 1000;
      justify-content: center;
      align-items: center;
    }
    
    .gallery-content {
      position: relative;
      max-width: 90%;
      max-height: 90%;
      text-align: center;
    }
    
    .gallery-image {
      max-width: 100%;
      max-height: 80vh;
      object-fit: contain;
      border-radius: 8px;
    }
    
    .gallery-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: none;
      padding: 12px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
      transition: background 0.3s;
    }
    
    .gallery-nav:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    
    .gallery-nav.prev {
      left: 20px;
    }
    
    .gallery-nav.next {
      right: 20px;
    }
    
    .gallery-close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    
    .gallery-counter {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
    }
  </style>
  
  <script>
    // Property images array
    const propertyImages = ${JSON.stringify(report.propertyData.images || [])};
    let currentImageIndex = 0;
    
    function openImageGallery(startIndex = 0) {
      if (propertyImages.length === 0) return;
      
      currentImageIndex = startIndex;
      const modal = document.getElementById('image-gallery-modal');
      const image = document.getElementById('gallery-current-image');
      const counter = document.getElementById('gallery-counter');
      
      if (modal && image && counter) {
        image.src = propertyImages[currentImageIndex];
        counter.textContent = \`\${currentImageIndex + 1} / \${propertyImages.length}\`;
        modal.style.display = 'flex';
      }
    }
    
    function closeImageGallery() {
      const modal = document.getElementById('image-gallery-modal');
      if (modal) {
        modal.style.display = 'none';
      }
    }
    
    function nextImage() {
      if (propertyImages.length === 0) return;
      currentImageIndex = (currentImageIndex + 1) % propertyImages.length;
      updateGalleryImage();
    }
    
    function prevImage() {
      if (propertyImages.length === 0) return;
      currentImageIndex = (currentImageIndex - 1 + propertyImages.length) % propertyImages.length;
      updateGalleryImage();
    }
    
    function updateGalleryImage() {
      const image = document.getElementById('gallery-current-image');
      const counter = document.getElementById('gallery-counter');
      
      if (image && counter) {
        image.src = propertyImages[currentImageIndex];
        counter.textContent = \`\${currentImageIndex + 1} / \${propertyImages.length}\`;
      }
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
      const modal = document.getElementById('image-gallery-modal');
      if (modal && modal.style.display === 'flex') {
        if (e.key === 'Escape') {
          closeImageGallery();
        } else if (e.key === 'ArrowRight') {
          nextImage();
        } else if (e.key === 'ArrowLeft') {
          prevImage();
        }
      }
    });
    
    // Close modal when clicking outside
    document.addEventListener('click', function(e) {
      const modal = document.getElementById('image-gallery-modal');
      if (modal && e.target === modal) {
        closeImageGallery();
      }
    });
  </script>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1>Buyer Investment Report</h1>
        <p>Generated on ${formatDate(report.reportDate)}</p>
      </div>
      <img src="data:image/png;base64,${logoBase64}" alt="PropertyList Logo" class="logo">
    </div>
    
    <!-- Property Details -->
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">🏠</div>
        <h2 class="section-title">Property Details</h2>
      </div>
      
            <!-- Location -->
      <div style="margin-bottom: 8px;">
        <h3 style="font-size: 12px; font-weight: 600; color: #1f2937; margin-bottom: 2px;">📍 <a href="https://maps.google.com/?q=${encodeURIComponent(report.propertyData.address)}" target="_blank" style="color: #00ae9a; text-decoration: none;">${formatComparableAddress(report.propertyData.address)}</a></h3>
        <p style="color: #6b7280; font-size: 10px; margin-bottom: 0;">${formatLocation(report.propertyData)}</p>
      </div>
      
      <!-- Reference and Price - positioned above property details box -->
      ${report.propertyData.price ? `
      <div style="position: relative; margin-bottom: 8px;">
        <!-- Reference - top right corner, bigger -->
        ${report.propertyData.refNumber ? `
        <div style="position: absolute; top: 0; right: 0; font-size: 12px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Ref: ${report.propertyData.refNumber}</div>
        ` : ''}
        
        <!-- Price - centered below reference -->
        <div style="text-align: center; margin-top: ${report.propertyData.refNumber ? '20px' : '0px'};">
          <div style="font-size: 9px; color: #6b7280; text-transform: uppercase; font-weight: 500; letter-spacing: 0.5px; margin-bottom: 1px;">Asking Price</div>
          <div style="font-size: 16px; color: #00ae9a; font-weight: bold;">${formatPrice(report.propertyData.price)}</div>
        </div>
      </div>
      ` : ''}
      
      <!-- Enhanced Property Details Section -->
      <div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        
        <!-- Main Content Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0;">
          
          <!-- Left Column: Property Image -->
          <div style="padding: 16px; border-right: 1px solid #f3f4f6;">
        ${report.propertyData.images && report.propertyData.images.length > 0 ? `
            <div style="position: relative; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <img 
            src="${report.propertyData.images[0]}" 
            alt="Main property image"
                style="width: 100%; height: 180px; object-fit: cover;"
          />
          ${report.propertyData.images.length > 1 ? `
              <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.8); color: white; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: 500;">
                📸 ${report.propertyData.images.length} photos
          </div>
          ` : ''}
        </div>
            ` : `
            <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); height: 180px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed #d1d5db;">
              <span style="font-size: 24px; color: #9ca3af; margin-bottom: 8px;">📷</span>
              <div style="color: #6b7280; font-size: 11px; font-weight: 500;">No image available</div>
            </div>
            `}
      </div>
      
          <!-- Right Column: Property Information -->
          <div style="padding: 16px;">
            
            <!-- Property Attributes Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              <div style="background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
                <div style="color: #64748b; font-size: 8px; font-weight: 600; text-transform: uppercase; margin-bottom: 2px;">Type</div>
                <div style="font-weight: 700; color: #1e293b; font-size: 10px;">${report.propertyData.propertyType}</div>
          </div>
              <div style="background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
                <div style="color: #64748b; font-size: 8px; font-weight: 600; text-transform: uppercase; margin-bottom: 2px;">Build Area</div>
                <div style="font-weight: 700; color: #1e293b; font-size: 10px;">${report.propertyData.buildArea ? report.propertyData.buildArea.toLocaleString() + ' m²' : 'N/A'}</div>
          </div>
              <div style="background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
                <div style="color: #64748b; font-size: 8px; font-weight: 600; text-transform: uppercase; margin-bottom: 2px;">Bedrooms</div>
                <div style="font-weight: 700; color: #1e293b; font-size: 10px;">${report.propertyData.bedrooms} bed</div>
          </div>
              <div style="background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
                <div style="color: #64748b; font-size: 8px; font-weight: 600; text-transform: uppercase; margin-bottom: 2px;">Bathrooms</div>
                <div style="font-weight: 700; color: #1e293b; font-size: 10px;">${report.propertyData.bathrooms} bath</div>
          </div>
            </div>
            
          </div>
        </div>
      </div>
      
      ${report.propertyData.features && report.propertyData.features.length > 0 ? `
      <div style="margin-top: 12px;">
        <h4 style="font-size: 11px; font-weight: 600; color: #1f2937; margin-bottom: 6px;">Key Features:</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
          ${report.propertyData.features.slice(0, 6).map(feature => `
          <span style="background: white; color: #374151; padding: 2px 6px; border-radius: 10px; font-size: 9px; border: 1px solid #e5e7eb;">${feature}</span>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>
    
    <!-- Property Condition Assessment -->
    ${report.propertyData.condition ? `
    <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; margin-bottom: 12px;">
      <h4 style="font-size: 11px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">🏠 Property Condition Assessment</h4>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="display: flex; gap: 8px; margin-bottom: 4px;">
            <span style="background: ${report.propertyData.condition === 'excellent' ? '#d1fae5' : report.propertyData.condition === 'good' ? '#d1fae5' : report.propertyData.condition === 'fair' ? '#fef3c7' : '#fee2e2'}; color: ${report.propertyData.condition === 'excellent' ? '#065f46' : report.propertyData.condition === 'good' ? '#065f46' : report.propertyData.condition === 'fair' ? '#92400e' : '#991b1b'}; padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: 500;">${report.propertyData.condition.charAt(0).toUpperCase() + report.propertyData.condition.slice(1)}</span>
            ${report.propertyData.architecturalStyle ? `<span style="background: #f3f4f6; color: #374151; padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: 500;">${report.propertyData.architecturalStyle}</span>` : ''}
          </div>
          <div style="font-size: 9px; color: #6b7280;">
            ${report.propertyData.yearBuilt ? 
              `Built in ${report.propertyData.yearBuilt} (${new Date().getFullYear() - report.propertyData.yearBuilt} years old)` :
              'Year built not specified'
            }
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 8px; color: #6b7280; margin-bottom: 2px;">Condition Impact</div>
          <div style="font-size: 12px; font-weight: bold; color: #00ae9a;">
            ${(() => {
              const conditionImpacts = {
                'excellent': '+15%',
                'good': '+5%',
                'fair': '0%',
                'needs work': '-10%',
                'renovation project': '-15%',
                'rebuild': '-20%'
              }
              return conditionImpacts[report.propertyData.condition] || '0%'
            })()}
          </div>
        </div>
      </div>
    </div>
    ` : ''}
    
    <!-- Executive Summary -->
    <div class="executive-summary">
      <div class="section-header">
        <div class="section-icon">📊</div>
        <h2 class="section-title">Executive Summary</h2>
      </div>
      
      <!-- Investment Overview -->
      <div style="margin-bottom: 16px;">
        <p style="font-size: 14px; line-height: 1.6; color: #1f2937; margin-bottom: 12px;">
          ${report.summary?.overview || `This comprehensive buyer analysis evaluates <strong>${report.propertyData.address}</strong> as a ${report.propertyData.propertyType.toLowerCase()} investment opportunity in ${(() => {
            // Build location string with proper hierarchy: urbanization/street first, then suburb, then city, then province
            const locationParts = []
            
            // Add urbanization if available (most specific)
            if (report.propertyData.urbanization) {
              locationParts.push(report.propertyData.urbanization)
            }
            
            // Add street if available (also very specific)
            if (report.propertyData.streetName) {
              locationParts.push(report.propertyData.streetName)
            }
            
            // Add suburb/area if available
            if (report.propertyData.suburb) {
              locationParts.push(report.propertyData.suburb)
            }
            
            // Add city
            if (report.propertyData.city) {
              locationParts.push(report.propertyData.city)
            }
            
            // Add province at the end
            if (report.propertyData.province) {
              locationParts.push(report.propertyData.province)
            }
            
            return locationParts.join(', ')
          })()}. The property presents ${(() => {
            const percentageDiff = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
            if (percentageDiff > 10) return 'a potential negotiation opportunity'
            if (percentageDiff < -10) return 'exceptional value'
            return 'fair market value'
          })()} with strong fundamentals for long-term appreciation.`}
        </p>
      </div>
      
      <!-- Key Investment Metrics -->
      <div class="summary-grid" style="margin-bottom: 16px;">
        <div class="summary-stat">
          <div class="summary-stat-value">${formatPrice(report.propertyData.price)}</div>
          <div class="summary-stat-label">Asking Price</div>
          ${(() => {
            const percentageDiff = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
            const sign = percentageDiff > 0 ? '+' : ''
            const color = percentageDiff > 0 ? '#dc2626' : percentageDiff < 0 ? '#059669' : '#6b7280'
            return `<div style="font-size: 10px; color: ${color}; font-weight: 500; margin-top: 2px;">${sign}${percentageDiff.toFixed(1)}% vs market</div>`
          })()}
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${formatPrice(report.valuationEstimate.estimated)}</div>
          <div class="summary-stat-label">Market Value</div>
          <div style="font-size: 10px; color: #6b7280; font-weight: 500; margin-top: 2px;">${report.valuationEstimate.confidence}% confidence</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${report.propertyData.buildArea ? report.propertyData.buildArea.toLocaleString() + ' m²' : 'N/A'}</div>
          <div class="summary-stat-label">Build Area</div>
          ${report.propertyData.terraceAreaM2 && report.propertyData.terraceAreaM2 > 0 ? `<div style="font-size: 10px; color: #6b7280; font-weight: 500; margin-top: 2px;">+${report.propertyData.terraceAreaM2} m² terrace</div>` : ''}
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${report.propertyData.price && report.propertyData.buildArea ? formatPrice(Math.round(report.propertyData.price / report.propertyData.buildArea)) : 'N/A'}</div>
          <div class="summary-stat-label">Price/m²</div>
          ${report.marketTrends?.averagePricePerM2 ? `<div style="font-size: 10px; color: #6b7280; font-weight: 500; margin-top: 2px;">vs ${formatPrice(report.marketTrends.averagePricePerM2)} avg</div>` : ''}
        </div>
      </div>
      
      <!-- Investment Highlights -->
      <div style="margin-bottom: 16px;">
        <h3 style="font-size: 13px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">Investment Highlights</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div style="background: #f9fafb; padding: 8px; border-radius: 6px; border: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 14px; margin-right: 6px;">💰</span>
              <span style="font-size: 11px; font-weight: 600; color: #1f2937;">Price Position</span>
            </div>
            <div style="font-size: 10px; color: #374151; line-height: 1.3;">
              ${(() => {
                const percentageDiff = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
                if (percentageDiff > 10) {
                  return `Property is ${percentageDiff.toFixed(1)}% above market value. Consider negotiating for a 5-10% reduction.`
                } else if (percentageDiff < -10) {
                  return `Excellent opportunity! Property is ${Math.abs(percentageDiff).toFixed(1)}% below market value. Strong buying potential.`
                } else {
                  return 'Property is fairly priced relative to market value. Standard market conditions.'
                }
              })()}
            </div>
          </div>
          
          <div style="background: #f9fafb; padding: 8px; border-radius: 6px; border: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 14px; margin-right: 6px;">📈</span>
              <span style="font-size: 11px; font-weight: 600; color: #1f2937;">Market Trends</span>
            </div>
            <div style="font-size: 10px; color: #374151; line-height: 1.3;">
              ${(() => {
                              if (report.marketTrends?.marketTrend === 'up') {
                return `Strong upward trend with ${(report.marketTrends?.priceChange6Month || 0) > 0 ? '+' : ''}${report.marketTrends?.priceChange6Month || 0}% 6-month growth. Excellent timing.`
              } else if (report.marketTrends?.marketTrend === 'down') {
                return `Market showing ${Math.abs(report.marketTrends?.priceChange6Month || 0)}% decline. Consider waiting or negotiate aggressively.`
              } else {
                return `Stable market with ${(report.marketTrends?.priceChange6Month || 0) > 0 ? '+' : ''}${report.marketTrends?.priceChange6Month || 0}% 6-month change. Predictable environment.`
              }
              })()}
            </div>
          </div>
          
          <div style="background: #f9fafb; padding: 8px; border-radius: 6px; border: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 14px; margin-right: 6px;">📍</span>
              <span style="font-size: 11px; font-weight: 600; color: #1f2937;">Location Quality</span>
            </div>
            <div style="font-size: 10px; color: #374151; line-height: 1.3;">
              ${(() => {
                const amenities = report.nearbyAmenities.length
                const walkability = report.walkabilityData?.walkingScore || report.walkabilityData?.walkScore || 0
                if (amenities > 10 && walkability > 70) {
                  return `Premium location with ${amenities} amenities and excellent walkability (${walkability}/100).`
                } else if (amenities > 5) {
                  return `Good location with ${amenities} amenities. ${walkability > 50 ? 'Moderate walkability' : 'Car-dependent'}.`
                } else {
                  return 'Limited local amenities. Consider transport requirements.'
                }
              })()}
            </div>
          </div>
          
          <div style="background: #f9fafb; padding: 8px; border-radius: 6px; border: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 14px; margin-right: 6px;">🏗️</span>
              <span style="font-size: 11px; font-weight: 600; color: #1f2937;">Property Condition</span>
            </div>
            <div style="font-size: 10px; color: #374151; line-height: 1.3;">
              ${(() => {
                if (report.propertyData.condition === 'excellent') {
                  return 'Excellent condition requiring minimal maintenance. Premium quality justified.'
                } else if (report.propertyData.condition === 'good') {
                  return 'Good condition with minor maintenance needs. Solid investment.'
                } else if (report.propertyData.condition === 'fair') {
                  return 'Fair condition may require updates. Consider renovation costs.'
                } else {
                  return 'Property needs work/renovation. Factor in improvement costs.'
                }
              })()}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Investment Recommendation -->
      <div style="margin-bottom: 16px;">
        <h3 style="font-size: 13px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">Investment Recommendation</h3>
        <div style="background: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb;">
          ${(() => {
            const percentageDiff = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
            const marketTrend = report.marketTrends.marketTrend
            
            if (percentageDiff < -15 && marketTrend === 'up') {
              return `<div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="background: #059669; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-right: 8px;">STRONG BUY</span>
                <span style="font-size: 10px; color: #6b7280;">Exceptional opportunity in rising market</span>
              </div>
              <p style="font-size: 11px; color: #374151; line-height: 1.4; margin: 0;">
                Property is significantly undervalued in a rising market. Immediate equity potential with strong appreciation outlook. Act quickly before market correction.
              </p>`
            } else if (percentageDiff < -10) {
              return `<div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="background: #059669; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-right: 8px;">BUY</span>
                <span style="font-size: 10px; color: #6b7280;">Good investment opportunity</span>
              </div>
              <p style="font-size: 11px; color: #374151; line-height: 1.4; margin: 0;">
                Good investment opportunity with below-market pricing. Strong fundamentals support long-term appreciation. Consider making an offer within 5% of asking price.
              </p>`
            } else if (percentageDiff > 15) {
              return `<div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="background: #dc2626; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-right: 8px;">AVOID</span>
                <span style="font-size: 10px; color: #6b7280;">Significantly overpriced</span>
              </div>
              <p style="font-size: 11px; color: #374151; line-height: 1.4; margin: 0;">
                Property is significantly overpriced. Consider waiting for price reduction or explore alternative properties in the area.
              </p>`
            } else if (percentageDiff > 5) {
              return `<div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="background: #d97706; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-right: 8px;">NEGOTIATE</span>
                <span style="font-size: 10px; color: #6b7280;">Slightly overpriced</span>
              </div>
              <p style="font-size: 11px; color: #374151; line-height: 1.4; margin: 0;">
                Property is slightly overpriced. Strong negotiating position - aim for 5-10% reduction to achieve fair market value.
              </p>`
            } else {
              return `<div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="background: #6b7280; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-right: 8px;">FAIR VALUE</span>
                <span style="font-size: 10px; color: #6b7280;">Fairly priced</span>
              </div>
              <p style="font-size: 11px; color: #374151; line-height: 1.4; margin: 0;">
                Property is fairly priced relative to market value. Standard market conditions - proceed with normal due diligence and consider your personal timeline.
              </p>`
            }
          })()}
        </div>
      </div>
      
      </div>
    </div>
    
    <!-- Risk Assessment -->
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">⚠️</div>
        <h2 class="section-title">Risk Assessment</h2>
      </div>
      ${(() => {
        // Calculate price difference percentage
        const priceDifference = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
        
        // Determine risk level based on overpricing and other factors
        let riskLevel = 'low'
        let riskColor = '#166534'
        let riskBackground = '#f0fdf4'
        let riskBorder = '#bbf7d0'
        let riskIcon = '✅'
        
        // Check for high overpricing (major risk factor)
        if (priceDifference > 15) {
          riskLevel = 'high'
          riskColor = '#dc2626'
          riskBackground = '#fef2f2'
          riskBorder = '#fecaca'
          riskIcon = '🚨'
        } else if (priceDifference > 10) {
          riskLevel = 'medium'
          riskColor = '#d97706'
          riskBackground = '#fffbeb'
          riskBorder = '#fed7aa'
          riskIcon = '⚠️'
        }
        
        // Additional risk factors
        const riskFactors = []
        const positiveFactors = []
        
        // Price-related risks
        if (priceDifference > 15) {
          riskFactors.push(`Severely overpriced (+${priceDifference.toFixed(1)}%)`)
        } else if (priceDifference > 10) {
          riskFactors.push(`Overpriced (+${priceDifference.toFixed(1)}%)`)
        } else if (priceDifference < -10) {
          positiveFactors.push(`Undervalued (${priceDifference.toFixed(1)}%)`)
        }
        
        // Market and property risks
        if (report.comparableProperties.length < 3) riskFactors.push('Limited comparables')
        if (report.marketTrends.marketTrend === 'down') riskFactors.push('Declining market')
        if (report.propertyData.condition === 'needs work' || report.propertyData.condition === 'renovation project') riskFactors.push('Renovation needed')
        if (report.nearbyAmenities.length < 3) riskFactors.push('Limited amenities')
        
        // Positive factors
        if (report.comparableProperties.length >= 5) positiveFactors.push('Strong comparables')
        if (report.marketTrends.inventory > 10) positiveFactors.push('Active market')
        if (report.nearbyAmenities.length > 5) positiveFactors.push('Good location')
        if (report.propertyData.condition === 'excellent' || report.propertyData.condition === 'good') positiveFactors.push('Good condition')
        
        return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <div style="background: ${riskBackground}; padding: 6px; border-radius: 4px; border: 1px solid ${riskBorder};">
            <div style="display: flex; align-items: center; margin-bottom: 2px;">
              <span style="font-size: 12px; margin-right: 4px;">${riskIcon}</span>
              <span style="font-size: 9px; font-weight: 600; color: ${riskColor}; text-transform: capitalize;">${riskLevel} Risk</span>
            </div>
            <div style="font-size: 8px; color: #374151; line-height: 1.2;">
              ${riskLevel === 'high' && priceDifference > 15 ? `Severely overpriced (+${priceDifference.toFixed(1)}%)` : 
                riskLevel === 'medium' && priceDifference > 10 ? `Overpriced (+${priceDifference.toFixed(1)}%)` :
                positiveFactors.length > 0 ? positiveFactors.join(', ') : 'Limited positive factors'}
            </div>
          </div>
          
          <div style="background: #fef3c7; padding: 6px; border-radius: 4px; border: 1px solid #fde68a;">
            <div style="display: flex; align-items: center; margin-bottom: 2px;">
              <span style="font-size: 12px; margin-right: 4px;">⚠️</span>
              <span style="font-size: 9px; font-weight: 600; color: #92400e;">Considerations</span>
            </div>
            <div style="font-size: 8px; color: #374151; line-height: 1.2;">
              ${riskFactors.length > 0 ? riskFactors.join(', ') : 'Standard considerations'}
            </div>
          </div>
        </div>
        `
      })()}
    </div>
    
    <!-- Investment Analysis & Market Position Group -->
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">💰</div>
        <h2 class="section-title">Investment Analysis & Market Position</h2>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
        <!-- Investment Analysis -->
        <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #e5e7eb;">
          <h4 style="font-size: 11px; font-weight: 600; color: #1f2937; margin-bottom: 6px;">Investment Potential</h4>
          <p style="font-size: 10px; line-height: 1.4; color: #374151; margin-bottom: 8px;">
            ${(() => {
                              const priceVsAvg = report.propertyData.price && report.marketTrends?.averagePrice ? 
                  parseFloat(((report.propertyData.price - report.marketTrends.averagePrice) / report.marketTrends.averagePrice * 100).toFixed(1)) : 0;
                      const pricePerM2VsAvg = report.propertyData.price && report.propertyData.buildArea && report.marketTrends?.averagePricePerM2 ?
        parseFloat(((report.propertyData.price / report.propertyData.buildArea - report.marketTrends.averagePricePerM2) / report.marketTrends.averagePricePerM2 * 100).toFixed(1)) : 0;
                              const marketTrend = report.marketTrends?.marketTrend || 'stable';
                              const annualGrowth = report.marketTrends?.priceChange12Month || 0;
                const daysOnMarket = report.marketTrends?.daysOnMarket || 0;
              
              let analysis = '';
              
              // Price positioning analysis
              if (Math.abs(priceVsAvg) < 5) {
                analysis += 'Priced competitively at market average. ';
              } else if (priceVsAvg < -5) {
                analysis += `Priced ${Math.abs(priceVsAvg)}% below market average - excellent value opportunity. `;
              } else {
                analysis += `Priced ${priceVsAvg}% above market average - premium positioning. `;
              }
              
              // Price per m² analysis
              if (Math.abs(pricePerM2VsAvg) < 10) {
                analysis += 'Price per m² aligns with market standards. ';
              } else if (pricePerM2VsAvg < -10) {
                analysis += `Price per m² is ${Math.abs(pricePerM2VsAvg)}% below average - strong value proposition. `;
              } else {
                analysis += `Price per m² is ${pricePerM2VsAvg}% above average - premium space efficiency. `;
              }
              
              // Market trend analysis
              if (marketTrend === 'up' && annualGrowth > 0) {
                analysis += `Market showing strong growth with ${annualGrowth}% annual appreciation. `;
              } else if (marketTrend === 'stable' && Math.abs(annualGrowth) < 3) {
                analysis += `Market is stable with moderate ${annualGrowth > 0 ? 'growth' : 'adjustment'}. `;
              } else if (marketTrend === 'down') {
                analysis += `Market experiencing correction - potential buying opportunity. `;
              }
              
              // Days on market analysis
              if (daysOnMarket < 30) {
                analysis += 'Fast-moving market with high demand. ';
              } else if (daysOnMarket < 60) {
                analysis += 'Balanced market conditions. ';
              } else {
                analysis += 'Buyer-friendly market with negotiation opportunities. ';
              }
              
              return analysis || 'Investment potential based on current market conditions and property positioning.';
            })()}
          </p>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
            <div style="background: #f9fafb; padding: 4px; border-radius: 4px; text-align: center; font-size: 9px;">
              <div style="font-weight: 600; color: #1f2937;">${formatPrice(report.marketTrends?.averagePrice || 0)}</div>
              <div style="color: #6b7280;">Avg Price</div>
            </div>
            <div style="background: #f9fafb; padding: 4px; border-radius: 4px; text-align: center; font-size: 9px;">
              <div style="font-weight: 600; color: #1f2937;">${report.marketTrends?.daysOnMarket || 0}</div>
              <div style="color: #6b7280;">Days on Market</div>
            </div>
            <div style="background: #f9fafb; padding: 4px; border-radius: 4px; text-align: center; font-size: 9px;">
                              <div style="font-weight: 600; color: #1f2937;">${formatPrice(report.marketTrends?.averagePricePerM2 || 0)}</div>
              <div style="color: #6b7280;">Avg €/m²</div>
            </div>
            <div style="background: #f9fafb; padding: 4px; border-radius: 4px; text-align: center; font-size: 9px;">
              <div style="font-weight: 600; color: #1f2937;">${(report.marketTrends?.priceChange12Month || 0) > 0 ? '+' : ''}${report.marketTrends?.priceChange12Month || 0}%</div>
              <div style="color: #6b7280;">Annual Growth</div>
            </div>
          </div>
        </div>
        
        <!-- Market Position -->
        <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #e5e7eb;">
          <h4 style="font-size: 11px; font-weight: 600; color: #1f2937; margin-bottom: 6px;">Market Position</h4>
          <p style="font-size: 10px; line-height: 1.4; color: #374151; margin-bottom: 8px;">
            ${report.summary.marketPosition}
          </p>
          
          ${report.summary.marketTiming ? `
          <div style="background: #f9fafb; padding: 6px; border-radius: 4px; border-left: 3px solid #00ae9a; margin-bottom: 6px;">
            <div style="font-size: 9px; font-weight: 600; color: #1f2937; margin-bottom: 2px;">⏰ Market Timing</div>
            <div style="font-size: 9px; color: #374151; line-height: 1.3;">${report.summary.marketTiming}</div>
          </div>
          ` : ''}
          
          ${report.summary.investmentTiming ? `
          <div style="background: #f9fafb; padding: 6px; border-radius: 4px; border-left: 3px solid #059669;">
            <div style="font-size: 9px; font-weight: 600; color: #1f2937; margin-bottom: 2px;">🎯 Investment Timing</div>
            <div style="font-size: 9px; color: #374151; line-height: 1.3;">${report.summary.investmentTiming.replace(/capitalize/gi, 'capitalise').replace(/Capitalize/gi, 'Capitalise')}</div>
          </div>
          ` : ''}
        </div>
      </div>
    </div>
    
    <!-- Valuation Group -->
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">🔮</div>
        <h2 class="section-title">Valuation</h2>
      </div>
      
      <!-- Valuation Section - Compact -->
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; margin-bottom: 8px;">
        <div style="font-size: 14px; font-weight: bold; color: #00ae9a;">${formatPrice(report.valuationEstimate.estimated)}</div>
        <div style="font-size: 9px; color: #374151;">Estimated Market Value</div>
        <div style="font-size: 8px; color: #6b7280;">Range: <span style="font-weight: 600; color: #1f2937;">${formatPrice(report.valuationEstimate.low)} - ${formatPrice(report.valuationEstimate.high)}</span></div>
        <div style="width: 100%; max-width: 150px; margin: 2px 0;">
          <div style="background: #e5e7eb; border-radius: 4px; height: 4px; overflow: hidden;">
            <div style="background: #00ae9a; height: 100%; width: ${report.valuationEstimate.confidence}%; border-radius: 4px;"></div>
          </div>
          <div style="font-size: 8px; color: #00ae9a; font-weight: 600; margin-top: 1px; text-align: right;">${report.valuationEstimate.confidence}% confidence</div>
        </div>
      </div>
      
      <!-- Compact Valuation Analysis -->
      <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #e5e7eb;">
        <h4 style="font-size: 10px; font-weight: 600; color: #1f2937; margin-bottom: 6px;">📊 Valuation Analysis</h4>
        
        <!-- Compact Methodology -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
          <div style="display: flex; align-items: start; gap: 3px;">
            <div style="width: 3px; height: 3px; background: #00ae9a; border-radius: 50%; margin-top: 2px; flex-shrink: 0;"></div>
            <div>
              <div style="font-size: 7px; font-weight: 600; color: #1f2937;">Base Value</div>
              <div style="font-size: 6px; color: #6b7280;">
                ${report.comparableProperties.length > 0 ? 
                  `${report.comparableProperties.length} comparables` :
                  'Limited data'
                }
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: start; gap: 3px;">
            <div style="width: 3px; height: 3px; background: #00ae9a; border-radius: 50%; margin-top: 2px; flex-shrink: 0;"></div>
            <div>
              <div style="font-size: 7px; font-weight: 600; color: #1f2937;">Condition</div>
              <div style="font-size: 6px; color: #6b7280;">
                ${report.propertyData.condition ? 
                  `${report.propertyData.condition}` :
                  'N/A'
                }
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: start; gap: 3px;">
            <div style="width: 3px; height: 3px; background: #00ae9a; border-radius: 50%; margin-top: 2px; flex-shrink: 0;"></div>
            <div>
              <div style="font-size: 7px; font-weight: 600; color: #1f2937;">Market Trend</div>
              <div style="font-size: 6px; color: #6b7280;">
                ${report.marketTrends?.marketTrend ? 
                  `${report.marketTrends.marketTrend} (${(report.marketTrends?.priceChange6Month || 0) > 0 ? '+' : ''}${report.marketTrends?.priceChange6Month || 0}%)` :
                  'N/A'
                }
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: start; gap: 3px;">
            <div style="width: 3px; height: 3px; background: #00ae9a; border-radius: 50%; margin-top: 2px; flex-shrink: 0;"></div>
            <div>
              <div style="font-size: 7px; font-weight: 600; color: #1f2937;">Location</div>
              <div style="font-size: 6px; color: #6b7280;">
                ${report.nearbyAmenities.length > 0 ? 
                  `${report.nearbyAmenities.length} amenities` :
                  'N/A'
                }
              </div>
            </div>
          </div>
        </div>
        
        <!-- Compact Factors -->
        <div style="border-top: 1px solid #e5e7eb; padding-top: 4px;">
          <div style="font-size: 8px; font-weight: 600; color: #1f2937; margin-bottom: 3px;">Key Factors:</div>
          ${report.valuationEstimate.adjustments.length > 0 ? `
            <div style="font-size: 7px; color: #6b7280;">
              ${report.valuationEstimate.adjustments.map(adjustment => {
                if (adjustment.factor === 'Comparable Properties') {
                  return `Comparables (${report.comparableProperties.length})`
                }
                return adjustment.factor
              }).join(' • ')}
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px;">
              <div style="text-align: center; background: #f9fafb; padding: 3px; border-radius: 3px; border: 1px solid #e5e7eb;">
                <div style="font-size: 7px; margin-bottom: 1px;">📍</div>
                <div style="font-size: 6px; font-weight: 600; color: #1f2937;">Location</div>
              </div>
              <div style="text-align: center; background: #f9fafb; padding: 3px; border-radius: 3px; border: 1px solid #e5e7eb;">
                <div style="font-size: 7px; margin-bottom: 1px;">🏗️</div>
                <div style="font-size: 6px; font-weight: 600; color: #1f2937;">Condition</div>
              </div>
              <div style="text-align: center; background: #f9fafb; padding: 3px; border-radius: 3px; border: 1px solid #e5e7eb;">
                <div style="font-size: 7px; margin-bottom: 1px;">🌟</div>
                <div style="font-size: 6px; font-weight: 600; color: #1f2937;">Features</div>
              </div>
              <div style="text-align: center; background: #f9fafb; padding: 3px; border-radius: 3px; border: 1px solid #e5e7eb;">
                <div style="font-size: 7px; margin-bottom: 1px;">📈</div>
                <div style="font-size: 6px; font-weight: 600; color: #1f2937;">Demand</div>
              </div>
            </div>
          `}
        </div>
      </div>
    </div>
    
    <!-- Compact Market Data & Trends -->
    <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #e5e7eb; margin-bottom: 12px;">
      <h4 style="font-size: 10px; font-weight: 600; color: #1f2937; margin-bottom: 6px;">📈 Market Data & Trends</h4>
      
      <!-- Market Stats Grid -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 6px;">
        <div style="text-align: center; background: #f9fafb; padding: 4px; border-radius: 4px; border: 1px solid #e5e7eb;">
          <div style="font-size: 8px; font-weight: 600; color: #1f2937; margin-bottom: 1px;">Avg Price</div>
          <div style="font-size: 7px; color: #6b7280;">${formatPrice(report.marketTrends?.averagePrice || 0)}</div>
        </div>
        <div style="text-align: center; background: #f9fafb; padding: 4px; border-radius: 4px; border: 1px solid #e5e7eb;">
          <div style="font-size: 8px; font-weight: 600; color: #1f2937; margin-bottom: 1px;">€/m²</div>
          <div style="font-size: 7px; color: #6b7280;">${formatPrice(report.marketTrends?.averagePricePerM2 || 0)}</div>
        </div>
        <div style="text-align: center; background: #f9fafb; padding: 4px; border-radius: 4px; border: 1px solid #e5e7eb;">
          <div style="font-size: 8px; font-weight: 600; color: #1f2937; margin-bottom: 1px;">Days</div>
          <div style="font-size: 7px; color: #6b7280;">${report.marketTrends?.daysOnMarket || 'N/A'}</div>
        </div>
        <div style="text-align: center; background: #f9fafb; padding: 4px; border-radius: 4px; border: 1px solid #e5e7eb;">
          <div style="font-size: 8px; font-weight: 600; color: #1f2937; margin-bottom: 1px;">12M Change</div>
          <div style="font-size: 7px; color: ${(report.marketTrends?.priceChange12Month || 0) > 0 ? '#059669' : '#dc2626'};">
            ${(report.marketTrends?.priceChange12Month || 0) > 0 ? '+' : ''}${report.marketTrends?.priceChange12Month || 0}%
          </div>
        </div>
      </div>
      
      <!-- Market Trend Summary -->
      <div style="border-top: 1px solid #e5e7eb; padding-top: 4px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <div style="font-size: 8px; font-weight: 600; color: #1f2937;">Market Trend:</div>
          <div style="display: flex; align-items: center; gap: 3px;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${report.marketTrends?.marketTrend === 'up' ? '#059669' : report.marketTrends?.marketTrend === 'down' ? '#dc2626' : '#6b7280'};"></div>
            <span style="font-size: 8px; color: #6b7280; text-transform: capitalize;">
              ${report.marketTrends?.marketTrend || 'stable'} market
            </span>
          </div>
        </div>
        ${report.marketTrends?.seasonalTrends ? `
        <div style="font-size: 7px; color: #6b7280; margin-top: 2px; font-style: italic;">
          ${report.marketTrends.seasonalTrends}
        </div>
        ` : ''}
      </div>
    </div>
    
    <!-- Location & Lifestyle Group -->
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">📍</div>
        <h2 class="section-title">Location & Lifestyle</h2>
      </div>
      
      <!-- Location & Lifestyle Section -->
      <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; margin-bottom: 12px;">
        <h4 style="font-size: 11px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">📍 Location & Lifestyle</h4>
        <p style="font-size: 10px; line-height: 1.4; color: #374151; margin-bottom: 8px;">
          ${report.summary.locationOverview}
        </p>
        
        ${report.summary.walkabilityInsights ? `
        <div style="background: #f9fafb; padding: 6px; border-radius: 4px; border-left: 3px solid #3b82f6; margin-bottom: 6px;">
          <div style="font-size: 9px; font-weight: 600; color: #1f2937; margin-bottom: 2px;">🚶 Walkability & Accessibility</div>
          <div style="font-size: 9px; color: #374151; line-height: 1.3;">${report.summary.walkabilityInsights}</div>
        </div>
        ` : ''}
        
        ${report.nearbyAmenities && report.nearbyAmenities.length > 0 ? `
        <div style="margin-top: 8px;">
          <div style="font-size: 9px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">Nearby Amenities:</div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 4px;">
            ${report.nearbyAmenities.slice(0, 6).map(amenity => `
            <div style="background: #f3f4f6; padding: 4px; border-radius: 4px; border: 1px solid #e5e7eb;">
              <div style="font-weight: 600; color: #1f2937; font-size: 8px; margin-bottom: 2px;">${amenity.name}</div>
              <div style="color: #6b7280; font-size: 8px;">${(amenity.distance * 1.60934).toFixed(1)} km</div>
            </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
      </div>
      
      <!-- Walkability & Mobility Analysis -->
      ${report.walkabilityData ? `
      <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb;">
        <h4 style="font-size: 11px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">🚶 Walkability & Mobility Analysis</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px;">
          ${report.walkabilityData.walkingScore || report.walkabilityData.walkScore ? `
          <div style="background: #f9fafb; padding: 8px; border-radius: 4px; border: 1px solid #e5e7eb;">
            <div style="font-size: 9px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">Walking Score</div>
            <div style="font-size: 14px; font-weight: bold; color: #00ae9a; margin-bottom: 2px;">${report.walkabilityData.walkingScore || report.walkabilityData.walkScore}/100</div>
            <div style="font-size: 8px; color: #6b7280;">${report.walkabilityData.walkingDescription || report.walkabilityData.walkDescription || 'Walking accessibility'}</div>
            ${report.walkabilityData.averageWalkTime ? `<div style="font-size: 8px; color: #6b7280; margin-top: 2px;">Avg: ${report.walkabilityData.averageWalkTime} min</div>` : ''}
          </div>
          ` : ''}
          
          ${report.walkabilityData.drivingScore ? `
          <div style="background: #f9fafb; padding: 8px; border-radius: 4px; border: 1px solid #e5e7eb;">
            <div style="font-size: 9px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">Driving Score</div>
            <div style="font-size: 14px; font-weight: bold; color: #00ae9a; margin-bottom: 2px;">${report.walkabilityData.drivingScore}/100</div>
            <div style="font-size: 8px; color: #6b7280;">${report.walkabilityData.drivingDescription}</div>
            ${report.walkabilityData.averageDriveTime ? `<div style="font-size: 8px; color: #6b7280; margin-top: 2px;">Avg: ${report.walkabilityData.averageDriveTime} min</div>` : ''}
          </div>
          ` : ''}
          
          ${report.walkabilityData.transitScore ? `
          <div style="background: #f9fafb; padding: 8px; border-radius: 4px; border: 1px solid #e5e7eb;">
            <div style="font-size: 9px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">Transit Score</div>
            <div style="font-size: 14px; font-weight: bold; color: #00ae9a; margin-bottom: 2px;">${report.walkabilityData.transitScore}/100</div>
            <div style="font-size: 8px; color: #6b7280;">${report.walkabilityData.transitDescription || 'Public transport'}</div>
            ${report.walkabilityData.transitAccessibleDestinations ? `<div style="font-size: 8px; color: #6b7280; margin-top: 2px;">${report.walkabilityData.transitAccessibleDestinations} destinations</div>` : ''}
          </div>
          ` : ''}
          
          ${report.walkabilityData.accessibilityScore ? `
          <div style="background: #f9fafb; padding: 8px; border-radius: 4px; border: 1px solid #e5e7eb;">
            <div style="font-size: 9px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">Overall Accessibility</div>
            <div style="font-size: 14px; font-weight: bold; color: #00ae9a; margin-bottom: 2px;">${report.walkabilityData.accessibilityScore}/100</div>
            <div style="font-size: 8px; color: #6b7280;">Combined mobility rating</div>
            ${report.walkabilityData.reachableDestinations ? `<div style="font-size: 8px; color: #6b7280; margin-top: 2px;">${report.walkabilityData.reachableDestinations} destinations</div>` : ''}
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}
    </div>
    
    <!-- Property Images Gallery - Full Page -->
    ${report.propertyData.images && report.propertyData.images.length > 0 ? `
    <div class="section-card" style="page-break-before: always; margin-bottom: 20px;">
      <div class="section-header" style="margin-bottom: 20px;">
        <div class="section-icon">📸</div>
        <h2 class="section-title">Property Images Gallery</h2>
        <div style="font-size: 10px; color: #6b7280; margin-top: 4px; font-style: italic;">
          Complete visual overview of the property
        </div>
      </div>
      
      <p style="margin-bottom: 20px; color: #6b7280; font-size: 13px; line-height: 1.5;">
        Below are all available images of the property, providing a comprehensive visual assessment of the condition, layout, and features. These images help buyers understand the property's current state and potential.
      </p>
      
      <div class="full-page-image-gallery" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
        ${report.propertyData.images.map((image, index) => `
        <div class="gallery-item" style="text-align: center;">
          <img src="${image}" alt="Property image ${index + 1}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />
          <div style="font-size: 11px; color: #6b7280; margin-top: 6px; font-weight: 500;">Image ${index + 1}</div>
        </div>
        `).join('')}
      </div>
      
      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; margin-top: 20px;">
        <div style="font-size: 12px; color: #6b7280; line-height: 1.4;">
          <strong>Image Analysis:</strong> The property features ${report.propertyData.images.length} high-quality images showcasing ${report.propertyData.bedrooms} bedrooms, ${report.propertyData.bathrooms} bathrooms, and ${report.propertyData.buildArea ? `${report.propertyData.buildArea} m²` : 'various'} of living space. The images provide a comprehensive view of the property's condition and layout.
        </div>
      </div>
    </div>
    ` : ''}
    
    <!-- Comparable Properties - Dedicated Page -->
    <div class="section-card comparable-properties-page">
      <div class="section-header" style="margin-bottom: 20px;">
        <div class="section-icon">🏘️</div>
        <h2 class="section-title">Comparable Properties Analysis</h2>
      </div>
      
      <p style="margin-bottom: 20px; color: #6b7280; font-size: 13px; line-height: 1.5;">
        Recent sales in the area provide valuable insights into current market values and trends. Each comparable property has been carefully selected based on location, size, and characteristics similar to the subject property.
      </p>
      
      <div class="comparables-grid" style="flex: 1;">
        ${report.comparableProperties.slice(0, 12).map(comp => `
        <div class="comparable-card">
          ${comp.images && comp.images.length > 0 ? `
          <div class="comparable-image">
            <div class="image-collage">
              <!-- Large image on the left -->
              <div class="main-image">
                <img src="${comp.images[0]}" alt="Property image" loading="lazy" />
              </div>
              <!-- 2 smaller images on the right -->
              <div class="thumbnail-images">
                ${comp.images.length > 1 ? `<img src="${comp.images[1]}" alt="Property image 2" loading="lazy" />` : '<div class="placeholder"></div>'}
                ${comp.images.length > 2 ? `<img src="${comp.images[2]}" alt="Property image 3" loading="lazy" />` : '<div class="placeholder"></div>'}
              </div>
            </div>
          </div>
          ` : ''}
          <div class="comparable-content">
            <div class="comparable-header">${formatComparableAddress(comp.address)}</div>
            <div class="comparable-type">${comp.propertyType}</div>
            <div class="comparable-details">
              <div class="comparable-detail">
                <span class="label">Price:</span>
                <span class="value price-highlight">${formatPrice(comp.price)}</span>
              </div>
              <div class="comparable-detail">
                <span class="label">Beds/Baths:</span>
                <span class="value" style="text-align: right;">${comp.bedrooms}🛏️ ${comp.bathrooms}🚿</span>
              </div>
              ${comp.buildArea && comp.buildArea > 0 ? `
              <div class="comparable-detail">
                <span class="label">Build:</span>
                <span class="value">${comp.buildArea.toLocaleString()} m²</span>
              </div>` : ''}
              ${comp.terraceArea && comp.terraceArea > 0 ? `
              <div class="comparable-detail">
                <span class="label">Terrace:</span>
                <span class="value">${comp.terraceArea.toLocaleString()} m²</span>
              </div>` : ''}
              ${comp.plotArea && comp.plotArea > 0 ? `
              <div class="comparable-detail">
                <span class="label">Plot:</span>
                <span class="value">${comp.plotArea.toLocaleString()} m²</span>
              </div>` : ''}
            </div>
            ${comp.refNumber ? `
            <div style="font-size: 8px; color: #6b7280; margin-top: 4px; font-weight: 500; text-align: right;">Ref: ${comp.refNumber}</div>
            ` : ''}
          </div>
        </div>
        `).join('')}
      </div>
    </div>
    
    <!-- Future Developments -->
    ${report.futureDevelopment && report.futureDevelopment.length > 0 ? `
    <div class="section-card" style="margin-bottom: 20px;">
      <div class="section-header">
        <div class="section-icon">🚧</div>
        <h2 class="section-title">Future Developments</h2>
      </div>
      
      <p style="margin-bottom: 20px; color: #6b7280;">
        Planned developments in the area may impact property values and lifestyle amenities.
      </p>
      
      ${report.futureDevelopment.slice(0, 3).map(dev => `
      <div style="background: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <div style="font-weight: 600; color: #1f2937;">${dev.project}</div>
          <span style="background: ${dev.impact === 'positive' ? '#d1fae5' : dev.impact === 'neutral' ? '#f3f4f6' : '#fee2e2'}; color: ${dev.impact === 'positive' ? '#065f46' : dev.impact === 'neutral' ? '#374151' : '#991b1b'}; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 500;">${dev.impact}</span>
        </div>
        <div style="color: #6b7280; margin-bottom: 12px;">${dev.description}</div>
        <div style="display: flex; justify-content: space-between; color: #6b7280; font-size: 10px;">
          <span>Type: ${dev.type}</span>
          <span>ETA: ${formatDate(dev.completionDate)}</span>
        </div>
      </div>
      `).join('')}
    </div>
    ` : ''}
    
    <!-- Next Steps -->
    <div class="next-steps" style="margin-bottom: 20px;">
      <div class="section-header">
        <div class="section-icon">🎯</div>
        <h2 class="section-title">Next Steps for Buyers</h2>
      </div>
      
      <p style="margin-bottom: 8px; font-size: 12px; line-height: 1.4; color: #6b7280;">
        Based on this analysis, here are the recommended next steps:
      </p>
      
      <div class="steps-grid">
        ${generateDynamicNextSteps(report).map(step => `
        <div class="step-card">
          <div class="step-icon">${step.icon}</div>
          <div class="step-content">
            <h3 class="step-title">${step.title}</h3>
            <p class="step-description">${step.description}</p>
          </div>
        </div>
        `).join('')}
      </div>
    </div>
    

    
    <!-- Footer -->
    <div class="footer">
      <p>This buyer investment report was generated by PropertyList Research Agent on ${formatDate(report.reportDate)}</p>
      <p>© ${new Date().getFullYear()} PropertyList.es All rights reserved.</p>
    </div>
    
    <!-- Image Gallery Modal -->
    ${report.propertyData.images && report.propertyData.images.length > 0 ? `
    <div id="image-gallery-modal" class="image-gallery-modal">
      <div class="gallery-content">
        <button class="gallery-close" onclick="closeImageGallery()">✕</button>
        <img id="gallery-current-image" class="gallery-image" alt="Property image" />
        ${report.propertyData.images.length > 1 ? `
        <button class="gallery-nav prev" onclick="prevImage()">‹</button>
        <button class="gallery-nav next" onclick="nextImage()">›</button>
        <div id="gallery-counter" class="gallery-counter">1 / ${report.propertyData.images.length}</div>
        ` : ''}
      </div>
    </div>
    ` : ''}
  </div>
</body>
</html>
  `
}

function generateMobileBuyerPDFHTML(report: CMAReport, logoBase64: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mobile Buyer Report - ${report.propertyData.address}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.4;
      color: #1f2937;
      background: #f8fafc;
      font-size: 16px;
    }
    
    .container {
      max-width: 100%;
      margin: 0 auto;
      padding: 0;
    }
    
    .header {
      background: linear-gradient(135deg, #00ae9a 0%, #009688 100%);
      color: white;
      padding: 20px;
      text-align: center;
      margin-bottom: 20px;
    }
    
    .header h1 {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .header p {
      font-size: 14px;
      opacity: 0.9;
    }
    
    .logo {
      width: 60px;
      height: 60px;
      border-radius: 8px;
      background: transparent;
      padding: 0;
      margin: 0 auto 12px;
      display: block;
    }
    
    .executive-summary {
      background: linear-gradient(135deg, #00ae9a 0%, #009688 100%);
      color: white;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 12px;
    }
    
    .summary-stat {
      text-align: center;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 10px;
    }
    
    .summary-stat-value {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .summary-stat-label {
      font-size: 12px;
      opacity: 0.9;
    }
    
    .section-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
      page-break-inside: avoid;
    }
    
    .section-header {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
    }
    
    .section-icon {
      width: 40px;
      height: 40px;
      background: #00ae9a;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
      color: white;
      font-size: 20px;
    }
    
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #1f2937;
    }
    
    .property-images {
      margin-bottom: 20px;
    }
    
    .main-image {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border-radius: 12px;
      margin-bottom: 12px;
      cursor: pointer;
      transition: transform 0.2s;
    }
    
    .main-image:hover {
      transform: scale(1.02);
    }
    
    .image-thumbnails {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    
    .thumbnail {
      width: 100%;
      height: 60px;
      object-fit: cover;
      border-radius: 8px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    
    .thumbnail:hover {
      opacity: 0.8;
    }
    
    .property-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .stat-card {
      background: #f9fafb;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      text-align: center;
    }
    
    .stat-label {
      color: #6b7280;
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 500;
      letter-spacing: 0.5px;
    }
    
    .stat-value {
      color: #1f2937;
      font-size: 14px;
      font-weight: 600;
      margin-top: 4px;
    }
    
    .market-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .market-stat {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      text-align: center;
    }
    
    .market-stat-value {
      font-size: 20px;
      font-weight: bold;
      color: #00ae9a;
      margin-bottom: 4px;
    }
    
    .market-stat-label {
      font-size: 12px;
      color: #6b7280;
    }
    
    .comparable-item {
      background: #f9fafb;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
      border: 1px solid #e5e7eb;
    }
    
    /* Mobility Analysis Styles */
    .mobility-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
    }
    
    .mobility-card {
      background: #f9fafb;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      text-align: center;
    }
    
    .mobility-score {
      font-size: 18px;
      font-weight: bold;
      color: #00ae9a;
      margin-bottom: 4px;
    }
    
    .mobility-label {
      font-size: 12px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
    }
    
    .mobility-desc {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 4px;
    }
    
    .mobility-detail {
      font-size: 10px;
      color: #9ca3af;
    }
    
    /* Property Condition Styles */
    .condition-assessment {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    
    .condition-badges {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    
    .condition-badge {
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .condition-badge.excellent {
      background: #d1fae5;
      color: #065f46;
    }
    
    .condition-badge.good {
      background: #d1fae5;
      color: #065f46;
    }
    
    .condition-badge.fair {
      background: #fef3c7;
      color: #92400e;
    }
    
    .condition-badge.needs\\ work,
    .condition-badge.renovation\\ project,
    .condition-badge.rebuild {
      background: #fee2e2;
      color: #991b1b;
    }
    
    .style-badge {
      background: #f3f4f6;
      color: #374151;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .condition-details {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .condition-info {
      font-size: 12px;
      color: #6b7280;
    }
    
    .condition-impact {
      text-align: right;
    }
    
    .impact-label {
      font-size: 10px;
      color: #6b7280;
      margin-bottom: 2px;
    }
    
    .impact-value {
      font-size: 14px;
      font-weight: bold;
      color: #00ae9a;
    }
    
    /* Valuation Methodology Styles */
    .methodology-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .methodology-item {
      display: flex;
      align-items: start;
      gap: 12px;
    }
    
    .methodology-bullet {
      width: 8px;
      height: 8px;
      background: #00ae9a;
      border-radius: 50%;
      margin-top: 6px;
      flex-shrink: 0;
    }
    
    .methodology-content {
      flex: 1;
    }
    
    .methodology-title {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
    }
    
    .methodology-desc {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.4;
    }
    
    /* Valuation Factors Styles */
    .valuation-factors {
      background: #f9fafb;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    
    .factors-list {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    
    .factors-note {
      font-size: 10px;
      color: #9ca3af;
      font-style: italic;
    }
    
    .valuation-factors-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
    }
    
    .factor-card {
      background: #f9fafb;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      text-align: center;
    }
    
    .factor-icon {
      font-size: 16px;
      margin-bottom: 6px;
    }
    
    .factor-title {
      font-size: 12px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
    }
    
    .factor-desc {
      font-size: 10px;
      color: #6b7280;
    }
    
    /* Valuation Confidence Styles */
    .confidence-container {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    
    .confidence-bar {
      background: #e5e7eb;
      border-radius: 8px;
      height: 12px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    
    .confidence-fill {
      background: #00ae9a;
      height: 100%;
      border-radius: 8px;
      transition: width 0.3s ease;
    }
    
    .confidence-label {
      font-size: 14px;
      font-weight: 600;
      color: #00ae9a;
      margin-bottom: 8px;
    }
    
    .confidence-methodology {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.4;
    }
    
    .comparable-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .comparable-price {
      font-size: 16px;
      font-weight: bold;
      color: #00ae9a;
    }
    
    .comparable-distance {
      font-size: 12px;
      color: #6b7280;
    }
    
    .comparable-details {
      font-size: 12px;
      color: #6b7280;
    }
    
    .insight-card {
      background: #f0f9ff;
      border-left: 4px solid #00ae9a;
      padding: 12px;
      margin-bottom: 8px;
      border-radius: 0 8px 8px 0;
    }
    
    .insight-title {
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
    }
    
    .insight-text {
      font-size: 14px;
      color: #6b7280;
    }
    
    .next-steps {
      background: #f8fafc;
      border-radius: 6px;
      padding: 10px;
      margin-top: 12px;
      border: 1px solid #e5e7eb;
    }
    
    .next-steps h3 {
      color: #1f2937;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .steps-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }
    
    .step-card {
      background: white;
      border-radius: 6px;
      padding: 8px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      border: 1px solid #e5e7eb;
    }
    
    .step-icon {
      font-size: 16px;
      min-width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #00ae9a;
      border-radius: 4px;
      flex-shrink: 0;
      color: white;
    }
    
    .step-content {
      flex: 1;
    }
    
    .step-title {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 3px;
      color: #1f2937;
    }
    
    .step-description {
      font-size: 10px;
      line-height: 1.2;
      color: #6b7280;
      margin: 0;
    }
    
    .gallery-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 1000;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
    
    .gallery-modal.active {
      display: flex;
    }
    
    .gallery-image {
      max-width: 90%;
      max-height: 80%;
      object-fit: contain;
      border-radius: 8px;
    }
    
    .gallery-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      padding: 12px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
      transition: background 0.2s;
    }
    
    .gallery-nav:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    
    .gallery-nav.prev {
      left: 20px;
    }
    
    .gallery-nav.next {
      right: 20px;
    }
    
    .gallery-close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      padding: 8px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 20px;
      transition: background 0.2s;
    }
    
    .gallery-close:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    
    .gallery-counter {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
    }
    
    @media print {
      .gallery-modal {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <img src="data:image/png;base64,${logoBase64}" alt="Logo" class="logo">
      <h1>Buyer Investment Report</h1>
              <p><a href="https://maps.google.com/?q=${encodeURIComponent(report.propertyData.address)}" target="_blank" style="color: #00ae9a; text-decoration: none;">${formatComparableAddress(report.propertyData.address)}</a></p>
    </div>
    
    <!-- Property Details -->
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">🏠</div>
        <h2 class="section-title">Property Details</h2>
      </div>
      
      <!-- Property Image -->
      ${report.propertyData.images && report.propertyData.images.length > 0 ? `
      <div style="margin-bottom: 16px;">
        <img 
          src="${report.propertyData.images[0]}" 
          alt="Main property image"
          style="width: 100%; height: 200px; object-fit: cover; border-radius: 12px; cursor: pointer; border: 1px solid #e5e7eb;"
          onclick="openImageGallery()"
          id="main-property-image"
        />
        ${report.propertyData.images.length > 1 ? `
        <div style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.7); color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer;" onclick="openImageGallery()">
          ${report.propertyData.images.length} photos
        </div>
        ` : ''}
      </div>
      ` : '<div style="background: #f3f4f6; height: 200px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 14px; margin-bottom: 16px;">No image available</div>'}
      
      <!-- Property Stats -->
      <div class="property-stats">
        <div class="stat-card">
          <div class="stat-label">Type</div>
          <div class="stat-value">${report.propertyData.propertyType}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Build Area</div>
          <div class="stat-value">${report.propertyData.buildArea ? report.propertyData.buildArea.toLocaleString() + ' m²' : 'N/A'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Bedrooms</div>
          <div class="stat-value">${report.propertyData.bedrooms} bed</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Bathrooms</div>
          <div class="stat-value">${report.propertyData.bathrooms} bath</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Price/m²</div>
          <div class="stat-value">${report.propertyData.price && report.propertyData.buildArea ? formatPrice(Math.round(report.propertyData.price / report.propertyData.buildArea)) : 'N/A'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Asking Price</div>
          <div class="stat-value price-highlight">${formatPrice(report.propertyData.price)}</div>
          ${report.propertyData.refNumber ? `
          <div style="font-size: 10px; color: #6b7280; margin-top: 2px; font-weight: 500;">Ref: ${report.propertyData.refNumber}</div>
          ` : ''}
        </div>
      </div>
      
      ${report.propertyData.features && report.propertyData.features.length > 0 ? `
      <div style="margin-top: 16px;">
        <h4 style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">Key Features:</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 12px;">
          ${report.propertyData.features.slice(0, 6).map(feature => `
          <span style="color: #374151; font-size: 12px; font-weight: 400;">• ${feature.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>
    
    <!-- Property Condition Assessment -->
    ${report.propertyData.condition ? `
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">🏠</div>
        <h2 class="section-title">Property Condition Assessment</h2>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
        <div>
          <div style="display: flex; gap: 8px; margin-bottom: 6px;">
            <span style="background: ${report.propertyData.condition === 'excellent' ? '#d1fae5' : report.propertyData.condition === 'good' ? '#d1fae5' : report.propertyData.condition === 'fair' ? '#fef3c7' : '#fee2e2'}; color: ${report.propertyData.condition === 'excellent' ? '#065f46' : report.propertyData.condition === 'good' ? '#065f46' : report.propertyData.condition === 'fair' ? '#92400e' : '#991b1b'}; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 500;">${report.propertyData.condition.charAt(0).toUpperCase() + report.propertyData.condition.slice(1)}</span>
            ${report.propertyData.architecturalStyle ? `<span style="background: #f3f4f6; color: #374151; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 500;">${report.propertyData.architecturalStyle}</span>` : ''}
          </div>
          <div style="font-size: 12px; color: #6b7280;">
            ${report.propertyData.yearBuilt ? 
              `Built in ${report.propertyData.yearBuilt} (${new Date().getFullYear() - report.propertyData.yearBuilt} years old)` :
              'Year built not specified'
            }
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 10px; color: #6b7280; margin-bottom: 4px;">Condition Impact</div>
          <div style="font-size: 16px; font-weight: bold; color: #00ae9a;">
            ${(() => {
              const conditionImpacts = {
                'excellent': '+15%',
                'good': '+5%',
                'fair': '0%',
                'needs work': '-10%',
                'renovation project': '-15%',
                'rebuild': '-20%'
              }
              return conditionImpacts[report.propertyData.condition] || '0%'
            })()}
          </div>
        </div>
      </div>
    </div>
    ` : ''}
    
    <!-- Executive Summary -->
    <div class="executive-summary">
      <h2 style="font-size: 18px; margin-bottom: 8px;">Investment Summary</h2>
      
      <!-- Investment Overview -->
      <p style="font-size: 14px; opacity: 0.9; margin-bottom: 12px; line-height: 1.5;">
        ${report.summary?.overview || `This comprehensive buyer analysis evaluates <strong>${report.propertyData.address}</strong> as a ${report.propertyData.propertyType.toLowerCase()} investment opportunity in ${(() => {
          // Build location string with proper hierarchy: urbanization/street first, then suburb, then city, then province
          const locationParts = []
          
          // Add urbanization if available (most specific)
          if (report.propertyData.urbanization) {
            locationParts.push(report.propertyData.urbanization)
          }
          
          // Add street if available (also very specific)
          if (report.propertyData.streetName) {
            locationParts.push(report.propertyData.streetName)
          }
          
          // Add suburb/area if available
          if (report.propertyData.suburb) {
            locationParts.push(report.propertyData.suburb)
          }
          
          // Add city
          if (report.propertyData.city) {
            locationParts.push(report.propertyData.city)
          }
          
          // Add province at the end
          if (report.propertyData.province) {
            locationParts.push(report.propertyData.province)
          }
          
          return locationParts.join(', ')
        })()}. The property presents ${(() => {
          const percentageDiff = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
          if (percentageDiff > 10) return 'a potential negotiation opportunity'
          if (percentageDiff < -10) return 'exceptional value'
          return 'fair market value'
        })()} with strong fundamentals for long-term appreciation.`}
      </p>
      
      <!-- Key Investment Metrics -->
      <div class="summary-grid" style="margin-bottom: 16px;">
        <div class="summary-stat">
          <div class="summary-stat-value">${formatPrice(report.propertyData.price)}</div>
          <div class="summary-stat-label">Asking Price</div>
          ${(() => {
            const percentageDiff = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
            const sign = percentageDiff > 0 ? '+' : ''
            const color = percentageDiff > 0 ? '#dc2626' : percentageDiff < 0 ? '#059669' : '#6b7280'
            return `<div style="font-size: 11px; color: ${color}; font-weight: 500; margin-top: 2px;">${sign}${percentageDiff.toFixed(1)}% vs market</div>`
          })()}
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${formatPrice(report.valuationEstimate.estimated)}</div>
          <div class="summary-stat-label">Market Value</div>
          <div style="font-size: 11px; color: #6b7280; font-weight: 500; margin-top: 2px;">${report.valuationEstimate.confidence}% confidence</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${report.propertyData.buildArea ? report.propertyData.buildArea.toLocaleString() + ' m²' : 'N/A'}</div>
          <div class="summary-stat-label">Build Area</div>
          ${report.propertyData.terraceAreaM2 && report.propertyData.terraceAreaM2 > 0 ? `<div style="font-size: 11px; color: #6b7280; font-weight: 500; margin-top: 2px;">+${report.propertyData.terraceAreaM2} m² terrace</div>` : ''}
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${report.propertyData.price && report.propertyData.buildArea ? formatPrice(Math.round(report.propertyData.price / report.propertyData.buildArea)) : 'N/A'}</div>
          <div class="summary-stat-label">Price/m²</div>
                      ${report.marketTrends?.averagePricePerM2 ? `<div style="font-size: 11px; color: #6b7280; font-weight: 500; margin-top: 2px;">vs ${formatPrice(report.marketTrends.averagePricePerM2)} avg</div>` : ''}
        </div>
      </div>
      
      <!-- Investment Highlights -->
      <div style="margin-bottom: 16px;">
        <h3 style="font-size: 15px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">Investment Highlights</h3>
        <div style="display: grid; grid-template-columns: 1fr; gap: 8px;">
          <div style="background: #f9fafb; padding: 10px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 16px; margin-right: 8px;">💰</span>
              <span style="font-size: 13px; font-weight: 600; color: #1f2937;">Price Position</span>
            </div>
            <div style="font-size: 12px; color: #374151; line-height: 1.4;">
              ${(() => {
                const percentageDiff = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
                if (percentageDiff > 10) {
                  return `Property is ${percentageDiff.toFixed(1)}% above market value. Consider negotiating for a 5-10% reduction to align with market expectations.`
                } else if (percentageDiff < -10) {
                  return `Excellent opportunity! Property is ${Math.abs(percentageDiff).toFixed(1)}% below market value. Strong buying potential with immediate equity.`
                } else {
                  return 'Property is fairly priced relative to market value. Standard market conditions with moderate appreciation potential.'
                }
              })()}
            </div>
          </div>
          
          <div style="background: #f9fafb; padding: 10px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 16px; margin-right: 8px;">📈</span>
              <span style="font-size: 13px; font-weight: 600; color: #1f2937;">Market Trends</span>
            </div>
            <div style="font-size: 12px; color: #374151; line-height: 1.4;">
              ${(() => {
                if (report.marketTrends.marketTrend === 'up') {
                  return `Strong upward market trend with ${report.marketTrends.priceChange6Month > 0 ? '+' : ''}${report.marketTrends.priceChange6Month}% 6-month growth. Excellent timing for long-term investment.`
                } else if (report.marketTrends.marketTrend === 'down') {
                  return `Market showing ${Math.abs(report.marketTrends.priceChange6Month)}% decline. Consider waiting for market stabilisation or negotiate aggressively.`
                } else {
                  return `Stable market conditions with ${report.marketTrends.priceChange6Month > 0 ? '+' : ''}${report.marketTrends.priceChange6Month}% 6-month change. Predictable investment environment.`
                }
              })()}
            </div>
          </div>
          
          <div style="background: #f9fafb; padding: 10px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 16px; margin-right: 8px;">📍</span>
              <span style="font-size: 13px; font-weight: 600; color: #1f2937;">Location Quality</span>
            </div>
            <div style="font-size: 12px; color: #374151; line-height: 1.4;">
              ${(() => {
                const amenities = report.nearbyAmenities.length
                const walkability = report.walkabilityData?.walkingScore || report.walkabilityData?.walkScore || 0
                if (amenities > 10 && walkability > 70) {
                  return `Premium location with ${amenities} nearby amenities and excellent walkability (${walkability}/100). High desirability factor.`
                } else if (amenities > 5) {
                  return `Good location with ${amenities} nearby amenities. ${walkability > 50 ? 'Moderate walkability' : 'Car-dependent area'}.`
                } else {
                  return 'Limited local amenities. Consider transport requirements and lifestyle preferences.'
                }
              })()}
            </div>
          </div>
          
          <div style="background: #f9fafb; padding: 10px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 16px; margin-right: 8px;">🏗️</span>
              <span style="font-size: 13px; font-weight: 600; color: #1f2937;">Property Condition</span>
            </div>
            <div style="font-size: 12px; color: #374151; line-height: 1.4;">
              ${(() => {
                if (report.propertyData.condition === 'excellent') {
                  return 'Excellent condition requiring minimal maintenance. Premium pricing justified by superior quality.'
                } else if (report.propertyData.condition === 'good') {
                  return 'Good condition with minor maintenance needs. Solid investment with reasonable upkeep costs.'
                } else if (report.propertyData.condition === 'fair') {
                  return 'Fair condition may require some updates. Consider renovation costs in your budget.'
                } else {
                  return 'Property needs work/renovation. Factor in significant improvement costs and timeline.'
                }
              })()}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Investment Recommendation -->
      <div style="margin-bottom: 16px;">
        <h3 style="font-size: 15px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">Investment Recommendation</h3>
        <div style="background: #f9fafb; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb;">
          ${(() => {
            const percentageDiff = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
            const marketTrend = report.marketTrends.marketTrend
            
            if (percentageDiff < -15 && marketTrend === 'up') {
              return `<div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="background: #059669; color: white; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-right: 10px;">STRONG BUY</span>
                <span style="font-size: 11px; color: #6b7280;">Exceptional opportunity in rising market</span>
              </div>
              <p style="font-size: 12px; color: #374151; line-height: 1.4; margin: 0;">
                Property is significantly undervalued in a rising market. Immediate equity potential with strong appreciation outlook. Act quickly before market correction.
              </p>`
            } else if (percentageDiff < -10) {
              return `<div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="background: #059669; color: white; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-right: 10px;">BUY</span>
                <span style="font-size: 11px; color: #6b7280;">Good investment opportunity</span>
              </div>
              <p style="font-size: 12px; color: #374151; line-height: 1.4; margin: 0;">
                Good investment opportunity with below-market pricing. Strong fundamentals support long-term appreciation. Consider making an offer within 5% of asking price.
              </p>`
            } else if (percentageDiff > 15) {
              return `<div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="background: #dc2626; color: white; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-right: 10px;">AVOID</span>
                <span style="font-size: 11px; color: #6b7280;">Significantly overpriced</span>
              </div>
              <p style="font-size: 12px; color: #374151; line-height: 1.4; margin: 0;">
                Property is significantly overpriced. Consider waiting for price reduction or explore alternative properties in the area.
              </p>`
            } else if (percentageDiff > 5) {
              return `<div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="background: #d97706; color: white; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-right: 10px;">NEGOTIATE</span>
                <span style="font-size: 11px; color: #6b7280;">Slightly overpriced</span>
              </div>
              <p style="font-size: 12px; color: #374151; line-height: 1.4; margin: 0;">
                Property is slightly overpriced. Strong negotiating position - aim for 5-10% reduction to achieve fair market value.
              </p>`
            } else {
              return `<div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="background: #6b7280; color: white; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-right: 10px;">FAIR VALUE</span>
                <span style="font-size: 11px; color: #6b7280;">Fairly priced</span>
              </div>
              <p style="font-size: 12px; color: #374151; line-height: 1.4; margin: 0;">
                Property is fairly priced relative to market value. Standard market conditions - proceed with normal due diligence and consider your personal timeline.
              </p>`
            }
          })()}
        </div>
      </div>
      
      <!-- Risk Assessment -->
      <div>
        <h3 style="font-size: 13px; font-weight: 600; color: #1f2937; margin-bottom: 6px;">Risk Assessment</h3>
        ${(() => {
          // Calculate price difference percentage
          const priceDifference = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
          
          // Determine risk level based on overpricing and other factors
          let riskLevel = 'low'
          let riskColor = '#166534'
          let riskBackground = '#f0fdf4'
          let riskBorder = '#bbf7d0'
          let riskIcon = '✅'
          
          // Check for high overpricing (major risk factor)
          if (priceDifference > 15) {
            riskLevel = 'high'
            riskColor = '#dc2626'
            riskBackground = '#fef2f2'
            riskBorder = '#fecaca'
            riskIcon = '🚨'
          } else if (priceDifference > 10) {
            riskLevel = 'medium'
            riskColor = '#d97706'
            riskBackground = '#fffbeb'
            riskBorder = '#fed7aa'
            riskIcon = '⚠️'
          }
          
          // Additional risk factors
          const riskFactors = []
          const positiveFactors = []
          
          // Price-related risks
          if (priceDifference > 15) {
            riskFactors.push(`Severely overpriced (+${priceDifference.toFixed(1)}%)`)
          } else if (priceDifference > 10) {
            riskFactors.push(`Overpriced (+${priceDifference.toFixed(1)}%)`)
          } else if (priceDifference < -10) {
            positiveFactors.push(`Undervalued (${priceDifference.toFixed(1)}%)`)
          }
          
          // Market and property risks
          if (report.comparableProperties.length < 3) riskFactors.push('Limited comparable data')
          if (report.marketTrends.marketTrend === 'down') riskFactors.push('Declining market')
          if (report.propertyData.condition === 'needs work' || report.propertyData.condition === 'renovation project') riskFactors.push('Renovation required')
          if (report.nearbyAmenities.length < 3) riskFactors.push('Limited amenities')
          
          // Positive factors
          if (report.comparableProperties.length >= 5) positiveFactors.push('Strong comparable data')
          if (report.marketTrends.inventory > 10) positiveFactors.push('Active market')
          if (report.nearbyAmenities.length > 5) positiveFactors.push('Good location')
          if (report.propertyData.condition === 'excellent' || report.propertyData.condition === 'good') positiveFactors.push('Good condition')
          
          return `
          <div style="display: grid; grid-template-columns: 1fr; gap: 6px;">
            <div style="background: ${riskBackground}; padding: 8px; border-radius: 6px; border: 1px solid ${riskBorder};">
              <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 14px; margin-right: 6px;">${riskIcon}</span>
                <span style="font-size: 11px; font-weight: 600; color: ${riskColor}; text-transform: capitalize;">${riskLevel} Risk Factors</span>
              </div>
              <div style="font-size: 10px; color: #374151; line-height: 1.3;">
                ${riskLevel === 'high' && priceDifference > 15 ? `Severely overpriced (+${priceDifference.toFixed(1)}%)` : 
                  riskLevel === 'medium' && priceDifference > 10 ? `Overpriced (+${priceDifference.toFixed(1)}%)` :
                  positiveFactors.length > 0 ? positiveFactors.join(', ') : 'Limited positive factors identified'}
              </div>
            </div>
            
            <div style="background: #fef3c7; padding: 8px; border-radius: 6px; border: 1px solid #fde68a;">
              <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 14px; margin-right: 6px;">⚠️</span>
                <span style="font-size: 11px; font-weight: 600; color: #92400e;">Considerations</span>
              </div>
              <div style="font-size: 10px; color: #374151; line-height: 1.3;">
                ${riskFactors.length > 0 ? riskFactors.join(', ') : 'Standard market considerations'}
              </div>
            </div>
          </div>
          `
        })()}
      </div>
    </div>
    
    <!-- Property Images -->
    ${report.propertyData.images && report.propertyData.images.length > 0 ? `
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">📸</div>
        <h2 class="section-title">Property Images</h2>
      </div>
      <div class="property-images">
        <img src="${report.propertyData.images[0]}" alt="Main property image" class="main-image" onclick="openGallery(0)">
        ${report.propertyData.images.length > 1 ? `
        <div class="image-thumbnails">
          ${report.propertyData.images.slice(1, 5).map((image, index) => `
            <img src="${image}" alt="Property image ${index + 2}" class="thumbnail" onclick="openGallery(${index + 1})">
          `).join('')}
        </div>
        ` : ''}
      </div>
    </div>
    ` : ''}
    
    <!-- Property Details -->
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">🏠</div>
        <h2 class="section-title">Property Details</h2>
      </div>
      <div class="property-stats">
        <div class="stat-card">
          <div class="stat-label">Type</div>
          <div class="stat-value">${report.propertyData.propertyType}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Price</div>
          <div class="stat-value">${formatPrice(report.propertyData.price)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Build Area</div>
          <div class="stat-value">${report.propertyData.buildArea ? report.propertyData.buildArea.toLocaleString() + ' m²' : 'N/A'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Bedrooms</div>
          <div class="stat-value">${report.propertyData.bedrooms || 'N/A'}</div>
        </div>
        ${report.propertyData.terraceAreaM2 && report.propertyData.terraceAreaM2 > 0 ? `
        <div class="stat-card">
          <div class="stat-label">Terrace</div>
          <div class="stat-value">${report.propertyData.terraceAreaM2.toLocaleString()} m²</div>
        </div>
        ` : ''}
        ${report.propertyData.plotArea ? `
        <div class="stat-card">
          <div class="stat-label">Plot</div>
          <div class="stat-value">${report.propertyData.plotArea.toLocaleString()} m²</div>
        </div>
        ` : ''}
      </div>
    </div>
    
    <!-- Property Condition Assessment -->
    ${report.propertyData.condition ? `
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">🏠</div>
        <h2 class="section-title">Property Condition</h2>
      </div>
      <div class="condition-assessment">
        <div class="condition-badges">
          <span class="condition-badge ${report.propertyData.condition}">${report.propertyData.condition.charAt(0).toUpperCase() + report.propertyData.condition.slice(1)}</span>
          ${report.propertyData.architecturalStyle ? `<span class="style-badge">${report.propertyData.architecturalStyle}</span>` : ''}
        </div>
        <div class="condition-details">
          <div class="condition-info">
            ${report.propertyData.yearBuilt ? 
              `Built in ${report.propertyData.yearBuilt} (${new Date().getFullYear() - report.propertyData.yearBuilt} years old)` :
              'Year built not specified'
            }
          </div>
          <div class="condition-impact">
            <div class="impact-label">Condition Impact</div>
            <div class="impact-value">
              ${(() => {
                const conditionImpacts = {
                  'excellent': '+15%',
                  'good': '+5%',
                  'fair': '0%',
                  'needs work': '-10%',
                  'renovation project': '-15%',
                  'rebuild': '-20%'
                }
                return conditionImpacts[report.propertyData.condition] || '0%'
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
    ` : ''}
    
    <!-- Market Analysis -->
    ${report.marketTrends ? `
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">📊</div>
        <h2 class="section-title">Market Analysis</h2>
      </div>
      <div class="market-stats">
        <div class="market-stat">
          <div class="market-stat-value">${report.marketTrends.averagePrice ? formatPrice(report.marketTrends.averagePrice) : 'N/A'}</div>
          <div class="market-stat-label">Average Price</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-value">${report.marketTrends?.averagePricePerM2 ? formatPrice(report.marketTrends.averagePricePerM2) : 'N/A'}</div>
          <div class="market-stat-label">Price/m²</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-value">${report.marketTrends.daysOnMarket ? report.marketTrends.daysOnMarket + ' days' : 'N/A'}</div>
          <div class="market-stat-label">Days on Market</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-value">${report.marketTrends.inventory ? report.marketTrends.inventory : 'N/A'}</div>
          <div class="market-stat-label">Inventory Level</div>
        </div>
      </div>
    </div>
    ` : ''}
    
    <!-- Walkability & Mobility Analysis -->
    ${report.walkabilityData ? `
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">🚶</div>
        <h2 class="section-title">Walkability & Mobility</h2>
      </div>
      <div class="mobility-grid">
        ${report.walkabilityData.walkingScore || report.walkabilityData.walkScore ? `
        <div class="mobility-card">
          <div class="mobility-score">${report.walkabilityData.walkingScore || report.walkabilityData.walkScore}/100</div>
          <div class="mobility-label">Walking Score</div>
          <div class="mobility-desc">${report.walkabilityData.walkingDescription || report.walkabilityData.walkDescription || 'Walking accessibility'}</div>
          ${report.walkabilityData.averageWalkTime ? `<div class="mobility-detail">Avg: ${report.walkabilityData.averageWalkTime} min</div>` : ''}
        </div>
        ` : ''}
        
        ${report.walkabilityData.drivingScore ? `
        <div class="mobility-card">
          <div class="mobility-score">${report.walkabilityData.drivingScore}/100</div>
          <div class="mobility-label">Driving Score</div>
          <div class="mobility-desc">${report.walkabilityData.drivingDescription}</div>
          ${report.walkabilityData.averageDriveTime ? `<div class="mobility-detail">Avg: ${report.walkabilityData.averageDriveTime} min</div>` : ''}
        </div>
        ` : ''}
        
        ${report.walkabilityData.transitScore ? `
        <div class="mobility-card">
          <div class="mobility-score">${report.walkabilityData.transitScore}/100</div>
          <div class="mobility-label">Transit Score</div>
          <div class="mobility-desc">${report.walkabilityData.transitDescription || 'Public transport'}</div>
          ${report.walkabilityData.transitAccessibleDestinations ? `<div class="mobility-detail">${report.walkabilityData.transitAccessibleDestinations} destinations</div>` : ''}
        </div>
        ` : ''}
        
        ${report.walkabilityData.accessibilityScore ? `
        <div class="mobility-card">
          <div class="mobility-score">${report.walkabilityData.accessibilityScore}/100</div>
          <div class="mobility-label">Overall Accessibility</div>
          <div class="mobility-desc">Combined mobility rating</div>
          ${report.walkabilityData.reachableDestinations ? `<div class="mobility-detail">${report.walkabilityData.reachableDestinations} destinations</div>` : ''}
        </div>
        ` : ''}
      </div>
    </div>
    ` : ''}

    <!-- Valuation Methodology -->
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">📊</div>
        <h2 class="section-title">Valuation Methodology</h2>
      </div>
      <div class="methodology-list">
        <div class="methodology-item">
          <div class="methodology-bullet"></div>
          <div class="methodology-content">
            <div class="methodology-title">Base Value Calculation</div>
            <div class="methodology-desc">
              ${report.comparableProperties.length > 0 ? 
                `Based on ${report.comparableProperties.length} properties analyzed` :
                'Limited comparable data available'
              }
            </div>
          </div>
        </div>
        
        <div class="methodology-item">
          <div class="methodology-bullet"></div>
          <div class="methodology-content">
            <div class="methodology-title">Condition Assessment</div>
            <div class="methodology-desc">
              ${report.propertyData.condition ? 
                `${report.propertyData.condition} condition affects valuation` :
                'Condition assessment not available'
              }
            </div>
          </div>
        </div>
        
        <div class="methodology-item">
          <div class="methodology-bullet"></div>
          <div class="methodology-content">
            <div class="methodology-title">Market Trends</div>
            <div class="methodology-desc">
              ${report.marketTrends.marketTrend ? 
                `${report.marketTrends.marketTrend} trend (${report.marketTrends.priceChange6Month > 0 ? '+' : ''}${report.marketTrends.priceChange6Month}% 6-month)` :
                'Market trend data not available'
              }
            </div>
          </div>
        </div>
        
        <div class="methodology-item">
          <div class="methodology-bullet"></div>
          <div class="methodology-content">
            <div class="methodology-title">Location Factors</div>
            <div class="methodology-desc">
              ${report.nearbyAmenities.length > 0 ? 
                `${report.nearbyAmenities.length} nearby amenities considered` :
                'Amenity data not available'
              }
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Valuation Factors -->
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">🎯</div>
        <h2 class="section-title">Valuation Factors</h2>
      </div>
      ${report.valuationEstimate.adjustments.length > 0 ? `
        <div class="valuation-factors">
          <div class="factors-list">
            ${report.valuationEstimate.adjustments.map(adjustment => {
              if (adjustment.factor === 'Comparable Properties') {
                return `Comparable Properties (${report.comparableProperties.length} properties)`
              }
              return adjustment.factor
            }).join(', ')}
          </div>
          <div class="factors-note">
            Based on analysis of ${report.comparablePropertiesTotal || report.comparableProperties.length} properties analyzed in the area
          </div>
        </div>
      ` : `
        <div class="valuation-factors-grid">
          <div class="factor-card">
            <div class="factor-icon">📍</div>
            <div class="factor-title">Location Premium</div>
            <div class="factor-desc">Prime area advantage</div>
          </div>
          <div class="factor-card">
            <div class="factor-icon">🏗️</div>
            <div class="factor-title">Property Condition</div>
            <div class="factor-desc">Well-maintained</div>
          </div>
          <div class="factor-card">
            <div class="factor-icon">🌟</div>
            <div class="factor-title">Unique Features</div>
            <div class="factor-desc">${report.propertyData.features?.length || 0} amenities</div>
          </div>
          <div class="factor-card">
            <div class="factor-icon">📈</div>
            <div class="factor-title">Market Demand</div>
            <div class="factor-desc">High interest area</div>
          </div>
        </div>
      `}
    </div>

    <!-- Valuation Confidence -->
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">📊</div>
        <h2 class="section-title">Valuation Confidence</h2>
      </div>
      <div class="confidence-container">
        <div class="confidence-bar">
          <div class="confidence-fill" style="width: ${report.valuationEstimate.confidence}%"></div>
        </div>
        <div class="confidence-label">${report.valuationEstimate.confidence}% Confidence</div>
        <div class="confidence-methodology">${report.valuationEstimate.methodology}</div>
      </div>
    </div>
    
    <!-- Comparable Properties - Dedicated Page -->
    ${report.comparableProperties && report.comparableProperties.length > 0 ? `
    <div class="section-card comparable-properties-page">
      <div class="section-header" style="margin-bottom: 24px;">
        <div class="section-icon">🏘️</div>
        <h2 class="section-title">Comparable Properties Analysis</h2>
        <div style="font-size: 12px; color: #6b7280; margin-top: 8px; font-style: italic;">
          This page can be removed if comparable properties are not required
        </div>
      </div>
      <p style="margin-bottom: 24px; color: #6b7280; font-size: 16px; line-height: 1.6;">
        Recent sales in the area provide valuable insights into current market values and trends. Each comparable property has been carefully selected based on location, size, and characteristics similar to the subject property.
      </p>
      <div class="comparables-grid" style="flex: 1;">
        ${report.comparableProperties.slice(0, 12).map(prop => `
        <div class="comparable-card">
          ${prop.images && prop.images.length > 0 ? `
          <div class="comparable-image">
            <div class="image-collage">
              <!-- Large image on the left -->
              <div class="main-image">
                <img src="${prop.images[0]}" alt="Property image" />
              </div>
              <!-- 2 smaller images on the right -->
              <div class="thumbnail-images">
                ${prop.images.length > 1 ? `<img src="${prop.images[1]}" alt="Property image 2" />` : '<div class="placeholder"></div>'}
                ${prop.images.length > 2 ? `<img src="${prop.images[2]}" alt="Property image 3" />` : '<div class="placeholder"></div>'}
              </div>
            </div>
          </div>
          ` : ''}
          <div class="comparable-content">
            <div class="comparable-header">${prop.address}</div>
            <div class="comparable-type">${prop.propertyType}</div>
            <div class="comparable-details">
              <div class="comparable-detail">
                <span class="label">Price:</span>
                <span class="value price-highlight">${formatPrice(prop.price)}</span>
              </div>
              <div class="comparable-detail">
                <span class="label">Beds/Baths:</span>
                <span class="value" style="text-align: right;">${prop.bedrooms}🛏️ ${prop.bathrooms}🚿</span>
              </div>
              ${prop.buildArea && prop.buildArea > 0 ? `
              <div class="comparable-detail">
                <span class="label">Build:</span>
                <span class="value">${prop.buildArea.toLocaleString()} m²</span>
              </div>` : ''}
              ${prop.terraceArea && prop.terraceArea > 0 ? `
              <div class="comparable-detail">
                <span class="label">Terrace:</span>
                <span class="value">${prop.terraceArea.toLocaleString()} m²</span>
              </div>` : ''}
              ${prop.plotArea && prop.plotArea > 0 ? `
              <div class="comparable-detail">
                <span class="label">Plot:</span>
                <span class="value">${prop.plotArea.toLocaleString()} m²</span>
              </div>` : ''}
            </div>
            ${prop.refNumber ? `
            <div style="font-size: 10px; color: #6b7280; margin-top: 4px; font-weight: 500; text-align: right;">Ref: ${prop.refNumber}</div>
            ` : ''}
          </div>
        </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    <!-- Property Summary -->
    ${report.summary ? `
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">📋</div>
        <h2 class="section-title">Property Analysis</h2>
      </div>
      <div class="insight-card">
        <div class="insight-title">Investment Overview</div>
        <div class="insight-text">${report.summary.overview}</div>
      </div>
      ${report.summary.investmentPotential ? `
      <div class="insight-card">
        <div class="insight-title">Investment Potential</div>
        <div class="insight-text">${report.summary.investmentPotential}</div>
      </div>
      ` : ''}
    </div>
    ` : ''}
    
    <!-- Next Steps -->
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">🎯</div>
        <h2 class="section-title">Next Steps for Buyers</h2>
      </div>
      <div class="next-steps">
        <h3>Ready to take action?</h3>
        <div class="steps-grid">
          ${generateDynamicNextSteps(report).slice(0, 4).map(step => `
          <div class="step-card">
            <div class="step-icon">${step.icon}</div>
            <div class="step-content">
              <h3 class="step-title">${step.title}</h3>
              <p class="step-description">${step.description}</p>
            </div>
          </div>
          `).join('')}
        </div>
      </div>
    </div>
  </div>
  
  <!-- Image Gallery Modal -->
  ${report.propertyData.images && report.propertyData.images.length > 1 ? `
  <div id="gallery-modal" class="gallery-modal">
    <button class="gallery-close" onclick="closeGallery()">×</button>
    <img id="gallery-image" src="" alt="Gallery image" class="gallery-image">
    <button class="gallery-nav prev" onclick="prevImage()">‹</button>
    <button class="gallery-nav next" onclick="nextImage()">›</button>
    <div id="gallery-counter" class="gallery-counter">1 / ${report.propertyData.images.length}</div>
  </div>
  
  <script>
    let currentImageIndex = 0;
    const images = ${JSON.stringify(report.propertyData.images)};
    
    function openGallery(index) {
      currentImageIndex = index;
      document.getElementById('gallery-image').src = images[index];
      document.getElementById('gallery-counter').textContent = \`\${index + 1} / \${images.length}\`;
      document.getElementById('gallery-modal').classList.add('active');
    }
    
    function closeGallery() {
      document.getElementById('gallery-modal').classList.remove('active');
    }
    
    function nextImage() {
      currentImageIndex = (currentImageIndex + 1) % images.length;
      document.getElementById('gallery-image').src = images[currentImageIndex];
      document.getElementById('gallery-counter').textContent = \`\${currentImageIndex + 1} / \${images.length}\`;
    }
    
    function prevImage() {
      currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
      document.getElementById('gallery-image').src = images[currentImageIndex];
      document.getElementById('gallery-counter').textContent = \`\${currentImageIndex + 1} / \${images.length}\`;
    }
    
    // Close modal on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeGallery();
      }
    });
    
    // Close modal on background click
    document.getElementById('gallery-modal').addEventListener('click', function(e) {
      if (e.target === this) {
        closeGallery();
      }
    });
  </script>
  ` : ''}
</body>
</html>
  `
}

function generatePDFHTML(report: CMAReport, logoBase64: string, reportType?: string, format?: string): string {
  // Validate report data
  if (!report || !report.propertyData) {
    throw new Error('Invalid report data provided')
  }
  
  // Generate different HTML based on report type
  if (reportType === 'Buyer') {
    return generateBuyerPDFHTML(report, logoBase64, format)
  }
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CMA Report ${reportType ? `(${reportType})` : ''} - ${report.propertyData.address}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    }
    
    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 0;
    }
    
    .header {
      background: linear-gradient(135deg, #00ae9a 0%, #009688 100%);
      color: white;
      padding: 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
    }
    
    .header-left h1 {
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .header-left p {
      font-size: 14px;
      opacity: 0.9;
    }
    
    .logo {
      width: 80px;
      height: 80px;
      border-radius: 12px;
      background: transparent;
      padding: 0;
    }
    
    .property-header {
      background: white;
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
    }
    
    .property-title {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .property-icon {
      width: 48px;
      height: 48px;
      background: #00ae9a;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
      color: white;
      font-size: 24px;
    }
    
    .property-title h2 {
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
    }
    
    .property-details {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
    }
    
    .property-info h3 {
      font-size: 20px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }
    
    .property-info p {
      color: #6b7280;
      margin-bottom: 16px;
    }
    
    .property-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    
    .stat-card {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    
    .stat-label {
      color: #6b7280;
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 500;
      letter-spacing: 0.5px;
    }
    
    .stat-value {
      color: #1f2937;
      font-size: 16px;
      font-weight: 600;
      margin-top: 4px;
    }
    
    .section-card {
      background: white;
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
      page-break-inside: avoid;
    }
    
    .section-header {
      display: flex;
      align-items: center;
      margin-bottom: 6px;
    }
    
    .section-icon {
      width: 20px;
      height: 20px;
      background: #00ae9a;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 6px;
      color: white;
      font-size: 10px;
    }
    
    .section-title {
      font-size: 12px;
      font-weight: bold;
      color: #1f2937;
    }
    
    .market-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }
    
    .market-stat {
      background: #f9fafb;
      padding: 20px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      text-align: center;
    }
    
    .market-stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #00ae9a;
      margin-bottom: 4px;
    }
    
    .market-stat-label {
      color: #6b7280;
      font-size: 14px;
    }
    
          .comparables-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        page-break-inside: avoid;
        align-content: start;
      }
    
    /* Ensure comparable properties section is always on its own page */
    .comparable-properties-page {
      page-break-before: always;
      page-break-after: always;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      break-inside: avoid;
      break-before: page;
      break-after: page;
    }
    
    .comparable-card {
      background: #f9fafb;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      overflow: hidden;
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s ease;
    }
    
    .comparable-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    }
    
    .comparable-image {
      width: 100%;
      height: 120px;
      overflow: hidden;
      position: relative;
    }
    
    .comparable-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      border-radius: 12px 12px 0 0;
      display: block;
    }
    
    .comparable-content {
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .comparable-header {
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 3px;
      font-size: 11px;
      line-height: 1.2;
    }
    
    .comparable-type {
      color: #6b7280;
      font-size: 9px;
      margin-bottom: 4px;
    }
    
    .comparable-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px;
      font-size: 9px;
    }
    
    .comparable-detail {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .comparable-detail .label {
      color: #6b7280;
    }
    
    .comparable-detail .value {
      font-weight: 600;
      color: #1f2937;
    }
    
    .price-highlight {
      color: #00ae9a;
      font-size: 15px;
    }
    
    .developments-list {
      space-y: 16px;
    }
    
    .development-item {
      background: #f9fafb;
      padding: 20px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      margin-bottom: 16px;
    }
    
    .development-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 12px;
    }
    
    .development-name {
      font-weight: 600;
      color: #1f2937;
    }
    
    .development-badges {
      display: flex;
      gap: 8px;
    }
    
    .badge {
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .badge-positive {
      background: #d1fae5;
      color: #065f46;
    }
    
    .badge-neutral {
      background: #f3f4f6;
      color: #374151;
    }
    
    .badge-negative {
      background: #fee2e2;
      color: #991b1b;
    }
    
    .badge-under-construction {
      background: #dbeafe;
      color: #1e40af;
    }
    
    .badge-approved {
      background: #ede9fe;
      color: #6b21a8;
    }
    
    .badge-excellent {
      background: #d1fae5;
      color: #065f46;
    }
    
    .badge-good {
      background: #dbeafe;
      color: #1e40af;
    }
    
    .badge-fair {
      background: #fef3c7;
      color: #92400e;
    }
    
    .badge-poor {
      background: #fee2e2;
      color: #991b1b;
    }
    
    .development-description {
      color: #6b7280;
      margin-bottom: 12px;
    }
    
    .development-footer {
      display: flex;
      justify-content: space-between;
      color: #6b7280;
      font-size: 14px;
    }
    
    .ai-summary {
      background: linear-gradient(135deg, #00ae9a 0%, #009688 100%);
      color: white;
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .ai-summary .section-header {
      color: white;
    }
    
    .ai-summary .section-icon {
      background: rgba(255, 255, 255, 0.2);
    }
    
    .ai-content {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 24px;
    }
    
    .ai-section {
      margin-bottom: 20px;
    }
    
    .ai-section:last-child {
      margin-bottom: 0;
    }
    
    .ai-section h3 {
      font-weight: 600;
      margin-bottom: 8px;
      color: white;
    }
    
    .ai-section p {
      color: rgba(255, 255, 255, 0.9);
      line-height: 1.6;
    }
    
    .valuation-highlight {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-top: 16px;
    }
    
    .valuation-range {
      font-size: 18px;
      font-weight: bold;
      color: white;
    }
    
    .confidence-badge {
      background: rgba(255, 255, 255, 0.2);
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
    }
    
    .footer {
      text-align: center;
      padding: 12px;
      color: #6b7280;
      font-size: 12px;
      border-top: 1px solid #e5e7eb;
      margin-top: 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    @media print {
      body {
        background: white !important;
      }
      
      .section-card, .property-header, .ai-summary {
        box-shadow: none !important;
        border: 1px solid #e5e7eb !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1>CMA Report${reportType ? ` - ${reportType}` : ''}</h1>
        <p>Generated on ${formatDate(report.reportDate)}</p>
      </div>
      <img src="data:image/png;base64,${logoBase64}" alt="PropertyList Logo" class="logo">
    </div>
    
    <!-- Property Header -->
    <div class="property-header">
      <div class="property-title">
        <div class="property-icon">🏠</div>
        <h2>Property Summary</h2>
      </div>
      
      <div class="property-details">
        <div class="property-info">
                      <h3>📍 <a href="https://maps.google.com/?q=${encodeURIComponent(report.propertyData.address)}" target="_blank" style="color: #00ae9a; text-decoration: none;">${formatComparableAddress(report.propertyData.address)}</a></h3>
          <p>${formatLocation(report.propertyData)}</p>
          
          <div class="property-stats">
            <div class="stat-card">
              <div class="stat-label">Property Type</div>
              <div class="stat-value">${report.propertyData.propertyType}</div>
            </div>
            <div class="stat-card">                              <div class="stat-label">Area</div>
              <div class="stat-value">${report.propertyData.buildArea ? report.propertyData.buildArea.toLocaleString() + ' m²' : 'N/A'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Bedrooms</div>
              <div class="stat-value">${report.propertyData.bedrooms} bed</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Bathrooms</div>
              <div class="stat-value">${report.propertyData.bathrooms} bath</div>
            </div>
          </div>
        </div>
        
        <div class="property-stats">
          ${report.propertyData.price ? `
          <div class="stat-card">
            <div class="stat-label">Asking Price</div>
            <div class="stat-value price-highlight">${formatPrice(report.propertyData.price)}</div>
            ${report.propertyData.refNumber ? `
            <div style="font-size: 10px; color: #6b7280; margin-top: 2px; font-weight: 500;">Ref: ${report.propertyData.refNumber}</div>
            ` : ''}
          </div>
          ` : ''}
          <div class="stat-card">
            <div class="stat-label">Price per m²</div>
            <div class="stat-value">${report.propertyData.price && report.propertyData.buildArea ? formatPrice(Math.round(report.propertyData.price / report.propertyData.buildArea)) : 'N/A'}</div>
          </div>
        </div>
      </div>
      
      <!-- Property Condition -->
      ${(function() {
        const desc = report.propertyData.descriptions?.en || report.propertyData.descriptions?.es || '';
        const descLower = desc.toLowerCase();
        
        // Check for renovation keywords  
        let condition = null;
        let conditionColor = '#059669'; // Default green
        
        if (descLower.includes('renovation villa project') || 
            descLower.includes('renovation project') || 
            descLower.includes('restoration project') ||
            descLower.includes('needs renovation') ||
            descLower.includes('investment opportunity') ||
            descLower.includes('has potential')) {
          condition = 'Renovation Project';
          conditionColor = '#dc2626'; // Red for needs work
        } else if (descLower.includes('newly renovated') || 
                   descLower.includes('recently renovated') ||
                   descLower.includes('renovated') ||
                   descLower.includes('newly built') ||
                   descLower.includes('brand new') ||
                   descLower.includes('immaculate')) {
          condition = 'Excellent Condition';
          conditionColor = '#059669'; // Green for excellent
        } else if (descLower.includes('good condition') ||
                   descLower.includes('well maintained') ||
                   descLower.includes('updated')) {
          condition = 'Good Condition';
          conditionColor = '#3b82f6'; // Blue for good
        }
        
        if (condition) {
          return `
          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 13px; color: #6b7280; font-weight: 500;">Property Condition</div>
              <div style="
                display: inline-block;
                padding: 6px 16px;
                background-color: ${conditionColor}15;
                color: ${conditionColor};
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
                border: 1px solid ${conditionColor}30;
              ">${condition}</div>
            </div>
            ${descLower.includes('renovation') ? 
              '<div style="font-size: 10px; color: #9ca3af; text-align: right; margin-top: 4px;">Based on property description analysis</div>' 
              : ''}
          </div>`;
        }
        return '';
      })()}
    </div>
    
    <!-- Market Data Section -->
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">📈</div>
        <h2 class="section-title">Market Data & Trends</h2>
      </div>
      
      <div class="market-stats">
        <div class="market-stat">
          <div class="market-stat-value">${formatPrice(report.marketTrends.averagePrice)}</div>
          <div class="market-stat-label">Average Price</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-value">${formatPrice(report.marketTrends?.averagePricePerM2 || 0)}</div>
          <div class="market-stat-label">Price per m²</div>
        </div>
        <div class="market-stats">
        <div class="market-stat">
          <div class="market-stat-value">${report.marketTrends.daysOnMarket}</div>
          <div class="market-stat-label">Avg Days on Market</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-value">${report.marketTrends.priceChange12Month > 0 ? '+' : ''}${report.marketTrends.priceChange12Month}%</div>
          <div class="market-stat-label">12-Month Change</div>
        </div>
      </div>
    </div>
    
    <!-- Comparable Properties Section - Dedicated Page -->
    <div class="section-card comparable-properties-page">
      <div class="section-header">
        <div class="section-icon">🏘️</div>
        <h2 class="section-title">Comparable Properties Analysis</h2>
        <div style="font-size: 10px; color: #6b7280; margin-top: 4px; font-style: italic;">
          This page can be removed if comparable properties are not required
        </div>
      </div>
      
      <p style="margin-bottom: 12px; color: #6b7280; font-size: 12px; line-height: 1.4;">
        Recent sales in the area provide valuable insights into current market values and trends. Each comparable property has been carefully selected based on location, size, and characteristics similar to the subject property.
      </p>
      
      <div class="comparables-grid" style="flex: 1;">
        ${report.comparableProperties.slice(0, 12).map(comp => `
        <div class="comparable-card">
          ${comp.images && comp.images.length > 0 ? `
          <div class="comparable-image">
            <img src="${comp.images[0]}" alt="Property image" />
          </div>
          ` : ''}
          <div class="comparable-content">
          <div class="comparable-header">${formatComparableAddress(comp.address)}</div>
          <div class="comparable-type">${comp.propertyType}</div>
          <div class="comparable-details">
            <div class="comparable-detail">
              <span class="label">Price:</span>
              <span class="value price-highlight">${formatPrice(comp.price)}</span>
            </div>
            <div class="comparable-detail">
              <span class="label">Beds/Baths:</span>
              <span class="value" style="text-align: right;">${comp.bedrooms}🛏️ ${comp.bathrooms}🚿</span>
            </div>
              ${comp.buildArea && comp.buildArea > 0 ? `
            <div class="comparable-detail">
              <span class="label">Build:</span>
                <span class="value">${comp.buildArea.toLocaleString()} m²</span>
            </div>` : ''}
              ${comp.plotArea && comp.plotArea > 0 ? `
            <div class="comparable-detail">
              <span class="label">Plot:</span>
                <span class="value">${comp.plotArea.toLocaleString()} m²</span>
            </div>` : ''}
              ${comp.terraceArea && comp.terraceArea > 0 ? `
            <div class="comparable-detail">
              <span class="label">Terrace:</span>
              <span class="value">${comp.terraceArea.toLocaleString()} m²</span>
            </div>` : ''}
            ${comp.features && comp.features.length > 0 ? `
            <div class="comparable-detail">
              <span class="label">Features:</span>
              <span class="value" style="font-size: 10px;">${comp.features.slice(0, 3).join(', ')}${comp.features.length > 3 ? ` (+${comp.features.length - 3} more)` : ''}</span>
            </div>` : ''}
            </div>
            ${comp.refNumber ? `
            <div style="font-size: 8px; color: #6b7280; margin-top: 4px; font-weight: 500; text-align: right;">Ref: ${comp.refNumber}</div>
            ` : ''}
          </div>
        </div>
        `).join('')}
      </div>
    </div>
    
    <!-- Future Developments Section -->
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">🚧</div>
        <h2 class="section-title">Future Developments</h2>
      </div>
      
      <div class="developments-list">
        ${report.futureDevelopment.map(dev => {
          const statusClass = dev.status === 'under_construction' ? 'badge-under-construction' : 
                             dev.status === 'approved' ? 'badge-approved' : 'badge-positive';
          const impactClass = dev.impact === 'positive' ? 'badge-positive' : dev.impact === 'neutral' ? 'badge-neutral' : 'badge-negative';
          const reputationClass = dev.reputationRating === 'excellent' ? 'badge-excellent' :
                                 dev.reputationRating === 'good' ? 'badge-good' :
                                 dev.reputationRating === 'fair' ? 'badge-fair' : 'badge-poor';
          
          return `
          <div class="development-item">
            <div class="development-header">
              <div class="development-name">${dev.project}</div>
              <div class="development-badges">
                <span class="badge ${statusClass}">${dev.status.replace('_', ' ')}</span>
                <span class="badge ${impactClass}">${dev.impact}</span>
                <span class="badge ${reputationClass}">${dev.reputationRating} source</span>
              </div>
            </div>
            <div class="development-description">${dev.description}</div>
            <div class="development-footer">
              <span style="font-size: 10px;">Type: ${dev.type}</span>
              <span style="font-size: 10px;">ETA: ${formatDate(dev.completionDate)}</span>
            </div>
          </div>
          `
        }).join('')}
      </div>
    </div>
    
    <!-- Property Images Gallery Page -->
    ${report.propertyData.images && report.propertyData.images.length > 0 ? `
    <div class="section-card" style="page-break-before: always;">
      <div class="section-header">
        <div class="section-icon">📸</div>
        <h2 class="section-title">Property Images Gallery</h2>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px; font-style: italic;">
          Complete visual overview of the property
        </div>
      </div>
      
      <p style="margin-bottom: 20px; color: #6b7280; font-size: 14px; line-height: 1.5;">
        Below are all available images of the property, providing a comprehensive visual assessment of the condition, layout, and features.
      </p>
      
      <div class="image-gallery-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
        ${report.propertyData.images.map((image, index) => `
        <div class="gallery-item" style="text-align: center;">
          <img src="${image}" alt="Property image ${index + 1}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 12px; border: 1px solid #e5e7eb;" />
          <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">Image ${index + 1}</div>
        </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    <!-- AI Analysis Summary - Final Section -->
    <div class="section-card" style="page-break-before: always; margin-bottom: 20px;">
      <div class="section-header">
        <div class="section-icon">🤖</div>
        <h2 class="section-title">AI Analysis Summary</h2>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px; font-style: italic;">
          Comprehensive AI-powered property analysis and investment insights
      </div>
        </div>
        
      <div class="ai-content" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <!-- Left Column -->
        <div>
          <div class="ai-section" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">📌 Executive Summary</h3>
            <p style="font-size: 12px; line-height: 1.5; color: #374151;">${report.summary.overview}</p>
        </div>
        
          <div class="ai-section" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">💰 Investment Recommendation</h3>
            <p style="font-size: 12px; line-height: 1.5; color: #374151;">${report.summary.investmentPotential}</p>
        </div>
        
          <div class="ai-section" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">📊 Market Position</h3>
            <p style="font-size: 12px; line-height: 1.5; color: #374151;">${report.summary.marketPosition}</p>
        </div>

        ${report.summary.propertyCondition ? `
          <div class="ai-section" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">🏠 Property Condition</h3>
            <p style="font-size: 12px; line-height: 1.5; color: #374151;">${report.summary.propertyCondition}</p>
        </div>
        ` : ''}

        ${report.summary.architecturalAnalysis ? `
          <div class="ai-section" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">🏛️ Architectural Analysis</h3>
            <p style="font-size: 12px; line-height: 1.5; color: #374151;">${report.summary.architecturalAnalysis}</p>
        </div>
        ` : ''}
        </div>
        
        <!-- Right Column -->
        <div>
          <div class="ai-section" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">🔮 Valuation Range</h3>
            <div style="background: #f9fafb; padding: 8px; border-radius: 6px; border: 1px solid #e5e7eb;">
              <div style="font-size: 16px; font-weight: bold; color: #00ae9a; margin-bottom: 4px;">
                ${formatPrice(report.valuationEstimate.low)} - ${formatPrice(report.valuationEstimate.high)}
              </div>
              <div style="font-size: 11px; color: #6b7280;">
                ${report.valuationEstimate.confidence}% confidence level
              </div>
            </div>
          </div>

        ${report.summary.marketTiming ? `
          <div class="ai-section" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">⏰ Market Timing</h3>
            <p style="font-size: 12px; line-height: 1.5; color: #374151;">${report.summary.marketTiming}</p>
        </div>
        ` : ''}

        ${report.summary.investmentTiming ? `
          <div class="ai-section" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">🎯 Investment Timing</h3>
            <p style="font-size: 12px; line-height: 1.5; color: #374151;">${report.summary.investmentTiming}</p>
        </div>
        ` : ''}

        ${report.summary.walkabilityInsights ? `
          <div class="ai-section" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">🚶 Walkability Insights</h3>
            <p style="font-size: 12px; line-height: 1.5; color: #374151;">${report.summary.walkabilityInsights}</p>
        </div>
        ` : ''}

        ${report.summary.developmentImpact ? `
          <div class="ai-section" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">🏗️ Development Impact</h3>
            <p style="font-size: 12px; line-height: 1.5; color: #374151;">${report.summary.developmentImpact}</p>
        </div>
        ` : ''}
        </div>
      </div>

      <!-- Full Width Sections -->
        ${report.summary.comparableInsights ? `
      <div class="ai-section" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px;">
        <h3 style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">📈 Comparable Insights</h3>
        <p style="font-size: 12px; line-height: 1.5; color: #374151;">${report.summary.comparableInsights}</p>
        </div>
        ` : ''}

        ${report.summary.riskAssessment ? `
      <div class="ai-section" style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px;">
        <h3 style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 8px;">📋 Key Considerations & Recommendations</h3>
        <p style="font-size: 12px; line-height: 1.5; color: #374151;">${report.summary.riskAssessment}</p>
        </div>
        ` : ''}
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p>This report was generated by PropertyList Research Agent on ${formatDate(report.reportDate)}</p>
      <p>© ${new Date().getFullYear()} PropertyList.es All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `
} 