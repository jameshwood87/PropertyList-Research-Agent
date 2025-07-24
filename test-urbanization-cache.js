require('dotenv').config({ path: '.env.local' });
const OptimizedLocationService = require('./server/services/optimizedLocationService');

async function testUrbanizationCache() {
  console.log('🧪 TESTING URBANIZATION + SUBURB CACHING');
  console.log('========================================');
  console.log('Testing that caching only works for exact urbanization + suburb matches\n');

  const locationService = new OptimizedLocationService();

  // Test 1: Properties with SAME urbanization + suburb (SHOULD share cache)
  const sameUrbanizationProperty1 = {
    reference: "TEST1",
    urbanization: "Los Pinos de Aloha",
    suburb: "Nueva Andalucía",
    city: "Marbella",
    descriptions: {
      en: "Beautiful villa with mountain views and pool",
      es: "Villa hermosa con vistas a la montaña y piscina"
    }
  };

  const sameUrbanizationProperty2 = {
    reference: "TEST2", 
    urbanization: "Los Pinos de Aloha",
    suburb: "Nueva Andalucía", 
    city: "Marbella",
    descriptions: {
      en: "Modern townhouse with garden and terrace",
      es: "Casa adosada moderna con jardín y terraza"
    }
  };

  // Test 2: Properties with DIFFERENT urbanizations (should NOT share cache)
  const differentUrbanizationProperty1 = {
    reference: "TEST3",
    urbanization: "Jardines de Aloha",
    suburb: "Nueva Andalucía",
    city: "Marbella", 
    descriptions: {
      en: "Luxury apartment with sea views",
      es: "Apartamento de lujo con vistas al mar"
    }
  };

  const differentUrbanizationProperty2 = {
    reference: "TEST4",
    urbanization: "Aloha Gardens", 
    suburb: "Nueva Andalucía",
    city: "Marbella",
    descriptions: {
      en: "Penthouse with panoramic views",
      es: "Ático con vistas panorámicas"
    }
  };

  // Test 3: Properties with no urbanization (should NOT share cache)
  const noUrbanizationProperty1 = {
    reference: "TEST5",
    urbanization: null,
    suburb: "Marbella Golden Mile",
    city: "Marbella",
    descriptions: {
      en: "Villa in Golden Mile near beach",
      es: "Villa en Milla de Oro cerca de la playa"
    }
  };

  const noUrbanizationProperty2 = {
    reference: "TEST6",
    urbanization: null,
    suburb: "Marbella Golden Mile", 
    city: "Marbella",
    descriptions: {
      en: "Apartment in Golden Mile with pool",
      es: "Apartamento en Milla de Oro con piscina"
    }
  };

  console.log('🔍 Test 1: Same urbanization + suburb (SHOULD share cache)');
  console.log('==========================================================');
  
  locationService.clearCaches();
  
  console.log('\nProperty 1 (Los Pinos de Aloha):');
  const result1 = await locationService.analyzePropertyLocation(sameUrbanizationProperty1);
  
  console.log('\nProperty 2 (Los Pinos de Aloha):');
  const result2 = await locationService.analyzePropertyLocation(sameUrbanizationProperty2);
  
  console.log('\n🔍 Test 2: Different urbanizations (should NOT share cache)');
  console.log('============================================================');
  
  locationService.clearCaches();
  
  console.log('\nProperty 3 (Jardines de Aloha):');
  const result3 = await locationService.analyzePropertyLocation(differentUrbanizationProperty1);
  
  console.log('\nProperty 4 (Aloha Gardens):');
  const result4 = await locationService.analyzePropertyLocation(differentUrbanizationProperty2);
  
  console.log('\n🔍 Test 3: No urbanization (should NOT share cache)');
  console.log('===================================================');
  
  locationService.clearCaches();
  
  console.log('\nProperty 5 (No urbanization):');
  const result5 = await locationService.analyzePropertyLocation(noUrbanizationProperty1);
  
  console.log('\nProperty 6 (No urbanization):');
  const result6 = await locationService.analyzePropertyLocation(noUrbanizationProperty2);
  
  // Analyze results
  console.log('\n📊 ANALYSIS RESULTS');
  console.log('===================');
  
  const sameUrbUsedCache = result2.cacheType === 'precise_location';
  const differentUrbUsedCache = result4.cacheType === 'precise_location';
  const noUrbUsedCache = result6.cacheType === 'precise_location';
  
  console.log(`Same urbanization shared cache: ${sameUrbUsedCache ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Different urbanization shared cache: ${differentUrbUsedCache ? '❌ FAILED' : '✅ PASSED'}`);
  console.log(`No urbanization shared cache: ${noUrbUsedCache ? '❌ FAILED' : '✅ PASSED'}`);
  
  if (sameUrbUsedCache && !differentUrbUsedCache && !noUrbUsedCache) {
    console.log('\n🎉 SUCCESS: Urbanization + suburb caching working perfectly!');
    console.log('   ✅ Same urbanization + suburb properties DO share cache');
    console.log('   ✅ Different urbanizations do NOT share cache');
    console.log('   ✅ Properties without urbanization do NOT share cache');
  } else {
    console.log('\n❌ ISSUE: Caching logic needs adjustment');
    if (!sameUrbUsedCache) {
      console.log('   ❌ Same urbanization properties not sharing cache');
    }
    if (differentUrbUsedCache) {
      console.log('   ❌ Different urbanizations incorrectly sharing cache');
    }
    if (noUrbUsedCache) {
      console.log('   ❌ No urbanization properties incorrectly sharing cache');
    }
  }
  
  const metrics = locationService.getMetrics();
  console.log(`\n📈 Cache efficiency: ${metrics.cacheHitRate}`);
  console.log(`   Description cache hits: ${metrics.descriptionCacheHits}`);
  console.log(`   Precise location cache hits: ${metrics.preciseLocationCacheHits}`);
}

testUrbanizationCache(); 