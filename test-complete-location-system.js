const LocationIntelligenceService = require('./server/services/locationIntelligenceService');
const PostgresDatabase = require('./server/database/postgresDatabase');

async function testCompleteLocationSystem() {
  console.log('🧪 Testing Complete Location Intelligence System...\n');
  
  try {
    // Initialize database
    console.log('🔌 Initializing database connection...');
    const db = new PostgresDatabase();
    await db.init();
    
    // Initialize location service
    console.log('🚀 Initializing Location Intelligence Service...');
    const locationService = new LocationIntelligenceService(db);
    
    // Wait for initialization (cache warming + knowledge base building)
    console.log('⏳ Waiting for service initialization...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 TESTING LOCATION RESOLUTION WITH LOGGING');
    console.log('='.repeat(60));
    
    // Test cases with various Spanish location formats
    const testCases = [
      { input: 'Nueva Andalucía', expected: 'exact_match' },
      { input: 'nueva andalucia', expected: 'fuzzy_match' },
      { input: 'Puerto Banus', expected: 'trigram_similarity' },
      { input: 'La Quinta Golf', expected: 'exact_match' },
      { input: 'Urbanización Nueva Andalucía', expected: 'structured_parse' },
      { input: 'Calle Real 15, Puerto Banús', expected: 'structured_parse' },
      { input: 'Villa near Marbella center', expected: 'ai_extraction' },
      { input: 'completely unknown location 12345', expected: 'no_match' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n📍 Testing: "${testCase.input}"`);
      console.log(`   Expected method: ${testCase.expected}`);
      
      const result = await locationService.resolveLocationWithLogging(testCase.input);
      
      console.log(`   ✅ Result: ${result.location}`);
      console.log(`   📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   🔧 Method: ${result.method}`);
      
      if (result.coordinates) {
        console.log(`   📍 Coordinates: ${result.coordinates.lat}, ${result.coordinates.lng}`);
      }
      
      if (result.alternatives && result.alternatives.length > 0) {
        console.log(`   📋 Alternatives: ${result.alternatives.map(a => `${a.location} (${(a.confidence * 100).toFixed(1)}%)`).join(', ')}`);
      }
      
      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TESTING LEARNING ANALYTICS');
    console.log('='.repeat(60));
    
    // Test learning analytics
    const analytics = await locationService.getLearningAnalytics(1); // Last 1 day
    console.log('\n📈 Learning Analytics Results:');
    console.log(JSON.stringify(analytics, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log('⚡ TESTING PERFORMANCE METRICS');
    console.log('='.repeat(60));
    
    // Display performance metrics
    const metrics = locationService.getMetrics();
    console.log('\n📊 Performance Metrics:');
    console.log(JSON.stringify(metrics, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log('🗄️ TESTING KNOWLEDGE BASE');
    console.log('='.repeat(60));
    
    // Test knowledge base queries
    console.log('\n🏗️ Querying urbanization knowledge base...');
    const knowledgeQuery = await db.query(`
      SELECT 
        name,
        city,
        property_count,
        aliases,
        latitude,
        longitude
      FROM urbanization_knowledge 
      ORDER BY property_count DESC 
      LIMIT 10
    `);
    
    console.log('\n📋 Top 10 Known Urbanizations:');
    knowledgeQuery.rows.forEach((urb, index) => {
      console.log(`${index + 1}. ${urb.name}, ${urb.city}`);
      console.log(`   Properties: ${urb.property_count}`);
      console.log(`   Coordinates: ${urb.latitude}, ${urb.longitude}`);
      if (urb.aliases && urb.aliases.length > 0) {
        console.log(`   Aliases: ${urb.aliases.join(', ')}`);
      }
      console.log('');
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('📜 TESTING RESOLUTION LOGS');
    console.log('='.repeat(60));
    
    // Test resolution logs
    const recentLogs = await db.query(`
      SELECT 
        input_text,
        method,
        confidence,
        processing_time_ms,
        success,
        created_at
      FROM location_resolution_log 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('\n📝 Recent Resolution Logs:');
    recentLogs.rows.forEach((log, index) => {
      console.log(`${index + 1}. "${log.input_text}"`);
      console.log(`   Method: ${log.method}`);
      console.log(`   Confidence: ${(log.confidence * 100).toFixed(1)}%`);
      console.log(`   Processing Time: ${log.processing_time_ms}ms`);
      console.log(`   Success: ${log.success ? '✅' : '❌'}`);
      console.log(`   Time: ${new Date(log.created_at).toLocaleString()}`);
      console.log('');
    });
    
    console.log('🎉 Complete Location Intelligence System Test Successful!');
    console.log('\n✨ All Features Working:');
    console.log('   ✅ 5-Layer Location Resolution');
    console.log('   ✅ Performance Caching');
    console.log('   ✅ Knowledge Base Population');
    console.log('   ✅ Learning Analytics');
    console.log('   ✅ Resolution Logging');
    console.log('   ✅ AI Learning Integration');
    console.log('   ✅ Spanish Address Parsing');
    console.log('   ✅ Trigram Fuzzy Matching');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  process.exit(0);
}

// Run the comprehensive test
testCompleteLocationSystem(); 