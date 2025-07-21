'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Image as ImageIcon } from 'lucide-react'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  style?: React.CSSProperties
  placeholder?: React.ReactNode
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
  onClick?: () => void
  priority?: boolean // For above-the-fold images
}

export default function LazyImage({
  src,
  alt,
  className = '',
  style = {},
  placeholder,
  onLoad,
  onError,
  onClick,
  priority = false
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const [hasError, setHasError] = useState(false)
  const [loadTime, setLoadTime] = useState<number | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadStartTime = useRef<number | null>(null)

  useEffect(() => {
    // If priority is true, load immediately
    if (priority) {
      setIsInView(true)
      return
    }

    // Create intersection observer for lazy loading
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            // Once in view, disconnect the observer
            if (observerRef.current) {
              observerRef.current.disconnect()
            }
          }
        })
      },
      {
        rootMargin: '50px 0px', // Start loading 50px before the image comes into view
        threshold: 0.1
      }
    )

    // Start observing the image element
    if (imgRef.current) {
      observerRef.current.observe(imgRef.current)
    }

    // Cleanup observer on unmount
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [priority])

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const endTime = performance.now()
    const loadDuration = loadStartTime.current ? endTime - loadStartTime.current : null
    
    setIsLoaded(true)
    setHasError(false)
    setLoadTime(loadDuration)
    
    // Log performance metrics in development
    if (process.env.NODE_ENV === 'development' && loadDuration) {
      console.log(`🖼️ LazyImage loaded in ${loadDuration.toFixed(2)}ms:`, src)
    }
    
    onLoad?.(e)
  }

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true)
    setIsLoaded(false)
    
    // Only log non-placeholder URLs in development
    if (process.env.NODE_ENV === 'development' && 
        !src.includes('example.com') && 
        !src.includes('placeholder') &&
        !src.includes('dummy')) {
      console.warn(`⚠️ Image failed to load: ${src}`)
    }
    
    onError?.(e)
  }

  // Start timing when image is set to load
  useEffect(() => {
    if (isInView && !hasError) {
      loadStartTime.current = performance.now()
    }
  }, [isInView, hasError])

  // Default placeholder
  const defaultPlaceholder = (
    <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
      <ImageIcon className="w-6 h-6 text-gray-400" />
    </div>
  )

  // Error placeholder
  const errorPlaceholder = (
    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
      <div className="text-center text-gray-500">
        <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">Property Image</p>
        <p className="text-xs text-gray-400">Image not available</p>
      </div>
    </div>
  )

  return (
    <div 
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={style}
      onClick={onClick}
    >
      {/* Show placeholder while loading or if not in view */}
      {(!isInView || (!isLoaded && !hasError)) && (
        <div className="absolute inset-0 z-10">
          {placeholder || defaultPlaceholder}
        </div>
      )}

      {/* Show error placeholder if image failed to load or URL is invalid */}
      {(hasError || (src && src.includes('example.com'))) && (
        <div className="absolute inset-0 z-20">
          {errorPlaceholder}
        </div>
      )}

      {/* Actual image - only render when in view and URL is valid */}
      {isInView && !hasError && src && !src.includes('example.com') && (
        <img
          src={src}
          alt={alt}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          style={style}
          onLoad={handleLoad}
          onError={handleError}
          loading={priority ? 'eager' : 'lazy'}
        />
      )}
    </div>
  )
}

// Specialized components for common use cases
export function LazyPropertyImage({
  src,
  alt,
  className = '',
  style = {},
  onClick,
  priority = false
}: {
  src: string
  alt: string
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
  priority?: boolean
}) {
  // Property-specific placeholder
  const propertyPlaceholder = (
    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse flex items-center justify-center">
      <div className="text-center text-gray-500">
        <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">Loading property image...</p>
      </div>
    </div>
  )

  // Use the default export directly
  return React.createElement(LazyImage, {
    src,
    alt,
    className,
    style,
    placeholder: propertyPlaceholder,
    onClick,
    priority
  })
}

export function LazyComparableImage({
  src,
  alt,
  className = '',
  style = {},
  onClick
}: {
  src: string
  alt: string
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}) {
  // Comparable-specific placeholder
  const comparablePlaceholder = (
    <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
      <ImageIcon className="w-4 h-4 text-gray-400" />
    </div>
  )

  return React.createElement(LazyImage, {
    src,
    alt,
    className,
    style,
    placeholder: comparablePlaceholder,
    onClick,
    priority: false
  })
}

export function LazyGalleryImage({
  src,
  alt,
  className = '',
  style = {},
  onClick
}: {
  src: string
  alt: string
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}) {
  // Gallery-specific placeholder
  const galleryPlaceholder = (
    <div className="w-full h-full bg-gray-800 animate-pulse flex items-center justify-center">
      <div className="text-center text-gray-400">
        <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Loading gallery image...</p>
      </div>
    </div>
  )

  return React.createElement(LazyImage, {
    src,
    alt,
    className,
    style,
    placeholder: galleryPlaceholder,
    onClick,
    priority: false
  })
} 