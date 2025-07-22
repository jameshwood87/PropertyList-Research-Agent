const axios = require('axios');

// Sample property data matching the format you provided
const testPropertyData = {
  id: 102,
  is_sale: true,
  reference: 'PL0102',
  price: 450000,
  bedrooms: 3,
  bathrooms: 2,
  build_square_meters: 108,
  plot_square_meters: null,
  terrace_square_meters: null,
  parking_spaces: 2,
  furnished: false,
  property_type: 0,
  city_id: 2,
  suburb_id: 120,
  urbanization_name: '',
  is_long_term: false,
  is_short_term: false,
  monthly_price: null,
  weekly_price_low: null,
  weekly_price_high: null,
  floor_number: 2,
  ibi: 1900,
  basura: 150,
  community_fees: 250,
  energy_rating: 'B',
  feature_ids: [27, 33, 36, 38, 39, 41, 42, 43, 47, 51, 58, 61, 62, 65, 76, 78, 83, 87, 91, 94, 98, 102, 103, 131, 134, 140, 155],
  images: [
    {
      id: 1306,
      small: 'https://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/6ZjJ3sfPjmXChE4y7E4eCnX3?response-content-disposition=inline%3B%20filename%3D%22o_1ige7fgp015idbe81atpe3913m642_1.jpg%22%3B%20filename%2A%3DUTF-8%27%27o_1ige7fgp015idbe81atpe3913m642_1.jpg&response-content-type=image%2Fjpeg&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAS7DVVMGJGYJ7YKGY%2F20250718%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20250718T121308Z&X-Amz-Expires=300&X-Amz-SignedHeaders=host&X-Amz-Signature=3956ca892d5ddb8f94048f69cf1c8f9fad2a677b2159a0c686c2518f6b03d88a',
      medium: 'https://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/6ZjJ3sfPjmXChE4y7E4eCnX3?response-content-disposition=inline%3B%20filename%3D%22o_1ige7fgp015idbe81atpe3913m642_1.jpg%22%3B%20filename%2A%3DUTF-8%27%27o_1ige7fgp015idbe81atpe3913m642_1.jpg&response-content-type=image%2Fjpeg&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAS7DVVMGJGYJ7YKGY%2F20250718%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20250718T121308Z&X-Amz-Expires=300&X-Amz-SignedHeaders=host&X-Amz-Signature=3956ca892d5ddb8f94048f69cf1c8f9fad2a677b2159a0c686c2518f6b03d88a'
    },
    {
      id: 1307,
      small: 'https://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/7CDBGGzW7xzkZqAsrRgKyLKu?response-content-disposition=inline%3B%20filename%3D%22o_1ige7fgp03v0ph1erd1v6q1vkm43_2.jpg%22%3B%20filename%2A%3DUTF-8%27%27o_1ige7fgp03v0ph1erd1v6q1vkm43_2.jpg&response-content-type=image%2Fjpeg&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAS7DVVMGJGYJ7YKGY%2F20250718%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20250718T121308Z&X-Amz-Expires=300&X-Amz-SignedHeaders=host&X-Amz-Signature=81bc447d7c545399726516acb42a260f01b96985eb23cc23fc93dec1c1eb3655',
      medium: 'https://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/7CDBGGzW7xzkZqAsrRgKyLKu?response-content-disposition=inline%3B%20filename%3D%22o_1ige7fgp03v0ph1erd1v6q1vkm43_2.jpg%22%3B%20filename%2A%3DUTF-8%27%27o_1ige7fgp03v0ph1erd1v6q1vkm43_2.jpg&response-content-type=image%2Fjpeg&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAS7DVVMGJGYJ7YKGY%2F20250718%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20250718T121308Z&X-Amz-Expires=300&X-Amz-SignedHeaders=host&X-Amz-Signature=81bc447d7c545399726516acb42a260f01b96985eb23cc23fc93dec1c1eb3655'
    },
    {
      id: 1308,
      small: 'https://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/yQM1h8w9JD5KhKwSzgMsbzfv?response-content-disposition=inline%3B%20filename%3D%22o_1ige7fgp0k14eokgr61gpul4u44_3.jpg%22%3B%20filename%2A%3DUTF-8%27%27o_1ige7fgp0k14eokgr61gpul4u44_3.jpg&response-content-type=image%2Fjpeg&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAS7DVVMGJGYJ7YKGY%2F20250718%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20250718T121308Z&X-Amz-Expires=300&X-Amz-SignedHeaders=host&X-Amz-Signature=9d9df0d42d713201549a10415197f81999afe56ae17934b728777031f03bd886',
      medium: 'https://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/yQM1h8w9JD5KhKwSzgMsbzfv?response-content-disposition=inline%3B%20filename%3D%22o_1ige7fgp0k14eokgr61gpul4u44_3.jpg%22%3B%20filename%2A%3DUTF-8%27%27o_1ige7fgp0k14eokgr61gpul4u44_3.jpg&response-content-type=image%2Fjpeg&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAS7DVVMGJGYJ7YKGY%2F20250718%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20250718T121308Z&X-Amz-Expires=300&X-Amz-SignedHeaders=host&X-Amz-Signature=9d9df0d42d713201549a10415197f81999afe56ae17934b728777031f03bd886'
    }
  ]
};

async function sendTestData() {
  try {
    console.log('🚀 Sending test property data to AI Property Research Agent...');
    console.log('📊 Property Reference:', testPropertyData.reference);
    console.log('💰 Price:', `€${testPropertyData.price.toLocaleString()}`);
    console.log('🏠 Type:', testPropertyData.bedrooms + ' bed, ' + testPropertyData.bathrooms + ' bath');
    
    const response = await axios.post('http://localhost:3004/api/send_property_data', testPropertyData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      console.log('\n✅ Success! Property data received and session created.');
      console.log('🆔 Session ID:', response.data.sessionId);
      console.log('🔗 Session URL:', response.data.sessionUrl);
      console.log('\n📝 Next steps:');
      console.log('1. Open the session URL in your browser');
      console.log('2. View the property details and images');
      console.log('3. Run market analysis or comparables analysis');
      console.log('4. Generate a comprehensive report');
    } else {
      console.error('❌ Error:', response.data.error);
    }

  } catch (error) {
    console.error('❌ Error sending test data:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received. Make sure the server is running on port 3004.');
      console.error('Start the server with: npm run server');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Check if server is running first
async function checkServerHealth() {
  try {
    const response = await axios.get('http://localhost:3004/api/health');
    if (response.data.success) {
      console.log('✅ Server is running and healthy');
      return true;
    }
  } catch (error) {
    console.error('❌ Server is not running or not accessible');
    console.error('Please start the server first with: npm run server');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🏠 AI Property Research Agent - Test Script');
  console.log('==========================================\n');
  
  const serverHealthy = await checkServerHealth();
  if (serverHealthy) {
    await sendTestData();
  }
}

// Run the test
main(); 