import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const propertyData = await request.json();
    
    // Generate session ID
    const sessionId = uuidv4();
    
    // For initial deployment, we'll create a basic session response
    // Later we can integrate with full backend services
    const sessionResponse = {
      success: true,
      sessionId,
      sessionUrl: `${process.env.VERCEL_URL || 'http://localhost:3000'}/analysis/${sessionId}`,
      message: 'Property data received and session created successfully',
      propertyData: {
        reference: propertyData.reference || 'VERCEL-001',
        property_type: propertyData.property_type || 'Villa',
        city: propertyData.city || 'Marbella',
        bedrooms: propertyData.bedrooms || 3,
        sale_price: propertyData.sale_price || 500000,
        status: 'ready'
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(sessionResponse);
  } catch (error) {
    console.error('Property submission error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create property session',
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Property API endpoint - use POST to submit property data',
    endpoints: {
      'POST /api/property': 'Submit property for analysis',
      'GET /api/health': 'Health check'
    }
  });
} 