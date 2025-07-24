#!/usr/bin/env node

/**
 * Complete Fresh Analysis Test
 * Tests the entire fresh analysis pipeline from PropertyList API to PDF generation
 */

require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

// Test configuration
const TEST_CONFIG = {
  serverUrl: 'http://localhost:3004',
  testPropertyData: {
    reference: 'TEST-FRESH-001',
    property_type: 'apartment',
    bedrooms: 2,
    bathrooms: 2,
    city: 'Marbella',
    suburb: 'Puerto Banús',
    sale_price: 450000,
    build_size: 85,
    latitude: 36.4848,
    longitude: -4.9528
  }
};

async function testCompleteFreshAnalysis() {
  console.log('🧪 Testing Complete Fresh Analysis System...\n');
  
  try {
    // Test 1: Check server health
    console.log('📋 Test 1: Checking server health...');
    const healthResponse = await axios.get(`${TEST_CONFIG.serverUrl}/api/health`);
    
    if (healthResponse.data.status === 'healthy') {
      console.log('✅ Server is healthy');
      console.log('   Services status:');
      Object.entries(healthResponse.data.services).forEach(([service, status]) => {
        console.log(`     ${service}: ${status ? '✅' : '❌'}`);
      });
    } else {
      console.log('❌ Server health check failed');
      return;
    }
    
    // Test 2: Create test session
    console.log('\n📋 Test 2: Creating test session...');
    const sessionResponse = await axios.post(`${TEST_CONFIG.serverUrl}/api/property`, TEST_CONFIG.testPropertyData);
    
    if (sessionResponse.data.success) {
      console.log('✅ Test session created successfully');
      console.log(`   Session ID: ${sessionResponse.data.sessionId}`);
      console.log(`   Session URL: ${sessionResponse.data.sessionUrl}`);
    } else {
      console.log('❌ Failed to create test session');
      return;
    }
    
    const sessionId = sessionResponse.data.sessionId;
    
    // Test 3: Verify session data
    console.log('\n📋 Test 3: Verifying session data...');
    const sessionDataResponse = await axios.get(`${TEST_CONFIG.serverUrl}/api/session/${sessionId}`);
    
    if (sessionDataResponse.data.sessionData) {
      console.log('✅ Session data verified');
      console.log(`   Property reference: ${sessionDataResponse.data.sessionData.propertyData.reference}`);
      console.log(`   Property type: ${sessionDataResponse.data.sessionData.propertyData.property_type}`);
      console.log(`   Location: ${sessionDataResponse.data.sessionData.propertyData.city}`);
    } else {
      console.log('❌ Session data verification failed');
      return;
    }
    
    // Test 4: Check PropertyList API credentials
    console.log('\n📋 Test 4: Checking PropertyList API configuration...');
    console.log(`   API Base URL: ${process.env.PROPERTYLIST_API_BASE_URL || 'NOT SET'}`);
    console.log(`   API Username: ${process.env.PROPERTYLIST_API_USERNAME ? 'SET' : 'NOT SET'}`);
    console.log(`   API Password: ${process.env.PROPERTYLIST_API_PASSWORD ? 'SET' : 'NOT SET'}`);
    
    if (!process.env.PROPERTYLIST_API_USERNAME || !process.env.PROPERTYLIST_API_PASSWORD) {
      console.log('⚠️ PropertyList API credentials not configured');
      console.log('   Skipping fresh analysis test - requires valid API credentials');
      console.log('   Please set PROPERTYLIST_API_USERNAME and PROPERTYLIST_API_PASSWORD in .env.local');
      return;
    }
    
    // Test 5: Start fresh analysis
    console.log('\n📋 Test 5: Starting fresh analysis...');
    console.log('   This will test the complete pipeline:');
    console.log('   1. PropertyList API data fetching');
    console.log('   2. Comparable property search');
    console.log('   3. Fresh image processing');
    console.log('   4. PDF report generation');
    console.log('   Please wait, this may take 2-3 minutes...\n');
    
    const startTime = Date.now();
    
    try {
      const analysisResponse = await axios.post(
        `${TEST_CONFIG.serverUrl}/api/analyze-fresh/${sessionId}`,
        {},
        { timeout: 300000 } // 5 minute timeout
      );
      
      if (analysisResponse.data.success) {
        const totalTime = Date.now() - startTime;
        console.log(`✅ Fresh analysis completed successfully in ${totalTime}ms`);
        
        console.log('\n📊 Analysis Results:');
        const analysis = analysisResponse.data.analysis;
        
        console.log('   Main Property:');
        console.log(`     Reference: ${analysis.mainProperty.reference}`);
        console.log(`     Type: ${analysis.mainProperty.type}`);
        console.log(`     Location: ${analysis.mainProperty.location}`);
        console.log(`     Price: €${analysis.mainProperty.price?.toLocaleString() || 'N/A'}`);
        console.log(`     Images: ${analysis.mainProperty.images} processed`);
        
        console.log('   Comparable Properties:');
        console.log(`     Count: ${analysis.comparables.count}`);
        console.log(`     Price range: €${analysis.comparables.priceRange.min?.toLocaleString()} - €${analysis.comparables.priceRange.max?.toLocaleString()}`);
        console.log(`     Median price: €${analysis.comparables.priceRange.median?.toLocaleString()}`);
        console.log(`     Total images: ${analysis.comparables.totalImages}`);
        
        console.log('   Processing Performance:');
        console.log(`     Total time: ${analysis.processing.totalTime}ms`);
        console.log(`     Image processing: ${analysis.processing.imageProcessingTime}ms`);
        console.log(`     PDF generation: ${analysis.processing.pdfGenerationTime}ms`);
        console.log(`     API calls made: ${analysis.processing.apiCalls}`);
        
        console.log('   PDF Report:');
        console.log(`     Filename: ${analysisResponse.data.pdfReport.filename}`);
        console.log(`     Size: ${(analysisResponse.data.pdfReport.size / 1024 / 1024).toFixed(2)}MB`);
        console.log(`     Download URL: ${analysisResponse.data.pdfReport.downloadUrl}`);
        
        console.log(`   Data Source: ${analysisResponse.data.dataSource}`);
        
        // Test 6: Verify PDF download
        console.log('\n📋 Test 6: Testing PDF download...');
        try {
          const pdfResponse = await axios.get(
            `${TEST_CONFIG.serverUrl}${analysisResponse.data.pdfReport.downloadUrl}`,
            { responseType: 'stream' }
          );
          
          if (pdfResponse.status === 200) {
            console.log('✅ PDF download successful');
            console.log(`   Content-Type: ${pdfResponse.headers['content-type']}`);
            console.log(`   Content-Length: ${pdfResponse.headers['content-length']} bytes`);
          } else {
            console.log('❌ PDF download failed');
          }
        } catch (pdfError) {
          console.log('❌ PDF download error:', pdfError.message);
        }
        
      } else {
        console.log('❌ Fresh analysis failed:', analysisResponse.data.error);
        console.log('   Message:', analysisResponse.data.message);
      }
      
    } catch (analysisError) {
      console.log('❌ Fresh analysis request failed:', analysisError.message);
      
      if (analysisError.response) {
        console.log('   Status:', analysisError.response.status);
        console.log('   Error data:', analysisError.response.data);
      }
    }
    
    // Test 7: Check updated session
    console.log('\n📋 Test 7: Checking updated session data...');
    const updatedSessionResponse = await axios.get(`${TEST_CONFIG.serverUrl}/api/session/${sessionId}`);
    
    if (updatedSessionResponse.data.sessionData.freshAnalysisResults) {
      console.log('✅ Session updated with fresh analysis results');
      console.log(`   Analysis type: ${updatedSessionResponse.data.sessionData.freshAnalysisResults.analysisType}`);
      console.log(`   Data source: ${updatedSessionResponse.data.sessionData.freshAnalysisResults.dataSource}`);
      console.log(`   Timestamp: ${updatedSessionResponse.data.sessionData.freshAnalysisResults.timestamp}`);
    } else {
      console.log('⚠️ Session not updated with fresh analysis results');
    }
    
    console.log('\n✅ Complete Fresh Analysis System test completed!');
    
  } catch (error) {
    console.error('❌ Complete Fresh Analysis test failed:', error.message);
    
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
    
    console.error('   Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  console.log('🚀 Starting Complete Fresh Analysis Test...');
  console.log('⚠️ Make sure the server is running on port 3004');
  console.log('⚠️ Make sure PropertyList API credentials are configured\n');
  
  testCompleteFreshAnalysis();
}

module.exports = testCompleteFreshAnalysis; 