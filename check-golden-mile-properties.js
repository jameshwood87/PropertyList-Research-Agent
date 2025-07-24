const { Pool } = require('pg');

async function checkProperties() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres:dev_password_123@localhost:5433/propertylist_db'
  });

  try {
    const result = await pool.query(`
      SELECT reference, address, suburb, urbanization 
      FROM properties 
      WHERE reference IN ('R5031994', 'BHHS1044')
    `);
    
    console.log('Properties that shared Golden Mile cache:');
    result.rows.forEach(prop => {
      console.log(`${prop.reference}:`);
      console.log(`  Address: ${prop.address}`);
      console.log(`  Suburb: ${prop.suburb}`); 
      console.log(`  Urbanization: ${prop.urbanization}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkProperties(); 