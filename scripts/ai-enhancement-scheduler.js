// AI Property Enhancement Scheduler
// Processes properties in controlled batches to manage costs and API limits

const fs = require('fs');
const path = require('path');

class AIEnhancementScheduler {
  constructor() {
    this.propertiesFile = path.join(__dirname, '..', 'data', 'properties.json');
    this.scheduleFile = path.join(__dirname, '..', 'data', 'ai-enhancement-schedule.json');
    this.batchSize = 8; // Reduced for GPT-4 Turbo rate limits
    this.delayBetweenBatches = 3000; // 3 seconds between batches for GPT-4 Turbo
    this.maxPropertiesPerDay = 400; // Reduced for GPT-4 Turbo (more expensive)
    this.initialTarget = 800; // Reduced initial target for GPT-4 Turbo
  }

  // Load properties from database
  loadProperties() {
    try {
      const data = fs.readFileSync(this.propertiesFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading properties:', error);
      return [];
    }
  }

  // Load or create schedule
  loadSchedule() {
    try {
      if (fs.existsSync(this.scheduleFile)) {
        const data = fs.readFileSync(this.scheduleFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
    }

    // Create new schedule
    const schedule = {
      startDate: new Date().toISOString(),
      lastProcessedDate: null,
      totalProcessed: 0,
      dailyProcessed: 0,
      currentDay: 1,
      isInitialPhase: true,
      propertiesToProcess: [],
      processedProperties: [],
      status: 'ready'
    };

    this.saveSchedule(schedule);
    return schedule;
  }

  // Save schedule
  saveSchedule(schedule) {
    try {
      fs.writeFileSync(this.scheduleFile, JSON.stringify(schedule, null, 2));
    } catch (error) {
      console.error('Error saving schedule:', error);
    }
  }

  // Get properties that need AI enhancement
  getPropertiesNeedingEnhancement(properties) {
    return properties.filter(property => {
      // Check if property has description
      const hasDescription = property.description && property.description.trim().length > 10;
      
      // Check if property is already enhanced
      const isAlreadyEnhanced = property.aiAnalysisDate && property.aiConfidence;
      
      return hasDescription && !isAlreadyEnhanced;
    });
  }

  // Calculate daily limit based on phase
  getDailyLimit(schedule) {
    if (schedule.isInitialPhase && schedule.currentDay === 1) {
      return this.initialTarget;
    } else if (schedule.isInitialPhase && schedule.currentDay === 2) {
      return this.initialTarget - schedule.totalProcessed;
    } else {
      return this.maxPropertiesPerDay;
    }
  }

  // Process a batch of properties
  async processBatch(properties, batch) {
    console.log(`📦 Processing batch ${batch.length} properties...`);
    
    const enhancedProperties = [];
    
    for (const property of batch) {
      try {
        // Simulate AI enhancement (replace with actual AI call)
        const enhanced = await this.enhanceProperty(property);
        enhancedProperties.push(enhanced);
        
        // Add delay between individual properties
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`❌ Failed to enhance property ${property.id}:`, error);
        enhancedProperties.push(property); // Keep original if enhancement fails
      }
    }
    
    return enhancedProperties;
  }

  // Simulate AI enhancement (replace with actual AI call)
  async enhanceProperty(property) {
    // This is a placeholder - replace with actual AI enhancement call
    console.log(`🤖 AI enhancing property: ${property.id || property.ref_number}`);
    
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Add AI enhancement metadata
    return {
      ...property,
      aiAnalysisDate: new Date().toISOString(),
      aiConfidence: Math.floor(Math.random() * 30) + 70, // 70-100% confidence
      urbanization: this.extractUrbanization(property.description),
      condition: this.extractCondition(property.description),
      architecturalStyle: this.extractStyle(property.description)
    };
  }

  // Simple extraction functions (replace with actual AI analysis)
  extractUrbanization(description) {
    if (!description) return null;
    const urbanizationMatch = description.match(/Urbanización\s+([^,\s]+)/i);
    return urbanizationMatch ? urbanizationMatch[1] : null;
  }

  extractCondition(description) {
    if (!description) return null;
    const conditions = ['excellent', 'good', 'fair', 'needs work', 'renovation'];
    for (const condition of conditions) {
      if (description.toLowerCase().includes(condition)) {
        return condition;
      }
    }
    return null;
  }

  extractStyle(description) {
    if (!description) return null;
    const styles = ['modern', 'traditional', 'andalusian', 'contemporary', 'rustic'];
    for (const style of styles) {
      if (description.toLowerCase().includes(style)) {
        return style;
      }
    }
    return null;
  }

  // Main processing function
  async processProperties() {
    console.log('🚀 Starting AI Enhancement Scheduler...');
    
    // Load properties and schedule
    const properties = this.loadProperties();
    const schedule = this.loadSchedule();
    
    console.log(`📊 Total properties in database: ${properties.length}`);
    
    // Get properties needing enhancement
    const propertiesNeedingEnhancement = this.getPropertiesNeedingEnhancement(properties);
    console.log(`🔍 Properties needing AI enhancement: ${propertiesNeedingEnhancement.length}`);
    
    if (propertiesNeedingEnhancement.length === 0) {
      console.log('✅ No properties need AI enhancement');
      return;
    }
    
    // Update schedule with properties to process
    if (schedule.propertiesToProcess.length === 0) {
      schedule.propertiesToProcess = propertiesNeedingEnhancement.map(p => p.id || p.ref_number);
    }
    
    // Calculate daily limit
    const dailyLimit = this.getDailyLimit(schedule);
    console.log(`📅 Daily processing limit: ${dailyLimit} properties`);
    
    // Determine how many to process today
    const remainingToday = dailyLimit - schedule.dailyProcessed;
    const toProcessToday = Math.min(remainingToday, schedule.propertiesToProcess.length);
    
    if (toProcessToday <= 0) {
      console.log('⏸️ Daily limit reached, waiting for next day');
      return;
    }
    
    console.log(`🎯 Processing ${toProcessToday} properties today`);
    
    // Get properties to process
    const propertiesToProcess = propertiesNeedingEnhancement
      .filter(p => schedule.propertiesToProcess.includes(p.id || p.ref_number))
      .slice(0, toProcessToday);
    
    // Process in batches
    let processedCount = 0;
    const enhancedProperties = [];
    
    for (let i = 0; i < propertiesToProcess.length; i += this.batchSize) {
      const batch = propertiesToProcess.slice(i, i + this.batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(propertiesToProcess.length / this.batchSize)}`);
      
      const enhancedBatch = await this.processBatch(properties, batch);
      enhancedProperties.push(...enhancedBatch);
      processedCount += batch.length;
      
      // Update schedule
      schedule.totalProcessed += batch.length;
      schedule.dailyProcessed += batch.length;
      schedule.lastProcessedDate = new Date().toISOString();
      
      // Remove processed properties from queue
      batch.forEach(property => {
        const index = schedule.propertiesToProcess.indexOf(property.id || property.ref_number);
        if (index > -1) {
          schedule.propertiesToProcess.splice(index, 1);
        }
      });
      
      // Add delay between batches
      if (i + this.batchSize < propertiesToProcess.length) {
        console.log(`⏱️ Waiting ${this.delayBetweenBatches}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
      }
    }
    
    // Update database with enhanced properties
    this.updateDatabase(enhancedProperties);
    
    // Check if we should transition to daily mode
    if (schedule.isInitialPhase && schedule.totalProcessed >= this.initialTarget) {
      schedule.isInitialPhase = false;
      schedule.dailyProcessed = 0;
      console.log('🔄 Transitioning to daily processing mode (500 properties/day)');
    }
    
    // Reset daily counter if it's a new day
    const today = new Date().toDateString();
    const lastProcessedDay = schedule.lastProcessedDate ? new Date(schedule.lastProcessedDate).toDateString() : null;
    
    if (lastProcessedDay && today !== lastProcessedDay) {
      schedule.dailyProcessed = 0;
      schedule.currentDay++;
      console.log(`📅 New day: ${today}, resetting daily counter`);
    }
    
    // Save updated schedule
    this.saveSchedule(schedule);
    
    // Print summary
    console.log(`✅ Processing complete for today:`);
    console.log(`   - Properties processed: ${processedCount}`);
    console.log(`   - Total processed: ${schedule.totalProcessed}`);
    console.log(`   - Remaining in queue: ${schedule.propertiesToProcess.length}`);
    console.log(`   - Daily processed: ${schedule.dailyProcessed}/${dailyLimit}`);
    console.log(`   - Phase: ${schedule.isInitialPhase ? 'Initial (1000/day)' : 'Daily (500/day)'}`);
  }

  // Update database with enhanced properties
  updateDatabase(enhancedProperties) {
    try {
      const properties = this.loadProperties();
      
      // Create a map for quick lookup
      const propertyMap = new Map();
      properties.forEach(p => propertyMap.set(p.id || p.ref_number, p));
      
      // Update properties with enhanced data
      enhancedProperties.forEach(enhanced => {
        const key = enhanced.id || enhanced.ref_number;
        if (propertyMap.has(key)) {
          const original = propertyMap.get(key);
          propertyMap.set(key, { ...original, ...enhanced });
        }
      });
      
      // Convert back to array
      const updatedProperties = Array.from(propertyMap.values());
      
      // Save updated database
      fs.writeFileSync(this.propertiesFile, JSON.stringify(updatedProperties, null, 2));
      
      console.log(`💾 Database updated with ${enhancedProperties.length} enhanced properties`);
      
    } catch (error) {
      console.error('Error updating database:', error);
    }
  }

  // Get schedule status
  getStatus() {
    const schedule = this.loadSchedule();
    const properties = this.loadProperties();
    const propertiesNeedingEnhancement = this.getPropertiesNeedingEnhancement(properties);
    
    return {
      totalProperties: properties.length,
      propertiesNeedingEnhancement: propertiesNeedingEnhancement.length,
      totalProcessed: schedule.totalProcessed,
      dailyProcessed: schedule.dailyProcessed,
      remainingInQueue: schedule.propertiesToProcess.length,
      currentPhase: schedule.isInitialPhase ? 'Initial (1000/day)' : 'Daily (500/day)',
      lastProcessed: schedule.lastProcessedDate,
      status: schedule.status
    };
  }
}

// Export for use in other scripts
module.exports = { AIEnhancementScheduler };

// Run if called directly
if (require.main === module) {
  const scheduler = new AIEnhancementScheduler();
  
  // Check command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--status')) {
    const status = scheduler.getStatus();
    console.log('📊 AI Enhancement Status:');
    console.log(JSON.stringify(status, null, 2));
  } else {
    scheduler.processProperties().catch(console.error);
  }
} 