import { NextRequest, NextResponse } from 'next/server'
import { generatePDFContent } from '@/lib/openai'
import jsPDF from 'jspdf'

// Define teal color palette
const colors = {
  primary: '#00ae9a',      // Main teal
  primaryDark: '#008a7c',  // Darker teal
  secondary: '#f0fffe',    // Light teal background
  accent: '#00635a',       // Darkest teal
  text: '#1f2937',         // Dark gray
  lightGray: '#6b7280',    // Medium gray
  background: '#ffffff',   // White
  border: '#e5e7eb'        // Light border
}

export async function POST(request: NextRequest) {
  try {
    const { result, propertyUrl, researchTopic } = await request.json()
    
    if (!result) {
      return NextResponse.json(
        { error: 'Analysis result is required' },
        { status: 400 }
      )
    }

    // Generate PDF content using OpenAI
    const pdfContent = await generatePDFContent(result, propertyUrl, researchTopic)
    
    // Create PDF document with better formatting
    const doc = new jsPDF('p', 'mm', 'a4')
    
    // Set document properties
    doc.setProperties({
      title: 'PropertyList Research Agent - Market Analysis Report',
      subject: `Property Analysis for ${result.propertyData.location}`,
      author: 'PropertyList Research Agent',
      keywords: 'property, analysis, real estate, market research',
      creator: 'PropertyList Research Agent'
    })

    // Helper functions for better formatting
    const addHeader = (title: string, subtitle?: string) => {
      // Header background
      doc.setFillColor(0, 174, 154) // Teal
      doc.rect(0, 0, 210, 25, 'F')
      
      // Logo placeholder (if you have a logo)
      doc.setFillColor(255, 255, 255)
      doc.circle(15, 12.5, 8, 'F')
      
      // Title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(255, 255, 255)
      doc.text(title, 30, 12)
      
      if (subtitle) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'normal')
        doc.text(subtitle, 30, 18)
      }
      
      // Reset colors
      doc.setTextColor(31, 41, 55) // Dark gray
    }

    const addSection = (title: string, yPos: number) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(0, 174, 154) // Teal
      doc.text(title, 20, yPos)
      
      // Underline
      doc.setDrawColor(0, 174, 154)
      doc.setLineWidth(0.5)
      doc.line(20, yPos + 2, 190, yPos + 2)
      
      return yPos + 10
    }

    const addKeyValuePair = (key: string, value: string, x: number, y: number, maxWidth = 85) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(107, 114, 128) // Medium gray
      doc.text(`${key}:`, x, y)
      
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(31, 41, 55) // Dark gray
      const valueText = doc.splitTextToSize(value, maxWidth)
      doc.text(valueText, x, y + 5)
      
      return y + 5 + (valueText.length * 5)
    }

    const addCard = (x: number, y: number, width: number, height: number, title: string, content: string) => {
      // Card background
      doc.setFillColor(240, 255, 254) // Light teal
      doc.setDrawColor(229, 231, 235) // Light border
      doc.setLineWidth(0.2)
      doc.roundedRect(x, y, width, height, 2, 2, 'FD')
      
      // Title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(0, 99, 90) // Dark teal
      doc.text(title, x + 5, y + 8)
      
      // Content
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(31, 41, 55)
      const contentLines = doc.splitTextToSize(content, width - 10)
      doc.text(contentLines, x + 5, y + 15)
      
      return y + height + 5
    }

    const addChart = (x: number, y: number, width: number, height: number, data: any) => {
      // Simple chart background
      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(229, 231, 235)
      doc.rect(x, y, width, height, 'FD')
      
      // Chart title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(0, 174, 154)
      doc.text('Market Comparison', x + 5, y + 10)
      
      // Simple bar representation
      if (data.priceComparison) {
        const barY = y + 20
        const barHeight = 8
        
        // Property price bar
        doc.setFillColor(0, 174, 154)
        doc.rect(x + 5, barY, 40, barHeight, 'F')
        doc.setFontSize(8)
        doc.setTextColor(31, 41, 55)
        doc.text('This Property', x + 5, barY + barHeight + 5)
        
        // Average market price bar
        doc.setFillColor(107, 114, 128)
        doc.rect(x + 5, barY + 15, 35, barHeight, 'F')
        doc.text('Market Average', x + 5, barY + 15 + barHeight + 5)
      }
    }

    // PAGE 1: Executive Summary
    addHeader('PropertyList Research Agent', 'Comprehensive Property Market Analysis')
    
    let yPos = 35
    
    // Property Overview Card
    yPos = addCard(20, yPos, 170, 40, 'Property Overview', 
      `${result.propertyData.location} • €${result.propertyData.price.toLocaleString()} • ${result.propertyData.sqm}m² • ${result.propertyData.bedrooms} bed, ${result.propertyData.bathrooms} bath`)
    
    // Executive Summary
    yPos = addSection('Executive Summary', yPos)
    const summary = result.report?.executiveSummary || result.insights?.summary || 'Comprehensive market analysis completed.'
    const summaryLines = doc.splitTextToSize(summary, 170)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(summaryLines, 20, yPos)
    yPos += summaryLines.length * 6 + 10

    // Key Metrics in Cards
    const col1X = 20, col2X = 105, cardWidth = 80, cardHeight = 25
    
    yPos = addCard(col1X, yPos, cardWidth, cardHeight, 'Market Value', 
      `€${(result.insights?.valuation?.estimatedValue || result.propertyData.price).toLocaleString()}`)
    
    addCard(col2X, yPos - cardHeight, cardWidth, cardHeight, 'Investment Grade', 
      result.insights?.investment?.potential || 'Medium')
    
    yPos += 10
    
    addCard(col1X, yPos, cardWidth, cardHeight, 'Price Assessment', 
      result.insights?.valuation?.priceAssessment || 'Fairly Priced')
    
    addCard(col2X, yPos, cardWidth, cardHeight, 'Market Trend', 
      result.marketData?.marketTrend || 'Stable')
    
    yPos += 35

    // Market Comparison Chart
    addChart(20, yPos, 170, 40, result.insights?.valuation)
    yPos += 50

    // Strengths and Weaknesses
    if (yPos > 220) {
      doc.addPage()
      yPos = 20
    }

    yPos = addSection('Key Insights', yPos)
    
    // Two column layout for strengths/weaknesses
    if (result.report?.strengths) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(34, 197, 94) // Green
      doc.text('✓ Strengths', 20, yPos)
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(31, 41, 55)
      result.report.strengths.slice(0, 3).forEach((strength: string, index: number) => {
        doc.text(`• ${strength}`, 25, yPos + 8 + (index * 6))
      })
    }

    if (result.report?.weaknesses) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(239, 68, 68) // Red
      doc.text('⚠ Considerations', 105, yPos)
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(31, 41, 55)
      result.report.weaknesses.slice(0, 2).forEach((weakness: string, index: number) => {
        doc.text(`• ${weakness}`, 110, yPos + 8 + (index * 6))
      })
    }

    // PAGE 2: Detailed Analysis
    doc.addPage()
    addHeader('Market Analysis', result.propertyData.location)
    yPos = 35

    // Property Details Section
    yPos = addSection('Property Details', yPos)
    
    const details = [
      ['Location', result.propertyData.location],
      ['Price', `€${result.propertyData.price.toLocaleString()}`],
      ['Size', `${result.propertyData.sqm} m²`],
      ['Price per m²', `€${result.propertyData.pricePerSqm?.toLocaleString() || 'N/A'}`],
      ['Type', result.propertyData.type],
      ['Bedrooms', result.propertyData.bedrooms.toString()],
      ['Bathrooms', result.propertyData.bathrooms.toString()],
      ['Transaction', result.propertyData.saleOrRent],
      ['New Construction', result.propertyData.isNewConstruction ? 'Yes' : 'No']
    ]
    
    details.forEach((detail, index) => {
      const x = (index % 2 === 0) ? 20 : 105
      if (index % 2 === 0 && index > 0) yPos += 12
      yPos = addKeyValuePair(detail[0], detail[1], x, yPos)
    })

    yPos += 10

    // Market Data Section
    yPos = addSection('Market Analysis', yPos)
    
    if (result.marketData) {
      const marketDetails = [
        ['Average Price/m²', `€${result.marketData.averagePricePerSqm?.toLocaleString() || 'N/A'}`],
        ['Market Trend', result.marketData.marketTrend || 'N/A'],
        ['Days on Market', `${result.marketData.daysOnMarket || 'N/A'} days`],
        ['Price Growth', `${result.marketData.priceGrowth || 'N/A'}%`],
        ['Market Segment', result.marketData.marketSegment || 'N/A'],
        ['Competition Level', result.marketData.competitionLevel || 'N/A']
      ]
      
      marketDetails.forEach((detail, index) => {
        const x = (index % 2 === 0) ? 20 : 105
        if (index % 2 === 0 && index > 0) yPos += 12
        yPos = addKeyValuePair(detail[0], detail[1], x, yPos)
      })
    }

    // PAGE 3: Financial Analysis
    doc.addPage()
    addHeader('Financial Analysis', 'Investment Projections & Returns')
    yPos = 35

    if (result.financialProjections) {
      // Purchase Scenario
      yPos = addSection('Purchase Analysis', yPos)
      if (result.financialProjections.purchaseScenario) {
        const purchase = result.financialProjections.purchaseScenario
        yPos = addCard(20, yPos, 170, 35, 'Total Investment Required',
          `Acquisition: €${purchase.acquisitionCosts?.toLocaleString() || 'N/A'}\n` +
          `Legal Fees: €${purchase.legalFees?.toLocaleString() || 'N/A'}\n` +
          `Total: €${purchase.totalInvestment?.toLocaleString() || 'N/A'}`)
      }

      // Rental Scenario
      if (result.financialProjections.rentalScenario) {
        const rental = result.financialProjections.rentalScenario
        yPos = addCard(20, yPos, 170, 35, 'Rental Income Projection',
          `Monthly Rent: €${rental.monthlyRent?.toLocaleString() || 'N/A'}\n` +
          `Annual Rent: €${rental.annualRent?.toLocaleString() || 'N/A'}\n` +
          `Net Yield: ${rental.netYield || 'N/A'}%`)
      }

      // Sale Scenario
      if (result.financialProjections.saleScenario) {
        const sale = result.financialProjections.saleScenario
        yPos = addCard(20, yPos, 170, 35, 'Appreciation Forecast',
          `Year 3 Value: €${sale.year3Value?.toLocaleString() || 'N/A'}\n` +
          `Year 5 Value: €${sale.year5Value?.toLocaleString() || 'N/A'}\n` +
          `Annual Return: ${sale.annualizedReturn || 'N/A'}%`)
      }
    }

    // Investment Recommendation
    yPos = addSection('Investment Recommendation', yPos)
    if (result.insights?.investment) {
      const investment = result.insights.investment
      yPos = addCard(20, yPos, 170, 40, `Investment Grade: ${investment.potential || 'Medium'}`,
        `Expected ROI: ${investment.expectedROI || 'N/A'}%\n` +
        `Risk Level: ${investment.liquidityRisk || 'Medium'}\n` +
        `Payback Period: ${investment.paybackPeriod || 'N/A'} years`)
    }

    // PAGE 4: Recommendations
    doc.addPage()
    addHeader('Strategic Recommendations', 'Actionable Insights')
    yPos = 35

    // Buyer Advice
    if (result.insights?.recommendations?.buyerAdvice) {
      yPos = addSection('For Buyers', yPos)
      const advice = result.insights.recommendations.buyerAdvice
      if (typeof advice === 'object') {
        yPos = addCard(20, yPos, 170, 50, `Recommendation: ${advice.recommendation || 'Analyze Further'}`,
          `${advice.reasoning || 'Conduct thorough analysis before proceeding.'}\n\n` +
          `Max Price: €${advice.maxPrice?.toLocaleString() || 'TBD'}\n` +
          `Timeline: ${advice.timeline || 'Standard process'}`)
      } else {
        const adviceLines = doc.splitTextToSize(advice, 170)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.text(adviceLines, 20, yPos)
        yPos += adviceLines.length * 5 + 10
      }
    }

    // Seller Advice
    if (result.insights?.recommendations?.sellerAdvice) {
      yPos = addSection('For Sellers', yPos)
      const advice = result.insights.recommendations.sellerAdvice
      if (typeof advice === 'object') {
        yPos = addCard(20, yPos, 170, 45, `Strategy: ${advice.pricingStrategy || 'Market Price'}`,
          `${advice.marketingStrategy || 'Standard marketing approach.'}\n\n` +
          `Timing: ${advice.timing || 'Current market'}\n` +
          `Expected Sale Time: ${advice.expectedTimeToSell || 'N/A'} days`)
      } else {
        const adviceLines = doc.splitTextToSize(advice, 170)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.text(adviceLines, 20, yPos)
        yPos += adviceLines.length * 5 + 10
      }
    }

    // Investor Advice
    if (result.insights?.recommendations?.investorAdvice) {
      yPos = addSection('For Investors', yPos)
      const advice = result.insights.recommendations.investorAdvice
      if (typeof advice === 'object') {
        yPos = addCard(20, yPos, 170, 45, `Strategy: ${advice.strategy || 'Buy and Hold'}`,
          `${advice.financing || 'Standard financing recommended.'}\n\n` +
          `Hold Period: ${advice.holdPeriod || 'N/A'} years\n` +
          `Exit Strategy: ${advice.exitStrategy || 'TBD'}`)
      } else {
        const adviceLines = doc.splitTextToSize(advice, 170)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.text(adviceLines, 20, yPos)
        yPos += adviceLines.length * 5 + 10
      }
    }

    // SWOT Analysis
    if (result.swotAnalysis) {
      yPos = addSection('SWOT Analysis', yPos)
      
      const swot = result.swotAnalysis
      const quadrantWidth = 80
      const quadrantHeight = 35
      
      // Strengths (top-left)
      yPos = addCard(20, yPos, quadrantWidth, quadrantHeight, 'Strengths',
        swot.strengths?.slice(0, 3).join('\n• ') || 'To be determined')
      
      // Weaknesses (top-right)
      addCard(105, yPos - quadrantHeight, quadrantWidth, quadrantHeight, 'Weaknesses',
        swot.weaknesses?.slice(0, 3).join('\n• ') || 'To be determined')
      
      // Opportunities (bottom-left)
      yPos = addCard(20, yPos, quadrantWidth, quadrantHeight, 'Opportunities',
        swot.opportunities?.slice(0, 3).join('\n• ') || 'To be determined')
      
      // Threats (bottom-right)
      addCard(105, yPos - quadrantHeight, quadrantWidth, quadrantHeight, 'Threats',
        swot.threats?.slice(0, 3).join('\n• ') || 'To be determined')
    }

    // PAGE 5: Detailed Report
    doc.addPage()
    addHeader('Detailed Market Report', 'Comprehensive Analysis')
    yPos = 35

    // Full report content
    const fullReport = result.report?.fullReport || pdfContent
    const reportLines = doc.splitTextToSize(fullReport, 170)
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(31, 41, 55)
    
    reportLines.forEach((line: string) => {
      if (yPos > 280) {
        doc.addPage()
        addHeader('Detailed Market Report', 'Continued')
        yPos = 35
      }
      doc.text(line, 20, yPos)
      yPos += 5
    })

    // Footer on last page
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(107, 114, 128)
    doc.text(`Generated by PropertyList Research Agent on ${new Date().toLocaleDateString()}`, 20, 285)
    doc.text(`Property URL: ${propertyUrl}`, 20, 290)
    if (researchTopic) {
      doc.text(`Research Focus: ${researchTopic}`, 20, 295)
    }

    // Generate PDF blob
    const pdfBlob = doc.output('blob')
    
    // Convert blob to buffer
    const buffer = Buffer.from(await pdfBlob.arrayBuffer())
    
    // Return PDF as response
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PropertyList-Analysis-${Date.now()}.pdf"`,
      },
    })
    
  } catch (error) {
    console.error('PDF generation failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
} 