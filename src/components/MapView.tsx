'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Amenity } from '@/types'

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

interface MapViewProps {
  center: [number, number]
  amenities: Amenity[]
  layers: {
    schools: boolean
    shopping: boolean
    transport: boolean
    healthcare: boolean
    recreation: boolean
    dining: boolean
  }
}

// Custom icons for different amenity types
const createIcon = (color: string, emoji: string) => {
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 14px;">${emoji}</div>`,
    className: 'custom-div-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  })
}

const amenityIcons = {
  school: createIcon('#3B82F6', '🏫'),
  shopping: createIcon('#EF4444', '🛍️'),
  transport: createIcon('#8B5CF6', '🚊'),
  healthcare: createIcon('#10B981', '🏥'),
  recreation: createIcon('#F59E0B', '🏞️'),
  dining: createIcon('#EC4899', '🍽️')
}

const propertyIcon = createIcon('#00ae9a', '🏠')

export default function MapView({ center, amenities, layers }: MapViewProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
  }

  const filteredAmenities = amenities.filter(amenity => 
    layers[amenity.type as keyof typeof layers]
  )

  return (
    <div className="h-64 w-full rounded-lg overflow-hidden shadow-lg">
      <MapContainer 
        center={center} 
        zoom={14} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Property marker */}
        <Marker position={center} icon={propertyIcon}>
          <Popup>
            <div className="text-center">
              <strong>Property Location</strong>
            </div>
          </Popup>
        </Marker>

        {/* Amenity markers */}
        {filteredAmenities.map((amenity, index) => {
          // Use real coordinates if available, otherwise generate consistent demo coordinates
          let lat, lng
          
          if (amenity.coordinates) {
            lat = amenity.coordinates.lat
            lng = amenity.coordinates.lng
          } else {
            // Fallback to consistent demo coordinates for amenities without real coords
            const hash = amenity.name.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)
            const normalizedHash = Math.abs(hash) / 2147483647 // Normalize to 0-1
            const angle = normalizedHash * 2 * Math.PI // Convert to angle
            const distance = 0.01 + (normalizedHash * 0.01) // Distance between 0.01 and 0.02
            lat = center[0] + Math.cos(angle) * distance
            lng = center[1] + Math.sin(angle) * distance
          }
          
          return (
            <Marker 
              key={index} 
              position={[lat, lng]} 
              icon={amenityIcons[amenity.type as keyof typeof amenityIcons]}
            >
              <Popup>
                <div>
                  <strong>{amenity.name}</strong>
                  <p className="text-sm text-gray-600">{amenity.description}</p>
                  <p className="text-sm">
                    📍 {(amenity.distance * 1.60934).toFixed(2)}km
                    {amenity.rating && (
                      <span className="ml-2">⭐ {amenity.rating}</span>
                    )}
                  </p>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
} 