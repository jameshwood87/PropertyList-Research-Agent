'use client'

import React, { useState } from 'react'
import { 
  Home, 
  MapPin, 
  Bed, 
  Bath, 
  Square, 
  Calendar, 
  Euro,
  ArrowRight,
  Plus
} from 'lucide-react'
import { fixSpanishCharacters } from '@/lib/utils'

interface PropertyPreviewProps {
  property: {
    address?: string
    city?: string
    province?: string
    propertyType?: string
    bedrooms?: number
    bathrooms?: number
    totalAreaM2?: number
    buildArea?: number
    terraceAreaM2?: number
    price?: number
    yearBuilt?: number
    features?: string[]
    images?: string[]
    description?: string
  }
  onStartAnalysis: (userContext: string) => void
}

export default function PropertyPreview({ property, onStartAnalysis }: PropertyPreviewProps) {
  const [userContext, setUserContext] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleStartAnalysis = () => {
    setIsLoading(true)
    onStartAnalysis(userContext)
  }

  const formatPrice = (price?: number) => {
    if (!price) return 'Price not available'
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price)
  }

  const formatArea = (area?: number) => {
    if (!area) return 'N/A'
    return `${area}m²`
  }

  // Helper function to determine which area fields to show based on property type
  const getAreaFields = () => {
    const propertyType = property.propertyType?.toLowerCase() || ''
    const isVilla = propertyType.includes('villa') || propertyType.includes('house') || propertyType.includes('detached')
    const isApartment = propertyType.includes('apartment') || propertyType.includes('flat') || propertyType.includes('piso')
    
    const fields = []
    
    // Always show bedrooms and bathrooms
    fields.push('bedrooms', 'bathrooms')
    
    // Show plot area only for villas/houses
    if (isVilla) {
      fields.push('plot')
    }
    
    // Always show built area
    fields.push('built')
    
    // Show terrace only if it exists
    if (property.terraceAreaM2) {
      fields.push('terrace')
    }
    
    // Show year built if it exists
    if (property.yearBuilt) {
      fields.push('yearBuilt')
    }
    
    return fields
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Property Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {property.propertyType || 'Property'} in {fixSpanishCharacters(property.city) || 'Location'}
          </h1>
          <div className="flex items-center text-gray-600">
            <MapPin className="w-4 h-4 mr-2" />
            <span>{fixSpanishCharacters(property.address) || 'Address not available'}</span>
            {property.city && property.province && (
              <span className="ml-2">, {fixSpanishCharacters(property.city)}, {fixSpanishCharacters(property.province)}</span>
            )}
          </div>
        </div>
        
        {/* Price */}
        <div className="text-center p-4 bg-[#00ae9a]/10 rounded-lg">
          <div className="text-3xl font-bold text-[#00ae9a]">
            {formatPrice(property.price)}
          </div>
        </div>
      </div>

      {/* Property Image and Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Main Image */}
        <div className="space-y-4">
          {property.images && property.images.length > 0 ? (
            <div className="relative">
              <img
                src={property.images[0]}
                alt="Property"
                className="w-full h-80 object-cover rounded-lg shadow-md"
              />
              {property.images.length > 1 && (
                <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                  +{property.images.length - 1} more
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-80 bg-gray-200 rounded-lg flex items-center justify-center">
              <Home className="w-16 h-16 text-gray-400" />
            </div>
          )}
          
          {/* Description */}
          {property.description && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
              <p className="text-gray-700 leading-relaxed">{fixSpanishCharacters(property.description)}</p>
            </div>
          )}
        </div>

        {/* Property Details */}
        <div className="space-y-6">
          {/* Dynamic Property Details */}
          <div className="grid grid-cols-2 gap-4">
            {getAreaFields().map((field, index) => {
              switch (field) {
                case 'bedrooms':
                  return (
                    <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Bed className="w-5 h-5 text-[#00ae9a] mr-3" />
                      <div>
                        <div className="text-sm text-gray-600">Bedrooms</div>
                        <div className="font-semibold">{property.bedrooms || 'N/A'}</div>
                      </div>
                    </div>
                  )
                case 'bathrooms':
                  return (
                    <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Bath className="w-5 h-5 text-[#00ae9a] mr-3" />
                      <div>
                        <div className="text-sm text-gray-600">Bathrooms</div>
                        <div className="font-semibold">{property.bathrooms || 'N/A'}</div>
                      </div>
                    </div>
                  )
                case 'plot':
                  return (
                    <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Square className="w-5 h-5 text-[#00ae9a] mr-3" />
                      <div>
                        <div className="text-sm text-gray-600">Plot Area</div>
                        <div className="font-semibold">{formatArea(property.totalAreaM2)}</div>
                      </div>
                    </div>
                  )
                case 'built':
                  return (
                    <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Home className="w-5 h-5 text-[#00ae9a] mr-3" />
                      <div>
                        <div className="text-sm text-gray-600">Built Area</div>
                        <div className="font-semibold">{formatArea(property.buildArea)}</div>
                      </div>
                    </div>
                  )
                case 'terrace':
                  return (
                    <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Square className="w-5 h-5 text-[#00ae9a] mr-3" />
                      <div>
                        <div className="text-sm text-gray-600">Terrace</div>
                        <div className="font-semibold">{formatArea(property.terraceAreaM2)}</div>
                      </div>
                    </div>
                  )
                case 'yearBuilt':
                  return (
                    <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Calendar className="w-5 h-5 text-[#00ae9a] mr-3" />
                      <div>
                        <div className="text-sm text-gray-600">Year Built</div>
                        <div className="font-semibold">{property.yearBuilt}</div>
                      </div>
                    </div>
                  )
                default:
                  return null
              }
            })}
          </div>

          {/* Features */}
          {property.features && property.features.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Features</h3>
              <div className="flex flex-wrap gap-2">
                {property.features.slice(0, 8).map((feature, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-[#00ae9a]/10 text-[#00ae9a] rounded-full text-sm"
                  >
                    {fixSpanishCharacters(feature)}
                  </span>
                ))}
                {property.features.length > 8 && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                    +{property.features.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* User Context Input */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <Plus className="w-5 h-5 mr-2 text-[#00ae9a]" />
              Additional Information for Better Analysis
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Add missing details for better analysis (urbanisation, condition, legal issues, etc.)
            </p>
            <textarea
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              placeholder="e.g., Urbanisation name, property condition, legal issues, exact location..."
              className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00ae9a] focus:border-transparent resize-none"
            />
            
            {/* Start Analysis Button */}
            <div className="flex justify-end mt-4">
              <button
                onClick={handleStartAnalysis}
                disabled={isLoading}
                className="inline-flex items-center px-8 py-4 bg-[#00ae9a] text-white font-semibold rounded-lg hover:bg-[#00ae9a]/90 focus:ring-4 focus:ring-[#00ae9a]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Starting Analysis...
                  </>
                ) : (
                              <>
              <ArrowRight className="w-5 h-5 mr-2" />
              Start AI Property Analysis
            </>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
} 
