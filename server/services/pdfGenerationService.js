const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class PDFGenerationService {
  constructor() {
    this.templateDir = path.join(__dirname, '../templates');
    this.outputDir = path.join(__dirname, '../../reports');
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    if (!fs.existsSync(this.templateDir)) {
      fs.mkdirSync(this.templateDir, { recursive: true });
    }
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate comprehensive property analysis PDF
   */
  async generatePropertyReport(sessionId, propertyData, analysisData) {
    try {
      console.log('Generating PDF report for session:', sessionId);
      
      // Build HTML content
      const htmlContent = this.buildReportHTML(propertyData, analysisData);
      
      // Launch Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Set page content and styling
      await page.setContent(htmlContent, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      
      // Generate filename following the specified pattern
      const filename = this.generateFilename(propertyData, sessionId);
      const filepath = path.join(this.outputDir, filename);
      
      // Generate PDF
      await page.pdf({
        path: filepath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm', 
          bottom: '20mm',
          left: '15mm'
        },
        displayHeaderFooter: true,
        headerTemplate: this.getHeaderTemplate(),
        footerTemplate: this.getFooterTemplate()
      });
      
      await browser.close();
      
      console.log('PDF report generated:', filename);
      
      return {
        success: true,
        filename,
        filepath,
        size: fs.statSync(filepath).size,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error generating PDF report:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generate filename following the pattern specified in memory
   */
  generateFilename(propertyData, sessionId) {
    const reportType = this.determineReportType(propertyData);
    const reference = propertyData.reference || sessionId.substring(0, 8);
    const location = this.getLocationForFilename(propertyData);
    const date = new Date().toISOString().split('T')[0];
    
    // Pattern: 'CMA #Buyer/Seller/Tenant/Investor Report for #referenceNumber - #Suburb(fallback City) - date'
    return `CMA ${reportType} Report for ${reference} - ${location} - ${date}.pdf`;
  }

  /**
   * Determine report type based on property data
   */
  determineReportType(propertyData) {
    if (propertyData.is_sale) return 'Buyer/Seller';
    if (propertyData.is_long_term) return 'Tenant/Investor';
    if (propertyData.is_short_term) return 'Investor';
    return 'Buyer/Seller'; // Default
  }

  /**
   * Get location for filename with fallback hierarchy
   */
  getLocationForFilename(propertyData) {
    // Priority: urbanization > suburb > city
    if (propertyData.urbanization) return propertyData.urbanization;
    if (propertyData.suburb) return propertyData.suburb;
    if (propertyData.city) return propertyData.city;
    return 'Spain';
  }

  /**
   * Build comprehensive HTML report
   */
  buildReportHTML(propertyData, analysisData) {
    const { comparables, summary, chartData, aiInsights, marketResearch } = analysisData;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Property Analysis Report</title>
        <style>
        ${this.getReportCSS()}
        </style>
    </head>
    <body>
        ${this.buildHeaderSection(propertyData)}
        ${this.buildExecutiveSummary(summary, aiInsights)}
        ${this.buildPropertyDetails(propertyData)}
        ${this.buildMarketAnalysis(chartData)}
        ${this.buildComparablesSection(comparables)}
        ${this.buildAIInsights(aiInsights)}
        ${this.buildMarketResearch(marketResearch)}
        ${this.buildFooterSection()}
    </body>
    </html>
    `;
  }

  /**
   * Get comprehensive CSS styling for the report
   */
  getReportCSS() {
    return `
    body {
        font-family: 'Segoe UI', Arial, sans-serif;
        margin: 0;
        padding: 0;
        color: #333;
        line-height: 1.6;
    }
    
    .header {
        background: linear-gradient(135deg, #00ae9a, #007b6d);
        color: white;
        padding: 30px;
        margin-bottom: 30px;
    }
    
    .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        max-width: 1000px;
        margin: 0 auto;
    }
    
    .logo-section {
        display: flex;
        align-items: center;
        gap: 20px;
    }
    
    .header-logo {
        height: 60px;
        width: auto;
        filter: brightness(0) invert(1);
    }
    
    .company-info {
        text-align: left;
    }
    
    .company-name {
        font-size: 24px;
        font-weight: bold;
        margin: 0;
    }
    
    .company-tagline {
        font-size: 14px;
        opacity: 0.9;
        margin-top: 2px;
    }
    
    .report-info {
        text-align: right;
    }
    
    .header h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 300;
    }
    
    .header .subtitle {
        font-size: 16px;
        opacity: 0.9;
        margin-top: 10px;
    }
    
    .section {
        margin-bottom: 30px;
        padding: 0 20px;
    }
    
    .section h2 {
        color: #00ae9a;
        border-bottom: 2px solid #00ae9a;
        padding-bottom: 10px;
        margin-bottom: 20px;
    }
    
    .property-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 20px;
    }
    
    .property-detail {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        border-left: 4px solid #00ae9a;
    }
    
    .property-detail .label {
        font-weight: bold;
        color: #666;
        font-size: 12px;
        text-transform: uppercase;
    }
    
    .property-detail .value {
        font-size: 18px;
        color: #333;
        margin-top: 5px;
    }
    
    .comparable-item {
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 15px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .comparable-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    }
    
    .comparable-reference {
        font-weight: bold;
        color: #00ae9a;
        font-size: 16px;
    }
    
    .similarity-score {
        background: #00ae9a;
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: bold;
    }
    
    .comparable-details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        margin-top: 15px;
    }
    
    .metric {
        text-align: center;
    }
    
    .metric .value {
        font-size: 20px;
        font-weight: bold;
        color: #00ae9a;
    }
    
    .metric .label {
        font-size: 12px;
        color: #666;
        text-transform: uppercase;
    }
    
    .ai-insights {
        background: #f0f8ff;
        border: 1px solid #b3d9ff;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
    }
    
    .confidence-badge {
        display: inline-block;
        background: #007bff;
        color: white;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: bold;
        margin-bottom: 10px;
    }
    
    .recommendations {
        margin-top: 15px;
    }
    
    .recommendation {
        background: white;
        border-left: 4px solid #28a745;
        padding: 10px 15px;
        margin-bottom: 8px;
        border-radius: 0 4px 4px 0;
    }
    
    .footer {
        background: #f8f9fa;
        padding: 20px;
        text-align: center;
        border-top: 1px solid #e0e0e0;
        font-size: 12px;
        color: #666;
        margin-top: 40px;
    }
    
    .page-break {
        page-break-before: always;
    }
    
    @media print {
        .no-print { display: none; }
    }
    `;
  }

  /**
   * Build header section with PropertyList logo
   */
  buildHeaderSection(propertyData) {
    const location = this.formatPropertyLocation(propertyData);
    const propertyType = this.getPropertyTypeName(propertyData.property_type);
    const logoPath = path.join(__dirname, '../../public/PropertyList logo.png');
    const logoBase64 = this.getLogoBase64(logoPath);
    
    return `
    <div class="header">
        <div class="header-content">
            <div class="logo-section">
                ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="PropertyList.es" class="header-logo">` : ''}
                <div class="company-info">
                    <div class="company-name">PropertyList.es</div>
                    <div class="company-tagline">Professional Property Analysis</div>
                </div>
            </div>
            <div class="report-info">
                <h1>Comparative Market Analysis</h1>
                <div class="subtitle">
                    ${propertyType} in ${location} | 
                    Reference: ${propertyData.reference || 'N/A'} | 
                    Generated: ${new Date().toLocaleDateString('en-GB')}
                </div>
            </div>
        </div>
    </div>
    `;
  }

  /**
   * Build executive summary section
   */
  buildExecutiveSummary(summary, aiInsights) {
    const confidence = aiInsights?.confidence || 0;
    const confidenceClass = confidence > 80 ? 'high' : confidence > 60 ? 'medium' : 'low';
    
    return `
    <div class="section">
        <h2>Executive Summary</h2>
        <div class="ai-insights">
            <div class="confidence-badge">Analysis Confidence: ${confidence}%</div>
            <p>${summary}</p>
            ${aiInsights?.analysis ? `<p><strong>AI Analysis:</strong> ${aiInsights.analysis.substring(0, 500)}...</p>` : ''}
        </div>
    </div>
    `;
  }

  /**
   * Build property details section
   */
  buildPropertyDetails(propertyData) {
    return `
    <div class="section">
        <h2>Subject Property Details</h2>
        <div class="property-grid">
            <div class="property-detail">
                <div class="label">Price</div>
                <div class="value">€${propertyData.price?.toLocaleString() || 'N/A'}</div>
            </div>
            <div class="property-detail">
                <div class="label">Build Area</div>
                <div class="value">${propertyData.build_square_meters || propertyData.build_area || 'N/A'}m²</div>
            </div>
            <div class="property-detail">
                <div class="label">Bedrooms</div>
                <div class="value">${propertyData.bedrooms || 'N/A'}</div>
            </div>
            <div class="property-detail">
                <div class="label">Bathrooms</div>
                <div class="value">${propertyData.bathrooms || 'N/A'}</div>
            </div>
            <div class="property-detail">
                <div class="label">Property Type</div>
                <div class="value">${this.getPropertyTypeName(propertyData.property_type)}</div>
            </div>
            <div class="property-detail">
                <div class="label">Location</div>
                <div class="value">${this.formatPropertyLocation(propertyData)}</div>
            </div>
        </div>
    </div>
    `;
  }

  /**
   * Build market analysis section
   */
  buildMarketAnalysis(chartData) {
    if (!chartData) return '';
    
    const { priceComparison, marketPosition, sizeComparison } = chartData;
    
    return `
    <div class="section">
        <h2>Market Analysis</h2>
        <div class="property-grid">
            <div class="property-detail">
                <div class="label">Average Market Price</div>
                <div class="value">€${priceComparison?.average?.toLocaleString() || 'N/A'}</div>
            </div>
            <div class="property-detail">
                <div class="label">Price Range</div>
                <div class="value">€${priceComparison?.min?.toLocaleString()} - €${priceComparison?.max?.toLocaleString()}</div>
            </div>
            <div class="property-detail">
                <div class="label">Market Position</div>
                <div class="value">${marketPosition?.percentile || 'N/A'}th percentile</div>
            </div>
            <div class="property-detail">
                <div class="label">Average Size</div>
                <div class="value">${sizeComparison?.average || 'N/A'}m²</div>
            </div>
        </div>
    </div>
    `;
  }

  /**
   * Build comparables section
   */
  buildComparablesSection(comparables) {
    if (!comparables || comparables.length === 0) {
      return '<div class="section"><h2>Comparable Properties</h2><p>No comparable properties found.</p></div>';
    }
    
    const comparablesHTML = comparables.slice(0, 6).map(comp => `
      <div class="comparable-item">
          <div class="comparable-header">
              <div class="comparable-reference">${comp.reference || 'N/A'}</div>
              <div class="similarity-score">${comp.overallPercent || 0}% Similar</div>
          </div>
          <div class="comparable-details">
              <div class="metric">
                  <div class="value">€${comp.price?.toLocaleString() || 'N/A'}</div>
                  <div class="label">Price</div>
              </div>
              <div class="metric">
                  <div class="value">${comp.buildArea || 'N/A'}m²</div>
                  <div class="label">Build Size</div>
              </div>
              ${comp.terraceArea ? `<div class="metric">
                  <div class="value">${comp.terraceArea}m²</div>
                  <div class="label">Terrace</div>
              </div>` : ''}
              ${comp.plotArea ? `<div class="metric">
                  <div class="value">${comp.plotArea}m²</div>
                  <div class="label">Plot</div>
              </div>` : ''}
              <div class="metric">
                  <div class="value">${comp.bedrooms || 'N/A'}</div>
                  <div class="label">Bedrooms</div>
              </div>
              ${comp.condition ? `<div class="metric">
                  <div class="value" style="text-transform: capitalize;">${comp.condition}</div>
                  <div class="label">Condition</div>
              </div>` : ''}
              <div class="metric">
                  <div class="value">${comp.distancePercent || 0}%</div>
                  <div class="label">Location Match</div>
              </div>
              <div class="metric">
                  <div class="value">${comp.pricePercent || 0}%</div>
                  <div class="label">Price Match</div>
              </div>
              <div class="metric">
                  <div class="value">${comp.sizePercent || 0}%</div>
                  <div class="label">Size Match</div>
              </div>
          </div>
          <p style="margin-top: 10px; color: #666; font-size: 14px;">${comp.address || 'Address not available'}</p>
      </div>
    `).join('');
    
    return `
    <div class="section page-break">
        <h2>Comparable Properties</h2>
        ${comparablesHTML}
    </div>
    `;
  }

  /**
   * Build AI insights section
   */
  buildAIInsights(aiInsights) {
    if (!aiInsights || !aiInsights.recommendations) return '';
    
    const recommendationsHTML = aiInsights.recommendations.map(rec => 
      `<div class="recommendation">${rec}</div>`
    ).join('');
    
    return `
    <div class="section">
        <h2>AI-Powered Recommendations</h2>
        <div class="recommendations">
            ${recommendationsHTML}
        </div>
    </div>
    `;
  }

  /**
   * Build market research section
   */
  buildMarketResearch(marketResearch) {
    if (!marketResearch) return '';
    
    return `
    <div class="section">
        <h2>Market Research Insights</h2>
        <div class="ai-insights">
            <p><strong>Location:</strong> ${marketResearch.location}</p>
            ${marketResearch.investment?.insights ? `<p><strong>Investment Insights:</strong> ${marketResearch.investment.insights}</p>` : ''}
            ${marketResearch.pricing?.trends ? `<p><strong>Price Trends:</strong> ${marketResearch.pricing.trends}</p>` : ''}
        </div>
    </div>
    `;
  }

  /**
   * Build footer section
   */
  buildFooterSection() {
    return `
    <div class="footer">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div>
                <strong>PropertyList.es</strong> - Professional Property Analysis
            </div>
            <div style="color: #00ae9a;">
                Generated on ${new Date().toLocaleString('en-GB')}
            </div>
        </div>
        <p>This report was generated by AI Property Research Agent using PropertyList.es MLS Data</p>
        <p>© ${new Date().getFullYear()} PropertyList.es. This report is for information purposes only and should not be considered as professional advice.</p>
    </div>
    `;
  }

  /**
   * Get header template for PDF
   */
  getHeaderTemplate() {
    return `
    <div style="font-size: 10px; padding: 0 20px; width: 100%; display: flex; justify-content: space-between; align-items: center;">
        <span>PropertyList.es - Property Analysis Report</span>
        <span style="color: #00ae9a;">Generated: ${new Date().toLocaleDateString('en-GB')}</span>
    </div>
    `;
  }

  /**
   * Get footer template for PDF
   */
  getFooterTemplate() {
    return `
    <div style="font-size: 10px; padding: 0 20px; width: 100%; display: flex; justify-content: space-between; align-items: center;">
        <span>AI Property Research Agent</span>
        <span class="pageNumber"></span>
    </div>
    `;
  }

  /**
   * Format property location
   */
  formatPropertyLocation(propertyData) {
    const components = [];
    if (propertyData.urbanization) components.push(propertyData.urbanization);
    if (propertyData.suburb) components.push(propertyData.suburb);
    if (propertyData.city) components.push(propertyData.city);
    return components.join(', ') || 'Location not specified';
  }

  /**
   * Get property type name
   */
  getPropertyTypeName(propertyType) {
    const types = {
      1: 'Apartment',
      2: 'Villa', 
      3: 'Townhouse',
      4: 'Plot',
      5: 'Commercial',
      6: 'Office',
      7: 'Garage',
      8: 'Hotel',
      9: 'Industrial'
    };
    return types[propertyType] || 'Property';
  }

  /**
   * Convert logo file to base64 for embedding in PDF
   */
  getLogoBase64(logoPath) {
    try {
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        return logoBuffer.toString('base64');
      }
      return null;
    } catch (error) {
      console.warn('Could not load logo for PDF:', error.message);
      return null;
    }
  }
}

module.exports = PDFGenerationService; 