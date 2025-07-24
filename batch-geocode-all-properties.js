const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

class BatchPropertyGeocoder {
  constructor() {
    this.pool = new Pool({
      connectionString: 'postgresql://postgres:dev_password_123@localhost:5433/propertylist_db'
    });
    this.geocodeCache = new Map();
    this.apiCallCount = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
  }

  async batchGeocodeAllProperties() {
    try {
      console.log('🏢 BATCH GEOCODING ALL PROPERTIES');
      console.log('==================================');
      console.log(`🔑 OpenCage API Key: ${process.env.OPENCAGE_API_KEY ? 'Loaded ✅' : 'Missing ❌'}`);
      
      if (!process.env.OPENCAGE_API_KEY) {
        throw new Error('OPENCAGE_API_KEY not found in environment variables');
      }

      // Step 1: Get all properties without coordinates
      const properties = await this.getPropertiesNeedingGeocode();
      console.log(`📊 Properties needing geocoding: ${properties.length}`);

      if (properties.length === 0) {
        console.log('✅ All properties already have coordinates!');
        return;
      }

      // Step 2: Smart location grouping
      const locationGroups = this.groupPropertiesByLocation(properties);
      console.log(`🗺️ Grouped into ${locationGroups.size} unique locations`);
      console.log(`💰 Estimated cost: $${(locationGroups.size * 0.001).toFixed(3)}`);

      // Step 3: Process by priority (high-value areas first)
      const prioritizedGroups = this.prioritizeLocationGroups(locationGroups);
      console.log(`⚡ Processing in priority order...`);

      // Step 4: Geocode each unique location with rate limiting
      await this.geocodeLocationGroups(prioritizedGroups);

      // Step 5: Update all properties with coordinates
      await this.updateAllPropertiesWithCoordinates(properties, this.geocodeCache);

      // Step 6: Verify results
      await this.verifyResults();

      // Step 7: Test comparable search
      await this.testComparableSearchAfterBatch();

      console.log('\n🎉 BATCH GEOCODING COMPLETE!');
      this.showFinalStatistics();

    } catch (error) {
      console.error('❌ Batch geocoding failed:', error.message);
    } finally {
      await this.pool.end();
    }
  }

  async getPropertiesNeedingGeocode() {
    const query = `
      SELECT id, reference, city, suburb, urbanization, latitude, longitude, sale_price
      FROM properties 
      WHERE latitude IS NULL OR longitude IS NULL
      ORDER BY 
        CASE 
          WHEN LOWER(suburb) LIKE '%nueva andaluc%' THEN 1
          WHEN LOWER(suburb) LIKE '%puerto ban%' THEN 2
          WHEN LOWER(suburb) LIKE '%marbella%' THEN 3
          WHEN LOWER(suburb) LIKE '%estepona%' THEN 4
          ELSE 5
        END,
        sale_price DESC NULLS LAST
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  groupPropertiesByLocation(properties) {
    const groups = new Map();
    
    for (const property of properties) {
      const locationKey = this.createLocationKey(property);
      
      if (!groups.has(locationKey)) {
        groups.set(locationKey, {
          locationString: this.createLocationString(property),
          properties: [],
          averagePrice: 0,
          highValueArea: this.isHighValueArea(property)
        });
      }
      
      groups.get(locationKey).properties.push(property);
    }
    
    // Calculate average prices for prioritization
    for (const [key, group] of groups) {
      const prices = group.properties
        .map(p => p.sale_price)
        .filter(p => p && p > 0);
      
      group.averagePrice = prices.length > 0 
        ? prices.reduce((a, b) => a + b, 0) / prices.length 
        : 0;
    }
    
    return groups;
  }

  createLocationKey(property) {
    // Group by most specific location available
    if (property.urbanization && property.urbanization !== 'undefined') {
      return `${property.urbanization.toLowerCase()}_${property.city.toLowerCase()}`;
    }
    if (property.suburb) {
      return `${property.suburb.toLowerCase()}_${property.city.toLowerCase()}`;
    }
    return property.city.toLowerCase();
  }

  createLocationString(property) {
    const parts = [];
    
    if (property.urbanization && property.urbanization !== 'undefined') {
      parts.push(property.urbanization);
    }
    if (property.suburb) {
      parts.push(property.suburb);
    }
    if (property.city) {
      parts.push(property.city);
    }
    parts.push('Spain');
    
    return parts.join(', ');
  }

  isHighValueArea(property) {
    const location = (property.suburb || property.city || '').toLowerCase();
    const highValueAreas = [
      'nueva andaluc', 'puerto ban', 'golden mile', 'sierra blanca',
      'la zagaleta', 'sotogrande', 'guadalmina', 'san pedro'
    ];
    
    return highValueAreas.some(area => location.includes(area));
  }

  prioritizeLocationGroups(locationGroups) {
    const groupsArray = Array.from(locationGroups.entries());
    
    return groupsArray.sort(([keyA, groupA], [keyB, groupB]) => {
      // Priority 1: High value areas first
      if (groupA.highValueArea && !groupB.highValueArea) return -1;
      if (!groupA.highValueArea && groupB.highValueArea) return 1;
      
      // Priority 2: More properties = higher priority
      if (groupA.properties.length !== groupB.properties.length) {
        return groupB.properties.length - groupA.properties.length;
      }
      
      // Priority 3: Higher average price
      return groupB.averagePrice - groupA.averagePrice;
    });
  }

  async geocodeLocationGroups(prioritizedGroups) {
    console.log('\n🌍 GEOCODING UNIQUE LOCATIONS:');
    
    for (let i = 0; i < prioritizedGroups.length; i++) {
      const [locationKey, group] = prioritizedGroups[i];
      const progress = `${i + 1}/${prioritizedGroups.length}`;
      
      console.log(`\n📍 [${progress}] Geocoding: "${group.locationString}"`);
      console.log(`   Properties: ${group.properties.length} | Priority: ${group.highValueArea ? 'HIGH' : 'NORMAL'}`);
      
      try {
        const coordinates = await this.geocodeLocation(group.locationString);
        
        if (coordinates) {
          this.geocodeCache.set(locationKey, coordinates);
          this.successCount += group.properties.length;
          
          console.log(`   ✅ Success: ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)} (confidence: ${coordinates.confidence}%)`);
        } else {
          this.errorCount += group.properties.length;
          console.log(`   ❌ Failed to geocode`);
        }
        
        // Rate limiting: 1 request per second for free tier
        if (i < prioritizedGroups.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1100));
        }
        
      } catch (error) {
        this.errorCount += group.properties.length;
        console.log(`   ❌ Error: ${error.message}`);
      }
      
      // Progress update every 10 locations
      if ((i + 1) % 10 === 0) {
        const elapsed = (Date.now() - this.startTime) / 1000;
        const rate = (i + 1) / elapsed;
        const remaining = prioritizedGroups.length - (i + 1);
        const eta = remaining / rate;
        
        console.log(`\n⏱️ Progress: ${i + 1}/${prioritizedGroups.length} locations`);
        console.log(`   Rate: ${rate.toFixed(1)} locations/sec | ETA: ${Math.round(eta)}s`);
        console.log(`   API calls: ${this.apiCallCount} | Cost so far: $${(this.apiCallCount * 0.001).toFixed(3)}`);
      }
    }
  }

  async geocodeLocation(locationString) {
    this.apiCallCount++;
    
    try {
      const response = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
        params: {
          q: locationString,
          key: process.env.OPENCAGE_API_KEY,
          limit: 1,
          countrycode: 'es',
          language: 'en'
        },
        timeout: 10000
      });

      if (response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0];
        return {
          lat: result.geometry.lat,
          lng: result.geometry.lng,
          confidence: result.confidence || 50,
          formatted: result.formatted
        };
      }
    } catch (error) {
      if (error.response?.status === 402) {
        throw new Error('OpenCage API quota exceeded');
      }
      if (error.response?.status === 401) {
        throw new Error('OpenCage API key invalid');
      }
      throw error;
    }
    
    return null;
  }

  async updateAllPropertiesWithCoordinates(properties, geocodeCache) {
    console.log('\n💾 UPDATING DATABASE WITH COORDINATES:');
    
    let updateCount = 0;
    const batchSize = 100;
    
    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);
      const updates = [];
      
      for (const property of batch) {
        const locationKey = this.createLocationKey(property);
        const coordinates = geocodeCache.get(locationKey);
        
        if (coordinates) {
          updates.push({
            id: property.id,
            lat: coordinates.lat,
            lng: coordinates.lng,
            reference: property.reference
          });
        }
      }
      
      if (updates.length > 0) {
        try {
          // Batch update using unnest arrays
          const ids = updates.map(u => u.id);
          const lats = updates.map(u => u.lat);
          const lngs = updates.map(u => u.lng);
          
          await this.pool.query(`
            UPDATE properties 
            SET latitude = coords.lat, longitude = coords.lng
            FROM (
              SELECT 
                unnest($1::integer[]) as id,
                unnest($2::decimal[]) as lat,
                unnest($3::decimal[]) as lng
            ) as coords
            WHERE properties.id = coords.id
          `, [ids, lats, lngs]);
          
          updateCount += updates.length;
          
          console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1}: Updated ${updates.length} properties`);
          
        } catch (error) {
          console.log(`   ❌ Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n📊 Database update complete: ${updateCount} properties updated`);
    return updateCount;
  }

  async verifyResults() {
    console.log('\n🔍 VERIFYING RESULTS:');
    
    const totalResult = await this.pool.query('SELECT COUNT(*) as total FROM properties');
    const coordsResult = await this.pool.query('SELECT COUNT(*) as with_coords FROM properties WHERE latitude IS NOT NULL AND longitude IS NOT NULL');
    
    const total = parseInt(totalResult.rows[0].total);
    const withCoords = parseInt(coordsResult.rows[0].with_coords);
    const percentage = (withCoords / total * 100).toFixed(1);
    
    console.log(`   Total properties: ${total}`);
    console.log(`   With coordinates: ${withCoords} (${percentage}%)`);
    console.log(`   Missing coordinates: ${total - withCoords}`);
  }

  async testComparableSearchAfterBatch() {
    console.log('\n🔍 TESTING COMPARABLE SEARCH:');
    
    try {
      // Get a property with coordinates
      const testProperty = await this.pool.query(`
        SELECT reference, latitude, longitude, property_type, sale_price
        FROM properties 
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        LIMIT 1
      `);
      
      if (testProperty.rows.length === 0) {
        console.log('   ⚠️ No properties with coordinates found for testing');
        return;
      }
      
      const prop = testProperty.rows[0];
      
      // Test comparable search
      const comparables = await this.pool.query(`
        SELECT reference, 
               ST_Distance(
                 ST_Point($1, $2)::geography,
                 ST_Point(longitude, latitude)::geography
               ) as distance
        FROM properties 
        WHERE latitude IS NOT NULL 
          AND longitude IS NOT NULL
          AND reference != $3
        ORDER BY distance
        LIMIT 5
      `, [prop.longitude, prop.latitude, prop.reference]);
      
      console.log(`   Test property: ${prop.reference}`);
      console.log(`   Found ${comparables.rows.length} comparable properties:`);
      
      comparables.rows.forEach((comp, i) => {
        console.log(`   ${i + 1}. ${comp.reference} - ${Math.round(comp.distance)}m away`);
      });
      
      if (comparables.rows.length > 0) {
        console.log('   ✅ Comparable search is working perfectly!');
      }
      
    } catch (error) {
      console.log(`   ❌ Comparable search test failed: ${error.message}`);
    }
  }

  showFinalStatistics() {
    const totalTime = (Date.now() - this.startTime) / 1000;
    const totalCost = this.apiCallCount * 0.001;
    
    console.log('\n📊 FINAL STATISTICS:');
    console.log('====================');
    console.log(`⏱️ Total time: ${Math.round(totalTime)}s (${(totalTime / 60).toFixed(1)} minutes)`);
    console.log(`🌐 API calls made: ${this.apiCallCount}`);
    console.log(`💰 Total cost: $${totalCost.toFixed(3)}`);
    console.log(`✅ Properties geocoded successfully: ${this.successCount}`);
    console.log(`❌ Properties failed: ${this.errorCount}`);
    console.log(`📈 Success rate: ${(this.successCount / (this.successCount + this.errorCount) * 100).toFixed(1)}%`);
    
    if (this.apiCallCount > 0) {
      console.log(`⚡ Average rate: ${(this.apiCallCount / totalTime).toFixed(2)} requests/second`);
    }
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('- Comparable property search is now working');
    console.log('- New properties will use Google Maps for real-time geocoding');
    console.log('- Consider setting up auto-geocoding for new XML imports');
  }
}

// Run the batch geocoding
console.log('🚀 Starting batch geocoding process...');
const geocoder = new BatchPropertyGeocoder();
geocoder.batchGeocodeAllProperties(); 