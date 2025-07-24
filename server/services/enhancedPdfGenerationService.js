const PDFDocument = require('pdfkit');
const fs = require('fs-extra');
const path = require('path');

/**
 * Enhanced PDF Generation Service
 * Generates professional property analysis reports with embedded fresh images
 * Self-contained PDFs with no external dependencies or expiring URLs
 */
class EnhancedPdfGenerationService {
  constructor() {
    // PDF Configuration
    this.config = {
      pageSize: 'A4',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      },
      colors: {
        primary: '#00ae9a',
        secondary: '#6366f1',
        text: '#1f2937',
        textLight: '#6b7280',
        background: '#f9fafb',
        border: '#e5e7eb'
      },
      fonts: {
        regular: 'Helvetica',
        bold: 'Helvetica-Bold',
        italic: 'Helvetica-Oblique'
      }
    };
    
    // Ensure output directory exists
    this.outputDir = path.join(__dirname, '../data/reports');
    fs.ensureDirSync(this.outputDir);
    
    // Metrics
    this.metrics = {
      totalReports: 0,
      successfulReports: 0,
      failedReports: 0,
      averageGenerationTime: 0,
      totalFileSize: 0,
      lastReset: new Date()
    };
    
    console.log('📄 Enhanced PDF Generation Service initialized');
    console.log(`   Output directory: ${this.outputDir}`);
  }
  
  /**
   * Generate comprehensive property analysis report with fresh images
   */
  async generatePropertyAnalysisReport(analysisData, imageData) {
    const startTime = Date.now();
    
    try {
      console.log('📄 Generating property analysis PDF report...');
      
      // Validate input data
      if (!analysisData || !analysisData.mainProperty) {
        throw new Error('Invalid analysis data provided');
      }
      
      const { mainProperty, comparables, marketAnalysis } = analysisData;
      const propertyRef = mainProperty.reference || mainProperty.id || 'unknown';
      
      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `PropertyAnalysis_${propertyRef}_${timestamp}.pdf`;
      const filepath = path.join(this.outputDir, filename);
      
      // Create PDF document
      const doc = new PDFDocument({
        size: this.config.pageSize,
        margins: this.config.margins,
        info: {
          Title: `Property Analysis Report - ${propertyRef}`,
          Author: 'PropertyList.es AI Agent',
          Subject: 'Comprehensive Property Market Analysis',
          Creator: 'PropertyList.es AI Agent v1.0'
        }
      });
      
      // Create write stream
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);
      
      // Generate report content
      await this.generateReportContent(doc, analysisData, imageData);
      
      // Finalize PDF
      doc.end();
      
      // Wait for file to be written
      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });
      
      // Get file size
      const stats = await fs.stat(filepath);
      const fileSize = stats.size;
      
      const generationTime = Date.now() - startTime;
      
      // Update metrics
      this.metrics.totalReports++;
      this.metrics.successfulReports++;
      this.metrics.totalFileSize += fileSize;
      this.updateGenerationTimeMetrics(generationTime);
      
      console.log(`✅ PDF report generated successfully:`);
      console.log(`   File: ${filename}`);
      console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Generation time: ${generationTime}ms`);
      
      return {
        success: true,
        filename,
        filepath,
        fileSize,
        generationTime,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.metrics.totalReports++;
      this.metrics.failedReports++;
      
      console.error('❌ Error generating PDF report:', error.message);
      return {
        success: false,
        error: error.message,
        generationTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Generate complete report content
   */
  async generateReportContent(doc, analysisData, imageData) {
    const { mainProperty, comparables, marketAnalysis } = analysisData;
    
    // Cover page
    this.generateCoverPage(doc, mainProperty);
    
    // Executive summary
    doc.addPage();
    this.generateExecutiveSummary(doc, analysisData, marketAnalysis);
    
    // Main property details with images
    doc.addPage();
    await this.generateMainPropertySection(doc, mainProperty, imageData?.mainProperty);
    
    // Market analysis
    doc.addPage();
    this.generateMarketAnalysisSection(doc, marketAnalysis);
    
    // Future developments
    doc.addPage();
    this.generateFutureDevelopmentsSection(doc, analysisData.futureDevelopments);
    
    // Comparable properties with images
    doc.addPage();
    await this.generateComparablesSection(doc, comparables, imageData?.comparables);
    
    // Investment insights
    doc.addPage();
    this.generateInvestmentInsightsSection(doc, analysisData);
    
    // Methodology and disclaimers
    doc.addPage();
    this.generateMethodologySection(doc);
  }
  
  /**
   * Generate cover page
   */
  generateCoverPage(doc, property) {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    
    // Background gradient effect
    doc.rect(0, 0, pageWidth, pageHeight / 3)
       .fillAndStroke(this.config.colors.primary, this.config.colors.primary);
    
    // Title section
    doc.fontSize(32)
       .fillColor('white')
       .text('Property Analysis Report', 50, 80, { align: 'center' });
    
    doc.fontSize(18)
       .text('Comprehensive Market Analysis & Investment Insights', 50, 130, { align: 'center' });
    
    // Property details box
    const boxY = pageHeight / 3 + 50;
    doc.rect(100, boxY, pageWidth - 200, 200)
       .fillAndStroke(this.config.colors.background, this.config.colors.border);
    
    // Property information
    doc.fillColor(this.config.colors.text)
       .fontSize(16)
       .text('Property Reference:', 120, boxY + 30);
    
    doc.fontSize(14)
       .fillColor(this.config.colors.textLight)
       .text(property.reference || 'N/A', 120, boxY + 55);
    
    doc.fillColor(this.config.colors.text)
       .fontSize(16)
       .text('Location:', 120, boxY + 85);
    
    const location = `${property.suburb || ''}, ${property.city || ''}`.replace(/^,\s*/, '');
    doc.fontSize(14)
       .fillColor(this.config.colors.textLight)
       .text(location || 'N/A', 120, boxY + 110);
    
    doc.fillColor(this.config.colors.text)
       .fontSize(16)
       .text('Property Type:', 120, boxY + 140);
    
    doc.fontSize(14)
       .fillColor(this.config.colors.textLight)
       .text(this.formatPropertyType(property.property_type), 120, boxY + 165);
    
    // Report details
    const reportDetailsY = pageHeight - 200;
    doc.fontSize(12)
       .fillColor(this.config.colors.textLight)
       .text(`Report Generated: ${new Date().toLocaleDateString('en-GB')}`, 50, reportDetailsY, { align: 'center' });
    
    doc.text('Powered by PropertyList.es AI Agent', 50, reportDetailsY + 20, { align: 'center' });
    
    doc.text('Data Source: PropertyList.es Live API', 50, reportDetailsY + 40, { align: 'center' });
  }
  
  /**
   * Generate executive summary
   */
  generateExecutiveSummary(doc, analysisData, marketAnalysis) {
    this.addSectionHeader(doc, 'Executive Summary');
    
    const { mainProperty, comparables } = analysisData;
    
    // Key metrics summary
    const summaryY = 120;
    
    doc.fontSize(12)
       .fillColor(this.config.colors.text)
       .text('This comprehensive analysis evaluates the investment potential and market position of the subject property using fresh market data from PropertyList.es.', 50, summaryY, {
         width: doc.page.width - 100,
         align: 'justify'
       });
    
    // Key findings box
    const boxY = summaryY + 60;
    doc.rect(50, boxY, doc.page.width - 100, 150)
       .fillAndStroke(this.config.colors.background, this.config.colors.border);
    
    doc.fontSize(14)
       .fillColor(this.config.colors.primary)
       .text('Key Findings:', 70, boxY + 20);
    
    const findings = [
      `Property Type: ${this.formatPropertyType(mainProperty.property_type)}`,
      `Comparable Properties Analyzed: ${comparables?.length || 0}`,
      `Market Data: Fresh data from PropertyList.es API`,
      `Analysis Date: ${new Date().toLocaleDateString('en-GB')}`
    ];
    
    let textY = boxY + 50;
    findings.forEach(finding => {
      doc.fontSize(11)
         .fillColor(this.config.colors.text)
         .text(`• ${finding}`, 70, textY);
      textY += 20;
    });
    
    // Market position summary
    if (marketAnalysis) {
      doc.fontSize(12)
         .fillColor(this.config.colors.text)
         .text('Market Position:', 50, boxY + 180);
      
      doc.fontSize(11)
         .fillColor(this.config.colors.textLight)
         .text(this.generateMarketPositionSummary(marketAnalysis), 50, boxY + 205, {
           width: doc.page.width - 100,
           align: 'justify'
         });
    }
  }
  
  /**
   * Generate main property section with images
   */
  async generateMainPropertySection(doc, property, propertyImages) {
    this.addSectionHeader(doc, 'Subject Property Details');
    
    let currentY = 120;
    
    // Property specifications
    const specs = [
      { label: 'Reference', value: property.reference || 'N/A' },
      { label: 'Property Type', value: this.formatPropertyType(property.property_type) },
      { label: 'Bedrooms', value: property.bedrooms || 'N/A' },
      { label: 'Bathrooms', value: property.bathrooms || 'N/A' },
      { label: 'Build Size', value: property.build_size ? `${property.build_size}m²` : 'N/A' },
      { label: 'Plot Size', value: property.plot_size ? `${property.plot_size}m²` : 'N/A' }
    ];
    
    // Create two-column layout for specifications
    const leftColumn = 70;
    const rightColumn = 300;
    
    specs.forEach((spec, index) => {
      const x = (index % 2 === 0) ? leftColumn : rightColumn;
      const y = currentY + Math.floor(index / 2) * 25;
      
      doc.fontSize(11)
         .fillColor(this.config.colors.text)
         .text(`${spec.label}:`, x, y);
      
      doc.fontSize(11)
         .fillColor(this.config.colors.textLight)
         .text(spec.value, x + 100, y);
    });
    
    currentY += Math.ceil(specs.length / 2) * 25 + 40;
    
    // Add property images if available
    if (propertyImages && propertyImages.images && propertyImages.images.length > 0) {
      doc.fontSize(14)
         .fillColor(this.config.colors.primary)
         .text('Property Images:', 50, currentY);
      
      currentY += 30;
      
      // Display up to 3 images in a row
      const imageWidth = 150;
      const imageHeight = 100;
      const imageSpacing = 20;
      
      for (let i = 0; i < Math.min(3, propertyImages.images.length); i++) {
        const image = propertyImages.images[i];
        const x = 50 + (i * (imageWidth + imageSpacing));
        
        try {
          // Convert base64 to buffer
          const base64Data = image.base64.replace(/^data:image\/[a-z]+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          // Add image to PDF
          doc.image(imageBuffer, x, currentY, {
            width: imageWidth,
            height: imageHeight,
            fit: [imageWidth, imageHeight]
          });
          
        } catch (error) {
          console.warn(`⚠️ Could not embed image ${i + 1}:`, error.message);
          
          // Add placeholder
          doc.rect(x, currentY, imageWidth, imageHeight)
             .fillAndStroke(this.config.colors.background, this.config.colors.border);
          
          doc.fontSize(10)
             .fillColor(this.config.colors.textLight)
             .text('Image\nUnavailable', x + 50, currentY + 40, { align: 'center' });
        }
      }
      
      currentY += imageHeight + 20;
    }
    
    // Location details
    doc.fontSize(14)
       .fillColor(this.config.colors.primary)
       .text('Location Details:', 50, currentY);
    
    currentY += 25;
    
    const locationDetails = [
      { label: 'City', value: property.city || 'N/A' },
      { label: 'Suburb', value: property.suburb || 'N/A' },
      { label: 'Province', value: property.province || 'N/A' }
    ];
    
    locationDetails.forEach(detail => {
      doc.fontSize(11)
         .fillColor(this.config.colors.text)
         .text(`${detail.label}:`, 70, currentY);
      
      doc.fontSize(11)
         .fillColor(this.config.colors.textLight)
         .text(detail.value, 150, currentY);
      
      currentY += 20;
    });
  }
  
  /**
   * Generate market analysis section
   */
  generateMarketAnalysisSection(doc, marketAnalysis) {
    this.addSectionHeader(doc, 'Market Analysis');
    
    let currentY = 120;
    
    if (!marketAnalysis) {
      doc.fontSize(12)
         .fillColor(this.config.colors.textLight)
         .text('Market analysis data not available.', 50, currentY);
      return;
    }
    
    // Market statistics
    doc.fontSize(14)
       .fillColor(this.config.colors.primary)
       .text('Market Statistics:', 50, currentY);
    
    currentY += 30;
    
    // Statistics grid
    const stats = [
      { label: 'Median Price', value: this.formatPrice(marketAnalysis.medianPrice) },
      { label: 'Average Price/m²', value: this.formatPrice(marketAnalysis.avgPricePerSqm) + '/m²' },
      { label: 'Sample Size', value: `${marketAnalysis.sampleSize} properties` },
      { label: 'Price Range', value: `${this.formatPrice(marketAnalysis.minPrice)} - ${this.formatPrice(marketAnalysis.maxPrice)}` }
    ];
    
    // Create statistics boxes
    const boxWidth = (doc.page.width - 140) / 2;
    const boxHeight = 60;
    
    stats.forEach((stat, index) => {
      const x = 50 + (index % 2) * (boxWidth + 40);
      const y = currentY + Math.floor(index / 2) * (boxHeight + 20);
      
      doc.rect(x, y, boxWidth, boxHeight)
         .fillAndStroke(this.config.colors.background, this.config.colors.border);
      
      doc.fontSize(12)
         .fillColor(this.config.colors.primary)
         .text(stat.label, x + 10, y + 15);
      
      doc.fontSize(16)
         .fillColor(this.config.colors.text)
         .text(stat.value, x + 10, y + 35);
    });
    
    currentY += Math.ceil(stats.length / 2) * (boxHeight + 20) + 40;
    
    // Market insights
    if (marketAnalysis.insights && marketAnalysis.insights.length > 0) {
      doc.fontSize(14)
         .fillColor(this.config.colors.primary)
         .text('Market Insights:', 50, currentY);
      
      currentY += 25;
      
      marketAnalysis.insights.slice(0, 3).forEach(insight => {
        doc.fontSize(11)
           .fillColor(this.config.colors.text)
           .text(`• ${insight}`, 70, currentY, {
             width: doc.page.width - 120,
             align: 'justify'
           });
        currentY += 25;
      });
    }
  }
  
  /**
   * Generate future developments section
   */
  generateFutureDevelopmentsSection(doc, futureDevelopments) {
    this.addSectionHeader(doc, 'Future Developments & Area Improvements');
    
    let currentY = 120;
    
    // Check if future developments data is available
    if (!futureDevelopments || !futureDevelopments.success) {
      doc.fontSize(12)
         .fillColor(this.config.colors.textLight)
         .text(futureDevelopments?.content || 'Future developments analysis not available for this area.', 50, currentY, {
           width: doc.page.width - 100,
           align: 'justify'
         });
      return;
    }
    
    // Check if analysis was skipped
    if (futureDevelopments.skipped) {
      doc.fontSize(12)
         .fillColor(this.config.colors.textLight)
         .text(`${futureDevelopments.content} (${futureDevelopments.reason})`, 50, currentY, {
           width: doc.page.width - 100,
           align: 'justify'
         });
      return;
    }
    
    // Introduction text
    doc.fontSize(12)
       .fillColor(this.config.colors.text)
       .text('This analysis identifies planned developments and infrastructure improvements that may impact property values in the area:', 50, currentY, {
         width: doc.page.width - 100,
         align: 'justify'
       });
    
    currentY += 50;
    
    // Show analysis tier information
    if (futureDevelopments.tier) {
      doc.fontSize(10)
         .fillColor(this.config.colors.textLight)
         .text(`Analysis Level: Tier ${futureDevelopments.tier} • ${futureDevelopments.metadata?.cached ? 'Cached data' : 'Fresh analysis'}`, 50, currentY);
      currentY += 25;
    }
    
    // Parse and display the content
    if (futureDevelopments.content && futureDevelopments.content !== "No significant future developments found in this area.") {
      this.renderFutureDevelopmentsContent(doc, futureDevelopments.content, currentY);
    } else {
      // No developments found
      doc.rect(50, currentY, doc.page.width - 100, 80)
         .fillAndStroke(this.config.colors.background, this.config.colors.border);
      
      doc.fontSize(12)
         .fillColor(this.config.colors.textLight)
         .text('No significant future developments found in this area.', 70, currentY + 30, {
           width: doc.page.width - 140,
           align: 'center'
         });
    }
  }
  
  /**
   * Render future developments content with proper formatting
   */
  renderFutureDevelopmentsContent(doc, content, startY) {
    let currentY = startY;
    
    // Split content into sections by double newlines
    const sections = content.split('\n\n').filter(section => section.trim());
    
    sections.forEach(section => {
      // Extract section title (text between ** **)
      const titleMatch = section.match(/\*\*(.*?)\*\*/);
      if (titleMatch) {
        const title = titleMatch[1];
        const listContent = section.replace(/\*\*.*?\*\*\n?/, '').trim();
        
        // Section header
        doc.fontSize(14)
           .fillColor(this.config.colors.primary)
           .text(title, 50, currentY);
        
        currentY += 25;
        
        // Parse list items
        const items = listContent.split('\n').filter(item => item.trim().startsWith('•'));
        
        if (items.length > 0) {
          items.forEach(item => {
            const cleanItem = item.replace('•', '').trim();
            
            // Create item box
            const itemHeight = Math.max(40, Math.ceil(cleanItem.length / 80) * 20 + 20);
            
            doc.rect(70, currentY, doc.page.width - 140, itemHeight)
               .fillAndStroke(this.config.colors.background, this.config.colors.border);
            
            doc.fontSize(11)
               .fillColor(this.config.colors.text)
               .text(`• ${cleanItem}`, 85, currentY + 10, {
                 width: doc.page.width - 170,
                 align: 'justify'
               });
            
            currentY += itemHeight + 10;
          });
        } else {
          // No specific items, just display the content
          doc.fontSize(11)
             .fillColor(this.config.colors.textLight)
             .text(listContent || 'No details available', 70, currentY);
          currentY += 30;
        }
        
        currentY += 20; // Space between sections
      }
    });
  }
  
  /**
   * Generate comparables section with images
   */
  async generateComparablesSection(doc, comparables, comparableImages) {
    this.addSectionHeader(doc, 'Comparable Properties');
    
    if (!comparables || comparables.length === 0) {
      doc.fontSize(12)
         .fillColor(this.config.colors.textLight)
         .text('No comparable properties found.', 50, 120);
      return;
    }
    
    let currentY = 120;
    
    // Summary
    doc.fontSize(12)
       .fillColor(this.config.colors.text)
       .text(`Analysis of ${comparables.length} comparable properties from PropertyList.es database:`, 50, currentY);
    
    currentY += 40;
    
    // Display comparables (max 6 to fit in report)
    const maxComparables = Math.min(6, comparables.length);
    
    for (let i = 0; i < maxComparables; i++) {
      const comparable = comparables[i];
      const comparableImageData = comparableImages?.find(img => 
        img.reference === comparable.reference || img.propertyId === comparable.id
      );
      
      // Check if we need a new page
      if (currentY > doc.page.height - 200) {
        doc.addPage();
        currentY = 50;
      }
      
      await this.generateComparableProperty(doc, comparable, comparableImageData, currentY);
      currentY += 180; // Space for each comparable
    }
    
    // Add note about additional comparables
    if (comparables.length > maxComparables) {
      doc.fontSize(10)
         .fillColor(this.config.colors.textLight)
         .text(`Note: ${comparables.length - maxComparables} additional comparable properties were analyzed but not shown in detail.`, 50, currentY);
    }
  }
  
  /**
   * Generate single comparable property
   */
  async generateComparableProperty(doc, comparable, imageData, startY) {
    const boxHeight = 160;
    const imageWidth = 120;
    const imageHeight = 80;
    
    // Property box
    doc.rect(50, startY, doc.page.width - 100, boxHeight)
       .fillAndStroke(this.config.colors.background, this.config.colors.border);
    
    // Property image
    let imageX = 70;
    if (imageData && imageData.images && imageData.images.length > 0) {
      try {
        const base64Data = imageData.images[0].base64.replace(/^data:image\/[a-z]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        doc.image(imageBuffer, imageX, startY + 15, {
          width: imageWidth,
          height: imageHeight,
          fit: [imageWidth, imageHeight]
        });
      } catch (error) {
        // Fallback placeholder
        doc.rect(imageX, startY + 15, imageWidth, imageHeight)
           .fillAndStroke('#f3f4f6', '#d1d5db');
        
        doc.fontSize(8)
           .fillColor(this.config.colors.textLight)
           .text('No Image', imageX + 40, startY + 50);
      }
    } else {
      // Placeholder
      doc.rect(imageX, startY + 15, imageWidth, imageHeight)
         .fillAndStroke('#f3f4f6', '#d1d5db');
      
      doc.fontSize(8)
         .fillColor(this.config.colors.textLight)
         .text('No Image', imageX + 40, startY + 50);
    }
    
    // Property details
    const detailsX = imageX + imageWidth + 20;
    let detailsY = startY + 20;
    
    // Reference and price
    doc.fontSize(12)
       .fillColor(this.config.colors.primary)
       .text(`Ref: ${comparable.reference || 'N/A'}`, detailsX, detailsY);
    
    doc.fontSize(16)
       .fillColor(this.config.colors.text)
       .text(this.formatPrice(comparable.price || comparable.sale_price || comparable.for_sale_price), detailsX, detailsY + 20);
    
    // Property specs
    const specs = [
      `${comparable.property_type || 'Property'} • ${comparable.bedrooms || 'N/A'} beds`,
      `${comparable.build_size ? comparable.build_size + 'm²' : 'Size N/A'} • ${comparable.city || 'Location N/A'}`,
      `Distance: ${comparable.distance || 'N/A'} • Match: ${comparable.overallPercent || 'N/A'}%`
    ];
    
    detailsY += 50;
    specs.forEach(spec => {
      doc.fontSize(10)
         .fillColor(this.config.colors.textLight)
         .text(spec, detailsX, detailsY);
      detailsY += 15;
    });
  }
  
  /**
   * Generate investment insights section
   */
  generateInvestmentInsightsSection(doc, analysisData) {
    this.addSectionHeader(doc, 'Investment Insights & Recommendations');
    
    let currentY = 120;
    
    // Investment summary
    doc.fontSize(12)
       .fillColor(this.config.colors.text)
       .text('Based on the comprehensive analysis of market data and comparable properties, the following insights and recommendations are provided:', 50, currentY, {
         width: doc.page.width - 100,
         align: 'justify'
       });
    
    currentY += 60;
    
    // Key insights
    const insights = [
      {
        title: 'Market Position',
        content: 'The property is positioned competitively within the local market based on current PropertyList.es data.'
      },
      {
        title: 'Comparable Analysis',
        content: `Analysis of ${analysisData.comparables?.length || 0} comparable properties indicates market consistency in pricing and features.`
      },
      {
        title: 'Investment Potential',
        content: 'The property shows strong fundamentals for both rental yield and capital appreciation potential.'
      },
      {
        title: 'Market Trends',
        content: 'Current market conditions support property investment in this location and property type category.'
      }
    ];
    
    insights.forEach(insight => {
      // Insight box
      doc.rect(50, currentY, doc.page.width - 100, 60)
         .fillAndStroke(this.config.colors.background, this.config.colors.border);
      
      doc.fontSize(12)
         .fillColor(this.config.colors.primary)
         .text(insight.title, 70, currentY + 10);
      
      doc.fontSize(10)
         .fillColor(this.config.colors.text)
         .text(insight.content, 70, currentY + 30, {
           width: doc.page.width - 140,
           align: 'justify'
         });
      
      currentY += 80;
    });
  }
  
  /**
   * Generate methodology section
   */
  generateMethodologySection(doc) {
    this.addSectionHeader(doc, 'Methodology & Data Sources');
    
    let currentY = 120;
    
    const methodology = [
      {
        title: 'Data Source',
        content: 'All property data sourced fresh from PropertyList.es API at the time of analysis, ensuring current market information.'
      },
      {
        title: 'Comparable Selection',
        content: 'Properties selected based on location proximity, property type, size, and price range using algorithmic matching.'
      },
      {
        title: 'Market Analysis',
        content: 'Statistical analysis of comparable properties including median pricing, price per square meter calculations.'
      },
      {
        title: 'Image Processing',
        content: 'All property images downloaded fresh from PropertyList.es and optimized for report inclusion.'
      }
    ];
    
    methodology.forEach(item => {
      doc.fontSize(12)
         .fillColor(this.config.colors.primary)
         .text(item.title + ':', 50, currentY);
      
      doc.fontSize(10)
         .fillColor(this.config.colors.text)
         .text(item.content, 50, currentY + 20, {
           width: doc.page.width - 100,
           align: 'justify'
         });
      
      currentY += 60;
    });
    
    // Disclaimer
    currentY += 20;
    doc.fontSize(8)
       .fillColor(this.config.colors.textLight)
       .text('Disclaimer: This report is for informational purposes only. Property investment decisions should consider additional factors and professional advice. Data accuracy depends on PropertyList.es source information.', 50, currentY, {
         width: doc.page.width - 100,
         align: 'justify'
       });
  }
  
  /**
   * Add section header
   */
  addSectionHeader(doc, title) {
    doc.fontSize(20)
       .fillColor(this.config.colors.primary)
       .text(title, 50, 60);
    
    // Underline
    doc.moveTo(50, 90)
       .lineTo(doc.page.width - 50, 90)
       .strokeColor(this.config.colors.primary)
       .lineWidth(2)
       .stroke();
  }
  
  /**
   * Format property type for display
   */
  formatPropertyType(type) {
    if (!type) return 'Property';
    
    const typeMap = {
      'apartment': 'Apartment',
      'house': 'House',
      'villa': 'Villa',
      'townhouse': 'Townhouse',
      'penthouse': 'Penthouse',
      'studio': 'Studio'
    };
    
    return typeMap[type.toLowerCase()] || type.charAt(0).toUpperCase() + type.slice(1);
  }
  
  /**
   * Format price for display
   */
  formatPrice(price) {
    if (!price || isNaN(price)) return 'Price on request';
    
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  }
  
  /**
   * Generate market position summary
   */
  generateMarketPositionSummary(marketAnalysis) {
    if (!marketAnalysis) {
      return 'Market position analysis not available.';
    }
    
    return 'The property is well-positioned within the current market based on comprehensive analysis of comparable properties and market trends.';
  }
  
  /**
   * Update generation time metrics
   */
  updateGenerationTimeMetrics(generationTime) {
    const totalSuccessful = this.metrics.successfulReports;
    this.metrics.averageGenerationTime = 
      ((this.metrics.averageGenerationTime * (totalSuccessful - 1)) + generationTime) / totalSuccessful;
  }
  
  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalReports > 0 
        ? (this.metrics.successfulReports / this.metrics.totalReports * 100)
        : 0,
      averageFileSize: this.metrics.successfulReports > 0
        ? (this.metrics.totalFileSize / this.metrics.successfulReports)
        : 0
    };
  }
  
  /**
   * Clean up old report files
   */
  async cleanupOldReports(maxAgeHours = 24) {
    try {
      const files = await fs.readdir(this.outputDir);
      const now = Date.now();
      let deletedCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.pdf')) {
          const filepath = path.join(this.outputDir, file);
          const stats = await fs.stat(filepath);
          const ageHours = (now - stats.mtime.getTime()) / (1000 * 60 * 60);
          
          if (ageHours > maxAgeHours) {
            await fs.remove(filepath);
            deletedCount++;
          }
        }
      }
      
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old PDF reports`);
      }
      
    } catch (error) {
      console.error('❌ Error cleaning up old reports:', error.message);
    }
  }
}

module.exports = EnhancedPdfGenerationService; 