// Refresh Property Feed - Standalone Script
// Fetches the latest XML feed and updates the properties database

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const XML_FEED_URL = 'http://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/47/export/189963705804aee9/admin.xml';
const PROPERTIES_FILE = path.join(__dirname, '../data/properties.json');
const BACKUP_FILE = path.join(__dirname, '../data/properties-backup-before-refresh.json');

// Fetch XML feed
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
        console.log(`📊 Received ${(data.length / 1024 / 1024).toFixed(2)} MB`);
        resolve(data);
      });
    });
    
    request.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });
    
    request.setTimeout(60000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Parse XML and extract properties
function parseXMLProperties(xmlString) {
  console.log('🔍 Parsing XML properties...');
  
  const properties = [];
  
  // Find all property blocks
  const propertyRegex = /<property[^>]*>([\s\S]*?)<\/property>/g;
  let propertyMatch;
  
  while ((propertyMatch = propertyRegex.exec(xmlString)) !== null) {
    const propertyBlock = propertyMatch[1];
    
    try {
      const property = extractPropertyData(propertyBlock);
      if (property) {
        properties.push(property);
      }
    } catch (error) {
      console.warn('⚠️ Error parsing property block:', error.message);
    }
  }
  
  console.log(`✅ Parsed ${properties.length} properties from XML`);
  return properties;
}

// Extract property data from XML block
function extractPropertyData(propertyBlock) {
  // Helper function to extract text content
  const extractText = (tagName) => {
    const regex = new RegExp(`<${tagName}>([^<]+)<\/${tagName}>`);
    const match = propertyBlock.match(regex);
    return match ? match[1].trim() : undefined;
  };
  
  // Helper function to extract number
  const extractNumber = (tagName) => {
    const text = extractText(tagName);
    if (!text) return undefined;
    const num = parseFloat(text.replace(/[€$,\s]/g, ''));
    return isNaN(num) ? undefined : num;
  };
  
  // Helper function to extract boolean
  const extractBoolean = (tagName) => {
    const text = extractText(tagName);
    if (!text) return undefined;
    return text.toLowerCase() === 'true' || text === '1' || text === 'yes';
  };
  
  // Helper function to extract array
  const extractArray = (tagName) => {
    // Handle both regular content and CDATA sections
    const regex = new RegExp(`<${tagName}>(?:<!\\[CDATA\\[([^\\]]*)\\]\\]>|([^<]+))<\/${tagName}>`, 'g');
    const matches = [];
    let match;
    while ((match = regex.exec(propertyBlock)) !== null) {
      // Use CDATA content if available, otherwise use regular content
      const content = match[1] || match[2];
      if (content) {
        matches.push(content.trim());
      }
    }
    return matches.length > 0 ? matches : undefined;
  };
  
  // Extract basic property information
  const refNumber = extractText('reference');
  if (!refNumber) {
    return null; // Skip properties without reference number
  }
  
  const city = extractText('city');
  const province = extractText('province');
  if (!city || !province) {
    return null; // Skip properties without location
  }
  
  // Extract property type and normalize
  const propertyTypeRaw = extractText('property_type');
  const propertyType = normalizePropertyType(propertyTypeRaw);
  if (!propertyType) {
    return null; // Skip properties with invalid type
  }
  
  // Extract numeric values
  const bedrooms = extractNumber('bedrooms') || 0;
  const bathrooms = extractNumber('bathrooms') || 0;
  const buildArea = extractNumber('build_size');
  const plotArea = extractNumber('plot_size');
  const terraceArea = extractNumber('terrace_size');
  const price = extractNumber('sale_price') || extractNumber('rental_price') || extractNumber('monthly_price') || 0;
  
  // Extract transaction type
  const isSale = extractBoolean('is_sale') !== false; // Default to sale if not specified
  const isShortTerm = extractBoolean('is_short_term');
  const isLongTerm = extractBoolean('is_long_term');
  
  // Extract rental-specific fields
  const monthlyPrice = extractNumber('monthly_price');
  const weeklyPriceFrom = extractNumber('weekly_price_from');
  const weeklyPriceTo = extractNumber('weekly_price_to');
  const rentalDeposit = extractNumber('rental_deposit');
  const rentalCommission = extractNumber('rental_commission');
  const propertyTax = extractNumber('property_tax');
  const garbageTax = extractNumber('garbage_tax');
  const communityFees = extractNumber('community_fees');
  
  // Extract additional fields
  const parkingSpaces = extractNumber('parking_spaces');
  const floorNumber = extractNumber('floor_number');
  const furnished = extractBoolean('furnished');
  const energyRating = extractText('energy_rating');
  const orientation = extractText('orientation');
  const urbanization = extractText('urbanization');
  const suburb = extractText('suburb');
  
  // Extract description
  const description = extractText('description');
  
  // Extract images
  const images = extractArray('photo');
  const mainImage = images && images.length > 0 ? images[0] : undefined;
  
  // Extract features
  const features = extractArray('feature');
  
  // Extract location coordinates
  const latitude = extractNumber('latitude');
  const longitude = extractNumber('longitude');
  
  // Construct address
  const addressParts = [suburb, urbanization, city, province].filter(Boolean);
  const address = addressParts.join(', ');
  
  // Generate unique property ID
  const keyData = {
    refNumber: refNumber,
    address: address,
    city: city,
    province: province,
    propertyType: propertyType,
    bedrooms: bedrooms,
    bathrooms: bathrooms,
    buildArea: buildArea || 0,
    price: price || 0
  };
  const dataString = JSON.stringify(keyData);
  const hash = Buffer.from(dataString).toString('base64').replace(/[/+=]/g, '').substring(0, 12);
  const id = refNumber ? `${refNumber}-${hash}` : hash;
  
  // Create property object
  const property = {
    id: id,
    ref_number: refNumber,
    address: address,
    city: city,
    province: province,
    property_type: propertyType,
    bedrooms: bedrooms,
    bathrooms: bathrooms,
    build_area: buildArea,
    plot_area: plotArea,
    terrace_area_m2: terraceArea,
    price: price,
    is_sale: isSale,
    isSale: isSale, // Add camelCase version for compatibility
    is_short_term: isShortTerm,
    is_long_term: isLongTerm,
    monthly_price: monthlyPrice,
    weekly_price_from: weeklyPriceFrom,
    weekly_price_to: weeklyPriceTo,
    rental_deposit: rentalDeposit,
    rental_commission: rentalCommission,
    property_tax: propertyTax,
    garbage_tax: garbageTax,
    community_fees: communityFees,
    parking_spaces: parkingSpaces,
    floor_number: floorNumber,
    furnished: furnished,
    energy_rating: energyRating,
    orientation: orientation,
    urbanization: urbanization,
    suburb: suburb,
    description: description,
    image: mainImage,
    images: images || [],
    features: features || [],
    latitude: latitude,
    longitude: longitude,
    date_listed: new Date().toISOString(),
    last_updated: new Date().toISOString()
  };
  
  return property;
}

// Normalize property type
function normalizePropertyType(type) {
  if (!type) return 'Unknown';
  
  const normalized = type.toLowerCase().trim();
  const typeMapping = {
    'apartment': 'Apartment',
    'villa': 'Villa',
    'penthouse': 'Penthouse',
    'townhouse': 'Townhouse',
    'duplex': 'Duplex',
    'studio': 'Studio',
    'house': 'House',
    'flat': 'Apartment',
    'country-house': 'Country House',
    'plot': 'Plot',
    'office': 'Office',
    'commercial': 'Commercial'
  };
  
  return typeMapping[normalized] || 'Unknown';
}

// Create backup
function createBackup() {
  if (fs.existsSync(PROPERTIES_FILE)) {
    fs.copyFileSync(PROPERTIES_FILE, BACKUP_FILE);
    console.log(`📦 Created backup: ${BACKUP_FILE}`);
  }
}

// Save properties to database
function saveProperties(properties) {
  console.log('💾 Saving properties to database...');
  
  // Convert to array format
  const propertiesArray = Array.isArray(properties) ? properties : Object.values(properties);
  
  // Save to file
  fs.writeFileSync(PROPERTIES_FILE, JSON.stringify(propertiesArray, null, 2));
  console.log(`✅ Saved ${propertiesArray.length} properties to database`);
  
  return propertiesArray;
}

// Show statistics
function showStatistics(properties) {
  console.log('\n📊 Database Statistics:');
  console.log(`   - Total properties: ${properties.length}`);
  
  const byType = {};
  const byCity = {};
  const byProvince = {};
  const withImages = properties.filter(p => p.images && p.images.length > 0).length;
  const withDescriptions = properties.filter(p => p.description && p.description.trim().length > 10).length;
  
  properties.forEach(p => {
    byType[p.property_type] = (byType[p.property_type] || 0) + 1;
    byCity[p.city] = (byCity[p.city] || 0) + 1;
    byProvince[p.province] = (byProvince[p.province] || 0) + 1;
  });
  
  console.log(`   - Properties with images: ${withImages} (${((withImages/properties.length)*100).toFixed(1)}%)`);
  console.log(`   - Properties with descriptions: ${withDescriptions} (${((withDescriptions/properties.length)*100).toFixed(1)}%)`);
  
  console.log('   - By property type:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`     * ${type}: ${count}`);
  });
  
  console.log('   - Top 5 cities:');
  const topCities = Object.entries(byCity)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  topCities.forEach(([city, count]) => {
    console.log(`     * ${city}: ${count}`);
  });
  
  console.log('   - By province:');
  Object.entries(byProvince).forEach(([province, count]) => {
    console.log(`     * ${province}: ${count}`);
  });
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Property Feed Refresh...');
    console.log(`📅 ${new Date().toISOString()}`);
    console.log('');
    
    // Create backup
    createBackup();
    console.log('');
    
    // Fetch XML feed
    const xmlData = await fetchXMLFeed();
    console.log('');
    
    // Parse properties
    const properties = parseXMLProperties(xmlData);
    console.log('');
    
    // Save to database
    const savedProperties = saveProperties(properties);
    console.log('');
    
    // Show statistics
    showStatistics(savedProperties);
    console.log('');
    
    console.log('✅ Property Feed Refresh completed successfully!');
    console.log('');
    console.log('🎯 Next steps:');
    console.log('   1. Test the database: node scripts/debug-property-database.js');
    console.log('   2. Check Marbella properties: node scripts/debug-marbella-market-data.js');
    console.log('   3. Run AI enhancement: node scripts/run-ai-enhancement.js');
    
  } catch (error) {
    console.error('❌ Property Feed Refresh failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fetchXMLFeed, parseXMLProperties, saveProperties }; 