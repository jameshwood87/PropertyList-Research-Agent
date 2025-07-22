'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function PropertyDisplay({ propertyData }) {
  const [selectedImage, setSelectedImage] = useState(0)

  if (!propertyData) {
    return (
      <div className="card">
        <p className="text-gray-500">No property data available</p>
      </div>
    )
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const getPropertyType = (type) => {
    const types = {
      0: 'Apartment',
      1: 'House',
      2: 'Villa',
      3: 'Penthouse',
      4: 'Studio',
      5: 'Townhouse'
    }
    return types[type] || 'Unknown'
  }

  const getEnergyRatingColor = (rating) => {
    const colors = {
      'A': 'text-green-600 bg-green-100',
      'B': 'text-blue-600 bg-blue-100',
      'C': 'text-yellow-600 bg-yellow-100',
      'D': 'text-orange-600 bg-orange-100',
      'E': 'text-red-600 bg-red-100',
      'F': 'text-red-700 bg-red-200',
      'G': 'text-red-800 bg-red-300'
    }
    return colors[rating] || 'text-gray-600 bg-gray-100'
  }

  return (
    <div className="space-y-6">
      {/* Property Images */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Property Images</h2>
        {propertyData.images && propertyData.images.length > 0 ? (
          <div className="space-y-4">
            <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <Image
                src={propertyData.images[selectedImage]?.medium || propertyData.images[selectedImage]?.small}
                alt={`Property image ${selectedImage + 1}`}
                fill
                className="object-cover"
              />
            </div>
            {propertyData.images.length > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {propertyData.images.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setSelectedImage(index)}
                    className={`relative aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 ${
                      selectedImage === index ? 'border-primary-500' : 'border-transparent'
                    }`}
                  >
                    <Image
                      src={image.small}
                      alt={`Property thumbnail ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">No images available</p>
          </div>
        )}
      </div>

      {/* Property Details */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Property Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Reference</p>
            <p className="text-lg font-semibold text-gray-900">{propertyData.reference}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Type</p>
            <p className="text-lg font-semibold text-gray-900">{getPropertyType(propertyData.property_type)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Price</p>
            <p className="text-lg font-semibold text-primary-500">{formatPrice(propertyData.price)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Status</p>
            <p className="text-lg font-semibold text-gray-900">
              {propertyData.is_sale ? 'For Sale' : 'For Rent'}
            </p>
          </div>
        </div>
      </div>

      {/* Property Specifications */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Specifications</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-500">Bedrooms:</span>
            <span className="text-lg font-semibold text-gray-900">{propertyData.bedrooms}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-500">Bathrooms:</span>
            <span className="text-lg font-semibold text-gray-900">{propertyData.bathrooms}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-500">Build Area:</span>
            <span className="text-lg font-semibold text-gray-900">{propertyData.build_square_meters}m²</span>
          </div>
          {propertyData.plot_square_meters && (
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-500">Plot Area:</span>
              <span className="text-lg font-semibold text-gray-900">{propertyData.plot_square_meters}m²</span>
            </div>
          )}
          {propertyData.terrace_square_meters && (
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-500">Terrace:</span>
              <span className="text-lg font-semibold text-gray-900">{propertyData.terrace_square_meters}m²</span>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-500">Parking:</span>
            <span className="text-lg font-semibold text-gray-900">{propertyData.parking_spaces} spaces</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-500">Floor:</span>
            <span className="text-lg font-semibold text-gray-900">{propertyData.floor_number}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-500">Furnished:</span>
            <span className="text-lg font-semibold text-gray-900">{propertyData.furnished ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      {/* Costs and Ratings */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Costs & Ratings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Energy Rating</span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getEnergyRatingColor(propertyData.energy_rating)}`}>
              {propertyData.energy_rating}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">IBI (Annual)</span>
            <span className="text-lg font-semibold text-gray-900">{formatPrice(propertyData.ibi)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Basura (Annual)</span>
            <span className="text-lg font-semibold text-gray-900">{formatPrice(propertyData.basura)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Community Fees (Monthly)</span>
            <span className="text-lg font-semibold text-gray-900">{formatPrice(propertyData.community_fees)}</span>
          </div>
        </div>
      </div>
    </div>
  )
} 