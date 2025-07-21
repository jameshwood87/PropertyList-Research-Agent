// Usage: node scripts/create-session.js
// Creates a session with proper UTF-8 encoding

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const testProperty = {
  "refNumber": "TEST-AI-LOCATION-001",
  "address": "Avenida del Mar, Marbella",
  "city": "Marbella",
  "province": "Málaga",
  "areaCode": "29600",
  "propertyType": "Apartment",
  "bedrooms": 3,
  "bathrooms": 2,
  "totalAreaM2": 120,
  "buildArea": 120,
  "plotArea": 0,
  "terraceAreaM2": 25,
  "condition": "Excellent",
  "architecturalStyle": "Contemporary",
  "features": [
    "Air Conditioning",
    "Balcony",
    "Parking",
    "Pool",
    "Garden"
  ],
  "description": "This beautiful apartment is located in Avenida del Mar, in the heart of Marbella's prestigious Golden Mile. The property is situated within the exclusive Urbanización Los Naranjos, just a short walk from the famous Puerto Banús marina and the pristine beaches of the Costa del Sol. This prime location offers easy access to the renowned Marbella Club Hotel and is within walking distance to excellent schools, shopping centers, and fine dining restaurants. The apartment is close to the iconic Orange Square (Plaza de los Naranjos) and benefits from proximity to the Marbella Golf Club. This exceptional location in the Golden Mile area provides the perfect blend of luxury living and convenience, with the Mediterranean Sea just steps away and the vibrant Marbella nightlife within easy reach.",
  "price": 450000,
  "yearBuilt": 2018,
  "dateListed": "2025-01-15T10:00:00Z",
  "image": "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop",
  "images": [
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop"
  ]
};

async function createSession() {
  try {
    console.log('🚀 Creating session with proper UTF-8 encoding...');
    
    const response = await axios.post('http://localhost:3004/create-session', {
      property: testProperty
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });

    if (response.data.success) {
      const sessionId = response.data.sessionId;
      const agentUrl = response.data.agentUrl;
      
      console.log('✅ Session created successfully!');
      console.log('📋 Session ID:', sessionId);
      console.log('🌐 Agent URL:', agentUrl);
      console.log('\n🎯 Copy and paste this URL in your browser:');
      console.log(agentUrl);
      
      return { sessionId, agentUrl };
    } else {
      console.error('❌ Failed to create session:', response.data);
    }
  } catch (error) {
    console.error('❌ Error creating session:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

createSession(); 