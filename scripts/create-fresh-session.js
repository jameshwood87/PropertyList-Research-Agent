// Create a fresh session with a new property
const fs = require('fs');
const path = require('path');

async function createFreshSession() {
    try {
        console.log('🆕 Creating fresh session with new property...\n');
        
        // Load properties from database and pick a different one
        const propertiesPath = path.join(__dirname, '../data/properties.json');
        const propertiesData = JSON.parse(fs.readFileSync(propertiesPath, 'utf8'));
        
        // Pick a property that's different from the previous one (Calle Benahavis)
        const availableProperties = propertiesData.filter(prop => 
            prop.city && 
            prop.city !== 'Marbella' && // Different city
            prop.images && 
            prop.images.length > 0 &&
            prop.price > 0
        );
        
        if (availableProperties.length === 0) {
            throw new Error('No suitable properties found in database');
        }
        
        // Pick a random property
        const randomIndex = Math.floor(Math.random() * availableProperties.length);
        const selectedProperty = availableProperties[randomIndex];
        
        // Construct address from available fields
        const addressParts = [];
        if (selectedProperty.urbanization) addressParts.push(selectedProperty.urbanization);
        if (selectedProperty.neighbourhood) addressParts.push(selectedProperty.neighbourhood);
        if (selectedProperty.city) addressParts.push(selectedProperty.city);
        if (selectedProperty.province) addressParts.push(selectedProperty.province);
        
        const constructedAddress = addressParts.length > 0 ? addressParts.join(', ') : `${selectedProperty.city}, ${selectedProperty.province}`;
        
        const propertyData = {
            address: constructedAddress,
            city: selectedProperty.city,
            province: selectedProperty.province,
            propertyType: selectedProperty.propertyType,
            bedrooms: selectedProperty.bedrooms,
            bathrooms: selectedProperty.bathrooms,
            buildArea: selectedProperty.buildArea,
            plotArea: selectedProperty.plotArea,
            price: selectedProperty.price,
            features: selectedProperty.features || []
        };
        
        const requestBody = {
            property: propertyData,
            userContext: "Fresh analysis with enhanced valuation system and feedback buttons"
        };
        
        console.log('📊 Property Details:');
        console.log(`- Address: ${propertyData.address}`);
        console.log(`- Type: ${propertyData.propertyType}`);
        console.log(`- Price: €${propertyData.price?.toLocaleString() || 'N/A'}`);
        console.log(`- Size: ${propertyData.buildArea || 'N/A'}m² build, ${propertyData.plotArea || 'N/A'}m² plot`);
        console.log(`- Features: ${propertyData.features.join(', ')}`);
        console.log(`- Images: ${selectedProperty.images?.length || 0} available`);
        console.log('');
        
        // Create session
        const response = await fetch('http://localhost:3004/create-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create session: ${response.status} - ${error}`);
        }
        
        const session = await response.json();
        
        console.log('✅ Session created successfully!');
        console.log(`- Session ID: ${session.sessionId}`);
        console.log(`- Property: ${session.property?.address || 'N/A'}`);
        console.log(`- Status: ${session.status}`);
        console.log(`- Agent URL: ${session.agentUrl}`);
        console.log('');
        
        // Start analysis
        console.log('🚀 Starting analysis...');
        
        const analysisResponse = await fetch(`http://localhost:3004/start-analysis/${session.sessionId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userContext: "Fresh analysis with enhanced valuation system and feedback buttons"
            })
        });
        
        if (!analysisResponse.ok) {
            const error = await analysisResponse.text();
            throw new Error(`Failed to start analysis: ${analysisResponse.status} - ${error}`);
        }
        
        console.log('✅ Analysis started successfully!');
        console.log('');
        console.log('🌐 Frontend URL:');
        console.log(`http://localhost:3000/?sessionId=${session.sessionId}`);
        console.log('');
        console.log('📋 Check for feedback buttons (thumbs up/down) at the bottom right of each section:');
        console.log('- Property Summary section');
        console.log('- Valuation Analysis section');
        console.log('- Comparable Properties section');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

createFreshSession(); 