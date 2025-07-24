require('dotenv').config({ path: '.env.local' });
const db = require('./server/database/postgresDatabase');

async function debugComparable() {
  console.log('🔍 DEBUGGING COMPARABLE SEARCH ISSUE');
  console.log('===================================');
  
  const pgDb = new db();
  await pgDb.init();
  
  try {
    // Check basic property counts
    console.log('📊 Basic property availability:');
    
    const total = await pgDb.pool.query('SELECT COUNT(*) as count FROM properties');
    console.log('Total properties:', total.rows[0].count);
    
    const active = await pgDb.pool.query('SELECT COUNT(*) as count FROM properties WHERE is_active = true');
    console.log('Active properties:', active.rows[0].count);
    
    const withPrice = await pgDb.pool.query('SELECT COUNT(*) as count FROM properties WHERE is_active = true AND sale_price > 0');
    console.log('Properties with sale price > 0:', withPrice.rows[0].count);
    
    const withCoords = await pgDb.pool.query('SELECT COUNT(*) as count FROM properties WHERE is_active = true AND sale_price > 0 AND latitude IS NOT NULL AND longitude IS NOT NULL');
    console.log('Properties with coordinates:', withCoords.rows[0].count);
    
    const withBuildSize = await pgDb.pool.query('SELECT COUNT(*) as count FROM properties WHERE is_active = true AND sale_price > 0 AND latitude IS NOT NULL AND longitude IS NOT NULL AND build_size > 0');
    console.log('Properties with build_size > 0:', withBuildSize.rows[0].count);
    
    // Check specific property types
    console.log('\n📊 Property type breakdown:');
    const types = await pgDb.pool.query(`
      SELECT property_type, COUNT(*) as count 
      FROM properties 
      WHERE is_active = true AND sale_price > 0 AND latitude IS NOT NULL AND longitude IS NOT NULL AND build_size > 0
      GROUP BY property_type 
      ORDER BY count DESC
    `);
    types.rows.forEach(t => console.log(`  ${t.property_type}: ${t.count}`));
    
    // Test simple query without spatial functions
    console.log('\n📊 Testing simple apartment query:');
    const simpleTest = await pgDb.pool.query(`
      SELECT reference, property_type, bedrooms, build_size, sale_price, latitude, longitude
      FROM properties 
      WHERE is_active = true 
        AND sale_price > 0 
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL 
        AND build_size > 0
        AND property_type = 'apartment'
        AND bedrooms = 3
      LIMIT 3
    `);
    console.log('Found matching apartments:', simpleTest.rows.length);
    simpleTest.rows.forEach(p => {
      console.log(`  - ${p.reference}: ${p.bedrooms} beds, ${p.build_size}m², €${p.sale_price}`);
    });
    
  } finally {
    await pgDb.close();
  }
}

debugComparable().catch(console.error); 