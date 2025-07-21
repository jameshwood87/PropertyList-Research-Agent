// Background Database Optimizer Startup Script
// Runs the background optimizer as a separate service

const { BackgroundDatabaseOptimizer } = require('./background-database-optimizer.js');

console.log('🚀 Starting Background Database Optimizer Service...');
console.log('📅', new Date().toISOString());

// Create and start the optimizer
const optimizer = new BackgroundDatabaseOptimizer();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  optimizer.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  optimizer.stop();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  optimizer.stop();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  optimizer.stop();
  process.exit(1);
});

// Start the optimizer
try {
  optimizer.start();
  console.log('✅ Background Database Optimizer Service started successfully');
  console.log('⏰ Will run optimization analysis every 6 hours');
  console.log('📊 Monitoring database for optimization opportunities...');
} catch (error) {
  console.error('❌ Failed to start Background Database Optimizer:', error);
  process.exit(1);
} 