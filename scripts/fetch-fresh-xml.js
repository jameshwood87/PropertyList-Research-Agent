// Fetch Fresh XML Feed
// Simple script to fetch the latest XML feed from the S3 URL

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// XML feed URL from feed config
const XML_FEED_URL = 'http://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/47/export/189963705804aee9/admin.xml';

async function fetchXMLFeed() {
  console.log('📥 Fetching fresh XML feed...');
  console.log(`🔗 URL: ${XML_FEED_URL}`);
  
  return new Promise((resolve, reject) => {
    const url = new URL(XML_FEED_URL);
    const client = url.protocol === 'https:' ? https : http;
    
    const request = client.get(url, (response) => {
      console.log(`📡 Response: ${response.statusCode} ${response.statusMessage}`);
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        console.log(`📊 Received ${data.length} bytes`);
        resolve(data);
      });
    });
    
    request.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });
    
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function saveXMLFeed(xmlData) {
  const cachePath = path.join(process.cwd(), 'data', 'feed-cache.xml');
  const backupPath = path.join(process.cwd(), 'data', `feed-cache-backup-${Date.now()}.xml`);
  
  console.log('💾 Saving fresh XML feed...');
  
  // Create backup of existing cache
  if (fs.existsSync(cachePath)) {
    console.log('📋 Creating backup of existing cache...');
    fs.copyFileSync(cachePath, backupPath);
    console.log(`✅ Backup created: ${backupPath}`);
  }
  
  // Save fresh XML data
  fs.writeFileSync(cachePath, xmlData, 'utf8');
  console.log(`✅ Fresh XML feed saved: ${cachePath}`);
  
  return cachePath;
}

async function main() {
  try {
    console.log('🚀 Starting fresh XML feed fetch...');
    console.log('');
    
    // Fetch fresh XML feed
    const xmlData = await fetchXMLFeed();
    
    // Save to cache
    const cachePath = await saveXMLFeed(xmlData);
    
    console.log('');
    console.log('✅ Fresh XML feed successfully fetched and saved!');
    console.log(`📁 Cache location: ${cachePath}`);
    console.log('');
    console.log('🎯 Next steps:');
    console.log('   1. Run image fix: node scripts/fix-existing-images.js');
    console.log('   2. Test images: node scripts/debug-comparable-images.js');
    
  } catch (error) {
    console.error('❌ Failed to fetch fresh XML feed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fetchXMLFeed, saveXMLFeed }; 