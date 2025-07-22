'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function PropertyImage({ src, alt, fallback, className, ...props }) {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const handleError = () => {
    console.log('Image failed to load:', src)
    setImageError(true)
    setIsLoading(false)
  }

  const handleLoad = () => {
    setIsLoading(false)
    setImageError(false)
  }

  // If there's no src or image failed to load, show fallback
  if (!src || imageError) {
    return (
      <div className={`${className} flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-200`}>
        {fallback || (
          <div className="text-center text-primary-600">
            <div className="w-12 h-12 bg-primary-200 rounded-lg flex items-center justify-center mx-auto mb-2">
              <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium">Property Image</p>
            <p className="text-xs opacity-70">Loading...</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {isLoading && (
        <div className={`${className} absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center`}>
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onError={handleError}
        onLoad={handleLoad}
        unoptimized={true} // Skip Next.js optimization for external images that might fail
        {...props}
      />
    </>
  )
} 