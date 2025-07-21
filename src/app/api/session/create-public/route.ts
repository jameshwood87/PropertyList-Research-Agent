import { NextRequest, NextResponse } from 'next/server'

// In-memory session storage for public sessions
const publicSessionStorage = new Map<string, any>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, property, previewOnly = false } = body

    if (!sessionId || !property) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId and property' },
        { status: 400 }
      )
    }

    // Create session data
    const sessionData = {
      sessionId,
      status: previewOnly ? 'completed' : 'pending',
      completedSteps: previewOnly ? 7 : 0,
      totalSteps: 7,
      currentStep: previewOnly ? 7 : 1,
      lastUpdated: new Date().toISOString(),
      property: property,
      ...(previewOnly && {
        report: {
          propertyData: property,
          summary: {
            title: `${property.propertyType} in ${property.city}`,
            description: `Beautiful ${property.propertyType} in ${property.city} with ${property.bedrooms} bedrooms and ${property.bathrooms} bathrooms.`,
            keyFeatures: [
              `${property.bedrooms} bedrooms and ${property.bathrooms} bathrooms`,
              `${property.buildArea}m² build area`,
              property.plotArea ? `${property.plotArea}m² plot area` : null,
              `Premium location in ${property.city}`
            ].filter(Boolean)
          },
          comparableProperties: [
            {
              address: `${property.address.replace(/\d+$/, '')}12`,
              price: Math.round(property.price * 0.95),
              bedrooms: property.bedrooms,
              bathrooms: property.bathrooms,
              buildArea: Math.round(property.buildArea * 0.96),
              pricePerM2: Math.round((property.price * 0.95) / (property.buildArea * 0.96))
            },
            {
              address: `${property.address.replace(/\d+$/, '')}18`,
              price: Math.round(property.price * 1.05),
              bedrooms: property.bedrooms,
              bathrooms: property.bathrooms,
              buildArea: Math.round(property.buildArea * 1.04),
              pricePerM2: Math.round((property.price * 1.05) / (property.buildArea * 1.04))
            }
          ],
          nearbyAmenities: [
            { name: 'Beach', distance: '0.5km', type: 'leisure' },
            { name: 'Restaurant', distance: '0.2km', type: 'dining' },
            { name: 'Supermarket', distance: '0.8km', type: 'shopping' }
          ],
          valuationEstimate: {
            estimatedValue: property.price,
            confidence: 'High',
            factors: ['Location premium', 'Property condition', 'Market trends']
          }
        },
        qualityScore: 95,
        criticalErrors: 0
      })
    }

    // Store in public session storage
    publicSessionStorage.set(sessionId, sessionData)

    return NextResponse.json({
      success: true,
      sessionId,
      status: sessionData.status,
      message: previewOnly ? 'Preview session created successfully' : 'Session created successfully'
    })

  } catch (error) {
    console.error('Error creating public session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}

// Make public session storage globally accessible
if (typeof globalThis !== 'undefined') {
  (globalThis as any).publicSessionStorage = publicSessionStorage
} 