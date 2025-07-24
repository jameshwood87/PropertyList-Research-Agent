const axios = require('axios');
const fs = require('fs');

async function testBullRingLocationIntelligence() {
  try {
    console.log('🎯 Testing bull ring location intelligence...');
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Create property in Nueva Andalucía
    const response = await axios.post('http://localhost:3004/api/property', {
      reference: 'BULL-RING-TEST',
      type: 1,
      city: 'Marbella',
      suburb: 'Nueva Andalucía',
      bedrooms: 3,
      bathrooms: 2,
      build_square_meters: 145,
      price: 650000,
      features: ['Pool', 'Garden']
    });
    
    const sessionId = response.data.sessionId;
    console.log('✅ Session created:', sessionId);
    
    // Add bull ring location context with CORRECT structure
    console.log('📍 Adding "next to the bull ring" location context...');
    await axios.post(`http://localhost:3004/api/session/${sessionId}/status`, {
      status: 'analyzing',
      propertyData: {
        additionalInfo: 'next to the bull ring'
      }
    });
    
    console.log('✅ Added bull ring location context');
    
    // Wait for AI processing
    console.log('⏳ Waiting for AI location intelligence processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check the results
    const sessionData = JSON.parse(fs.readFileSync(`server/data/sessions/${sessionId}.json`, 'utf8'));
    
    console.log('\n📊 SESSION DATA ANALYSIS:');
    console.log('Additional Info:', sessionData.propertyData?.additionalInfo);
    console.log('Location Context Exists:', !!sessionData.locationContext);
    console.log('Enhanced Location Exists:', !!sessionData.locationContext?.enhancedLocation);
    
    const coords = sessionData.locationContext?.enhancedLocation?.coordinates;
    if (coords) {
      console.log('\n📍 ENHANCED COORDINATES FOUND:');
      console.log('Lat:', coords.lat);
      console.log('Lng:', coords.lng);
      console.log('🗺️ Google Maps:', `https://www.google.com/maps?q=${coords.lat},${coords.lng}`);
      
      // Check distance to actual bull ring
      const actualBullRing = { lat: 36.4920, lng: -4.9520 };
      const distance = Math.sqrt(
        Math.pow((actualBullRing.lat - coords.lat) * 111000, 2) + 
        Math.pow((actualBullRing.lng - coords.lng) * 111000, 2)
      );
      console.log('📏 Distance from Plaza de Toros Nueva Andalucía:', Math.round(distance), 'meters');
      
      if (distance < 100) {
        console.log('🎯 EXCELLENT! Very close to bull ring');
      } else if (distance < 500) {
        console.log('✅ Good! Reasonably close to bull ring');
      } else {
        console.log('❌ Still too far from bull ring');
      }
      
      console.log('\n📋 Location Intelligence Details:');
      if (sessionData.locationContext?.enhancedLocation?.landmarks) {
        console.log('Landmarks:', sessionData.locationContext.enhancedLocation.landmarks);
      }
      if (sessionData.locationContext?.enhancedLocation?.proximityClues) {
        console.log('Proximity Clues:', sessionData.locationContext.enhancedLocation.proximityClues);
      }
      
    } else {
      console.log('\n❌ NO ENHANCED COORDINATES FOUND');
      console.log('Location context:', JSON.stringify(sessionData.locationContext, null, 2));
    }
    
    console.log('\n🔗 Analysis URL:', `http://localhost:3000/analysis/${sessionId}`);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Server not running. Start with: npm run dev');
    }
  }
}

testBullRingLocationIntelligence(); 