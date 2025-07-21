// Daily XML Processor Startup Script
// Run this as a separate service to handle daily XML processing

const { dailyProcessor } = require('./daily-xml-processor');

console.log('🚀 Starting Daily XML Processor Service...');
console.log('📅 This service will:');
console.log('   - Download XML feed at 2:30 AM daily');
console.log('   - Process and analyze properties at 3:30 AM daily');
console.log('   - Maintain fresh database for fast comparable searches');
console.log('   - Generate market insights');
console.log('');

// Start scheduled processing
dailyProcessor.startScheduledProcessing();

// Run initial processing if requested
if (process.argv.includes('--process-now')) {
  console.log('🔄 Running initial XML processing...');
  dailyProcessor.processDailyXML()
    .then(() => {
      console.log('✅ Initial processing completed');
    })
    .catch(error => {
      console.error('❌ Initial processing failed:', error.message);
    });
}

// Keep the process running
console.log('⏰ Daily processor service is running...');
console.log('💡 Press Ctrl+C to stop');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down daily processor service...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🔄 Shutting down daily processor service...');
  process.exit(0);
}); 