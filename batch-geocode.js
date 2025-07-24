require('dotenv').config({ path: '.env.local' });
const PostgresDatabase = require('./server/database/postgresDatabase');
const BatchGeocodingService = require('./server/services/batchGeocodingService');

async function runBatchGeocoding() {
  console.log('🌍 AI PROPERTY BATCH GEOCODING');
  console.log('==============================');
  
  const pgDb = new PostgresDatabase();
  await pgDb.init();
  
  const batchService = new BatchGeocodingService(pgDb);
  
  try {
    // First, check current status
    console.log('\n📊 Checking current geocoding status...');
    await batchService.checkGeocodingStatus();
    
    // Ask user what they want to do
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (command === 'status') {
      console.log('\n✅ Status check complete.');
      
    } else if (command === 'dry-run') {
      console.log('\n🧪 Running smart geocoding dry-run (no database updates)...');
      const maxGroups = parseInt(args[1]) || 10;
      await batchService.geocodeAllProperties({ 
        maxGroups, 
        dryRun: true,
        batchSize: 5,
        delayMs: 500,
        useSmartGrouping: true
      });
      
    } else if (command === 'run') {
      console.log('\n🚀 Running FULL smart batch geocoding...');
      const maxGroups = parseInt(args[1]) || null;
      await batchService.geocodeAllProperties({ 
        maxGroups,
        batchSize: 10,
        delayMs: 1000,
        useSmartGrouping: true
      });
      
    } else if (command === 'individual') {
      console.log('\n📍 Running individual property geocoding (legacy mode)...');
      const maxProperties = parseInt(args[1]) || null;
      await batchService.geocodeAllProperties({ 
        maxProperties,
        batchSize: 20,
        delayMs: 1000,
        useSmartGrouping: false
      });
      
    } else {
      console.log('\n📋 SMART GEOCODING USAGE:');
      console.log('  node batch-geocode.js status                    - Check geocoding status');
      console.log('  node batch-geocode.js dry-run [max]             - Test smart grouping (no updates)');
      console.log('  node batch-geocode.js run [max]                 - Run smart batch geocoding');
      console.log('  node batch-geocode.js individual [max]          - Legacy individual geocoding');
      console.log('');
      console.log('Examples:');
      console.log('  node batch-geocode.js dry-run 5                 - Test with 5 location groups');
      console.log('  node batch-geocode.js run 50                    - Process first 50 groups');
      console.log('  node batch-geocode.js run                       - Process ALL groups (~$2.21)');
      console.log('  node batch-geocode.js individual 100            - Legacy: geocode 100 properties');
      console.log('');
      console.log('💡 Smart grouping reduces costs by 90%+ compared to individual geocoding!');
    }
    
  } catch (error) {
    console.error('❌ Batch geocoding error:', error);
  } finally {
    await pgDb.close();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️ Geocoding interrupted by user');
  process.exit(0);
});

runBatchGeocoding().catch(console.error); 