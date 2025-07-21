const fs = require('fs');
const path = require('path');

// Import the URL refresh utilities
const { batchRefreshUrls, isSignedUrlExpired } = require('../src/lib/url-refresh.ts');

async function scheduledUrlRefresh() {
  try {
    console.log('🕐 Starting scheduled URL refresh (runs at 4:30 AM after XML feed import)...');
    console.log(`📅 ${new Date().toISOString()}`);
    
    // Load the properties database
    const propertiesPath = path.join(__dirname, '../data/properties.json');
    const properties = JSON.parse(fs.readFileSync(propertiesPath, 'utf8'));
    
    console.log(`📊 Loaded ${properties.length} properties from database`);
    
    // Check how many properties have expired URLs
    let expiredCount = 0;
    let totalExpiredUrls = 0;
    
    properties.forEach(property => {
      if (property.images && Array.isArray(property.images)) {
        let propertyHasExpired = false;
        property.images.forEach(url => {
          if (isSignedUrlExpired(url)) {
            propertyHasExpired = true;
            totalExpiredUrls++;
          }
        });
        if (propertyHasExpired) {
          expiredCount++;
        }
      }
    });
    
    console.log(`🔍 Found ${expiredCount} properties with expired URLs`);
    console.log(`🔍 Total expired URLs: ${totalExpiredUrls}`);
    
    if (expiredCount === 0) {
      console.log('✅ No expired URLs found. Skipping refresh.');
      return;
    }
    
    // Process in batches to avoid memory issues
    const batchSize = 50; // Smaller batches for scheduled runs
    const totalProperties = properties.length;
    const batches = Math.ceil(totalProperties / batchSize);
    let totalRefreshed = 0;
    
    console.log(`🔄 Processing ${totalProperties} properties in ${batches} batches`);
    
    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, totalProperties);
      const batch = properties.slice(start, end);
      
      console.log(`🔄 Processing batch ${i + 1}/${batches} (properties ${start + 1}-${end})`);
      
      const refreshedBatch = await batchRefreshUrls(batch);
      
      // Update the batch in the main array
      for (let j = 0; j < refreshedBatch.length; j++) {
        properties[start + j] = refreshedBatch[j];
      }
      
      // Count refreshed URLs in this batch
      const batchRefreshed = refreshedBatch.reduce((count, property, index) => {
        const originalImages = batch[index].images || [];
        const refreshedImages = property.images || [];
        return count + refreshedImages.filter((url, idx) => 
          originalImages[idx] !== url
        ).length;
      }, 0);
      
      totalRefreshed += batchRefreshed;
      
      // Save progress after each batch
      fs.writeFileSync(propertiesPath, JSON.stringify(properties, null, 2));
      
      console.log(`✅ Batch ${i + 1} complete: ${batchRefreshed} URLs refreshed`);
      
      // Add a small delay between batches to be gentle on the server
      if (i < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Scheduled URL refresh complete!`);
    console.log(`📊 Total URLs refreshed: ${totalRefreshed}`);
    console.log(`📊 Properties processed: ${totalProperties}`);
    
    // Create a log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      totalProperties,
      expiredProperties: expiredCount,
      totalExpiredUrls,
      totalRefreshed,
      batches,
      status: 'success'
    };
    
    // Save to log file
    const logPath = path.join(__dirname, '../data/url-refresh-logs.json');
    let logs = [];
    
    if (fs.existsSync(logPath)) {
      logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }
    
    logs.push(logEntry);
    
    // Keep only last 30 days of logs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    logs = logs.filter(log => new Date(log.timestamp) > thirtyDaysAgo);
    
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    
  } catch (error) {
    console.error('❌ Error in scheduled URL refresh:', error);
    
    // Log the error
    const logEntry = {
      timestamp: new Date().toISOString(),
      error: error.message,
      status: 'error'
    };
    
    const logPath = path.join(__dirname, '../data/url-refresh-logs.json');
    let logs = [];
    
    if (fs.existsSync(logPath)) {
      logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }
    
    logs.push(logEntry);
    
    // Keep only last 30 days of logs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    logs = logs.filter(log => new Date(log.timestamp) > thirtyDaysAgo);
    
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    
    process.exit(1);
  }
}

// Run the scheduled refresh
scheduledUrlRefresh(); 