const axios = require('axios');

async function createButtonUXTest() {
  try {
    console.log('🎯 Creating test session for improved button UX...');
    
    const response = await axios.post('http://localhost:3004/api/property', {
      reference: 'BUTTON-UX-TEST',
      type: 1,
      city: 'Marbella',
      suburb: 'Nueva Andalucía',
      bedrooms: 3,
      bathrooms: 2,
      build_square_meters: 145,
      price: 650000,
      latitude: 36.492075,
      longitude: -4.952039,
      features: ['Pool', 'Garden']
    });
    
    const sessionId = response.data.sessionId;
    console.log('✅ Test session created:', sessionId);
    console.log('🔗 URL with IMPROVED button UX:', `http://localhost:3000/analysis/${sessionId}`);
    console.log('');
    console.log('🎯 Button improvements:');
    console.log('✅ Immediate visual feedback when clicked');
    console.log('✅ Shows spinning loader and "Starting Analysis..."');
    console.log('✅ Button disabled to prevent multiple clicks');
    console.log('✅ Opacity reduced when disabled');
    console.log('✅ Cursor changes to not-allowed when disabled');
    console.log('');
    console.log('👆 Try clicking the analyze button - it should give immediate feedback!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createButtonUXTest(); 