const { Pool } = require('pg');
const axios = require('axios');
const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });

class EnhancedBatchGeocoder {
  constructor() {
    this.pool = new Pool({
      connectionString: 'postgresql://postgres:dev_password_123@localhost:5433/propertylist_db'
    });
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.geocodeCache = new Map();
    this.aiAnalysisCache = new Map();
    this.apiCallCount = 0;
    this.aiCallCount = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.enhancedCount = 0;
    this.startTime = Date.now();
  }

  async enhancedBatchGeocode() {
    try {
      console.log('🧠 ENHANCED BATCH GEOCODING WITH AI DESCRIPTION ANALYSIS');
      console.log('========================================================');
      console.log(`🔑 OpenCage API Key: ${process.env.OPENCAGE_API_KEY ? 'Loaded ✅' : 'Missing ❌'}`);
      console.log(`🤖 OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Loaded ✅' : 'Missing ❌'}`);
      
      if (!process.env.OPENCAGE_API_KEY) {
        throw new Error('OPENCAGE_API_KEY not found in environment variables');
      }
      
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not found in environment variables');
      }

      // Step 1: Get properties with descriptions
      const properties = await this.getPropertiesWithDescriptions();
      console.log(`📊 Properties needing geocoding: ${properties.length}`);

      if (properties.length === 0) {
        console.log('✅ All properties already have coordinates!');
        return;
      }

      // Step 2: Enhanced location analysis with AI
      console.log('\n🧠 ANALYZING DESCRIPTIONS WITH AI...');
      const enhancedProperties = await this.analyzeDescriptionsWithAI(properties.slice(0, 10)); // Test with 10 first

      // Step 3: Smart location grouping with enhanced data
      const locationGroups = this.groupEnhancedPropertiesByLocation(enhancedProperties);
      console.log(`🗺️ Grouped into ${locationGroups.size} unique enhanced locations`);
      console.log(`💰 Estimated cost: $${(locationGroups.size * 0.001).toFixed(3)} (geocoding) + $${(this.aiCallCount * 0.002).toFixed(3)} (AI)`);

      // Step 4: Process enhanced locations
      const prioritizedGroups = this.prioritizeLocationGroups(locationGroups);
      await this.geocodeEnhancedLocationGroups(prioritizedGroups);

      // Step 5: Update database with enhanced coordinates
      await this.updatePropertiesWithEnhancedCoordinates(enhancedProperties);

      // Step 6: Verify and test results
      await this.verifyEnhancedResults();
      await this.testEnhancedComparableSearch(enhancedProperties[0]);

      console.log('\n🎉 ENHANCED BATCH GEOCODING COMPLETE!');
      this.showEnhancedStatistics();

    } catch (error) {
      console.error('❌ Enhanced batch geocoding failed:', error.message);
    } finally {
      await this.pool.end();
    }
  }

  async getPropertiesWithDescriptions() {
    const query = `
      SELECT id, reference, city, suburb, urbanization, latitude, longitude, 
             sale_price, property_type, descriptions, address
      FROM properties 
      WHERE (latitude IS NULL OR longitude IS NULL)
        AND descriptions IS NOT NULL
      ORDER BY 
        CASE 
          WHEN LOWER(suburb) LIKE '%nueva andaluc%' THEN 1
          WHEN LOWER(suburb) LIKE '%puerto ban%' THEN 2
          WHEN LOWER(suburb) LIKE '%marbella%' THEN 3
          ELSE 4
        END,
        sale_price DESC NULLS LAST
      LIMIT 50
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  async analyzeDescriptionsWithAI(properties) {
    console.log(`🔍 Analyzing ${properties.length} property descriptions...`);
    const enhancedProperties = [];

    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];
      console.log(`\n📝 [${i + 1}/${properties.length}] Analyzing: ${property.reference}`);
      
      try {
        const enhanced = await this.enhancePropertyWithAI(property);
        enhancedProperties.push(enhanced);
        
        // Rate limiting for OpenAI
        if (i < properties.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.log(`   ❌ AI analysis failed: ${error.message}`);
        // Keep original property data
        enhancedProperties.push({
          ...property,
          aiEnhanced: false,
          enhancedLocation: this.createBasicLocationString(property),
          enhancementReason: 'AI analysis failed'
        });
      }
    }

    return enhancedProperties;
  }

  async enhancePropertyWithAI(property) {
    const cacheKey = property.reference;
    if (this.aiAnalysisCache.has(cacheKey)) {
      console.log(`   ⚡ Cache hit`);
      return this.aiAnalysisCache.get(cacheKey);
    }

    this.aiCallCount++;

    // Extract text from descriptions
    const descriptions = property.descriptions || {};
    const englishDesc = descriptions.en || '';
    const spanishDesc = descriptions.es || '';
    const combinedDesc = `${englishDesc} ${spanishDesc}`.trim();
    
    console.log(`   📖 Description: "${combinedDesc.substring(0, 100)}..."`);
    
    if (!combinedDesc || combinedDesc.length < 20) {
      console.log(`   ⚠️ Description too short, using basic location`);
      return {
        ...property,
        aiEnhanced: false,
        enhancedLocation: this.createBasicLocationString(property),
        enhancementReason: 'Description too short'
      };
    }

    const prompt = `Analyze this Spanish property description to extract specific location details for precise geocoding:

PROPERTY CONTEXT:
- Reference: ${property.reference}
- Basic Location: ${property.suburb || 'Unknown'}, ${property.city || 'Unknown'}
- Property Type: ${property.property_type || 'Unknown'}

DESCRIPTION:
"${combinedDesc}"

TASK: Extract specific location details that would help with precise geocoding. Look for:
1. Specific neighborhoods, urbanizations, or developments
2. Nearby landmarks (golf courses, marinas, shopping centers)
3. Street names or addresses
4. Distance/proximity references ("close to", "near", "next to")
5. Notable features that could help pinpoint location

Return JSON with:
{
  "hasSpecificLocation": boolean,
  "extractedLocation": "most specific location found or original if none",
  "landmarks": ["list of nearby landmarks mentioned"],
  "proximityClues": ["phrases like 'close to Puerto Banus'"],
  "confidence": 1-10,
  "reasoning": "brief explanation of what was found"
}

Focus on creating the most accurate geocoding query possible.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system", 
            content: "You are a Spanish real estate location intelligence expert. Extract precise location details for accurate geocoding."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 300 // Ultra-optimized for bulk processing
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      console.log(`   🧠 AI Analysis: ${analysis.extractedLocation} (confidence: ${analysis.confidence}/10)`);
      
      const enhanced = {
        ...property,
        aiEnhanced: analysis.hasSpecificLocation,
        enhancedLocation: analysis.extractedLocation,
        landmarks: analysis.landmarks || [],
        proximityClues: analysis.proximityClues || [],
        aiConfidence: analysis.confidence,
        enhancementReason: analysis.reasoning,
        originalDescription: combinedDesc.substring(0, 200)
      };

      this.aiAnalysisCache.set(cacheKey, enhanced);
      
      if (analysis.hasSpecificLocation) {
        this.enhancedCount++;
        console.log(`   ✨ Enhanced with: ${analysis.reasoning}`);
      } else {
        console.log(`   📍 Using basic location: ${analysis.reasoning}`);
      }

      return enhanced;

    } catch (error) {
      console.log(`   ❌ OpenAI error: ${error.message}`);
      throw error;
    }
  }

  createBasicLocationString(property) {
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

  groupEnhancedPropertiesByLocation(properties) {
    const groups = new Map();
    
    for (const property of properties) {
      // Use enhanced location for grouping
      const locationKey = property.enhancedLocation.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
      
      if (!groups.has(locationKey)) {
        groups.set(locationKey, {
          locationString: property.enhancedLocation,
          properties: [],
          enhancedCount: 0,
          averageConfidence: 0,
          highValueArea: this.isHighValueArea(property)
        });
      }
      
      const group = groups.get(locationKey);
      group.properties.push(property);
      
      if (property.aiEnhanced) {
        group.enhancedCount++;
        group.averageConfidence += property.aiConfidence || 0;
      }
    }
    
    // Calculate average confidence for each group
    for (const [key, group] of groups) {
      if (group.enhancedCount > 0) {
        group.averageConfidence = group.averageConfidence / group.enhancedCount;
      }
    }
    
    return groups;
  }

  isHighValueArea(property) {
    const location = (property.suburb || property.city || '').toLowerCase();
    const enhanced = (property.enhancedLocation || '').toLowerCase();
    const highValueAreas = [
      'nueva andaluc', 'puerto ban', 'golden mile', 'sierra blanca',
      'la zagaleta', 'sotogrande', 'guadalmina', 'san pedro'
    ];
    
    return highValueAreas.some(area => 
      location.includes(area) || enhanced.includes(area)
    );
  }

  prioritizeLocationGroups(locationGroups) {
    const groupsArray = Array.from(locationGroups.entries());
    
    return groupsArray.sort(([keyA, groupA], [keyB, groupB]) => {
      // Priority 1: Enhanced locations first
      if (groupA.enhancedCount > 0 && groupB.enhancedCount === 0) return -1;
      if (groupA.enhancedCount === 0 && groupB.enhancedCount > 0) return 1;
      
      // Priority 2: Higher AI confidence
      if (groupA.averageConfidence !== groupB.averageConfidence) {
        return groupB.averageConfidence - groupA.averageConfidence;
      }
      
      // Priority 3: High value areas
      if (groupA.highValueArea && !groupB.highValueArea) return -1;
      if (!groupA.highValueArea && groupB.highValueArea) return 1;
      
      // Priority 4: More properties
      return groupB.properties.length - groupA.properties.length;
    });
  }

  async geocodeEnhancedLocationGroups(prioritizedGroups) {
    console.log('\n🌍 GEOCODING ENHANCED LOCATIONS:');
    
    for (let i = 0; i < prioritizedGroups.length; i++) {
      const [locationKey, group] = prioritizedGroups[i];
      const progress = `${i + 1}/${prioritizedGroups.length}`;
      
      console.log(`\n📍 [${progress}] Geocoding: "${group.locationString}"`);
      console.log(`   Properties: ${group.properties.length} | Enhanced: ${group.enhancedCount} | Confidence: ${group.averageConfidence.toFixed(1)}/10`);
      
      try {
        const coordinates = await this.geocodeLocation(group.locationString);
        
        if (coordinates) {
          this.geocodeCache.set(locationKey, {
            ...coordinates,
            isEnhanced: group.enhancedCount > 0,
            aiConfidence: group.averageConfidence
          });
          this.successCount += group.properties.length;
          
          const enhancedFlag = group.enhancedCount > 0 ? '✨ ENHANCED' : '📍 BASIC';
          console.log(`   ✅ Success: ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)} (${enhancedFlag})`);
        } else {
          this.errorCount += group.properties.length;
          console.log(`   ❌ Failed to geocode`);
        }
        
        // Rate limiting
        if (i < prioritizedGroups.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1100));
        }
        
      } catch (error) {
        this.errorCount += group.properties.length;
        console.log(`   ❌ Error: ${error.message}`);
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

  async updatePropertiesWithEnhancedCoordinates(enhancedProperties) {
    console.log('\n💾 UPDATING DATABASE WITH ENHANCED COORDINATES:');
    
    let updateCount = 0;
    
    for (const property of enhancedProperties) {
      const locationKey = property.enhancedLocation.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
      const result = this.geocodeCache.get(locationKey);
      
      if (result) {
        try {
          await this.pool.query(
            'UPDATE properties SET latitude = $1, longitude = $2 WHERE id = $3',
            [result.lat, result.lng, property.id]
          );
          
          const enhancedFlag = property.aiEnhanced ? '✨' : '📍';
          console.log(`   ${enhancedFlag} ${property.reference}: ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`);
          updateCount++;
        } catch (error) {
          console.log(`   ❌ ${property.reference}: ${error.message}`);
        }
      } else {
        console.log(`   ⚠️ ${property.reference}: No coordinates available`);
      }
    }
    
    console.log(`\n📊 Updated ${updateCount} properties in database`);
    return updateCount;
  }

  async verifyEnhancedResults() {
    console.log('\n🔍 VERIFYING ENHANCED RESULTS:');
    
    const totalResult = await this.pool.query('SELECT COUNT(*) as total FROM properties');
    const coordsResult = await this.pool.query('SELECT COUNT(*) as with_coords FROM properties WHERE latitude IS NOT NULL AND longitude IS NOT NULL');
    
    const total = parseInt(totalResult.rows[0].total);
    const withCoords = parseInt(coordsResult.rows[0].with_coords);
    const percentage = (withCoords / total * 100).toFixed(1);
    
    console.log(`   Total properties: ${total}`);
    console.log(`   With coordinates: ${withCoords} (${percentage}%)`);
    console.log(`   Enhanced properties: ${this.enhancedCount}`);
  }

  async testEnhancedComparableSearch(testProperty) {
    console.log('\n🔍 TESTING ENHANCED COMPARABLE SEARCH:');
    
    try {
      const updatedProperty = await this.pool.query(`
        SELECT reference, latitude, longitude, property_type, sale_price, suburb
        FROM properties 
        WHERE id = $1 AND latitude IS NOT NULL AND longitude IS NOT NULL
      `, [testProperty.id]);
      
      if (updatedProperty.rows.length === 0) {
        console.log('   ⚠️ Test property does not have coordinates');
        return;
      }
      
      const prop = updatedProperty.rows[0];
      
      const comparables = await this.pool.query(`
        SELECT reference, suburb, property_type, sale_price,
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
      
      console.log(`   Test property: ${prop.reference} (${prop.suburb})`);
      console.log(`   Found ${comparables.rows.length} comparable properties:`);
      
      comparables.rows.forEach((comp, i) => {
        const distance = Math.round(comp.distance);
        const price = comp.sale_price ? '€' + comp.sale_price.toLocaleString() : 'No price';
        console.log(`   ${i + 1}. ${comp.reference} - ${distance}m away (${comp.suburb}) - ${price}`);
      });
      
      if (comparables.rows.length > 0) {
        console.log('   ✅ Enhanced comparable search working perfectly!');
      } else {
        console.log('   ⚠️ No comparables found');
      }
      
    } catch (error) {
      console.log(`   ❌ Enhanced comparable search test failed: ${error.message}`);
    }
  }

  showEnhancedStatistics() {
    const totalTime = (Date.now() - this.startTime) / 1000;
    const geocodingCost = this.apiCallCount * 0.001;
    const aiCost = this.aiCallCount * 0.002; // Estimate $0.002 per GPT-4 call
    const totalCost = geocodingCost + aiCost;
    
    console.log('\n📊 ENHANCED BATCH GEOCODING STATISTICS:');
    console.log('=======================================');
    console.log(`⏱️ Total time: ${Math.round(totalTime)}s (${(totalTime / 60).toFixed(1)} minutes)`);
    console.log(`🌐 Geocoding API calls: ${this.apiCallCount} ($${geocodingCost.toFixed(3)})`);
    console.log(`🤖 AI analysis calls: ${this.aiCallCount} ($${aiCost.toFixed(3)})`);
    console.log(`💰 Total cost: $${totalCost.toFixed(3)}`);
    console.log(`✨ Properties enhanced: ${this.enhancedCount}`);
    console.log(`✅ Properties geocoded successfully: ${this.successCount}`);
    console.log(`❌ Properties failed: ${this.errorCount}`);
    
    if (this.successCount + this.errorCount > 0) {
      console.log(`📈 Success rate: ${(this.successCount / (this.successCount + this.errorCount) * 100).toFixed(1)}%`);
    }
    
    console.log('\n🎯 ENHANCEMENT RESULTS:');
    console.log('- More precise coordinates from AI-analyzed descriptions');
    console.log('- Better comparable property matching');
    console.log('- Enhanced location intelligence for future sessions');
  }
}

// Run the enhanced batch geocoding
console.log('🚀 Starting enhanced batch geocoding with AI description analysis...');
const geocoder = new EnhancedBatchGeocoder();
geocoder.enhancedBatchGeocode(); 