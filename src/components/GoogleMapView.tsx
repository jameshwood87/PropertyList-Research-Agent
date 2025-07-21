'use client'

import { useEffect, useState } from 'react'
import { GoogleMap, Marker, LoadScript } from '@react-google-maps/api'
import { Amenity } from '@/types'

interface GoogleMapViewProps {
  center: [number, number]
  amenities: Amenity[]
  layers: {
    schools: boolean
    shopping: boolean
    transport: boolean
    healthcare: boolean
    recreation: boolean
    dining: boolean
    entertainment: boolean
    zoo: boolean
    waterpark: boolean
    cinema: boolean
    casino: boolean
    museum: boolean
    golf: boolean
    beach: boolean
  }
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
}

const mapOptions = {
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ]
}

export default function GoogleMapView({ center, amenities, layers }: GoogleMapViewProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return (
      <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-gray-500">Loading map...</div>
      </div>
    )
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return (
      <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 mb-2">📍 Property Location</div>
          <div className="text-sm text-gray-400">
            {center[0].toFixed(6)}, {center[1].toFixed(6)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Google Maps API key not configured
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-64 w-full rounded-lg overflow-hidden shadow-lg">
      <LoadScript googleMapsApiKey={apiKey} libraries={['places']}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={{ lat: center[0], lng: center[1] }}
          zoom={14}
          options={mapOptions}
        >
          <Marker
            position={{ lat: center[0], lng: center[1] }}
            title="Property Location"
            icon={{
              path: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
              fillColor: '#00ae9a',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 2
            }}
          />
        </GoogleMap>
      </LoadScript>
    </div>
  )
} 