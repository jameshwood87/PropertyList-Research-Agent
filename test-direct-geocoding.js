const axios = require('axios');

async function testDirectGeocodingForBullRing() {
  try {
    console.log('🎯 Testing direct geocoding for Plaza de Toros Nueva Andalucía...');
    
    const searchQueries = [
      'Plaza de Toros Nueva Andalucía, Nueva Andalucía, Marbella, Spain',
      'Plaza de Toros Nueva Andalucía, Marbella, Spain',
      'Plaza de Toros, Nueva Andalucía, Spain',
      'bull ring Nueva Andalucía, Marbella, Spain',
      'the bull ring, Nueva Andalucía, Spain'
    ];
    
    for (const query of searchQueries) {
      console.log(`\n🔍 Testing: "${query}"`);
      
      try {
        // Using OpenCage geocoding API (assuming that's what the service uses)
        const response = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
          params: {
            q: query,
            key: process.env.OPENCAGE_API_KEY || 'demo_key',
            limit: 1,
            country: 'ES'
          }
        });
        
        if (response.data.results && response.data.results.length > 0) {
          const result = response.data.results[0];
          const lat = result.geometry.lat;
          const lng = result.geometry.lng;
          
          console.log(`📍 Coordinates: ${lat}, ${lng}`);
          console.log(`🗺️ Maps: https://www.google.com/maps?q=${lat},${lng}`);
          
          // Check distance to expected bull ring location
          const expectedLat = 36.4920;
          const expectedLng = -4.9520;
          const distance = Math.sqrt(
            Math.pow((expectedLat - lat) * 111000, 2) + 
            Math.pow((expectedLng - lng) * 111000, 2)
          );
          console.log(`📏 Distance from expected: ${Math.round(distance)} meters`);
          
          if (distance < 100) {
            console.log('🎯 EXCELLENT! Very accurate');
          } else if (distance < 500) {
            console.log('✅ Good! Reasonably accurate');
          } else {
            console.log('❌ Too far from expected location');
          }
          
        } else {
          console.log('❌ No results found');
        }
        
      } catch (error) {
        if (error.response?.status === 402) {
          console.log('⚠️ API key needed for OpenCage');
        } else {
          console.log('❌ Error:', error.message);
        }
      }
    }
    
    console.log('\n💡 Expected location: Plaza de Toros Nueva Andalucía');
    console.log('📍 Expected coordinates: 36.4920, -4.9520');
    console.log('🗺️ Expected Maps: https://www.google.com/maps?q=36.4920,-4.9520');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDirectGeocodingForBullRing(); 