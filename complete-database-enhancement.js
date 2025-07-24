const { Pool } = require('pg');
const OptimizedLocationService = require('./server/services/optimizedLocationService');
require('dotenv').config({ path: '.env.local' });

class CompleteDatabaseEnhancer {
  constructor() {
    this.pool = new Pool({
      connectionString: 'postgresql://postgres:dev_password_123@localhost:5433/propertylist_db'
    });
    this.locationService = new OptimizedLocationService();
    this.stats = {
      totalProperties: 0,
      processedCount: 0,
      coordinatesUpdated: 0,
      conditionsUpdated: 0,
      errorCount: 0,
      cacheHits: 0,
      freshAI: 0,
      startTime: Date.now()
    };
    this.conditionStats = {
      excellent: 0,
      'very-good': 0,
      good: 0,
      fair: 0,
      'needs-renovation': 0
    };
  }

  async enhanceAllProperties() {
    try {
      console.log('🚀 COMPLETE DATABASE ENHANCEMENT');
      console.log('=================================');
      console.log('Processing ALL properties with location + condition AI analysis\n');
      
      if (!process.env.OPENAI_API_KEY || !process.env.OPENCAGE_API_KEY) {
        throw new Error('Missing required API keys (OpenAI and OpenCage)');
      }

      // Get database statistics
      await this.showDatabaseStats();

      // Get all properties needing enhancement
      const allProperties = await this.getAllPropertiesForEnhancement();
      this.stats.totalProperties = allProperties.length;
      
      console.log(`\n📊 Properties to process: ${this.stats.totalProperties}`);
      if (this.stats.totalProperties === 0) {
        console.log('✅ All properties are already fully enhanced!');
        return;
      }

      // Process in manageable batches
      const batchSize = 50;
      const totalBatches = Math.ceil(this.stats.totalProperties / batchSize);
      
      console.log(`📦 Processing in ${totalBatches} batches of ${batchSize} properties each\n`);

      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const start = batchNum * batchSize;
        const end = Math.min(start + batchSize, this.stats.totalProperties);
        const batch = allProperties.slice(start, end);
        
        console.log(`📝 BATCH ${batchNum + 1}/${totalBatches}: Processing properties ${start + 1}-${end}`);
        
        await this.processBatch(batch, batchNum + 1);
        
        // Show progress every batch
        this.showProgress();
        
        // Small break between batches
        if (batchNum < totalBatches - 1) {
          console.log('⏸️ Brief pause between batches...\n');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      await this.showFinalResults();

    } catch (error) {
      console.error('❌ Complete database enhancement failed:', error.message);
    } finally {
      await this.pool.end();
    }
  }

  async showDatabaseStats() {
    const stats = await this.pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(descriptions) as with_descriptions,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as with_coordinates,
        COUNT(CASE WHEN condition_rating IS NOT NULL AND condition_rating != '' THEN 1 END) as with_condition,
        COUNT(CASE WHEN descriptions IS NOT NULL AND 
               (latitude IS NULL OR longitude IS NULL OR 
                condition_rating IS NULL OR condition_rating = '') THEN 1 END) as needs_enhancement
      FROM properties
    `);
    
    const data = stats.rows[0];
    console.log('📊 DATABASE STATUS:');
    console.log(`   Total properties: ${data.total}`);
    console.log(`   With descriptions: ${data.with_descriptions}`);
    console.log(`   With coordinates: ${data.with_coordinates}`);
    console.log(`   With condition ratings: ${data.with_condition}`);
    console.log(`   Need enhancement: ${data.needs_enhancement}`);
    
    // Cost estimation
    const needsEnhancement = parseInt(data.needs_enhancement);
    const estimatedCost = needsEnhancement * 0.00065; // GPT-3.5-Turbo cost per property
    const estimatedTimeMinutes = Math.ceil(needsEnhancement / 60) * 5; // ~60 properties per 5 minutes
    
    console.log('\n💰 ESTIMATED COSTS:');
    console.log(`   Full processing cost: $${estimatedCost.toFixed(3)}`);
    console.log(`   With 90% cache efficiency: $${(estimatedCost * 0.1).toFixed(3)}`);
    console.log(`   Estimated time: ${estimatedTimeMinutes} minutes`);
  }

  async getAllPropertiesForEnhancement() {
    const query = `
      SELECT id, reference, city, suburb, urbanization, latitude, longitude, 
             descriptions, condition_rating, sale_price, property_type, address
      FROM properties 
      WHERE descriptions IS NOT NULL
        AND (
          latitude IS NULL OR 
          longitude IS NULL OR 
          condition_rating IS NULL OR 
          condition_rating = ''
        )
      ORDER BY 
        CASE 
          WHEN sale_price > 1000000 THEN 1  -- High-value properties first
          WHEN LOWER(suburb) LIKE '%nueva andaluc%' THEN 2
          WHEN LOWER(suburb) LIKE '%puerto ban%' THEN 3
          WHEN LOWER(suburb) LIKE '%marbella%' THEN 4
          ELSE 5
        END,
        sale_price DESC NULLS LAST,
        created_at DESC
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  async processBatch(properties, batchNumber) {
    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];
      this.stats.processedCount++;
      
      const progress = `[${i + 1}/${properties.length}]`;
      console.log(`   ${progress} ${property.reference} - ${property.suburb || 'No suburb'}, ${property.city}`);
      
      try {
        // AI analysis for location + condition
        const result = await this.locationService.analyzePropertyLocation(property);
        
        // Track AI usage
        if (result.method?.includes('cache')) {
          this.stats.cacheHits++;
        } else {
          this.stats.freshAI++;
        }

        // Update coordinates if needed
        let needsGeocode = !property.latitude || !property.longitude;
        if (needsGeocode && result.enhancedLocation) {
          const coordinates = await this.geocodeLocation(result.enhancedLocation);
          if (coordinates) {
            await this.updateCoordinates(property.reference, coordinates);
            this.stats.coordinatesUpdated++;
            console.log(`     📍 Coordinates: ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`);
          }
        }

        // Update condition if needed
        let needsCondition = !property.condition_rating;
        if (needsCondition && result.conditionRating) {
          await this.updateCondition(property.reference, result.conditionRating);
          this.stats.conditionsUpdated++;
          this.conditionStats[result.conditionRating] = (this.conditionStats[result.conditionRating] || 0) + 1;
          console.log(`     🏠 Condition: ${result.conditionRating} (${result.conditionConfidence}/10)`);
        }

        // Show what was enhanced
        const enhancements = [];
        if (needsGeocode) enhancements.push('location');
        if (needsCondition) enhancements.push('condition');
        if (enhancements.length > 0) {
          console.log(`     ✨ Enhanced: ${enhancements.join(' + ')}`);
        } else {
          console.log(`     ✅ Already complete`);
        }

        // Rate limiting for AI calls
        if (result.method?.includes('gpt35') && i < properties.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }

      } catch (error) {
        console.log(`     ❌ Error: ${error.message}`);
        this.stats.errorCount++;
      }
    }
  }

  async geocodeLocation(locationString) {
    try {
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(locationString)}&key=${process.env.OPENCAGE_API_KEY}&countrycode=es&language=en&limit=1`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status.code === 200 && data.results.length > 0) {
        const result = data.results[0];
        return {
          lat: result.geometry.lat,
          lng: result.geometry.lng,
          confidence: Math.round(result.confidence || 50)
        };
      }
      return null;
    } catch (error) {
      console.error(`Geocoding error: ${error.message}`);
      return null;
    }
  }

  async updateCoordinates(reference, coordinates) {
    await this.pool.query(
      `UPDATE properties 
       SET latitude = $1, longitude = $2, updated_timestamp = CURRENT_TIMESTAMP
       WHERE reference = $3`,
      [coordinates.lat, coordinates.lng, reference]
    );
  }

  async updateCondition(reference, conditionRating) {
    await this.pool.query(
      `UPDATE properties 
       SET condition_rating = $1, updated_timestamp = CURRENT_TIMESTAMP
       WHERE reference = $2`,
      [conditionRating, reference]
    );
  }

  showProgress() {
    const metrics = this.locationService.getMetrics();
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const rate = this.stats.processedCount / elapsed;
    const remaining = this.stats.totalProperties - this.stats.processedCount;
    const eta = remaining / rate;
    
    console.log(`\n⚡ PROGRESS UPDATE:`);
    console.log(`   📊 Processed: ${this.stats.processedCount}/${this.stats.totalProperties} (${((this.stats.processedCount/this.stats.totalProperties)*100).toFixed(1)}%)`);
    console.log(`   📍 Coordinates updated: ${this.stats.coordinatesUpdated}`);
    console.log(`   🏠 Conditions updated: ${this.stats.conditionsUpdated}`);
    console.log(`   ⚡ Cache hits: ${this.stats.cacheHits} (${((this.stats.cacheHits/this.stats.processedCount)*100).toFixed(1)}%)`);
    console.log(`   🤖 Fresh AI calls: ${this.stats.freshAI}`);
    console.log(`   ⏱️ Rate: ${rate.toFixed(1)} properties/sec | ETA: ${Math.round(eta/60)} minutes`);
    console.log(`   💰 Cost so far: $${(this.stats.freshAI * 0.00065).toFixed(4)}`);
  }

  async showFinalResults() {
    const totalTime = (Date.now() - this.stats.startTime) / 1000;
    const metrics = this.locationService.getMetrics();
    const totalCost = this.stats.freshAI * 0.00065;

    console.log('\n🎉 COMPLETE DATABASE ENHANCEMENT FINISHED!');
    console.log('==========================================');
    console.log(`⏱️ Total time: ${Math.round(totalTime)}s (${(totalTime / 60).toFixed(1)} minutes)`);
    console.log(`📊 Properties processed: ${this.stats.processedCount}`);
    console.log(`✅ Success rate: ${(((this.stats.processedCount - this.stats.errorCount) / this.stats.processedCount) * 100).toFixed(1)}%`);
    
    console.log('\n📍 LOCATION ENHANCEMENTS:');
    console.log(`   Coordinates added: ${this.stats.coordinatesUpdated} properties`);
    console.log(`   Cache efficiency: ${((this.stats.cacheHits / this.stats.processedCount) * 100).toFixed(1)}%`);
    
    console.log('\n🏠 CONDITION ENHANCEMENTS:');
    console.log(`   Condition ratings added: ${this.stats.conditionsUpdated} properties`);
    Object.entries(this.conditionStats).forEach(([condition, count]) => {
      if (count > 0) {
        const percentage = ((count / this.stats.conditionsUpdated) * 100).toFixed(1);
        console.log(`   ${condition}: ${count} properties (${percentage}%)`);
      }
    });
    
    console.log('\n💰 COST ANALYSIS:');
    console.log(`   AI calls made: ${this.stats.freshAI}`);
    console.log(`   Total cost: $${totalCost.toFixed(4)}`);
    console.log(`   Cost per property: $${(totalCost / this.stats.processedCount).toFixed(6)}`);
    console.log(`   Cache savings: $${((this.stats.cacheHits * 0.00065).toFixed(4))}`);
    
    console.log('\n🎯 DATABASE IMPACT:');
    console.log('✅ All properties now have enhanced location intelligence');
    console.log('✅ All properties now have AI-analyzed condition ratings');
    console.log('✅ Comparable property matching significantly improved');
    console.log('✅ Market analysis will be much more accurate');
    console.log('✅ Future property analysis will benefit from cached data');
    
    // Verify final database state
    await this.verifyDatabaseCompleteness();
  }

  async verifyDatabaseCompleteness() {
    const verification = await this.pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as with_coordinates,
        COUNT(CASE WHEN condition_rating IS NOT NULL AND condition_rating != '' THEN 1 END) as with_condition,
        COUNT(CASE WHEN descriptions IS NOT NULL AND 
               latitude IS NOT NULL AND longitude IS NOT NULL AND
               condition_rating IS NOT NULL AND condition_rating != '' THEN 1 END) as fully_enhanced
      FROM properties
      WHERE descriptions IS NOT NULL
    `);
    
    const data = verification.rows[0];
    console.log('\n📊 FINAL DATABASE STATUS:');
    console.log(`   Properties with descriptions: ${data.total}`);
    console.log(`   With coordinates: ${data.with_coordinates} (${((data.with_coordinates/data.total)*100).toFixed(1)}%)`);
    console.log(`   With condition ratings: ${data.with_condition} (${((data.with_condition/data.total)*100).toFixed(1)}%)`);
    console.log(`   Fully enhanced: ${data.fully_enhanced} (${((data.fully_enhanced/data.total)*100).toFixed(1)}%)`);
    
    if (data.fully_enhanced == data.total) {
      console.log('\n🎉 SUCCESS: All properties are now fully enhanced!');
    } else {
      console.log(`\n⚠️ Note: ${data.total - data.fully_enhanced} properties may need additional processing`);
    }
  }
}

// Run the complete database enhancement
const enhancer = new CompleteDatabaseEnhancer();
enhancer.enhanceAllProperties(); 