const LocationIntelligenceService = require('./server/services/locationIntelligenceService');
const PostgresDatabase = require('./server/database/postgresDatabase');

/**
 * Comprehensive test for Enhanced Location Intelligence System
 * Tests AI description parsing, multi-query geocoding, and enhanced confidence scoring
 */

async function testEnhancedLocationSystem() {
  console.log('🚀 Testing Enhanced Location Intelligence System...\n');

  try {
    // Initialize database and service
    console.log('🔌 Initializing PostgreSQL database...');
    const db = new PostgresDatabase();
    await db.init();

    console.log('🤖 Initializing Enhanced Location Intelligence Service...');
    const locationService = new LocationIntelligenceService(db);

    // Test cases representing various Spanish property location scenarios
    const testCases = [
      {
        name: "Complex Spanish Description with Landmarks",
        input: "Villa situada en Urbanización Los Monteros, a 10 metros del Restaurante Palm Beach, caminando a la playa de Los Monteros y cerca del Alamos Park Golf Club",
        expected: "should extract urbanization, landmarks, and proximity clues",
        context: { city: "Marbella", province: "Málaga", userInput: true }
      },
      {
        name: "Street Address with Urbanization",
        input: "Avenida del Mar 15, Urb. Puerto Romano, Nueva Andalucía",
        expected: "should prioritize specific street address",
        context: { city: "Marbella", province: "Málaga" }
      },
      {
        name: "Landmark-based Location",
        input: "Property next to El Corte Inglés shopping center in Puerto Banús",
        expected: "should use landmark for geocoding",
        context: { city: "Marbella", province: "Málaga", userInput: true }
      },
      {
        name: "Urbanization Only",
        input: "La Quinta Golf Resort",
        expected: "should find urbanization coordinates",
        context: { city: "Benahavís", province: "Málaga" }
      },
      {
        name: "Mixed Language Description",
        input: "Beautiful villa near Marbella Club Hotel, walking distance to Golden Mile beaches",
        expected: "should handle English/Spanish mix",
        context: { city: "Marbella", province: "Málaga", userInput: true }
      },
      {
        name: "Proximity-based Description",
        input: "5 minutes walk to Puerto Banús marina, close to Villa Padierna hotel",
        expected: "should extract multiple proximity clues",
        context: { city: "Marbella", province: "Málaga", userInput: true }
      }
    ];

    console.log(`📋 Testing ${testCases.length} enhanced location scenarios...\n`);

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🧪 Test ${i + 1}: ${testCase.name}`);
      console.log(`📝 Input: "${testCase.input}"`);
      console.log(`🎯 Expected: ${testCase.expected}`);
      console.log(`${'='.repeat(60)}`);

      try {
        // Test AI Description Parsing
        console.log('\n🤖 PHASE 1: AI Description Parsing');
        console.log('-'.repeat(40));
        
        const aiAnalysis = await locationService.analyzeDescriptionWithAI(
          testCase.input, 
          testCase.context
        );
        
        console.log(`✅ AI Analysis Results:`);
        if (aiAnalysis.specificStreets?.length > 0) {
          console.log(`   🛣️  Streets: ${aiAnalysis.specificStreets.join(', ')}`);
        }
        if (aiAnalysis.urbanizations?.length > 0) {
          console.log(`   🏘️  Urbanizations: ${aiAnalysis.urbanizations.join(', ')}`);
        }
        if (aiAnalysis.neighborhoods?.length > 0) {
          console.log(`   🏙️  Neighborhoods: ${aiAnalysis.neighborhoods.join(', ')}`);
        }
        if (aiAnalysis.landmarks?.length > 0) {
          console.log(`   🏛️  Landmarks: ${aiAnalysis.landmarks.map(l => `${l.name} (${l.distance})`).join(', ')}`);
        }
        if (aiAnalysis.proximityClues?.length > 0) {
          console.log(`   🚶 Proximity: ${aiAnalysis.proximityClues.map(p => `${p.place} (${p.distance})`).join(', ')}`);
        }

        // Test Multi-Query Generation
        console.log('\n🔍 PHASE 2: Multi-Query Generation');
        console.log('-'.repeat(40));
        
        const queries = locationService.generateOptimalGeocodingQueries(
          aiAnalysis, 
          testCase.input, 
          testCase.context
        );
        
        console.log(`✅ Generated ${queries.length} optimized queries:`);
        queries.forEach((query, index) => {
          console.log(`   ${index + 1}. "${query}"`);
        });

        // Test Enhanced Location Resolution
        console.log('\n🎯 PHASE 3: Enhanced Location Resolution');
        console.log('-'.repeat(40));
        
        const result = await locationService.resolveLocationWithLogging(
          testCase.input,
          testCase.context
        );

        console.log(`✅ Resolution Results:`);
        console.log(`   📍 Location: ${result.location}`);
        console.log(`   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   🔧 Method: ${result.method}`);
        
        if (result.coordinates) {
          console.log(`   🗺️  Coordinates: ${result.coordinates.lat}, ${result.coordinates.lng}`);
        }

        if (result.enhancedMetadata) {
          console.log(`   📊 Enhanced Metadata:`);
          console.log(`      Query Used: "${result.enhancedMetadata.queryUsed}"`);
          console.log(`      Query Index: ${result.enhancedMetadata.queryIndex}/${result.enhancedMetadata.totalQueries}`);
          console.log(`      Location Type: ${result.enhancedMetadata.locationType}`);
          if (result.enhancedMetadata.placeId) {
            console.log(`      Place ID: ${result.enhancedMetadata.placeId}`);
          }
        }

        // Success indicators
        const hasCoordinates = !!result.coordinates;
        const highConfidence = result.confidence > 0.75;
        const usedEnhancedMethod = result.method?.includes('enhanced');

        console.log(`\n📈 Quality Assessment:`);
        console.log(`   ${hasCoordinates ? '✅' : '❌'} Has Coordinates`);
        console.log(`   ${highConfidence ? '✅' : '❌'} High Confidence (${(result.confidence * 100).toFixed(1)}%)`);
        console.log(`   ${usedEnhancedMethod ? '✅' : '❌'} Used Enhanced Method`);

        if (hasCoordinates && highConfidence && usedEnhancedMethod) {
          console.log(`   🎉 Test PASSED - All quality indicators met!`);
        } else {
          console.log(`   ⚠️  Test PARTIAL - Some quality indicators missing`);
        }

      } catch (error) {
        console.error(`   ❌ Test FAILED:`, error.message);
      }
    }

    // Performance and Analytics Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 SYSTEM PERFORMANCE SUMMARY');
    console.log(`${'='.repeat(60)}`);

    const metrics = locationService.getMetrics();
    console.log(`🔢 Performance Metrics:`);
    console.log(`   Total Queries: ${metrics.totalQueries}`);
    console.log(`   Exact Hits: ${metrics.exactHits}`);
    console.log(`   Trigram Hits: ${metrics.trigramHits}`);
    console.log(`   Fuzzy Hits: ${metrics.fuzzyHits}`);
    console.log(`   AI Calls: ${metrics.aiCalls}`);
    console.log(`   Cache Hits: ${metrics.cacheHits}`);

    // Test Database Query Performance
    console.log(`\n🔍 Database Performance Test:`);
    const startTime = Date.now();
    
    // Test fuzzy matching performance
    const fuzzyTest = await locationService.findTrigramMatch("Los Monteros");
    const fuzzyTime = Date.now() - startTime;
    
    console.log(`   Fuzzy Search: ${fuzzyTime}ms`);
    console.log(`   Result: ${fuzzyTest.location} (${(fuzzyTest.confidence * 100).toFixed(1)}% confidence)`);

    console.log(`\n🎉 Enhanced Location Intelligence System Test Complete!`);

  } catch (error) {
    console.error('❌ System test failed:', error);
  }
}

// Run the comprehensive test
if (require.main === module) {
  testEnhancedLocationSystem()
    .then(() => {
      console.log('\n✅ All tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testEnhancedLocationSystem }; 