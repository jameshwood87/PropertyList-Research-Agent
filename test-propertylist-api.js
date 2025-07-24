#!/usr/bin/env node

/**
 * PropertyList API Service Test
 * Tests API connectivity, rate limiting, and basic functionality
 */

require('dotenv').config({ path: '.env.local' });
const PropertyListApiService = require('./server/services/propertyListApiService');

async function testPropertyListApi() {
  console.log('🧪 Testing PropertyList API Service...\n');
  
  try {
    // Initialize service
    const apiService = new PropertyListApiService();
    
    // Test 1: Check API credentials
    console.log('📋 Test 1: Checking API configuration...');
    console.log(`   Base URL: ${process.env.PROPERTYLIST_API_BASE_URL || 'NOT SET'}`);
    console.log(`   Username: ${process.env.PROPERTYLIST_API_USERNAME ? 'SET' : 'NOT SET'}`);
    console.log(`   Password: ${process.env.PROPERTYLIST_API_PASSWORD ? 'SET' : 'NOT SET'}`);
    
    if (!process.env.PROPERTYLIST_API_USERNAME || !process.env.PROPERTYLIST_API_PASSWORD) {
      console.log('⚠️ API credentials not configured in .env.local');
      console.log('   Please set PROPERTYLIST_API_USERNAME and PROPERTYLIST_API_PASSWORD');
      return;
    }
    
    // Test 2: Test API connection
    console.log('\n📋 Test 2: Testing API connection...');
    const connectionTest = await apiService.testConnection();
    
    if (connectionTest.success) {
      console.log('✅ API connection successful');
    } else {
      console.log('❌ API connection failed:', connectionTest.message);
      return;
    }
    
    // Test 3: Test property search
    console.log('\n📋 Test 3: Testing property search...');
    const searchResults = await apiService.searchProperties({
      page_size: 3,
      search_type: 'for-sale'
    });
    
    if (searchResults && searchResults.data) {
      console.log(`✅ Search successful: Found ${searchResults.data.length} properties`);
      console.log('   Sample property:');
      if (searchResults.data.length > 0) {
        const sample = searchResults.data[0];
        console.log(`     ID: ${sample.id}`);
        console.log(`     Reference: ${sample.reference || 'N/A'}`);
        console.log(`     Type: ${sample.property_type || 'N/A'}`);
        console.log(`     Price: €${sample.for_sale_price?.toLocaleString() || 'N/A'}`);
      }
    } else {
      console.log('❌ Search failed or returned no data');
    }
    
    // Test 4: Test property details (if we have a property ID)
    if (searchResults && searchResults.data && searchResults.data.length > 0) {
      console.log('\n📋 Test 4: Testing property details...');
      const propertyId = searchResults.data[0].id;
      
      const propertyDetails = await apiService.getPropertyDetails(propertyId);
      
      if (propertyDetails) {
        console.log(`✅ Property details retrieved for ID: ${propertyId}`);
        console.log(`   Reference: ${propertyDetails.reference || 'N/A'}`);
        console.log(`   Bedrooms: ${propertyDetails.bedrooms || 'N/A'}`);
        console.log(`   Images: ${propertyDetails.photos?.length || 0} photos`);
        
        if (propertyDetails.photos && propertyDetails.photos.length > 0) {
          console.log(`   Sample image: ${propertyDetails.photos[0].large || propertyDetails.photos[0].small || 'N/A'}`);
        }
      } else {
        console.log('❌ Property details failed');
      }
    }
    
    // Test 5: Test rate limiting status
    console.log('\n📋 Test 5: Checking rate limiting status...');
    const metrics = apiService.getMetrics();
    console.log('   Rate Limit Status:');
    console.log(`     Global: ${metrics.rateLimitStatus.global}/100`);
    console.log(`     Listings: ${metrics.rateLimitStatus.listings}/30`);
    console.log(`     Details: ${metrics.rateLimitStatus.details}/40`);
    console.log('   Performance:');
    console.log(`     Total Requests: ${metrics.totalRequests}`);
    console.log(`     Successful: ${metrics.successfulRequests}`);
    console.log(`     Failed: ${metrics.failedRequests}`);
    console.log(`     Average Response Time: ${metrics.averageResponseTime.toFixed(0)}ms`);
    
    // Test 6: Test comparable search (if we have property data)
    if (searchResults && searchResults.data && searchResults.data.length > 0) {
      console.log('\n📋 Test 6: Testing comparable property search...');
      const mainProperty = searchResults.data[0];
      
      const comparables = await apiService.findComparables(mainProperty, 5);
      
      if (comparables && comparables.length > 0) {
        console.log(`✅ Found ${comparables.length} comparable properties`);
        console.log('   Sample comparable:');
        const sample = comparables[0];
        console.log(`     ID: ${sample.id}`);
        console.log(`     Reference: ${sample.reference || 'N/A'}`);
        console.log(`     Price: €${sample.for_sale_price?.toLocaleString() || 'N/A'}`);
      } else {
        console.log('⚠️ No comparable properties found');
      }
    }
    
    console.log('\n✅ PropertyList API Service test completed successfully!');
    console.log('\n📊 Final Metrics:');
    const finalMetrics = apiService.getMetrics();
    console.log(`   Total API calls: ${finalMetrics.totalRequests}`);
    console.log(`   Success rate: ${(finalMetrics.successfulRequests / finalMetrics.totalRequests * 100).toFixed(1)}%`);
    console.log(`   Rate limit hits: ${finalMetrics.rateLimitHits}`);
    
  } catch (error) {
    console.error('❌ PropertyList API test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testPropertyListApi();
}

module.exports = testPropertyListApi; 