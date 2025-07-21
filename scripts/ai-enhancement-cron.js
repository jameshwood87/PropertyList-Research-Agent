// AI Enhancement Cron Job
// Runs the AI enhancement scheduler at scheduled intervals

const cron = require('node-cron');
const { AIEnhancementScheduler } = require('./ai-enhancement-scheduler');

class AIEnhancementCron {
  constructor() {
    this.scheduler = new AIEnhancementScheduler();
    this.isRunning = false;
    this.jobs = [];
  }

  // Start the cron jobs
  start() {
    console.log('🚀 Starting AI Enhancement Cron Jobs...');

    // Job 1: Run every 2 hours during business hours (8 AM - 8 PM)
    const businessHoursJob = cron.schedule('0 */2 8-20 * * *', async () => {
      await this.runEnhancement();
    }, {
      scheduled: false,
      timezone: 'Europe/Madrid'
    });

    // Job 2: Run once at 2 AM for overnight processing
    const overnightJob = cron.schedule('0 0 2 * * *', async () => {
      await this.runEnhancement();
    }, {
      scheduled: false,
      timezone: 'Europe/Madrid'
    });

    // Job 3: Run once at 10 AM for morning processing
    const morningJob = cron.schedule('0 0 10 * * *', async () => {
      await this.runEnhancement();
    }, {
      scheduled: false,
      timezone: 'Europe/Madrid'
    });

    // Start all jobs
    businessHoursJob.start();
    overnightJob.start();
    morningJob.start();

    this.jobs = [businessHoursJob, overnightJob, morningJob];
    this.isRunning = true;

    console.log('✅ AI Enhancement Cron Jobs started:');
    console.log('   - Every 2 hours during business hours (8 AM - 8 PM)');
    console.log('   - Once at 2 AM (overnight processing)');
    console.log('   - Once at 10 AM (morning processing)');
    console.log('   - Timezone: Europe/Madrid');

    // Run initial processing
    this.runEnhancement();
  }

  // Stop the cron jobs
  stop() {
    console.log('🛑 Stopping AI Enhancement Cron Jobs...');
    
    this.jobs.forEach(job => {
      job.stop();
    });
    
    this.isRunning = false;
    console.log('✅ AI Enhancement Cron Jobs stopped');
  }

  // Run enhancement processing
  async runEnhancement() {
    if (this.isRunning) {
      console.log('⏸️ Enhancement already running, skipping...');
      return;
    }

    try {
      console.log('🔄 Running AI Enhancement...');
      await this.scheduler.processProperties();
    } catch (error) {
      console.error('❌ Error running AI enhancement:', error);
    }
  }

  // Get status
  getStatus() {
    const schedulerStatus = this.scheduler.getStatus();
    
    return {
      cronRunning: this.isRunning,
      jobsCount: this.jobs.length,
      scheduler: schedulerStatus
    };
  }
}

// Export for use in other scripts
module.exports = { AIEnhancementCron };

// Run if called directly
if (require.main === module) {
  const cron = new AIEnhancementCron();
  
  // Check command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--status')) {
    const status = cron.getStatus();
    console.log('📊 AI Enhancement Cron Status:');
    console.log(JSON.stringify(status, null, 2));
  } else if (args.includes('--stop')) {
    cron.stop();
  } else {
    cron.start();
    
    // Keep the process running
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, stopping cron jobs...');
      cron.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, stopping cron jobs...');
      cron.stop();
      process.exit(0);
    });
  }
} 