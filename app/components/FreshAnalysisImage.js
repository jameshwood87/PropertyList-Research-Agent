'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function FreshAnalysisImage({ 
  src, 
  alt, 
  className, 
  fallback, 
  showSource = false,
  imageData = null,
  ...props 
}) {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const handleError = () => {
    console.log('Fresh analysis image failed to load:', src?.substring(0, 50) + '...')
    setImageError(true)
    setIsLoading(false)
  }

  const handleLoad = () => {
    setIsLoading(false)
    setImageError(false)
  }

  // Determine if this is a Base64 data URI
  const isBase64 = src?.startsWith('data:image/')
  
  // Get image metadata if available
  const imageSize = imageData?.size || (isBase64 ? 'Optimized' : 'Standard')
  const imageSource = isBase64 ? 'Fresh PropertyList API' : 'Database Cache'

  // If there's no src or image failed to load, show fallback
  if (!src || imageError) {
    return (
      <div className={`${className} flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg`}>
        {fallback || (
          <div className="text-center text-gray-500">
            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center mx-auto mb-2">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium">Property Image</p>
            <p className="text-xs opacity-70">
              {imageError ? 'Failed to load' : 'Loading...'}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className={`${className} absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center rounded-lg z-10`}>
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin"></div>
        </div>
      )}
      
      <Image
        src={src}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300 rounded-lg`}
        onError={handleError}
        onLoad={handleLoad}
        unoptimized={true} // Skip Next.js optimization for Base64 and external images
        {...props}
      />
      
      {/* Source indicator */}
      {showSource && !isLoading && !imageError && (
        <div className="absolute top-2 right-2 z-20">
          <div className={`px-2 py-1 rounded-full text-xs font-medium shadow-lg ${
            isBase64 
              ? 'bg-emerald-500 text-white' 
              : 'bg-blue-500 text-white'
          }`}>
            {isBase64 ? '🔄 Fresh' : '💾 Cache'}
          </div>
        </div>
      )}
      
      {/* Image metadata */}
      {showSource && imageData && !isLoading && !imageError && (
        <div className="absolute bottom-2 left-2 right-2 z-20">
          <div className="bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
            <div className="flex justify-between items-center">
              <span>{imageSource}</span>
              <span>{imageSize}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 