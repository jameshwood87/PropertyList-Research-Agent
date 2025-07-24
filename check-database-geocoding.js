const { Pool } = require('pg');

async function checkDatabaseGeocode() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres:dev_password_123@localhost:5433/propertylist_db'
  });

  try {
    console.log('🔍 Checking database properties and their geocoding...');
    
    // Check total properties
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM properties');
    console.log('📊 Total properties in database:', totalResult.rows[0].total);
    
    // Check properties with coordinates
    const coordsResult = await pool.query('SELECT COUNT(*) as with_coords FROM properties WHERE latitude IS NOT NULL AND longitude IS NOT NULL');
    console.log('📍 Properties with coordinates:', coordsResult.rows[0].with_coords);
    
    // Check some sample properties with their locations
    const sampleResult = await pool.query(`
      SELECT reference, city, suburb, urbanization, latitude, longitude, sale_price, property_type
      FROM properties 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log('\n📋 Sample properties with coordinates:');
    sampleResult.rows.forEach((prop, i) => {
      console.log(`${i + 1}.`, {
        ref: prop.reference,
        location: prop.urbanization || prop.suburb || prop.city,
        coords: prop.latitude && prop.longitude ? `${prop.latitude.toFixed(4)}, ${prop.longitude.toFixed(4)}` : 'None',
        price: prop.sale_price ? `€${prop.sale_price.toLocaleString()}` : 'N/A',
        type: prop.property_type
      });
    });
    
    // Check for Nueva Andalucía specifically
    const naResult = await pool.query(`
      SELECT COUNT(*) as na_count 
      FROM properties 
      WHERE LOWER(suburb) LIKE '%nueva andaluc%' OR LOWER(city) LIKE '%nueva andaluc%'
    `);
    console.log('\n🏘️ Nueva Andalucía properties:', naResult.rows[0].na_count);
    
    // Check coordinate ranges to see if they look reasonable for Spain
    const coordRangeResult = await pool.query(`
      SELECT 
        MIN(latitude) as min_lat, MAX(latitude) as max_lat,
        MIN(longitude) as min_lng, MAX(longitude) as max_lng
      FROM properties 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `);
    
    const coords = coordRangeResult.rows[0];
    console.log('\n🌍 Coordinate ranges:');
    console.log(`Latitude range: ${coords.min_lat?.toFixed(4)} to ${coords.max_lat?.toFixed(4)}`);
    console.log(`Longitude range: ${coords.min_lng?.toFixed(4)} to ${coords.max_lng?.toFixed(4)}`);
    
    // Spain should be roughly: Lat 36-44, Lng -9 to 3
    const spanishLat = coords.min_lat >= 35 && coords.max_lat <= 45;
    const spanishLng = coords.min_lng >= -10 && coords.max_lng <= 4;
    
    if (spanishLat && spanishLng) {
      console.log('✅ Coordinates look reasonable for Spain');
    } else {
      console.log('❌ Coordinates seem outside Spain range!');
      console.log('Expected: Lat 36-44, Lng -9 to 3');
    }
    
    // Check specific Nueva Andalucía properties with coordinates
    const naCoordResult = await pool.query(`
      SELECT reference, suburb, city, latitude, longitude
      FROM properties 
      WHERE (LOWER(suburb) LIKE '%nueva andaluc%' OR LOWER(city) LIKE '%nueva andaluc%')
      AND latitude IS NOT NULL AND longitude IS NOT NULL
      LIMIT 5
    `);
    
    console.log('\n🎯 Nueva Andalucía properties with coordinates:');
    naCoordResult.rows.forEach((prop, i) => {
      const lat = parseFloat(prop.latitude);
      const lng = parseFloat(prop.longitude);
      
      // Nueva Andalucía should be around: Lat 36.49, Lng -4.95
      const distanceFromNA = Math.sqrt(
        Math.pow((36.49 - lat) * 111000, 2) + 
        Math.pow((-4.95 - lng) * 111000, 2)
      );
      
      console.log(`${i + 1}.`, {
        ref: prop.reference,
        location: prop.suburb || prop.city,
        coords: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        distanceFromNA: `${Math.round(distanceFromNA)}m from Nueva Andalucía center`
      });
    });
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkDatabaseGeocode(); 