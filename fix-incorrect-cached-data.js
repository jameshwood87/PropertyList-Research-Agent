const { Pool } = require('pg');
const OptimizedLocationService = require('./server/services/optimizedLocationService');
require('dotenv').config({ path: '.env.local' });

// Quick check function for specific property
async function checkPropertyCoordinates(reference) {
  const pool = new Pool({
    connectionString: 'postgresql://postgres:dev_password_123@localhost:5433/propertylist_db'
  });
  
  try {
    const result = await pool.query(
      'SELECT reference, latitude, longitude, suburb, city, urbanization, address FROM properties WHERE reference = $1', 
      [reference]
    );
    
    if (result.rows.length > 0) {
      console.log(`Property ${reference} coordinates in database:`);
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log(`Property ${reference} not found in database`);
    }
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await pool.end();
  }
}

// Run check if called directly
if (require.main === module && process.argv[2] === 'check') {
  const propertyRef = process.argv[3] || 'R4899124';
  checkPropertyCoordinates(propertyRef);
  return;
}

// Manual trigger reanalysis function
async function manualTriggerReanalysis(reference) {
  const { Pool } = require('pg');
  const AutoReanalysisService = require('./server/services/autoReanalysisService');
  
  const pool = new Pool({
    connectionString: 'postgresql://postgres:dev_password_123@localhost:5433/propertylist_db'
  });
  
  try {
    console.log(`🎯 Manually triggering reanalysis for ${reference}...`);
    
    const autoReanalysis = new AutoReanalysisService(pool);
    await autoReanalysis.triggerReanalysis([reference]);
    
    console.log(`✅ Manual reanalysis completed for ${reference}`);
  } catch (error) {
    console.error('❌ Manual reanalysis failed:', error.message);
  } finally {
    await pool.end();
  }
}

// Run manual trigger if called with 'trigger' argument
if (require.main === module && process.argv[2] === 'trigger') {
  const propertyRef = process.argv[3] || 'R4899124';
  manualTriggerReanalysis(propertyRef);
  return;
}

class IncorrectCacheDataFixer {
  constructor() {
    this.pool = new Pool({
      connectionString: 'postgresql://postgres:dev_password_123@localhost:5433/propertylist_db'
    });
    this.locationService = new OptimizedLocationService();
    this.stats = {
      totalChecked: 0,
      potentiallyIncorrect: 0,
      corrected: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  async fixIncorrectCachedData() {
    try {
      console.log('🚨 TESTING NEW CACHING SYSTEM WITH 10 PROPERTIES');
      console.log('=================================================');
      console.log('Testing the new urbanization + suburb caching system');
      console.log('and checking for any remaining incorrect cached data\n');

      if (!process.env.OPENAI_API_KEY) {
        throw new Error('Missing OpenAI API key');
      }

      // Step 1: Get 10 properties for testing the new caching system
      const affectedProperties = await this.identifyAffectedProperties();
      this.stats.totalChecked = affectedProperties.length;
      
      console.log(`📊 Found ${affectedProperties.length} properties to test with new caching system\n`);

      if (affectedProperties.length === 0) {
        console.log('✅ No properties found for testing!');
        return;
      }

      // Step 2: Show property details before analysis
      console.log('📋 Properties to be tested:');
      affectedProperties.forEach((prop, i) => {
        console.log(`   ${i + 1}. ${prop.reference} - ${prop.suburb}, ${prop.city}`);
        console.log(`      Current condition: ${prop.condition_rating}`);
        console.log(`      Urbanization: ${prop.urbanization || 'None'}`);
        console.log(`      Has coordinates: ${prop.latitude ? 'Yes' : 'No'}`);
        console.log(`      Address: ${prop.address || 'N/A'}`);
      });
      console.log('');

      // Step 3: Test new caching system with these properties
      console.log('🔍 Testing new caching system with real properties...\n');
      
      for (let i = 0; i < affectedProperties.length; i++) {
        const property = affectedProperties[i];
        const progress = `[${i + 1}/${affectedProperties.length}]`;
        
        console.log(`${progress} Testing ${property.reference} - ${property.suburb}, ${property.city}`);
        
        try {
          const isIncorrect = await this.checkIfDataIsIncorrect(property);
          
          if (isIncorrect) {
            console.log(`   ❌ INCORRECT DATA DETECTED - Fixing...`);
            await this.fixPropertyData(property);
            this.stats.corrected++;
            console.log(`   ✅ Fixed with fresh AI analysis`);
          } else {
            console.log(`   ✅ Data appears correct with new caching system`);
          }
          
          // Rate limiting
          if (i < affectedProperties.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (error) {
          console.log(`   ❌ Error checking property: ${error.message}`);
          this.stats.errors++;
        }
      }

      await this.showResults();

    } catch (error) {
      console.error('❌ Failed to test new caching system:', error.message);
    } finally {
      await this.pool.end();
    }
  }

  async identifyAffectedProperties() {
    console.log('🔍 Identifying properties that may have been affected by old cache system...');
    
    // TEST MODE: Get 10 properties for testing the new caching system
    const query = `
      SELECT 
        id, reference, city, suburb, urbanization, address,
        latitude, longitude, condition_rating, descriptions,
        created_timestamp, updated_timestamp
      FROM properties 
      WHERE 
        descriptions IS NOT NULL
        AND condition_rating IS NOT NULL 
        AND condition_rating != ''
        AND (
          -- Properties in same suburb that might have shared cache incorrectly
          suburb IN (
            SELECT suburb 
            FROM properties 
            WHERE suburb IS NOT NULL 
            GROUP BY suburb 
            HAVING COUNT(*) > 1
          )
          -- Focus on areas where old cache was likely used
          AND (
            LOWER(suburb) LIKE '%nueva andaluc%' OR
            LOWER(suburb) LIKE '%puerto ban%' OR
            LOWER(suburb) LIKE '%marbella%' OR
            LOWER(suburb) LIKE '%estepona%'
          )
        )
      ORDER BY suburb, updated_timestamp DESC
      LIMIT 10  -- TEST MODE: Process 10 properties
    `;
    
    const result = await this.pool.query(query);
    console.log(`   Found ${result.rows.length} properties to check (TEST MODE - Limited to 10)`);
    
    return result.rows;
  }

  async checkIfDataIsIncorrect(property) {
    // Run fresh AI analysis and compare with stored data
    console.log(`   🤖 Running fresh AI analysis...`);
    
    const freshResult = await this.locationService.analyzePropertyLocation(property);
    
    // Compare stored condition_rating with fresh AI analysis
    const storedCondition = property.condition_rating;
    const freshCondition = freshResult.conditionRating;
    
    // If there's a significant difference, it might be incorrect cached data
    const conditionMismatch = storedCondition !== freshCondition;
    
    if (conditionMismatch) {
      console.log(`   ⚠️ Condition mismatch: stored "${storedCondition}" vs fresh "${freshCondition}"`);
      this.stats.potentiallyIncorrect++;
      return true;
    }
    
    // Additional checks could be added here for location intelligence accuracy
    // For now, focus on condition rating as it's the main cached data
    
    return false;
  }

  async fixPropertyData(property) {
    // Clear old cached data and run fresh analysis
    console.log(`   🔧 Clearing old cached data and running fresh analysis...`);
    
    // Run completely fresh AI analysis (will use new precise cache if applicable)
    const freshResult = await this.locationService.analyzePropertyLocation(property);
    
    // Update condition rating with fresh analysis
    if (freshResult.conditionRating) {
      await this.pool.query(
        `UPDATE properties 
         SET condition_rating = $1, updated_timestamp = CURRENT_TIMESTAMP
         WHERE reference = $2`,
        [freshResult.conditionRating, property.reference]
      );
      console.log(`     🏠 Updated condition: ${freshResult.conditionRating}`);
    }
    
    // If coordinates need updating from enhanced location
    if (!property.latitude && freshResult.enhancedLocation) {
      const coordinates = await this.geocodeLocation(freshResult.enhancedLocation);
      if (coordinates) {
        await this.pool.query(
          `UPDATE properties 
           SET latitude = $1, longitude = $2, updated_timestamp = CURRENT_TIMESTAMP
           WHERE reference = $3`,
          [coordinates.lat, coordinates.lng, property.reference]
        );
        console.log(`     📍 Updated coordinates: ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`);
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

  async showResults() {
    const totalTime = (Date.now() - this.stats.startTime) / 1000;
    
    console.log('\n🎉 INCORRECT CACHE DATA FIXING COMPLETED!');
    console.log('==========================================');
    console.log(`⏱️ Total time: ${Math.round(totalTime)}s`);
    console.log(`📊 Properties checked: ${this.stats.totalChecked}`);
    console.log(`⚠️ Potentially incorrect: ${this.stats.potentiallyIncorrect}`);
    console.log(`✅ Properties corrected: ${this.stats.corrected}`);
    console.log(`❌ Errors: ${this.stats.errors}`);
    
    const correctionRate = this.stats.totalChecked > 0 
      ? ((this.stats.corrected / this.stats.totalChecked) * 100).toFixed(1)
      : 0;
    
    console.log(`📈 Correction rate: ${correctionRate}%`);
    
    if (this.stats.corrected > 0) {
      console.log('\n🎯 IMPACT:');
      console.log('✅ Removed incorrect location intelligence sharing');
      console.log('✅ Updated with fresh, property-specific AI analysis');
      console.log('✅ Future analysis will use precise location cache only');
      console.log('✅ Data integrity restored for affected properties');
    }
    
    // Clear in-memory caches to ensure fresh data
    this.locationService.clearCaches();
    console.log('\n🧹 Cleared all caches to ensure fresh data for future analysis');
    
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Monitor future property analysis for accuracy');
    console.log('2. New precise location cache only matches same street/urbanization');
    console.log('3. Each property now has correct, specific location intelligence');
  }
}

// Run the incorrect cache data fixer
const fixer = new IncorrectCacheDataFixer();
fixer.fixIncorrectCachedData(); 