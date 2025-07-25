'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'

export default function PropertyDisplay({ propertyData }) {
  const [selectedImage, setSelectedImage] = useState(0)
  const params = useParams()
  const sessionId = params?.sessionId

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

  const getConditionColor = (condition) => {
    const colors = {
      'excellent': 'text-emerald-700 bg-emerald-100',
      'very-good': 'text-green-700 bg-green-100', 
      'good': 'text-blue-600 bg-blue-100',
      'fair': 'text-yellow-600 bg-yellow-100',
      'needs-renovation': 'text-orange-600 bg-orange-100',
      'poor': 'text-red-600 bg-red-100'
    }
    return colors[condition?.toLowerCase()] || 'text-gray-600 bg-gray-100'
  }

  const getPropertyCondition = () => {
    // Use coded condition_rating if available
    if (propertyData.condition_rating && propertyData.condition_rating !== '') {
      return { rating: propertyData.condition_rating, specific: null }
    }

    // AI inference from description and features
    const description = propertyData.descriptions?.en || propertyData.descriptions?.es || ''
    const features = propertyData.features || []
    
    // Specific keywords with their display names - ORDERED BY SPECIFICITY (longest matches first)
    const conditionKeywords = {
      // CRITICAL FIX: Renovation-related keywords FIRST to prevent misclassification
      'renovation villa project': { rating: 'needs-renovation', display: 'Renovation Villa Project' },
      'renovation project': { rating: 'needs-renovation', display: 'Renovation Project' },
      'restoration project': { rating: 'needs-renovation', display: 'Restoration Project' },
      'investment opportunity': { rating: 'needs-renovation', display: 'Investment Opportunity' },
      'needs renovation': { rating: 'needs-renovation', display: 'Needs Renovation' },
      'needs work': { rating: 'needs-renovation', display: 'Needs Work' },
      'fixer upper': { rating: 'needs-renovation', display: 'Fixer Upper' },
      'potential': { rating: 'needs-renovation', display: 'Has Potential' },

      // Excellent conditions with specific labels
      'newly renovated': { rating: 'excellent', display: 'Newly Renovated' },
      'newly built': { rating: 'excellent', display: 'Newly Built' },
      'new development project': { rating: 'excellent', display: 'New Development' },
      'development project': { rating: 'excellent', display: 'New Development' },
      'new development': { rating: 'excellent', display: 'New Development' },
      'new construction': { rating: 'excellent', display: 'New Construction' },
      'recién renovado': { rating: 'excellent', display: 'Newly Renovated' },
      'recién construido': { rating: 'excellent', display: 'Newly Built' },
      'proyecto de desarrollo': { rating: 'excellent', display: 'New Development' },
      'nueva construcción': { rating: 'excellent', display: 'New Construction' },
      'obra nueva': { rating: 'excellent', display: 'New Construction' },
      'renovated': { rating: 'excellent', display: 'Renovated' },
      'refurbished': { rating: 'excellent', display: 'Refurbished' },
      'luxury': { rating: 'excellent', display: 'Luxury Property' },
      'pristine': { rating: 'excellent', display: 'Pristine Condition' },
      'immaculate': { rating: 'excellent', display: 'Immaculate' },
      'brand new': { rating: 'excellent', display: 'Brand New' },
      'state-of-the-art': { rating: 'excellent', display: 'State-of-the-Art' },
      'designer': { rating: 'excellent', display: 'Designer Property' },
      'impecable': { rating: 'excellent', display: 'Immaculate' },
      'perfectas condiciones': { rating: 'excellent', display: 'Perfect Condition' },
      'estrenar': { rating: 'excellent', display: 'Brand New' },
      
      // Good conditions
      'well-maintained': { rating: 'good', display: 'Well Maintained' },
      'good condition': { rating: 'good', display: 'Good Condition' },
      'maintained': { rating: 'good', display: 'Well Maintained' },
      'updated': { rating: 'good', display: 'Updated' },
      'recently updated': { rating: 'good', display: 'Recently Updated' },
      
      // Fair conditions
      'original': { rating: 'fair', display: 'Original Condition' },
      'traditional': { rating: 'fair', display: 'Traditional Style' },
      'classic': { rating: 'fair', display: 'Classic Property' }
    }

    const desc = description.toLowerCase()
    
    // IMPROVED: Sort keywords by length (longest first) to ensure most specific matches win
    const sortedKeywords = Object.entries(conditionKeywords).sort((a, b) => b[0].length - a[0].length)
    
    // Find the first (most specific) matching keyword
    for (const [keyword, info] of sortedKeywords) {
      if (desc.includes(keyword.toLowerCase())) {
        console.log(`🏠 Detected condition keyword: "${keyword}" → ${info.rating} (${info.display})`)
        return { rating: info.rating, specific: info.display }
      }
    }

    // Default based on property age and features
    const modernFeatures = features.filter(f => 
      f.includes('air-conditioning') || 
      f.includes('modern') || 
      f.includes('updated')
    ).length

    return { 
      rating: modernFeatures > 0 ? 'good' : 'fair', 
      specific: modernFeatures > 0 ? 'Good Condition' : 'Standard Condition'
    }
  }

  const formatCondition = (conditionData) => {
    // Show specific condition if available, otherwise generic rating
    if (conditionData.specific) {
      return conditionData.specific
    }
    
    const formatted = {
      'excellent': 'Excellent',
      'very-good': 'Very Good',
      'good': 'Good', 
      'fair': 'Fair',
      'needs-renovation': 'Needs Renovation',
      'poor': 'Poor'
    }
    return formatted[conditionData.rating?.toLowerCase()] || 'Unknown'
  }

  // Auto-update backend when AI detects condition from description
  useEffect(() => {
    const updateConditionIfDetected = async () => {
      if (!sessionId || !propertyData) return;
      
      // Get the AI-detected condition
      const detectedCondition = getPropertyCondition();
      
      // Only update if:
      // 1. We detected a specific condition from description (not default)
      // 2. The stored condition_rating is null/empty
      // 3. We found a specific condition (has .specific property)
      if (detectedCondition.specific && 
          (!propertyData.condition_rating || propertyData.condition_rating === '') &&
          detectedCondition.rating !== 'fair' && detectedCondition.rating !== 'good') {
        
        try {
          console.log(`🏠 Auto-updating backend with detected condition: ${detectedCondition.rating}`);
          
          const response = await fetch(`/api/property/${sessionId}/condition`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              condition: detectedCondition.rating,
              confidence: 8, // High confidence for keyword-based detection
              source: 'frontend_description_analysis'
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log(`✅ Backend condition updated:`, result);
          } else {
            console.error('❌ Failed to update backend condition:', response.statusText);
          }
        } catch (error) {
          console.error('❌ Error updating backend condition:', error);
        }
      }
    };
    
    // Run after component mounts and data is available
    if (propertyData) {
      setTimeout(updateConditionIfDetected, 1000); // Small delay to ensure everything is loaded
    }
  }, [sessionId, propertyData?.condition_rating, propertyData?.descriptions]);

  return (
    <div className="space-y-6">
      {/* Property Images */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Property Images</h2>
        {propertyData.images && propertyData.images.length > 0 ? (
          <div className="space-y-4">
            <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden min-h-[300px]">
              <Image
                key={`main-image-${selectedImage}`}
                src={typeof propertyData.images[selectedImage] === 'string' ? propertyData.images[selectedImage] : (propertyData.images[selectedImage]?.medium || propertyData.images[selectedImage]?.small)}
                alt={`Property image ${selectedImage + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
            {propertyData.images.length > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {propertyData.images.map((image, index) => (
                  <button
                    key={image.id || `image-${index}`}
                    onClick={() => setSelectedImage(index)}
                    className={`relative aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 min-h-[80px] ${
                      selectedImage === index ? 'border-primary-500' : 'border-transparent'
                    }`}
                  >
                    <Image
                      key={`thumb-${index}`}
                      src={typeof image === 'string' ? image : (image.small || image.medium)}
                      alt={`Property thumbnail ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="150px"
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
        
        {/* Property Condition - Prominently displayed */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Property Condition</span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getConditionColor(getPropertyCondition().rating)}`}>
              {formatCondition(getPropertyCondition())}
            </span>
          </div>
          {propertyData.descriptions?.en && propertyData.descriptions.en.toUpperCase().includes('RENOVATION') && (
            <p className="text-xs text-gray-500 mt-1 text-right">Based on property description analysis</p>
          )}
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
            <span className="text-sm font-medium text-gray-500">Condition</span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getConditionColor(getPropertyCondition().rating)}`}>
              {formatCondition(getPropertyCondition())}
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