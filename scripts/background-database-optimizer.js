// Background Database Optimizer
// Continuously analyzes the property database to improve comparable selection strategies

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

class BackgroundDatabaseOptimizer {
  constructor() {
    this.isRunning = false;
    this.optimizationHistory = [];
    this.propertiesFile = path.join(__dirname, '..', 'data', 'properties.json');
    this.optimizationFile = path.join(__dirname, '..', 'data', 'database-optimization.json');
    this.analysisInterval = 6; // Run every 6 hours
  }

  // Start the background optimization service
  start() {
    if (this.isRunning) {
      console.log('⚠️ Background Database Optimizer is already running');
      return;
    }

    console.log('🚀 Starting Background Database Optimizer...');
    console.log(`⏰ Will run every ${this.analysisInterval} hours`);

    // Schedule optimization job
    const cronExpression = `0 */${this.analysisInterval} * * *`; // Every 6 hours
    this.optimizationJob = cron.schedule(cronExpression, async () => {
      await this.runOptimization();
    }, {
      scheduled: false,
      timezone: 'Europe/Madrid'
    });

    this.optimizationJob.start();
    this.isRunning = true;

    // Run initial optimization
    this.runOptimization();

    console.log('✅ Background Database Optimizer started successfully');
  }

  // Stop the background optimization service
  stop() {
    if (this.optimizationJob) {
      this.optimizationJob.stop();
    }
    this.isRunning = false;
    console.log('🛑 Background Database Optimizer stopped');
  }

  // Main optimization function
  async runOptimization() {
    try {
      console.log('🔄 Starting database optimization analysis...');
      console.log(`📅 ${new Date().toISOString()}`);

      // Load properties
      const properties = this.loadProperties();
      if (!properties || properties.length === 0) {
        console.log('⚠️ No properties found for optimization');
        return;
      }

      console.log(`📊 Analyzing ${properties.length} properties for optimization opportunities`);

      // Run optimization analyses
      const optimizationResults = {
        timestamp: new Date().toISOString(),
        totalProperties: properties.length,
        analyses: {}
      };

      // 1. Property Type Distribution Analysis
      optimizationResults.analyses.propertyTypeDistribution = this.analyzePropertyTypeDistribution(properties);

      // 2. Location Coverage Analysis
      optimizationResults.analyses.locationCoverage = this.analyzeLocationCoverage(properties);

      // 3. Price Range Analysis
      optimizationResults.analyses.priceRangeAnalysis = this.analyzePriceRanges(properties);

      // 4. Comparable Selection Patterns
      optimizationResults.analyses.comparablePatterns = this.analyzeComparablePatterns(properties);

      // 5. Data Quality Assessment
      optimizationResults.analyses.dataQuality = this.assessDataQuality(properties);

      // 6. Search Index Optimization
      optimizationResults.analyses.indexOptimization = this.optimizeSearchIndexes(properties);

      // 7. Market Trend Analysis
      optimizationResults.analyses.marketTrends = this.analyzeMarketTrends(properties);

      // Store optimization results
      this.storeOptimizationResults(optimizationResults);

      // Generate optimization recommendations
      const recommendations = this.generateRecommendations(optimizationResults);
      console.log('📋 Optimization recommendations:', recommendations);

      console.log('✅ Database optimization analysis completed');

    } catch (error) {
      console.error('❌ Database optimization failed:', error.message);
    }
  }

  // Analyze property type distribution
  analyzePropertyTypeDistribution(properties) {
    const typeDistribution = {};
    const typeCounts = {};

    properties.forEach(property => {
      const type = property.property_type || 'Unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    // Calculate percentages
    const total = properties.length;
    Object.keys(typeCounts).forEach(type => {
      typeDistribution[type] = {
        count: typeCounts[type],
        percentage: Math.round((typeCounts[type] / total) * 100)
      };
    });

    return {
      distribution: typeDistribution,
      totalTypes: Object.keys(typeCounts).length,
      mostCommonType: Object.keys(typeCounts).reduce((a, b) => typeCounts[a] > typeCounts[b] ? a : b),
      leastCommonType: Object.keys(typeCounts).reduce((a, b) => typeCounts[a] < typeCounts[b] ? a : b)
    };
  }

  // Analyze location coverage
  analyzeLocationCoverage(properties) {
    const cityCoverage = {};
    const provinceCoverage = {};

    properties.forEach(property => {
      const city = property.city || 'Unknown';
      const province = property.province || 'Unknown';

      cityCoverage[city] = (cityCoverage[city] || 0) + 1;
      provinceCoverage[province] = (provinceCoverage[province] || 0) + 1;
    });

    return {
      cities: {
        total: Object.keys(cityCoverage).length,
        coverage: cityCoverage,
        topCities: Object.entries(cityCoverage)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([city, count]) => ({ city, count }))
      },
      provinces: {
        total: Object.keys(provinceCoverage).length,
        coverage: provinceCoverage,
        topProvinces: Object.entries(provinceCoverage)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([province, count]) => ({ province, count }))
      }
    };
  }

  // Analyze price ranges
  analyzePriceRanges(properties) {
    const prices = properties
      .map(p => p.price)
      .filter(price => price && price > 0)
      .sort((a, b) => a - b);

    if (prices.length === 0) {
      return { error: 'No valid prices found' };
    }

    const min = prices[0];
    const max = prices[prices.length - 1];
    const median = prices[Math.floor(prices.length / 2)];
    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;

    // Calculate quartiles
    const q1 = prices[Math.floor(prices.length * 0.25)];
    const q3 = prices[Math.floor(prices.length * 0.75)];

    // Price range categories
    const priceRanges = {
      'Under €200k': prices.filter(p => p < 200000).length,
      '€200k-€500k': prices.filter(p => p >= 200000 && p < 500000).length,
      '€500k-€1M': prices.filter(p => p >= 500000 && p < 1000000).length,
      '€1M-€2M': prices.filter(p => p >= 1000000 && p < 2000000).length,
      'Over €2M': prices.filter(p => p >= 2000000).length
    };

    return {
      statistics: {
        min: min,
        max: max,
        mean: Math.round(mean),
        median: median,
        q1: q1,
        q3: q3,
        totalProperties: prices.length
      },
      priceRanges: priceRanges,
      recommendations: this.generatePriceRecommendations(priceRanges, prices.length)
    };
  }

  // Analyze comparable selection patterns
  analyzeComparablePatterns(properties) {
    // Analyze properties by bedroom/bathroom combinations
    const bedroomBathroomPatterns = {};
    const areaPatterns = {};

    properties.forEach(property => {
      const bedrooms = property.bedrooms || 0;
      const bathrooms = property.bathrooms || 0;
      const area = property.build_area || property.plot_area || 0;

      const pattern = `${bedrooms}BR-${bathrooms}BA`;
      bedroomBathroomPatterns[pattern] = (bedroomBathroomPatterns[pattern] || 0) + 1;

      // Area patterns
      if (area > 0) {
        const areaRange = this.getAreaRange(area);
        areaPatterns[areaRange] = (areaPatterns[areaRange] || 0) + 1;
      }
    });

    return {
      bedroomBathroomPatterns: bedroomBathroomPatterns,
      areaPatterns: areaPatterns,
      mostCommonPatterns: Object.entries(bedroomBathroomPatterns)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([pattern, count]) => ({ pattern, count }))
    };
  }

  // Assess data quality
  assessDataQuality(properties) {
    const qualityMetrics = {
      totalProperties: properties.length,
      completeData: 0,
      missingPrices: 0,
      missingAreas: 0,
      missingBedrooms: 0,
      missingBathrooms: 0,
      missingDescriptions: 0,
      missingImages: 0
    };

    properties.forEach(property => {
      let isComplete = true;

      if (!property.price || property.price <= 0) {
        qualityMetrics.missingPrices++;
        isComplete = false;
      }

      if (!property.build_area && !property.plot_area) {
        qualityMetrics.missingAreas++;
        isComplete = false;
      }

      if (!property.bedrooms) {
        qualityMetrics.missingBedrooms++;
        isComplete = false;
      }

      if (!property.bathrooms) {
        qualityMetrics.missingBathrooms++;
        isComplete = false;
      }

      if (!property.description) {
        qualityMetrics.missingDescriptions++;
        isComplete = false;
      }

      if (!property.images || property.images.length === 0) {
        qualityMetrics.missingImages++;
        isComplete = false;
      }

      if (isComplete) {
        qualityMetrics.completeData++;
      }
    });

    // Calculate percentages
    qualityMetrics.completenessPercentage = Math.round((qualityMetrics.completeData / qualityMetrics.totalProperties) * 100);
    qualityMetrics.missingPricesPercentage = Math.round((qualityMetrics.missingPrices / qualityMetrics.totalProperties) * 100);
    qualityMetrics.missingAreasPercentage = Math.round((qualityMetrics.missingAreas / qualityMetrics.totalProperties) * 100);

    return qualityMetrics;
  }

  // Optimize search indexes
  optimizeSearchIndexes(properties) {
    // Analyze index efficiency
    const indexAnalysis = {
      cityIndex: {},
      typeIndex: {},
      priceIndex: {},
      areaIndex: {}
    };

    properties.forEach(property => {
      // City index
      const city = property.city || 'Unknown';
      indexAnalysis.cityIndex[city] = (indexAnalysis.cityIndex[city] || 0) + 1;

      // Type index
      const type = property.property_type || 'Unknown';
      indexAnalysis.typeIndex[type] = (indexAnalysis.typeIndex[type] || 0) + 1;

      // Price index (buckets)
      if (property.price) {
        const priceBucket = this.getPriceBucket(property.price);
        indexAnalysis.priceIndex[priceBucket] = (indexAnalysis.priceIndex[priceBucket] || 0) + 1;
      }

      // Area index (buckets)
      const area = property.build_area || property.plot_area;
      if (area) {
        const areaBucket = this.getAreaBucket(area);
        indexAnalysis.areaIndex[areaBucket] = (indexAnalysis.areaIndex[areaBucket] || 0) + 1;
      }
    });

    return {
      indexDistribution: indexAnalysis,
      recommendations: this.generateIndexRecommendations(indexAnalysis)
    };
  }

  // Analyze market trends
  analyzeMarketTrends(properties) {
    // Group properties by date (if available)
    const propertiesByDate = {};
    
    properties.forEach(property => {
      const date = property.date_listed || property.created_at || 'Unknown';
      if (!propertiesByDate[date]) {
        propertiesByDate[date] = [];
      }
      propertiesByDate[date].push(property);
    });

    // Calculate average prices by date
    const averagePricesByDate = {};
    Object.keys(propertiesByDate).forEach(date => {
      const validPrices = propertiesByDate[date]
        .map(p => p.price)
        .filter(price => price && price > 0);
      
      if (validPrices.length > 0) {
        averagePricesByDate[date] = Math.round(validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length);
      }
    });

    return {
      propertiesByDate: propertiesByDate,
      averagePricesByDate: averagePricesByDate,
      totalDates: Object.keys(propertiesByDate).length,
      dateRange: {
        earliest: Object.keys(propertiesByDate).sort()[0],
        latest: Object.keys(propertiesByDate).sort().pop()
      }
    };
  }

  // Generate optimization recommendations
  generateRecommendations(optimizationResults) {
    const recommendations = [];

    // Data quality recommendations
    if (optimizationResults.analyses.dataQuality.completenessPercentage < 80) {
      recommendations.push({
        type: 'data_quality',
        priority: 'high',
        message: `Data completeness is ${optimizationResults.analyses.dataQuality.completenessPercentage}%. Consider enhancing data collection.`,
        action: 'Enhance data collection processes'
      });
    }

    // Property type balance recommendations
    const typeDistribution = optimizationResults.analyses.propertyTypeDistribution;
    const mostCommon = typeDistribution.mostCommonType;
    const leastCommon = typeDistribution.leastCommonType;
    
    if (typeDistribution.distribution[mostCommon].percentage > 70) {
      recommendations.push({
        type: 'property_balance',
        priority: 'medium',
        message: `Property type distribution is skewed: ${mostCommon} represents ${typeDistribution.distribution[mostCommon].percentage}% of properties.`,
        action: 'Consider diversifying property type collection'
      });
    }

    // Location coverage recommendations
    const locationCoverage = optimizationResults.analyses.locationCoverage;
    if (locationCoverage.cities.total < 5) {
      recommendations.push({
        type: 'location_coverage',
        priority: 'high',
        message: `Limited city coverage: only ${locationCoverage.cities.total} cities represented.`,
        action: 'Expand geographic coverage'
      });
    }

    // Price range recommendations
    const priceAnalysis = optimizationResults.analyses.priceRangeAnalysis;
    if (priceAnalysis.statistics) {
      const priceRange = priceAnalysis.statistics.max - priceAnalysis.statistics.min;
      if (priceRange > 5000000) {
        recommendations.push({
          type: 'price_range',
          priority: 'medium',
          message: 'Large price range detected. Consider segmenting by price tiers for better comparable selection.',
          action: 'Implement price-tiered comparable selection'
        });
      }
    }

    return recommendations;
  }

  // Helper functions
  getAreaRange(area) {
    if (area < 50) return 'Under 50m²';
    if (area < 100) return '50-100m²';
    if (area < 150) return '100-150m²';
    if (area < 200) return '150-200m²';
    if (area < 300) return '200-300m²';
    if (area < 500) return '300-500m²';
    return 'Over 500m²';
  }

  getAreaBucket(area) {
    if (area < 100) return '0-100m²';
    if (area < 200) return '100-200m²';
    if (area < 300) return '200-300m²';
    if (area < 500) return '300-500m²';
    return '500m²+';
  }

  getPriceBucket(price) {
    if (price < 200000) return '0-200k';
    if (price < 500000) return '200k-500k';
    if (price < 1000000) return '500k-1M';
    if (price < 2000000) return '1M-2M';
    return '2M+';
  }

  generatePriceRecommendations(priceRanges, totalProperties) {
    const recommendations = [];
    
    // Check for price range gaps
    const ranges = Object.keys(priceRanges);
    const gaps = [];
    
    for (let i = 0; i < ranges.length - 1; i++) {
      const currentCount = priceRanges[ranges[i]];
      const nextCount = priceRanges[ranges[i + 1]];
      
      if (currentCount === 0 || nextCount === 0) {
        gaps.push(`${ranges[i]} to ${ranges[i + 1]}`);
      }
    }
    
    if (gaps.length > 0) {
      recommendations.push(`Price gaps detected: ${gaps.join(', ')}`);
    }
    
    // Check for over-representation
    Object.entries(priceRanges).forEach(([range, count]) => {
      const percentage = (count / totalProperties) * 100;
      if (percentage > 50) {
        recommendations.push(`${range} represents ${percentage.toFixed(1)}% of properties - consider diversifying`);
      }
    });
    
    return recommendations;
  }

  generateIndexRecommendations(indexAnalysis) {
    const recommendations = [];
    
    // Check for index imbalance
    Object.entries(indexAnalysis.cityIndex).forEach(([city, count]) => {
      if (count > 1000) {
        recommendations.push(`City index imbalance: ${city} has ${count} properties - consider sub-indexing`);
      }
    });
    
    Object.entries(indexAnalysis.typeIndex).forEach(([type, count]) => {
      if (count > 500) {
        recommendations.push(`Type index imbalance: ${type} has ${count} properties - consider sub-indexing`);
      }
    });
    
    return recommendations;
  }

  // Load properties from file
  loadProperties() {
    try {
      if (fs.existsSync(this.propertiesFile)) {
        const data = fs.readFileSync(this.propertiesFile, 'utf8');
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('Error loading properties:', error.message);
      return [];
    }
  }

  // Store optimization results
  storeOptimizationResults(results) {
    try {
      // Load existing results
      let existingResults = [];
      if (fs.existsSync(this.optimizationFile)) {
        const data = fs.readFileSync(this.optimizationFile, 'utf8');
        existingResults = JSON.parse(data);
      }

      // Add new results
      existingResults.push(results);

      // Keep only last 100 results
      if (existingResults.length > 100) {
        existingResults = existingResults.slice(-100);
      }

      // Save to file
      fs.writeFileSync(this.optimizationFile, JSON.stringify(existingResults, null, 2));
      
      console.log('💾 Optimization results saved');
    } catch (error) {
      console.error('Error saving optimization results:', error.message);
    }
  }
}

// Export for use in other modules
module.exports = { BackgroundDatabaseOptimizer };

// Start the optimizer if this file is run directly
if (require.main === module) {
  const optimizer = new BackgroundDatabaseOptimizer();
  optimizer.start();
  
  // Keep the process running
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Background Database Optimizer...');
    optimizer.stop();
    process.exit(0);
  });
} 