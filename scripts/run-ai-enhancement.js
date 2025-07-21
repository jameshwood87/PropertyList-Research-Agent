// Manual AI Enhancement Runner
// Run this script to start processing the initial 1000 properties

const { AIEnhancementScheduler } = require('./ai-enhancement-scheduler');

async function runInitialEnhancement() {
  console.log('🚀 Starting Initial AI Enhancement (1000 properties in 24h)...');
  console.log('📅 Schedule: 1000 properties in first 24 hours, then 500/day');
  console.log('⏱️ Processing: 10 properties per batch, 2 second delays');
  console.log('');

  const scheduler = new AIEnhancementScheduler();
  
  // Get initial status
  const status = scheduler.getStatus();
  console.log('📊 Initial Status:');
  console.log(`   - Total properties: ${status.totalProperties}`);
  console.log(`   - Properties needing enhancement: ${status.propertiesNeedingEnhancement}`);
  console.log(`   - Already processed: ${status.totalProcessed}`);
  console.log(`   - Current phase: ${status.currentPhase}`);
  console.log('');

  if (status.propertiesNeedingEnhancement === 0) {
    console.log('✅ No properties need AI enhancement');
    return;
  }

  // Calculate processing time
  const batchesPerDay = Math.ceil(1000 / 10); // 1000 properties ÷ 10 per batch
  const timePerBatch = 2; // 2 seconds
  const totalTimePerDay = batchesPerDay * timePerBatch; // seconds
  const hoursPerDay = totalTimePerDay / 3600;

  console.log('⏱️ Processing Time Estimates:');
  console.log(`   - Batches per day: ${batchesPerDay}`);
  console.log(`   - Time per batch: ${timePerBatch} seconds`);
  console.log(`   - Total time per day: ${hoursPerDay.toFixed(1)} hours`);
  console.log('');

  // Start processing
  try {
    await scheduler.processProperties();
    
    // Get final status
    const finalStatus = scheduler.getStatus();
    console.log('');
    console.log('✅ Processing Complete!');
    console.log('📊 Final Status:');
    console.log(`   - Total processed: ${finalStatus.totalProcessed}`);
    console.log(`   - Remaining in queue: ${finalStatus.remainingInQueue}`);
    console.log(`   - Daily processed: ${finalStatus.dailyProcessed}`);
    console.log(`   - Current phase: ${finalStatus.currentPhase}`);
    
  } catch (error) {
    console.error('❌ Error during processing:', error);
  }
}

// Run if called directly
if (require.main === module) {
  runInitialEnhancement().catch(console.error);
}

module.exports = { runInitialEnhancement }; 