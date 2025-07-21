// Daily Feed Refresh Script
// Automatically fetches fresh XML feeds and updates properties database with new image URLs

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const XML_FEED_URL = 'https://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/47/export/189963705804aee9/admin.xml';
const FEED_CACHE_PATH = path.join(__dirname, '../data/feed-cache.xml');
const PROPERTIES_PATH = path.join(__dirname, '../data/properties.json');
const BACKUP_DIR = path.join(__dirname, '../data/backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Fetch fresh XML feed
async function fetchFreshXMLFeed() {
  console.log('🔄 Fetching fresh XML feed...');
  
  return new Promise((resolve, reject) => {
    const request = https.get(XML_FEED_URL, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch XML feed: ${response.statusCode}`));
        return;
      }

      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        console.log(`✅ Successfully fetched XML feed (${(data.length / 1024 / 1024).toFixed(2)} MB)`);
        resolve(data);
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Extract property reference and images from XML
function extractPropertyImagesFromXML(xmlString) {
  const propertyImages = new Map();
  
  // Find all property blocks
  const propertyRegex = /<property[^>]*>([\s\S]*?)<\/property>/g;
  let propertyMatch;
  
  while ((propertyMatch = propertyRegex.exec(xmlString)) !== null) {
    const propertyBlock = propertyMatch[1];
    
    // Extract property reference (using <reference> tag)
    const refMatch = propertyBlock.match(/<reference>([^<]+)<\/reference>/);
    if (!refMatch) continue;
    
    const propertyRef = refMatch[1].trim();
    
    // Extract all photos for this property
    const photos = [];
    const photoRegex = /<photo><!\[CDATA\[([^\]]+)\]\]><\/photo>/g;
    let photoMatch;
    
    while ((photoMatch = photoRegex.exec(propertyBlock)) !== null) {
      const imageUrl = photoMatch[1].trim();
      if (imageUrl && imageUrl.length > 0) {
        photos.push(imageUrl);
      }
    }
    
    if (photos.length > 0) {
      propertyImages.set(propertyRef, photos);
    }
  }
  
  return propertyImages;
}

// Update properties database with fresh image URLs
function updatePropertiesWithFreshImages(freshImageUrls) {
  console.log('🔄 Updating properties database with fresh image URLs...');
  
  if (!fs.existsSync(PROPERTIES_PATH)) {
    console.error('❌ Properties database not found');
    return { updated: 0, total: 0 };
  }
  
  // Load current properties
  const propertiesData = JSON.parse(fs.readFileSync(PROPERTIES_PATH, 'utf8'));
  const properties = Array.isArray(propertiesData) ? propertiesData : (propertiesData.properties || []);
  
  let updatedCount = 0;
  let totalCount = properties.length;
  
  // Update each property with fresh images
  properties.forEach(property => {
    if (property.ref_number && freshImageUrls.has(property.ref_number)) {
      const freshImages = freshImageUrls.get(property.ref_number);
      
      // Check if images have changed
      const currentImages = property.images || [];
      const imagesChanged = JSON.stringify(currentImages) !== JSON.stringify(freshImages);
      
      if (imagesChanged) {
        property.images = freshImages;
        updatedCount++;
        console.log(`✅ Updated images for property ${property.ref_number}: ${freshImages.length} images`);
      }
    }
  });
  
  // Save updated properties
  fs.writeFileSync(PROPERTIES_PATH, JSON.stringify(propertiesData, null, 2));
  
  return { updated: updatedCount, total: totalCount };
}

// Create backup of current data
function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Backup XML feed
  if (fs.existsSync(FEED_CACHE_PATH)) {
    const xmlBackupPath = path.join(BACKUP_DIR, `feed-cache-${timestamp}.xml`);
    fs.copyFileSync(FEED_CACHE_PATH, xmlBackupPath);
    console.log(`📦 Backed up XML feed to: ${xmlBackupPath}`);
  }
  
  // Backup properties database
  if (fs.existsSync(PROPERTIES_PATH)) {
    const propertiesBackupPath = path.join(BACKUP_DIR, `properties-${timestamp}.json`);
    fs.copyFileSync(PROPERTIES_PATH, propertiesBackupPath);
    console.log(`📦 Backed up properties database to: ${propertiesBackupPath}`);
  }
}

// Clean up old backups (keep last 7 days)
function cleanupOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  
  files.forEach(file => {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    
    if (stats.mtime < sevenDaysAgo) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Cleaned up old backup: ${file}`);
    }
  });
}

// Main execution function
async function main() {
  try {
    console.log('🚀 Starting daily feed refresh...');
    console.log(`📅 ${new Date().toISOString()}`);
    
    // Create backup of current data
    createBackup();
    
    // Fetch fresh XML feed
    const freshXML = await fetchFreshXMLFeed();
    
    // Save fresh XML feed
    fs.writeFileSync(FEED_CACHE_PATH, freshXML);
    console.log(`💾 Saved fresh XML feed to: ${FEED_CACHE_PATH}`);
    
    // Extract fresh image URLs
    const freshImageUrls = extractPropertyImagesFromXML(freshXML);
    console.log(`📸 Extracted ${freshImageUrls.size} properties with fresh image URLs`);
    
    // Update properties database
    const { updated, total } = updatePropertiesWithFreshImages(freshImageUrls);
    console.log(`✅ Updated ${updated} out of ${total} properties with fresh image URLs`);
    
    // Clean up old backups
    cleanupOldBackups();
    
    console.log('🎉 Daily feed refresh completed successfully!');
    
  } catch (error) {
    console.error('❌ Daily feed refresh failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  fetchFreshXMLFeed,
  extractPropertyImagesFromXML,
  updatePropertiesWithFreshImages,
  createBackup,
  cleanupOldBackups,
  main
}; 