'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, ExternalLink, Navigation } from 'lucide-react'

export default function PropertyLocationMap({ locationContext, propertyData }) {
  const mapRef = useRef(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [error, setError] = useState(null)

  // Default to Marbella center if no coordinates
  const defaultCoords = { lat: 36.5084, lng: -4.9531 }
  
  // Helper function to get coordinates for known cities/locations
  const getCityCoordinates = (cityName) => {
    const knownCities = {
      'marbella': { lat: 36.5084, lng: -4.9531 },
      'málaga': { lat: 36.7213, lng: -4.4217 },
      'malaga': { lat: 36.7213, lng: -4.4217 },
      'manilva': { lat: 36.3433, lng: -5.2483 },
      'estepona': { lat: 36.4277, lng: -5.1447 },
      'fuengirola': { lat: 36.5397, lng: -4.6262 },
      'benalmádena': { lat: 36.5988, lng: -4.5169 },
      'benalmadena': { lat: 36.5988, lng: -4.5169 },
      'torremolinos': { lat: 36.6201, lng: -4.4998 },
      'puerto banús': { lat: 36.4844, lng: -4.9532 },
      'puerto banus': { lat: 36.4844, lng: -4.9532 },
      'nueva andalucía': { lat: 36.4928, lng: -4.9687 },
      'nueva andalucia': { lat: 36.4928, lng: -4.9687 },
      'san pedro de alcántara': { lat: 36.4856, lng: -5.0139 },
      'san pedro': { lat: 36.4856, lng: -5.0139 },
      'cancelada': { lat: 36.4775, lng: -5.0361 },
      'benahavís': { lat: 36.5167, lng: -5.0167 },
      'benahavis': { lat: 36.5167, lng: -5.0167 }
    };
    
    return knownCities[cityName?.toLowerCase()];
  };
  
  // Use resolved location coordinates with comprehensive fallback logic
  const coordinates = (() => {
    console.log('🗺️ Debug coordinates:', {
      locationContext,
      enhancedLocation: locationContext?.enhancedLocation?.coordinates,
      propertyLatitude: propertyData?.latitude,
      propertyLongitude: propertyData?.longitude,
      propertyCity: propertyData?.city
    });

    // HIGHEST PRIORITY: Use enhanced location coordinates from user input AI processing
    if (locationContext?.enhancedLocation?.coordinates?.lat && locationContext?.enhancedLocation?.coordinates?.lng) {
      console.log('🎯 Using ENHANCED location coordinates from user input:', locationContext.enhancedLocation.coordinates);
      console.log('🏛️ Enhanced method:', locationContext.enhancedLocation.method);
      console.log('📍 User provided:', locationContext.userProvidedEnhancement);
      return locationContext.enhancedLocation.coordinates;
    }

    // First priority: Use coordinates from location intelligence
    if (locationContext?.coordinates?.lat && locationContext?.coordinates?.lng) {
      console.log('🗺️ Using location intelligence coordinates:', locationContext.coordinates);
      return locationContext.coordinates;
    }
    
    // Second priority: Use lat/lng from location intelligence
    if (locationContext?.lat && locationContext?.lng) {
      console.log('🗺️ Using location intelligence lat/lng:', { lat: locationContext.lat, lng: locationContext.lng });
      return { lat: locationContext.lat, lng: locationContext.lng };
    }
    
    // Third priority: Use coordinates directly from property data
    if (propertyData?.latitude && propertyData?.longitude) {
      const propertyCoords = {
        lat: parseFloat(propertyData.latitude),
        lng: parseFloat(propertyData.longitude)
      };
      console.log('🗺️ Using property data coordinates:', propertyCoords);
      return propertyCoords;
    }
    
    // Fourth priority: Try to get city coordinates for known cities
    if (propertyData?.city) {
      const cityCoords = getCityCoordinates(propertyData.city);
      if (cityCoords) {
        console.log('🗺️ Using known city coordinates for:', propertyData.city, cityCoords);
        return cityCoords;
      }
    }
    
    // Fifth priority: Try to get coordinates for resolved location
    if (locationContext?.location) {
      const locationCoords = getCityCoordinates(locationContext.location);
      if (locationCoords) {
        console.log('🗺️ Using known location coordinates for:', locationContext.location, locationCoords);
        return locationCoords;
      }
      console.log('🗺️ Location intelligence found but no coordinates for:', locationContext.location);
    }
    
    // Fallback: Use default Marbella coordinates
    console.log('🗺️ Using default coordinates for:', propertyData?.city || 'Unknown location');
    return defaultCoords;
  })();
  
  const locationName = locationContext?.location || propertyData?.city || 'Property Location'
  const confidence = locationContext?.confidence || 0

  useEffect(() => {
    // Check if Google Maps API key is available
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      setError('Google Maps API key not configured')
      return
    }

    // Load Google Maps script if not already loaded
    if (!window.google) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,geometry`
      script.async = true
      script.defer = true
      script.onload = initializeMap
      script.onerror = () => setError('Failed to load Google Maps')
      document.head.appendChild(script)
    } else {
      initializeMap()
    }
  }, [coordinates])

  const initializeMap = () => {
    if (!mapRef.current || !coordinates) return

    try {
                      const map = new window.google.maps.Map(mapRef.current, {
        center: coordinates,
        zoom: 18,
        mapTypeId: 'hybrid',
        tilt: 45, // Enable 3D view by default
        heading: 0, // Set initial heading for 3D view
        styles: [
          // Custom styling for better visibility
          {
            featureType: 'poi.business',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          },
          {
            featureType: 'transit',
            elementType: 'labels.icon',
            stylers: [{ visibility: 'off' }]
          }
        ],
        // Dynamic controls
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: window.google.maps.MapTypeControlStyle.DROPDOWN_MENU,
          position: window.google.maps.ControlPosition.TOP_RIGHT,
          mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain']
        },
        streetViewControl: true,
        streetViewControlOptions: {
          position: window.google.maps.ControlPosition.TOP_LEFT
        },
        fullscreenControl: true,
        fullscreenControlOptions: {
          position: window.google.maps.ControlPosition.LEFT_CENTER
        },
        zoomControl: true,
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_CENTER
        },
        rotateControl: false, // Remove 3D view toggle button
        gestureHandling: 'auto', // Allow all gestures
        draggable: true,
        scrollwheel: true,
        disableDoubleClickZoom: false
      })

      // Create marker for property location
      const marker = new window.google.maps.Marker({
        position: coordinates,
        map: map,
        title: locationName,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="24" height="30" viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.372 0 0 5.372 0 12c0 9 12 18 12 18s12-9 12-18C24 5.372 18.628 0 12 0z" fill="#059669"/>
              <circle cx="12" cy="12" r="5" fill="white"/>
              <circle cx="12" cy="12" r="2.5" fill="#059669"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(24, 30),
          anchor: new window.google.maps.Point(12, 30)
        }
      })

      // Create info window with resolved location info
                        const methodText = locationContext?.method?.replace('_', ' ') || 'direct';
                  const resolvedLocationText = locationContext?.location ? 
                    `${locationContext.location} (${methodText})` : 
                    locationName;
        
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 10px; max-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #1f2937;">
              ${resolvedLocationText}
            </h3>
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">
              ${propertyData?.property_type || 'Property'} • ${propertyData?.bedrooms || 0} bed • ${propertyData?.bathrooms || 0} bath
            </p>
            ${confidence > 0 ? `
              <div style="margin-top: 8px; padding: 4px 8px; background: #10b981; color: white; border-radius: 4px; font-size: 11px;">
                📍 ${(confidence * 100).toFixed(0)}% location confidence
              </div>
            ` : ''}
            <div style="margin-top: 6px; font-size: 10px; color: #9ca3af;">
              Lat: ${coordinates.lat.toFixed(4)}, Lng: ${coordinates.lng.toFixed(4)}
            </div>
          </div>
        `
      })

      // Open info window on marker click
      marker.addListener('click', () => {
        infoWindow.open(map, marker)
      })

      // Add map event listeners for dynamic interaction
      map.addListener('zoom_changed', () => {
        console.log('Map zoom changed to:', map.getZoom())
      })

      map.addListener('center_changed', () => {
        const center = map.getCenter()
        console.log('Map center changed to:', center.lat(), center.lng())
      })

      // Add nearby places search (dynamic content)
      const placesService = new window.google.maps.places.PlacesService(map)
      
      // Search for nearby amenities
      const nearbyRequest = {
        location: coordinates,
        radius: 1000, // 1km radius
        types: ['restaurant', 'school', 'hospital', 'shopping_mall', 'bank', 'pharmacy']
      }

      placesService.nearbySearch(nearbyRequest, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          // Add markers for nearby places (first 5)
          results.slice(0, 5).forEach((place, index) => {
            const placeMarker = new window.google.maps.Marker({
              position: place.geometry.location,
              map: map,
              title: place.name,
              icon: {
                url: place.icon,
                scaledSize: new window.google.maps.Size(20, 20),
                anchor: new window.google.maps.Point(10, 10)
              }
            })

            // Info window for places
            const placeInfoWindow = new window.google.maps.InfoWindow({
              content: `
                <div style="padding: 8px; max-width: 150px;">
                  <h4 style="margin: 0 0 4px 0; font-size: 12px; font-weight: bold;">${place.name}</h4>
                  <p style="margin: 0; font-size: 10px; color: #666;">${place.types[0].replace(/_/g, ' ')}</p>
                  <p style="margin: 4px 0 0 0; font-size: 10px;">Rating: ${place.rating || 'N/A'} ⭐</p>
                </div>
              `
            })

            placeMarker.addListener('click', () => {
              placeInfoWindow.open(map, placeMarker)
            })
          })
        }
      })



      setMapLoaded(true)
    } catch (err) {
      console.error('Error initializing map:', err)
      setError('Failed to initialize map')
    }
  }

  const openInGoogleMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`
    window.open(url, '_blank')
  }

  const getDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat},${coordinates.lng}`
    window.open(url, '_blank')
  }

  if (error) {
    return (
      <div className="h-64 lg:h-full bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg flex flex-col items-center justify-center border border-emerald-200 p-6">
        <div className="text-center">
          <MapPin className="w-12 h-12 mx-auto mb-3 text-emerald-600" />
          <h3 className="font-semibold text-gray-900 mb-2">{locationName}</h3>
          
          {/* Location Details */}
          <div className="space-y-2 text-sm text-gray-600 mb-4">
            {locationContext?.urbanization && (
              <p>📍 {locationContext.urbanization}</p>
            )}
            {locationContext?.city && (
              <p>🏙️ {locationContext.city}</p>
            )}
            {coordinates && (
              <p>🌍 {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}</p>
            )}
            {confidence > 0 && (
              <p className="text-xs">
                📊 {(confidence * 100).toFixed(0)}% location confidence
              </p>
            )}
          </div>
          
          {/* External Map Links */}
          {coordinates && (
            <div className="flex gap-2 justify-center">
              <button
                onClick={openInGoogleMaps}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1.5 rounded text-xs transition-colors duration-200 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                View on Google Maps
              </button>
              <button
                onClick={getDirections}
                className="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1.5 rounded text-xs transition-colors duration-200 flex items-center gap-1"
              >
                <Navigation className="w-3 h-3" />
                Directions
              </button>
            </div>
          )}
          
          <p className="text-xs text-gray-500 mt-3">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-64 lg:h-full rounded-lg overflow-hidden relative group">

      {/* Map Container */}
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Loading State */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm">Loading map...</p>
          </div>
        </div>
      )}

      {/* Map Overlay Controls */}
      {mapLoaded && (
        <div className="absolute top-3 right-3 space-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={openInGoogleMaps}
            className="bg-white/90 backdrop-blur-sm hover:bg-white shadow-lg rounded p-1.5 transition-all duration-200 hover:scale-105"
            title="Open in Google Maps"
          >
            <ExternalLink className="w-3.5 h-3.5 text-gray-700" />
          </button>
          <button
            onClick={getDirections}
            className="bg-white/90 backdrop-blur-sm hover:bg-white shadow-lg rounded p-1.5 transition-all duration-200 hover:scale-105"
            title="Get Directions"
          >
            <Navigation className="w-3.5 h-3.5 text-gray-700" />
          </button>
        </div>
      )}

      {/* Location Info Overlay */}
      {mapLoaded && (
        <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-3 shadow-lg">
          <div className="flex items-start space-x-2">
            <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900 text-sm leading-tight">
                {locationName}
              </h4>
              {locationContext?.method && (
                <p className="text-xs text-gray-600 mt-1">
                  Via {locationContext.method.replace('user_input_ai', 'User Input AI').replace('_', ' ')}
                  {confidence > 0 && `• ${(confidence * 100).toFixed(0)}% confidence`}
                </p>
              )}
              {locationContext?.urbanization && locationContext.urbanization !== locationName && (
                <p className="text-xs text-gray-500 mt-1">
                  {locationContext.urbanization}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 