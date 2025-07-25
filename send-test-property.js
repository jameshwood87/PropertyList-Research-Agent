const fs = require('fs');
const axios = require('axios');

async function sendTestProperty() {
  try {
    console.log('📤 Sending test property to create new session...');
    
    // Read the test property data
    const propertyData = JSON.parse(fs.readFileSync('test-property-real-images.json', 'utf8'));
    
    console.log(`🏠 Property: ${propertyData.reference} - €${propertyData.price.toLocaleString()}`);
    console.log(`📍 Location: ${propertyData.address}, ${propertyData.suburb}, ${propertyData.city}`);
    console.log(`🏡 Details: ${propertyData.bedrooms}br/${propertyData.bathrooms}ba, ${propertyData.build_square_meters}sqm build, ${propertyData.plot_square_meters}sqm plot`);
    console.log(`📸 Images: ${propertyData.images.length} available (Real Unsplash URLs)`);
    
    // Send to listener endpoint
    const response = await axios.post('http://localhost:3004/api/property', propertyData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Property sent successfully!');
    console.log('📊 Response:', response.data);
    
    if (response.data.sessionId) {
      const sessionUrl = `http://localhost:3000/analysis/${response.data.sessionId}`;
      console.log('\n🎯 ANALYSIS URL:');
      console.log(`🔗 ${sessionUrl}`);
      console.log('\n📋 Copy this URL to start the analysis!');
    }
    
  } catch (error) {
    console.error('❌ Error sending property:', error.message);
    console.error('Full error:', error);
  }
}

sendTestProperty(); 