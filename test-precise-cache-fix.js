require('dotenv').config({ path: '.env.local' });
const OptimizedLocationService = require('./server/services/optimizedLocationService');

async function testPreciseCacheFix() {
  console.log('🧪 TESTING PRECISE CACHE FIX');
  console.log('============================');
  console.log('Testing that broad areas like "Golden Mile" are rejected\n');

  const locationService = new OptimizedLocationService();

  // Test properties that should NOT share cache
  const goldenMileProperty1 = {
    reference: "TEST1",
    address: "Marbella Golden Mile, Marbella",
    suburb: "Marbella Golden Mile",
    urbanization: null,
    descriptions: {
      en: "Luxury villa in Golden Mile near beach",
      es: "Villa de lujo en Milla de Oro cerca de la playa"
    }
  };

  const goldenMileProperty2 = {
    reference: "TEST2", 
    address: "Marbella Golden Mile, Marbella",
    suburb: "Marbella Golden Mile",
    urbanization: null,
    descriptions: {
      en: "Modern apartment in Golden Mile with views",
      es: "Apartamento moderno en Milla de Oro con vistas"
    }
  };

  // Test properties that SHOULD share cache
  const specificStreetProperty1 = {
    reference: "TEST3",
    address: "Calle Los Naranjos 15, Nueva Andalucía",
    suburb: "Nueva Andalucía",
    urbanization: null,
    descriptions: {
      en: "Villa on Los Naranjos street with pool",
      es: "Villa en calle Los Naranjos con piscina"
    }
  };

  const specificStreetProperty2 = {
    reference: "TEST4",
    address: "Calle Los Naranjos 22, Nueva Andalucía", 
    suburb: "Nueva Andalucía",
    urbanization: null,
    descriptions: {
      en: "Townhouse on Los Naranjos street",
      es: "Casa adosada en calle Los Naranjos"
    }
  };

  console.log('🔍 Test 1: Golden Mile properties (should NOT share cache)');
  console.log('=========================================================');
  
  // Clear caches first
  locationService.clearCaches();
  
  console.log('\nProperty 1 (Golden Mile):');
  const result1 = await locationService.analyzePropertyLocation(goldenMileProperty1);
  
  console.log('\nProperty 2 (Golden Mile):');
  const result2 = await locationService.analyzePropertyLocation(goldenMileProperty2);
  
  console.log('\n🔍 Test 2: Specific street properties (SHOULD share cache)');
  console.log('==========================================================');
  
  // Clear caches again
  locationService.clearCaches();
  
  console.log('\nProperty 3 (Calle Los Naranjos):');
  const result3 = await locationService.analyzePropertyLocation(specificStreetProperty1);
  
  console.log('\nProperty 4 (Calle Los Naranjos):');
  const result4 = await locationService.analyzePropertyLocation(specificStreetProperty2);
  
  // Analyze results
  console.log('\n📊 ANALYSIS RESULTS');
  console.log('===================');
  
  const goldenMileUsedCache = result2.cacheType === 'precise_location';
  const specificStreetUsedCache = result4.cacheType === 'precise_location';
  
  console.log(`Golden Mile shared cache: ${goldenMileUsedCache ? '❌ FAILED' : '✅ PASSED'}`);
  console.log(`Specific street shared cache: ${specificStreetUsedCache ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (!goldenMileUsedCache && specificStreetUsedCache) {
    console.log('\n🎉 SUCCESS: Fix working correctly!');
    console.log('   ✅ Broad areas (Golden Mile) are NOT cached together');
    console.log('   ✅ Specific streets ARE cached together');
  } else {
    console.log('\n❌ ISSUE: Fix needs adjustment');
    if (goldenMileUsedCache) {
      console.log('   ❌ Golden Mile properties still sharing cache');
    }
    if (!specificStreetUsedCache) {
      console.log('   ❌ Specific street properties not sharing cache');
    }
  }
  
  const metrics = locationService.getMetrics();
  console.log(`\n📈 Cache efficiency: ${metrics.cacheHitRate}`);
  console.log(`   Description cache hits: ${metrics.descriptionCacheHits}`);
  console.log(`   Precise location cache hits: ${metrics.preciseLocationCacheHits}`);
}

testPreciseCacheFix(); 